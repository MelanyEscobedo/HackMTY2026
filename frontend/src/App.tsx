import { useEffect, useState } from 'react'
import Sidebar from './components/Sidebar'
import AccountsView from './views/AccountsView'
import ChatView from './views/ChatView'
import './App.css'

export type View = 'accounts' | 'chat'
export type Theme = 'light' | 'dark'

function parseHash(): View {
  const h = window.location.hash.replace(/^#\/?/, '')
  return h === 'chat' ? 'chat' : 'accounts'
}

function App() {
  const [view, setView] = useState<View>(parseHash)
  const [theme, setTheme] = useState<Theme>(
    (document.documentElement.dataset.theme as Theme) ?? 'light',
  )

  useEffect(() => {
    const onHashChange = () => setView(parseHash())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('theme', theme)
  }, [theme])

  const navigate = (next: View) => {
    window.location.hash = `/${next}`
  }

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }

  return (
    <div className="app">
      <Sidebar
        view={view}
        onNavigate={navigate}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
      <main className="content">
        {view === 'accounts' ? <AccountsView /> : <ChatView />}
      </main>
    </div>
  )
}

export default App