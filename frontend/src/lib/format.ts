const dateFormat = new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
const timeFormat = new Intl.DateTimeFormat('en-AU', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })

export function formatDate(ms: number): string {
  return dateFormat.format(ms)
}

export function formatDateTime(ms: number): string {
  return `${dateFormat.format(ms)}, ${timeFormat.format(ms)}`
}

export function formatTime(ms: number): string {
  return timeFormat.format(ms)
}

/** "2026-03-03" to "3 Mar 2026"; empty input gives a dash. */
export function formatIsoDate(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '—'
  const [y, m, d] = iso.split('-').map(Number)
  return dateFormat.format(Date.UTC(y, m - 1, d))
}

export function daysBetweenIso(a: string, b: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(a) || !/^\d{4}-\d{2}-\d{2}$/.test(b)) return null
  return Math.round(Math.abs(Date.parse(b) - Date.parse(a)) / 86_400_000)
}

/** "4 min 12 s", "2 h 5 min", "3 days" */
export function formatDuration(ms: number): string {
  const s = Math.round(Math.abs(ms) / 1000)
  if (s < 60) return `${s} s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} min ${s % 60} s`
  const h = Math.floor(m / 60)
  if (h < 48) return `${h} h ${m % 60} min`
  return `${Math.floor(h / 24)} days`
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`
}
