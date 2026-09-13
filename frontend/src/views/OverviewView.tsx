import type { DemoAccount, RiskResult } from '../api'
import type { Tab } from '../App'
import { money } from '../format'
import './OverviewView.css'

interface OverviewViewProps {
  account: DemoAccount
  risk: RiskResult
  onNavigate: (tab: Tab) => void
  onOpenChat: () => void
}

function OverviewView({ account, risk, onNavigate, onOpenChat }: OverviewViewProps) {
  const fullName =
    [account.first_name, account.last_name].filter(Boolean).join(' ') || 'Cliente Capital One'

  return (
    <section className="account-stack tab-anim" aria-label="Tus cuentas">
      <article className="acct-card acct-card-primary">
        <div className="acct-card-top">
          <span className="acct-card-id">
            <span>{account.nickname || 'Checking'}</span>
            <span className="acct-card-sep">&middot;</span>
            <span className="acct-card-mask num">&bull;&bull;&bull;&bull;{account.mask}</span>
          </span>
          <span className={`acct-card-badge${account.frozen ? ' is-frozen' : ''}`}>
            {account.frozen ? 'Congelada' : 'Activa'}
          </span>
        </div>
        <div className="acct-card-balance">
          <span className="acct-card-balance-label">Saldo disponible</span>
          <span className="acct-card-balance-amount num">{money(account.balance)}</span>
          <span className="acct-card-name">{fullName}</span>
        </div>
        <div className="acct-card-actions">
          <button className="acct-chip" type="button" onClick={onOpenChat}>
            Hablar con el asistente
          </button>
          <button className="acct-chip" type="button" onClick={() => onNavigate('transactions')}>
            Ver movimientos
          </button>
        </div>
        {account.frozen && <div className="card-frozen-ribbon">Tarjeta congelada</div>}
      </article>

      <button
        type="button"
        className={`acct-card acct-card-secondary${risk.flagged ? '' : ' is-clear'}`}
        onClick={() => onNavigate('alerts')}
        aria-label="Ver alertas de fraude"
      >
        <div className="acct-card-top">
          <span className="acct-card-id">Protección contra fraude</span>
          <span className={`pill ${risk.flagged ? 'pill-critical' : 'pill-muted'}`}>
            {risk.flagged ? '1 alerta' : 'Todo en orden'}
          </span>
        </div>
        <p className="acct-card-note">
          {risk.flagged
            ? `${risk.explanation} Toca para revisarla.`
            : 'Sin actividad inusual por ahora — toca para ver el detalle.'}
        </p>
      </button>

      <button
        type="button"
        className="new-account-btn"
        disabled
        title="Próximamente en este prototipo"
      >
        + Abrir una nueva cuenta
      </button>

      <article className="acct-card acct-card-rewards" aria-label="Recompensas y beneficios">
        <div className="acct-card-top">
          <span className="acct-card-id">Recompensas y beneficios</span>
          <span className="pill pill-muted">Ilustrativo</span>
        </div>
        <div className="rewards-cash">
          <span className="rewards-cash-label">Recompensas disponibles</span>
          <span className="rewards-cash-amount num">$60.80</span>
        </div>
        <div className="rewards-perks">
          <span className="rewards-perk">
            <span className="rewards-perk-icon" aria-hidden="true">&#9992;&#65039;</span>Viajes
          </span>
          <span className="rewards-perk">
            <span className="rewards-perk-icon" aria-hidden="true">&#127869;&#65039;</span>Restaurantes
          </span>
          <span className="rewards-perk">
            <span className="rewards-perk-icon" aria-hidden="true">&#127916;</span>Entretenimiento
          </span>
        </div>
        <p className="acct-card-note">
          Ejemplo ilustrativo &mdash; Nessie no maneja un programa de recompensas real.
        </p>
      </article>
    </section>
  )
}

export default OverviewView
