import { useEffect, useState } from 'react'
import Navbar from './components/Navbar'
import ChatWidget from './components/ChatWidget'
import LoginView from './views/LoginView'
import OverviewView from './views/OverviewView'
import AlertsView from './views/AlertsView'
import SpendingView from './views/SpendingView'
import TransactionsView from './views/TransactionsView'
import { useAccountData } from './useAccountData'
import './App.css'

export type Tab = 'overview' | 'alerts' | 'spending' | 'transactions'
export type Theme = 'light' | 'dark'

const TAB_IDS: Tab[] = ['overview', 'alerts', 'spending', 'transactions']
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

  const data = useAccountData()

  useEffect(() => {
    const onHashChange = () => setTab(parseHash())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
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

  function handleLogin() {
    sessionStorage.setItem(LOGIN_KEY, '1')
    setLoggedIn(true)
  }

  function handleLogout() {
    sessionStorage.removeItem(LOGIN_KEY)
    setLoggedIn(false)
    setChatOpen(false)
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

  return (
    <div className="app">
      <div className="bg-decor" aria-hidden="true">
        <div className="bg-blob b1" />
        <div className="bg-blob b2" />
      </div>
      <Navbar
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

          {data.error && !data.live && (
            <p className="foot-note">
              Datos de ejemplo del motor de detección de Capital You — el backend no respondió
              ({data.error}). Corre <code>uvicorn main:app --reload</code> en <code>backend/</code>{' '}
              (y <code>python seed_data.py</code> si es la primera vez) para ver tus datos reales.
            </p>
          )}
          {data.live && (
            <p className="foot-note">
              En vivo desde tu backend local — datos sembrados por seed_data.py, calificados por
              baseline.py.
              <br />
              Prototipo construido para el reto de Capital One en HackMTY 2026 usando su sandbox
              Nessie — no es un producto oficial de Capital One.
            </p>
          )}
        </div>
      </main>

      <ChatWidget open={chatOpen} onOpenChange={setChatOpen} currentTab={tab} onNavigate={navigate} />
    </div>
  )
}

export default App
