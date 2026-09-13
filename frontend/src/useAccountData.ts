import { useCallback, useEffect, useState } from 'react'
import {
  fetchDemoAccount,
  fetchLeaks,
  fetchPurchases,
  fetchRisk,
  fetchSpendingBreakdown,
  setFrozen,
  type DemoAccount,
  type LeaksResult,
  type Purchase,
  type RiskResult,
  type SpendingBreakdown,
} from './api'

// Static example numbers used when the backend isn't reachable -- keeps the
// app showing "modo de ejemplo" content instead of going blank.
const FALLBACK_ACCOUNT: DemoAccount = {
  customer_id: 'demo',
  account_id: 'demo',
  first_name: 'Maria',
  last_name: 'Hopper',
  nickname: 'Checking',
  balance: 1428.53,
  mask: '4471',
  frozen: false,
}

const FALLBACK_RISK: RiskResult = {
  account_id: 'demo',
  score: 97,
  flagged: true,
  unusual_categories: ['Electrónica', 'Joyería', 'Tarjetas de regalo'],
  explanation:
    '4 categorías inusuales en 22 minutos. Esta cuenta normalmente compra en Groceries y Gas — no suele tocar Electrónica, Joyería o Tarjetas de regalo.',
  sequence: [
    { category: 'Gas', rarity: 0.72, unusual: true, typical_frequency_pct: 28 },
    { category: 'Electrónica', rarity: 1, unusual: true, typical_frequency_pct: 0 },
    { category: 'Joyería', rarity: 1, unusual: true, typical_frequency_pct: 0 },
    { category: 'Tarjetas de regalo', rarity: 1, unusual: true, typical_frequency_pct: 0 },
  ],
}

const FALLBACK_SPENDING: SpendingBreakdown = {
  account_id: 'demo',
  total: 574.97,
  breakdown: [
    { category: 'Groceries', amount: 288, percent: 50 },
    { category: 'Gas', amount: 170, percent: 30 },
    { category: 'Coffee Shops', amount: 69, percent: 12 },
    { category: 'Streaming Services', amount: 47.97, percent: 8 },
  ],
}

const FALLBACK_LEAKS: LeaksResult = {
  account_id: 'demo',
  leaks: [{ category: 'Streaming Services', amount: 15.99, count: 3 }],
}

const FALLBACK_PURCHASES: Purchase[] = [
  { merchant_id: 'm1', amount: 62.1, purchase_date: '2026-09-08', category: 'Groceries', merchant_name: 'Fresh Market Groceries' },
  { merchant_id: 'm2', amount: 41.3, purchase_date: '2026-09-09', category: 'Gas', merchant_name: 'QuickFuel Gas Station' },
  { merchant_id: 'm3', amount: 389, purchase_date: '2026-09-12', category: 'Electrónica', merchant_name: 'ElectroMax Outlet' },
  { merchant_id: 'm4', amount: 5.75, purchase_date: '2026-09-07', category: 'Coffee Shops', merchant_name: 'Corner Coffee Shop' },
]

export interface AccountData {
  account: DemoAccount
  risk: RiskResult
  spending: SpendingBreakdown
  leaks: LeaksResult
  purchases: Purchase[]
  live: boolean
  loading: boolean
  error: string | null
  freezeCard: () => Promise<void>
  markSafe: () => Promise<void>
  freezing: boolean
  refetch: () => void
}

export function useAccountData(accountOverride: DemoAccount | null = null): AccountData {
  const [account, setAccount] = useState<DemoAccount>(FALLBACK_ACCOUNT)
  const [risk, setRisk] = useState<RiskResult>(FALLBACK_RISK)
  const [spending, setSpending] = useState<SpendingBreakdown>(FALLBACK_SPENDING)
  const [leaks, setLeaks] = useState<LeaksResult>(FALLBACK_LEAKS)
  const [purchases, setPurchases] = useState<Purchase[]>(FALLBACK_PURCHASES)
  const [live, setLive] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [freezing, setFreezing] = useState(false)
  const [tick, setTick] = useState(0)

  const refetch = useCallback(() => {
    setLoading(true)
    setTick((t) => t + 1)
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const acc = accountOverride ?? (await fetchDemoAccount())
        if (cancelled) return
        setAccount(acc)
        setLive(true)
        setError(null)

        // Cada panel se actualiza por su cuenta: si un endpoint falla
        // (p. ej. una cuenta sin historial), los demás siguen mostrando
        // datos reales en lugar de romper toda la página.
        const [r, s, l, p] = await Promise.allSettled([
          fetchRisk(acc.account_id),
          fetchSpendingBreakdown(acc.account_id),
          fetchLeaks(acc.account_id),
          fetchPurchases(acc.account_id),
        ])
        if (cancelled) return
        if (r.status === 'fulfilled') setRisk(r.value)
        if (s.status === 'fulfilled') setSpending(s.value)
        if (l.status === 'fulfilled') setLeaks(l.value)
        if (p.status === 'fulfilled') setPurchases(p.value)
      } catch (err) {
        // No hay backend disponible (o /demo-account) -- nos quedamos con
        // el contenido de ejemplo. Estado esperado si aún no corriste
        // seed_data.py o el backend no está levantado.
        if (!cancelled) {
          setLive(false)
          setError((err as Error).message)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [tick, accountOverride])

  const applyFrozen = useCallback(
    async (frozen: boolean) => {
      if (!live) return
      setFreezing(true)
      try {
        const result = await setFrozen(account.account_id, frozen)
        setAccount((prev) => ({ ...prev, frozen: result.frozen }))
      } finally {
        setFreezing(false)
      }
    },
    [account.account_id, live],
  )

  const freezeCard = useCallback(() => applyFrozen(true), [applyFrozen])
  const markSafe = useCallback(() => applyFrozen(false), [applyFrozen])

  return {
    account,
    risk,
    spending,
    leaks,
    purchases,
    live,
    loading,
    error,
    freezeCard,
    markSafe,
    freezing,
    refetch,
  }
}
