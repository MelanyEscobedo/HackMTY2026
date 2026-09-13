import type { Purchase, RiskResult } from '../api'
import { colorVarFor, formatDate, money } from '../format'
import './TransactionsView.css'

interface TransactionsViewProps {
  purchases: Purchase[]
  risk: RiskResult
}

const MAX_ROWS = 8

function TransactionsView({ purchases, risk }: TransactionsViewProps) {
  // risk.sequence lines up with the LAST risk.sequence.length purchases, in
  // the same order (baseline.py's score_window scores purchases[-window:])
  // -- use it to flag the exact rows the fraud engine currently thinks are
  // unusual. Same alignment logic as dashboard.html's renderTransactions.
  const total = purchases.length
  const windowLen = risk.sequence.length
  const unusualByIndex = new Array(total).fill(false)
  risk.sequence.forEach((step, i) => {
    const idx = total - windowLen + i
    if (idx >= 0) unusualByIndex[idx] = step.unusual
  })

  const recent = purchases.slice(-MAX_ROWS)
  const startIndex = total - recent.length
  const rows = recent
    .map((p, i) => ({ p, idx: startIndex + i }))
    .slice()
    .reverse()

  return (
    <section className="card-section tab-anim" id="transactions" aria-label="Movimientos recientes">
      <div className="card-section-head">
        <span className="card-section-title">Movimientos recientes</span>
        <span className="pill pill-muted">{total > 0 ? `${total} en total` : '—'}</span>
      </div>
      <div className="card-section-body">
        <div className="tx-list">
          {rows.length === 0 && <div className="tx-empty">Sin movimientos todavía.</div>}
          {rows.map(({ p, idx }) => {
            const colorVar = colorVarFor(p.category || 'Otros')
            const name = p.merchant_name || 'Comercio'
            const flagged = unusualByIndex[idx]
            return (
              <div className="tx-row" key={p._id ?? `${p.merchant_id}-${p.purchase_date}-${idx}`}>
                <span className="tx-icon" style={{ background: `var(${colorVar})` }}>
                  {name.charAt(0).toUpperCase()}
                </span>
                <div className="tx-main">
                  <div className="tx-merchant">{name}</div>
                  <div className="tx-meta">
                    <span>{p.category || 'Otros'}</span>
                    <span>&middot;</span>
                    <span>{formatDate(p.purchase_date)}</span>
                    {flagged && <span className="tx-flag">Inusual</span>}
                  </div>
                </div>
                <div className="tx-amount num">-{money(p.amount)}</div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

export default TransactionsView
