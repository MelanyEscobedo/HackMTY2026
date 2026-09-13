import { useState } from 'react'
import type { DemoAccount, RiskResult } from '../api'
import './AlertsView.css'

interface AlertsViewProps {
  account: DemoAccount
  risk: RiskResult
  live: boolean
  freezing: boolean
  onMarkSafe: () => void
  onFreezeCard: () => void
}

const CIRCUMFERENCE = 119.4

function AlertsView({ account, risk, live, freezing, onMarkSafe, onFreezeCard }: AlertsViewProps) {
  const pct = Math.max(0, Math.min(100, risk.score))
  const dashOffset = (CIRCUMFERENCE * (1 - pct / 100)).toFixed(1)
  const [note, setNote] = useState<string | null>(null)

  async function handleMarkSafe() {
    if (!live) {
      setNote('Solo datos de ejemplo -- corre el backend para probar esto de verdad.')
      return
    }
    await onMarkSafe()
    setNote('Gracias -- confirmado como tú. La tarjeta sigue activa.')
  }

  async function handleFreeze() {
    if (!live) {
      setNote('Solo datos de ejemplo -- corre el backend para probar esto de verdad.')
      return
    }
    await onFreezeCard()
    setNote('Tarjeta congelada. Puedes descongelarla cuando quieras (o pídeselo al asistente).')
  }

  return (
    <section className="card-section tab-anim" id="alerts" aria-label="Alertas de fraude">
      <div className="card-section-head">
        <span className="card-section-title">Alertas</span>
        <span className={`pill ${risk.flagged ? 'pill-critical' : 'pill-muted'}`}>
          {risk.flagged ? '1 nueva' : '0 nuevas'}
        </span>
      </div>
      <div className="card-section-body">
        <article className={`alert-card${risk.flagged ? '' : ' is-clear'}`}>
          <div className="alert-top">
            <span className={`status ${risk.flagged ? 'status-critical' : 'status-good'}`}>
              {risk.flagged ? (
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M12 9v4M12 16.5h.01M10.29 3.86 1.82 18a1.5 1.5 0 0 0 1.29 2.25h17.78A1.5 1.5 0 0 0 22.18 18L13.71 3.86a1.5 1.5 0 0 0-2.42 0Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M4 12.5 9.5 18 20 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
              <span>{risk.flagged ? 'Marcada' : 'Todo en orden'}</span>
            </span>
            <span className="gauge" role="img" aria-label={`Puntaje de riesgo ${Math.round(risk.score)} de 100`}>
              <svg viewBox="0 0 46 46">
                <circle cx="23" cy="23" r="19" fill="none" stroke="var(--chart-grid)" strokeWidth="5" />
                <circle
                  cx="23" cy="23" r="19" fill="none" stroke="var(--status-critical)" strokeWidth="5"
                  strokeLinecap="round" strokeDasharray={CIRCUMFERENCE} strokeDashoffset={dashOffset}
                />
              </svg>
              <span className="gauge-value num">{Math.round(risk.score)}</span>
            </span>
          </div>

          <div className="hop-path" aria-hidden="true">
            {risk.sequence.map((step, i) => {
              const squareClass = !step.unusual ? 'neutral' : step.rarity >= 0.9 ? 'full' : 'mild'
              const caption = !step.unusual
                ? 'dentro del patrón normal'
                : step.typical_frequency_pct > 0
                  ? `típico en ${step.typical_frequency_pct}% de las visitas`
                  : 'nunca antes visto'
              return (
                <span key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 4 }}>
                  {i > 0 && <span className="hop-arrow">&rarr;</span>}
                  <span className="hop-tile">
                    <span className={`hop-square ${squareClass}`}>{i + 1}</span>
                    <span className="hop-name">{step.category}</span>
                    <span className="hop-caption">{caption}</span>
                  </span>
                </span>
              )
            })}
          </div>

          <p className="alert-explanation"><b>{risk.explanation}</b></p>
          <div className="alert-meta">
            {risk.flagged ? 'Justo ahora, en vivo desde tus datos' : 'Sin actividad inusual en la ventana actual'}
          </div>

          <div className="alert-actions">
            <button
              className="btn btn-primary"
              type="button"
              disabled={freezing}
              onClick={handleMarkSafe}
            >
              Fui yo
            </button>
            <button
              className="btn btn-ghost"
              type="button"
              disabled={freezing || account.frozen}
              onClick={handleFreeze}
            >
              {account.frozen ? 'Tarjeta congelada ✓' : 'Congelar tarjeta'}
            </button>
          </div>
          {note && (
            <div className={`action-note${!live ? ' is-error' : ''}`}>{note}</div>
          )}
        </article>

        <div className="mini-row">
          <span className="status status-good">
            <svg viewBox="0 0 24 24" fill="none"><path d="M4 12.5 9.5 18 20 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            Normal
          </span>
          <span className="mini-desc">Groceries &rarr; Gas, más temprano hoy</span>
          <span className="mini-score num">Puntaje 40 &middot; ejemplo</span>
        </div>
      </div>
    </section>
  )
}

export default AlertsView
