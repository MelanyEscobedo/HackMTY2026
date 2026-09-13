import { useState, type FormEvent } from 'react'
import { fetchCreditEstimate, type CreditEstimate } from '../api'
import { money } from '../format'
import './CreditView.css'

function CreditView() {
  const [amount, setAmount] = useState('')
  const [downpayment, setDownpayment] = useState('')
  const [apr, setApr] = useState('')
  const [months, setMonths] = useState('')
  const [estimate, setEstimate] = useState<CreditEstimate | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setEstimate(null)
    try {
      const result = await fetchCreditEstimate({
        amount: Number(amount),
        downpayment: Number(downpayment) || 0,
        apr: Number(apr),
        months: Number(months),
      })
      setEstimate(result)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="view">
      <header className="banner">
        <h1>Análisis de crédito</h1>
        <p className="subtitle">Estimaciones de pago y enganche</p>
      </header>

      <div className="credit-layout">
        <section className="card-section">
          <div className="card-section-head">
            <span className="card-section-title">Calcula tu crédito</span>
          </div>
          <div className="card-section-body">
            <form className="credit-form" onSubmit={handleSubmit}>
              <label>
                Monto del préstamo
                <input
                  type="number"
                  min="1"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Ej. 200000"
                />
              </label>
              <label>
                Enganche
                <input
                  type="number"
                  min="0"
                  value={downpayment}
                  onChange={(e) => setDownpayment(e.target.value)}
                  placeholder="Ej. 20000"
                />
              </label>
              <label>
                Tasa de interés (APR %)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={apr}
                  onChange={(e) => setApr(e.target.value)}
                  placeholder="Ej. 15"
                />
              </label>
              <label>
                Plazo (meses)
                <input
                  type="number"
                  min="1"
                  required
                  value={months}
                  onChange={(e) => setMonths(e.target.value)}
                  placeholder="Ej. 60"
                />
              </label>
              <button className="btn btn-brand" type="submit" disabled={loading}>
                {loading ? 'Calculando…' : 'Calcular'}
              </button>
            </form>

            {error && <p className="msg error">Error: {error}</p>}
          </div>
        </section>

        {estimate && (
          <>
            <section className="card-section">
              <div className="card-section-head">
                <span className="card-section-title">Resultado</span>
              </div>
              <div className="card-section-body">
                <div className="credit-summary">
                  <div className="credit-stat main">
                    <span className="credit-stat-label">Pago mensual</span>
                    <span className="credit-stat-value">{money(estimate.monthly_payment)}</span>
                  </div>
                  <div className="credit-stat">
                    <span className="credit-stat-label">Monto financiado</span>
                    <span className="credit-stat-value">{money(estimate.principal)}</span>
                  </div>
                  <div className="credit-stat">
                    <span className="credit-stat-label">Enganche</span>
                    <span className="credit-stat-value">{money(estimate.downpayment)}</span>
                  </div>
                  <div className="credit-stat">
                    <span className="credit-stat-label">Total a pagar</span>
                    <span className="credit-stat-value">{money(estimate.total_paid)}</span>
                  </div>
                  <div className="credit-stat">
                    <span className="credit-stat-label">Intereses totales</span>
                    <span className="credit-stat-value">{money(estimate.total_interest)}</span>
                  </div>
                </div>
              </div>
            </section>

            <section className="card-section">
              <div className="card-section-head">
                <span className="card-section-title">Escenarios de enganche</span>
              </div>
              <div className="card-section-body">
                <table className="credit-table">
                  <thead>
                    <tr>
                      <th>Enganche</th>
                      <th>Monto</th>
                      <th>Mensualidad</th>
                      <th>Intereses</th>
                    </tr>
                  </thead>
                  <tbody>
                    {estimate.downpayment_options.map((o) => (
                      <tr key={o.downpayment_pct} className={o.downpayment_pct === 10 ? 'is-current' : ''}>
                        <td>{o.downpayment_pct}%</td>
                        <td>{money(o.downpayment)}</td>
                        <td>{money(o.monthly_payment)}</td>
                        <td>{money(o.total_interest)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  )
}

export default CreditView