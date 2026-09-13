import type { Tab, Theme } from '../App'
import './Sidebar.css'

export interface ProfileOption {
  id: string
  name: string
  detail?: string
  active: boolean
}

interface SidebarProps {
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
  profiles: ProfileOption[]
  profileOpen: boolean
  onToggleProfile: () => void
  onSelectProfile: (id: string) => void
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Resumen' },
  { id: 'alerts', label: 'Alertas' },
  { id: 'spending', label: 'Gastos' },
  { id: 'transactions', label: 'Movimientos' },
  { id: 'credit', label: 'Crédito' },
]

const SUN = '☼︎'
const MOON = '☾︎'

function Sidebar({
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
  profiles,
  profileOpen,
  onToggleProfile,
  onSelectProfile,
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="brand-capital">Capital</span>
        <span className="brand-colon">:</span>
        <span className="brand-you">You</span>
      </div>

      <nav className="sidebar-links" role="tablist">
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
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-profile-wrap">
          {profileOpen && (
            <div className="profile-dropdown" role="listbox" aria-label="Cambiar de cliente">
              {profiles.length === 0 ? (
                <div className="profile-empty">No hay clientes</div>
              ) : (
                profiles.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    role="option"
                    aria-selected={p.active}
                    className={`profile-option${p.active ? ' is-active' : ''}`}
                    onClick={() => onSelectProfile(p.id)}
                  >
                    <span className="profile-avatar">{p.name.charAt(0).toUpperCase()}</span>
                    <span className="profile-text">
                      <span className="profile-name">{p.name}</span>
                      {p.detail && <span className="profile-detail">{p.detail}</span>}
                    </span>
                    {p.active && (
                      <svg className="profile-check" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                ))
              )}
            </div>
          )}

          <button
            type="button"
            className="sidebar-profile"
            onClick={onToggleProfile}
            aria-haspopup="listbox"
            aria-expanded={profileOpen}
            aria-label="Cambiar de cliente"
          >
            <span className="sidebar-avatar">{personaInitials}</span>
            <div className="sidebar-persona-text">
              <span className="sidebar-name">{personaName}</span>
              <span className="sidebar-account">
                {personaType} &middot; &middot;&middot;&middot;&middot;&middot;{personaMask}
              </span>
            </div>
            <svg className="profile-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        <span className={`sidebar-live${live ? ' is-live' : ''}`}>
          <span className="dot" />
          {live ? 'En vivo' : 'Datos de ejemplo'}
        </span>

        <div className="sidebar-actions">
          <button
            type="button"
            className={`sidebar-theme-toggle${theme === 'dark' ? ' is-active' : ''}`}
            onClick={onToggleTheme}
            aria-label={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          >
            <span className="theme-icon" aria-hidden="true">
              {theme === 'dark' ? MOON : SUN}
            </span>
          </button>
          <button type="button" className="sidebar-logout" onClick={onLogout}>
            Cerrar sesión
          </button>
        </div>
      </div>
    </aside>
  )
}

export default Sidebar