import type { ReactNode } from 'react'

type Tone = 'neutral' | 'info' | 'taxi' | 'route' | 'danger'

const TONES: Record<Tone, string> = {
  neutral: 'bg-paper text-muted ring-line',
  info: 'bg-info-soft text-info ring-info/15',
  taxi: 'bg-taxi-soft text-[#7a5c00] ring-taxi/40',
  route: 'bg-route-soft text-route ring-route/15',
  danger: 'bg-danger-soft text-danger ring-danger/15',
}

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${TONES[tone]}`}>
      {children}
    </span>
  )
}

const TRIP_STATUS: Record<string, { label: string; tone: Tone }> = {
  scheduled: { label: 'Upcoming', tone: 'info' },
  departed: { label: 'On the road', tone: 'taxi' },
  completed: { label: 'Completed', tone: 'route' },
  cancelled: { label: 'Cancelled', tone: 'danger' },
}

const BOOKING_STATUS: Record<string, { label: string; tone: Tone }> = {
  confirmed: { label: 'Confirmed', tone: 'info' },
  completed: { label: 'Completed', tone: 'route' },
  cancelled: { label: 'Cancelled', tone: 'danger' },
}

export function TripStatusBadge({ status }: { status: string }) {
  const s = TRIP_STATUS[status] ?? { label: status, tone: 'neutral' as Tone }
  return <Badge tone={s.tone}>{s.label}</Badge>
}

export function BookingStatusBadge({ status }: { status: string }) {
  const s = BOOKING_STATUS[status] ?? { label: status, tone: 'neutral' as Tone }
  return <Badge tone={s.tone}>{s.label}</Badge>
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-line bg-card ${className}`}>{children}</div>
}

export function PageHeader({ title, subtitle, action }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="font-semi-condensed text-[28px] font-extrabold leading-tight tracking-tight text-ink sm:text-[32px]">{title}</h1>
        {subtitle && <p className="mt-1 text-[15px] text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function EmptyState({ title, message, action }: { title: string; message?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-card px-6 py-12 text-center">
      <RoadIcon className="mx-auto h-10 w-10 text-faint" />
      <p className="mt-4 text-base font-semibold text-ink">{title}</p>
      {message && <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted">{message}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  )
}

export function Avatar({ name, url, size = 'md' }: { name?: string | null; url?: string | null; size?: 'sm' | 'md' | 'lg' }) {
  const dims = { sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-20 w-20 text-2xl' }[size]
  const initials = (name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')
  return (
    <span className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-ink font-bold text-taxi ${dims}`}>
      {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : initials || '?'}
    </span>
  )
}

export function Stars({ rating, className = '' }: { rating: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 font-semibold text-ink ${className}`}>
      <svg viewBox="0 0 20 20" className="h-4 w-4 text-taxi" fill="currentColor" aria-hidden="true">
        <path d="M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 14.9l-5.2 2.7 1-5.8L1.5 7.7l5.9-.9z" />
      </svg>
      {rating.toFixed(1)}
      <span className="sr-only">out of 5</span>
    </span>
  )
}

export function VerifiedMark() {
  return (
    <span title="Verified driver" className="inline-flex items-center text-route">
      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
        <path d="M10 1l2.2 1.6 2.7-.2.9 2.6 2.3 1.4-.8 2.6.8 2.6-2.3 1.4-.9 2.6-2.7-.2L10 19l-2.2-1.6-2.7.2-.9-2.6L1.9 13.6l.8-2.6-.8-2.6L4.2 7l.9-2.6 2.7.2z" />
        <path d="M6.5 10.2l2.3 2.3 4.7-4.7" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="sr-only">Verified driver</span>
    </span>
  )
}

export function RoadIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M14 4L6 36M26 4l8 32" strokeLinecap="round" />
      <path d="M20 6v5M20 17v6M20 29v5" strokeLinecap="round" />
    </svg>
  )
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-line/70 ${className}`} aria-hidden="true" />
}
