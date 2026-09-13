import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Always starts light regardless of the OS theme -- only the in-app toggle
// (Sidebar's sun/moon button) switches to dark, so the app doesn't surprise-
// render dark just because the system is in dark mode.
const stored = localStorage.getItem('theme')
const initial = stored === 'dark' ? 'dark' : 'light'
document.documentElement.dataset.theme = initial

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)