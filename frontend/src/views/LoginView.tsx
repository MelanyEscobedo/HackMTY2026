import { useState, type FormEvent } from 'react'
import './LoginView.css'

interface LoginViewProps {
  onLogin: () => void
}

// Cosmetic only -- there's nothing to validate against. Nessie has no
// concept of a logged-in user (no usernames/passwords, just simulated
// banking data), so this just gives the demo a normal "login" beat before
// landing on the real, live dashboard. Same behavior as backend/login.html.
function LoginView({ onLogin }: LoginViewProps) {
  const [submitting, setSubmitting] = useState(false)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setTimeout(onLogin, 550)
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-brand">
          <span className="login-brand-mark" aria-hidden="true">C1</span>
          <span className="login-brand-word">Capital You</span>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="login-heading">
            <h1>Inicia sesión</h1>
            <p>Entra para ver tus cuentas, alertas y gastos.</p>
          </div>

          <div className="login-field">
            <label htmlFor="login-username">Usuario o correo</label>
            <input
              type="text"
              id="login-username"
              autoComplete="username"
              placeholder="maria.hopper@ejemplo.com"
              required
            />
          </div>
          <div className="login-field">
            <label htmlFor="login-password">Contraseña</label>
            <input
              type="password"
              id="login-password"
              autoComplete="current-password"
              placeholder="••••••••"
              required
            />
          </div>

          <button className="login-submit" type="submit" disabled={submitting}>
            {submitting && <span className="login-spinner" aria-hidden="true" />}
            {submitting ? 'Verificando…' : 'Iniciar sesión'}
          </button>

          <div className="login-hint">
            <b>Modo demo:</b> cualquier usuario y contraseña te dejan entrar &mdash; Nessie
            no maneja cuentas de usuario reales, solo datos bancarios simulados.
          </div>
        </form>

        <p className="login-foot">
          Prototipo construido para el reto de Capital One en HackMTY 2026 usando su sandbox
          Nessie &mdash; no es un producto oficial de Capital One.
        </p>
      </div>
    </div>
  )
}

export default LoginView
