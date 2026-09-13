// Talks to the real FastAPI backend (main.py) through Vite's /api proxy
// (see vite.config.ts) -- ?key=... auth and the Nessie round trip all
// happen server-side, this file just calls the JSON routes main.py exposes:
// /demo-account, /accounts/{id}/risk|spending-breakdown|leaks|purchases|freeze,
// and /chat/message.
const BASE = '/api'

export interface DemoAccount {
  customer_id: string
  account_id: string
  first_name: string | null
  last_name: string | null
  nickname: string | null
  balance: number
  mask: string
  frozen: boolean
}

export interface Purchase {
  _id?: string
  merchant_id: string
  amount: number
  purchase_date: string
  description?: string
  status?: string
  medium?: string
  category: string
  merchant_name: string
}

export interface RiskStep {
  category: string
  rarity: number
  unusual: boolean
  typical_frequency_pct: number
}

export interface RiskResult {
  account_id: string
  score: number
  flagged: boolean
  unusual_categories: string[]
  explanation: string
  sequence: RiskStep[]
}

export interface SpendingBreakdownRow {
  category: string
  amount: number
  percent: number
}

export interface SpendingBreakdown {
  account_id: string
  total: number
  breakdown: SpendingBreakdownRow[]
}

export interface Leak {
  category: string
  amount: number
  count: number
}

export interface LeaksResult {
  account_id: string
  leaks: Leak[]
}

export interface FreezeResult {
  account_id: string
  frozen: boolean
}

export interface ChatMessageResult {
  reply: string
}

export interface Customer {
  _id: string
  first_name: string
  last_name: string
  address?: Record<string, unknown>
}

export interface NessieAccount {
  _id: string
  type: string
  nickname: string
  rewards: number
  balance: number
  account_number?: string
  customer_id?: string
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    signal: AbortSignal.timeout(60000),
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options?.headers ?? {}) },
  })
  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = await res.json()
      detail =
        typeof body.detail === 'string'
          ? body.detail
          : JSON.stringify(body.detail ?? body)
    } catch {
      // keep statusText fallback
    }
    throw new Error(detail)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export const fetchDemoAccount = () => request<DemoAccount>('/demo-account')

export const fetchPurchases = (accountId: string) =>
  request<Purchase[]>(`/accounts/${accountId}/purchases`)

export const fetchRisk = (accountId: string, windowSize = 4) =>
  request<RiskResult>(`/accounts/${accountId}/risk?window_size=${windowSize}`)

export const fetchSpendingBreakdown = (accountId: string, windowSize = 4) =>
  request<SpendingBreakdown>(
    `/accounts/${accountId}/spending-breakdown?window_size=${windowSize}`,
  )

export const fetchLeaks = (accountId: string, windowSize = 4) =>
  request<LeaksResult>(`/accounts/${accountId}/leaks?window_size=${windowSize}`)

export const setFrozen = (accountId: string, frozen: boolean) =>
  request<FreezeResult>(`/accounts/${accountId}/freeze?frozen=${frozen}`, {
    method: 'POST',
  })

export const sendChatMessage = (message: string) =>
  request<ChatMessageResult>('/chat/message', {
    method: 'POST',
    body: JSON.stringify({ message }),
  })

export const fetchCustomers = () => request<Customer[]>('/customers')

export const fetchCustomerAccounts = (customerId: string) =>
  request<NessieAccount[]>(`/customers/${customerId}/accounts`)

export interface CreditEstimateOption {
  downpayment_pct: number
  downpayment: number
  principal: number
  monthly_payment: number
  total_paid: number
  total_interest: number
}

export interface CreditEstimate {
  amount: number
  downpayment: number
  principal: number
  apr: number
  months: number
  monthly_payment: number
  total_paid: number
  total_interest: number
  downpayment_options: CreditEstimateOption[]
}

export interface CreditEstimateRequest {
  amount: number
  downpayment: number
  apr: number
  months: number
}

export const fetchCreditEstimate = (payload: CreditEstimateRequest) =>
  request<CreditEstimate>('/credit/estimate', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

export const speakChatText = async (text: string): Promise<Blob> => {
  const res = await fetch(`${BASE}/chat/speak`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
    signal: AbortSignal.timeout(60000),
  })
  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = await res.json()
      detail =
        typeof body.detail === 'string'
          ? body.detail
          : JSON.stringify(body.detail ?? body)
    } catch {
      // keep statusText fallback
    }
    throw new Error(detail)
  }
  return res.blob()
}
