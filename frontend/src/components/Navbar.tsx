import type { Tab, Theme } from '../App'
import './Navbar.css'

interface NavbarProps {
  activeTab: Tab
  onNavigate: (tab: Tab) => void
  personaName: string
  personaType: string
  personaMask: string
  personaInitials: string
  live: boolean
  theme: Theme
  onToggleTheme: () => void
  onLogout: () => void
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Resumen' },
  { id: 'alerts', label: 'Alertas' },
  { id: 'spending', label: 'Gastos' },
  { id: 'transactions', label: 'Movimientos' },
]

const SUN = '☼︎'
const MOON = '☾︎'

function Navbar({
  activeTab,
  onNavigate,
  personaName,
  personaType,
  personaMask,
  personaInitials,
  live,
  theme,
  onToggleTheme,
  onLogout,
}: NavbarProps) {
  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <span className="navbar-mark" aria-hidden="true">C1</span>
        <span className="navbar-word">Capital You</span>
        <span className="navbar-tag">Capital One Challenge &middot; HackMTY 2026</span>
      </div>

      <div className="navbar-links" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={activeTab === tab.id ? 'is-active' : ''}
            onClick={() => onNavigate(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="navbar-persona">
        <span className="navbar-persona-avatar">{personaInitials}</span>
        <span>
          <span className="navbar-persona-name">{personaName}</span> &middot; {personaType}{' '}
          &middot;&middot;&middot;&middot;{personaMask}
        </span>
        <span className={`navbar-live${live ? ' is-live' : ''}`}>
          <span className="dot" />
          {live ? 'En vivo' : 'Datos de ejemplo'}
        </span>
        <button
          type="button"
          className="navbar-theme-toggle"
          onClick={onToggleTheme}
          aria-label={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
        >
          <span aria-hidden="true">{theme === 'dark' ? MOON : SUN}</span>
        </button>
        <button type="button" className="navbar-logout" onClick={onLogout}>
          Cerrar sesión
        </button>
      </div>
    </nav>
  )
}

export default Navbar
