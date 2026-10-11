// Display helpers shared across pages, so dates, times and money look the
// same everywhere in the app.

const DAY_FORMAT = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
})

/** "2026-10-12" -> "Mon 12 Oct", "Today" or "Tomorrow" */
export function formatTripDate(date: string | null | undefined): string {
  if (!date) return 'Date not set'
  const [y, m, d] = date.split('-').map(Number)
  if (!y || !m || !d) return date
  const target = new Date(y, m - 1, d)

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86_400_000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Tomorrow'
  if (diffDays === -1) return 'Yesterday'
  return DAY_FORMAT.format(target)
}

/** "07:30:00" -> "07:30" */
export function formatTripTime(time: string | null | undefined): string {
  return time ? time.slice(0, 5) : '--:--'
}

/** 1500 -> "1,500 XAF" */
export function formatXAF(amount: number | null | undefined): string {
  return `${Math.round(amount ?? 0).toLocaleString('en-US')} XAF`
}

/** Local Date for a trip's departure, built from its date and time columns. */
export function tripDeparture(date: string | null | undefined, time: string | null | undefined): Date | null {
  if (!date) return null
  const [y, m, d] = date.split('-').map(Number)
  const [hh = 0, mm = 0] = (time || '00:00').split(':').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d, hh, mm)
}

/** True once a trip's departure time has passed. */
export function isPastDeparture(date: string | null | undefined, time: string | null | undefined): boolean {
  const dep = tripDeparture(date, time)
  return dep ? dep.getTime() < Date.now() : false
}

/** Today's date as YYYY-MM-DD in the user's local time zone. */
export function todayISODate(): string {
  const now = new Date()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${m}-${d}`
}

export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

/** "2026-10-11T19:04:00Z" -> "5 min ago" style labels for notifications */
export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.round(diff / 60_000)
  if (min < 1) return 'Just now'
  if (min < 60) return `${min} min ago`
  const hours = Math.round(min / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.round(hours / 24)
  return days === 1 ? 'Yesterday' : `${days} days ago`
}

/** Escape % and _ so user text is matched literally by .ilike() */
export function escapeLike(value: string): string {
  return value.replace(/[%_\\]/g, (c) => `\\${c}`)
}
