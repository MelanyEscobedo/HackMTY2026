import { useEffect, useState } from 'react'
import Sidebar, { type ProfileOption } from './components/Sidebar'
import ChatWidget from './components/ChatWidget'
import LoginView from './views/LoginView'
import OverviewView from './views/OverviewView'
import AlertsView from './views/AlertsView'
import SpendingView from './views/SpendingView'
import TransactionsView from './views/TransactionsView'
import CreditView from './views/CreditView'
import { useAccountData } from './useAccountData'
import {
  fetchCustomerAccounts,
  fetchCustomers,
  type Customer,
  type DemoAccount,
} from './api'
import './App.css'

export type Tab = 'overview' | 'alerts' | 'spending' | 'transactions' | 'credit'
export type Theme = 'light' | 'dark'

const TAB_IDS: Tab[] = ['overview', 'alerts', 'spending', 'transactions', 'credit']
const LOGIN_KEY = 'capitalyou_loggedIn'

function parseHash(): Tab {
  const h = window.location.hash.replace(/^#\/?/, '') as Tab
  return TAB_IDS.includes(h) ? h : 'overview'
}

function App() {
  const [loggedIn, setLoggedIn] = useState(() => sessionStorage.getItem(LOGIN_KEY) === '1')
  const [tab, setTab] = useState<Tab>(parseHash)
  const [chatOpen, setChatOpen] = useState(false)
  const [theme, setTheme] = useState<Theme>(
    (document.documentElement.dataset.theme as Theme) ?? 'light',
  )
  const [profileOpen, setProfileOpen] = useState(false)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedAccount, setSelectedAccount] = useState<DemoAccount | null>(null)

  const data = useAccountData(selectedAccount)

  useEffect(() => {
    const onHashChange = () => setTab(parseHash())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  useEffect(() => {
    let cancelled = false
    fetchCustomers()
      .then((cs) => {
        if (!cancelled) setCustomers(cs)
      })
      .catch(() => {
        // Lista de clientes no disponible (backend caído) -- el dropdown
        // simplemente se muestra vacío.
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('theme', theme)
  }, [theme])

  const navigate = (next: Tab) => {
    window.location.hash = `/${next}`
    setTab(next)
  }

  const toggleTheme = () => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))

  async function handleSelectCustomer(customerId: string) {
    setProfileOpen(false)
    try {
      const accounts = await fetchCustomerAccounts(customerId)
      if (accounts.length === 0) return
      const acc = accounts.find((a) => a.type === 'Checking') ?? accounts[0]
      const cust = customers.find((c) => c._id === customerId)
      setSelectedAccount({
        customer_id: customerId,
        account_id: acc._id,
        first_name: cust?.first_name ?? null,
        last_name: cust?.last_name ?? null,
        nickname: acc.nickname,
        balance: acc.balance,
        mask: acc._id.slice(-4),
        frozen: false,
      })
    } catch {
      // Ignorar errores de red; seguimos con la cuenta actual.
    }
  }

  function handleLogin() {
    sessionStorage.setItem(LOGIN_KEY, '1')
    setLoggedIn(true)
  }

  function handleLogout() {
    sessionStorage.removeItem(LOGIN_KEY)
    setLoggedIn(false)
    setChatOpen(false)
    setProfileOpen(false)
    setSelectedAccount(null)
  }

  if (!loggedIn) {
    return <LoginView onLogin={handleLogin} />
  }

  const fullName =
    [data.account.first_name, data.account.last_name].filter(Boolean).join(' ') ||
    'Cliente Capital One'
  const initials =
    ((data.account.first_name?.[0] ?? '') + (data.account.last_name?.[0] ?? '')).toUpperCase() ||
    'CY'

  const activeCustomerId = selectedAccount?.customer_id ?? data.account.customer_id
  const profiles: ProfileOption[] = customers.map((c) => ({
    id: c._id,
    name: [c.first_name, c.last_name].filter(Boolean).join(' ') || 'Cliente',
    active: c._id === activeCustomerId,
  }))

  return (
    <div className="app">
      <div className="bg-decor" aria-hidden="true">
        <div className="bg-blob b1" />
        <div className="bg-blob b2" />
      </div>
      <Sidebar
        activeTab={tab}
        onNavigate={navigate}
        personaName={fullName}
        personaType={data.account.nickname || 'Checking'}
        personaMask={data.account.mask}
        personaInitials={initials}
        live={data.live}
        theme={theme}
        onToggleTheme={toggleTheme}
        onLogout={handleLogout}
        profiles={profiles}
        profileOpen={profileOpen}
        onToggleProfile={() => setProfileOpen((o) => !o)}
        onSelectProfile={handleSelectCustomer}
      />

      <main className="content">
        <div className="view">
          {tab === 'overview' && (
            <OverviewView
              account={data.account}
              risk={data.risk}
              onNavigate={navigate}
              onOpenChat={() => setChatOpen(true)}
            />
          )}
          {tab === 'alerts' && (
            <AlertsView
              account={data.account}
              risk={data.risk}
              live={data.live}
              freezing={data.freezing}
              onMarkSafe={data.markSafe}
              onFreezeCard={data.freezeCard}
            />
          )}
          {tab === 'spending' && <SpendingView spending={data.spending} leaks={data.leaks} />}
          {tab === 'transactions' && (
            <TransactionsView purchases={data.purchases} risk={data.risk} />
          )}
          {tab === 'credit' && <CreditView />}
        </div>
      </main>

      <ChatWidget open={chatOpen} onOpenChange={setChatOpen} currentTab={tab} onNavigate={navigate} />
    </div>
  )
}

export default App
