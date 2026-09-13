import type { LeaksResult, SpendingBreakdown } from '../api'
import { colorVarFor, money } from '../format'
import './SpendingView.css'

interface SpendingViewProps {
  spending: SpendingBreakdown
  leaks: LeaksResult
}

function SpendingView({ spending, leaks }: SpendingViewProps) {
  const first = leaks.leaks[0]
  const more = leaks.leaks.length - 1

  return (
    <div className="screens tab-anim">
      <section className="card-section" id="spending" aria-label="Gastos">
        <div className="card-section-head">
          <span className="card-section-title">Gastos</span>
          <span className="pill pill-muted">Este mes</span>
        </div>
        <div className="card-section-body">
          <div className="spend-total">
            <span className="spend-label">Total gastado, últimos 30 días</span>
            <span className="spend-amount num">{money(spending.total)}</span>
          </div>

          <div className="bars" id="spend-bars" role="img" aria-label="Gasto por categoría">
            {spending.breakdown.map((row) => {
              const colorVar = colorVarFor(row.category)
              return (
                <div className="bar-row" key={row.category}>
                  <div className="bar-row-top">
                    <span className="cat">
                      <span className="swatch" style={{ background: `var(${colorVar})` }} />
                      {row.category}
                    </span>
                    <span className="amt num">{money(row.amount)} &middot; {row.percent}%</span>
                  </div>
                  <div className="bar-track">
                    <div
                      className="bar-fill"
                      style={{ width: `${row.percent}%`, background: `var(${colorVar})` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>

          {first && (
            <div className="leak-card">
              <span className="status status-warning">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M12 2a8 8 0 0 1 8 8c0 5.5-8 12-8 12S4 15.5 4 10a8 8 0 0 1 8-8Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                  <circle cx="12" cy="10" r="2.4" stroke="currentColor" strokeWidth="1.8" />
                </svg>
                Parece recurrente
              </span>
              <p>
                {first.category} &mdash; {first.count} cargos de <span className="num">{money(first.amount)}</span> cada uno
                {more > 0 ? `, más ${more} cargo${more === 1 ? '' : 's'} recurrente${more === 1 ? '' : 's'}.` : '.'}
              </p>
              <a className="link" href="#">Revisar suscripción &rarr;</a>
            </div>
          )}
        </div>
      </section>

      <section className="card-section" aria-label="Cuenta">
        <div className="card-section-head">
          <span className="card-section-title">Tu cuenta</span>
          <span className="pill pill-muted">Capital One Nessie</span>
        </div>
        <div className="card-section-body">
          <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: 'var(--ink-2)' }}>
            Capital You conecta directo con el sandbox de Capital One (Nessie) para leer tus
            cuentas y movimientos reales de prueba, detecta patrones de fraude con un motor
            propio, y te deja congelar la tarjeta o preguntarle al asistente sin salir de esta
            pantalla.
          </p>
          <div className="mini-row" style={{ borderTop: 'none', paddingTop: 0 }}>
            <span className="status status-good">
              <svg viewBox="0 0 24 24" fill="none"><path d="M4 12.5 9.5 18 20 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              Conectado
            </span>
            <span className="mini-desc">API de Nessie + Gemini para el asistente</span>
          </div>
        </div>
      </section>
    </div>
  )
}

export default SpendingView
