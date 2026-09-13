// Shared formatting + category-color helpers, ported from dashboard.html so
// the two surfaces render identical numbers. Nessie balances/amounts are
// plain dollar floats (e.g. 1428.53) -- NOT cents, so callers must not
// divide by 100.
export const money = (n: number) =>
  '$' + Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const formatDate = (isoDate: string) => {
  try {
    const dt = new Date(isoDate + 'T00:00:00')
    return dt.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
  } catch {
    return isoDate
  }
}

const CATEGORY_COLOR_VARS: Record<string, string> = {
  Groceries: '--series-groceries',
  Gas: '--series-gas',
  'Coffee Shops': '--series-coffee',
  'Streaming Services': '--series-stream',
}
const EXTRA_COLOR_VARS = ['--series-extra1', '--series-extra2']

export function colorVarFor(category: string): string {
  if (CATEGORY_COLOR_VARS[category]) return CATEGORY_COLOR_VARS[category]
  let h = 0
  for (let i = 0; i < category.length; i++) h = (h * 31 + category.charCodeAt(i)) >>> 0
  return EXTRA_COLOR_VARS[h % EXTRA_COLOR_VARS.length]
}
