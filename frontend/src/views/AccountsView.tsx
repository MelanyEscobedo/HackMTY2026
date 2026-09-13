import { useEffect, useState } from 'react'
import { fetchAccounts, type Account } from '../api'

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

const formatBalance = (cents: number) => usd.format(cents / 100)
const formatRewards = (points: number) => points.toLocaleString('en-US')

function AccountsView() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchAccounts()
      .then((accs) => {
        if (cancelled) return
        setAccounts(accs)
        if (accs.length > 0) setSelectedId(accs[0]._id)
      })
      .catch((err: Error) => {
        if (!cancelled) setLoadError(err.message)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const selected = accounts.find((a) => a._id === selectedId) ?? null

  return (
    <div className="view">
      <header className="banner">
        <h1>Your accounts</h1>
        <p className="subtitle">Capital One Nessie · overview</p>
      </header>

      {loadError && <p className="msg error">{loadError}</p>}

      {!loadError && accounts.length === 0 && (
        <p className="empty">No accounts yet.</p>
      )}

      {!loadError && accounts.length > 0 && (
        <div className="layout">
          <nav className="menu" aria-label="Accounts">
            <ul className="menu-list">
              {accounts.map((a) => (
                <li key={a._id}>
                  <button
                    type="button"
                    className={`menu-item${a._id === selectedId ? ' active' : ''}`}
                    onClick={() => setSelectedId(a._id)}
                  >
                    <span className="nick">{a.nickname}</span>
                    <span className="meta">
                      {a.type} · {formatBalance(a.balance)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          {selected && (
            <section className="panel detail">
              <div className="account-head">
                <span className="type">{selected.type}</span>
                <span className="nick">{selected.nickname}</span>
              </div>
              <dl className="detail-list">
                <div>
                  <dt>Balance</dt>
                  <dd>{formatBalance(selected.balance)}</dd>
                </div>
                <div>
                  <dt>Rewards</dt>
                  <dd>{formatRewards(selected.rewards)} pts</dd>
                </div>
                <div>
                  <dt>Account number</dt>
                  <dd>
                    <code>{selected.account_number}</code>
                  </dd>
                </div>
                <div>
                  <dt>Account ID</dt>
                  <dd>
                    <code>{selected._id}</code>
                  </dd>
                </div>
                {selected.customer_id && (
                  <div>
                    <dt>Customer ID</dt>
                    <dd>
                      <code>{selected.customer_id}</code>
                    </dd>
                  </div>
                )}
              </dl>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

export default AccountsView