import type { Theme, View } from '../App'
import './Sidebar.css'

interface SidebarProps {
  view: View
  onNavigate: (view: View) => void
  theme: Theme
  onToggleTheme: () => void
}

const NAV: { id: View; label: string }[] = [
  { id: 'chat', label: 'Chat' },
  { id: 'accounts', label: 'Accounts' },
]

const SUN = '\u263C\uFE0E'
const MOON = '\u263E\uFE0E'


function Sidebar({ view, onNavigate, theme, onToggleTheme }: SidebarProps) {
  const art = theme === 'dark' ? MOON : SUN
  return (
    <aside className="sidebar">
      <div className="brand">Capital You</div>
      <nav className="sidebar-nav">
        <ul>
          {NAV.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className={view === item.id ? 'active' : ''}
                onClick={() => onNavigate(item.id)}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <button
        type="button"
        className="theme-toggle"
        onClick={onToggleTheme}
        aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        <span className="theme-icon" aria-hidden>
          {art}
        </span>
      </button>
    </aside>
  )
}

export default Sidebar