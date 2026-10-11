import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useFeedback } from '../context/FeedbackContext'
import { useLocationShare } from '../context/LocationShareContext'
import { PageContainer } from '../components/AppLayout'
import { TripDetailsModal } from '../components/TripDetailsModal'
import { RouteLabel } from '../components/RouteLabel'
import { Button, LinkButton } from '../components/ui/Button'
import { Notice } from '../components/ui/Field'
import { EmptyState, PageHeader, Skeleton, TripStatusBadge } from '../components/ui/Display'
import { formatTripDate, formatTripTime, formatXAF, isPastDeparture, plural } from '../lib/format'
import { getErrorMessage } from '../lib/errors'

const TABS = [
  { key: 'scheduled', label: 'Upcoming' },
  { key: 'departed', label: 'On the road' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
] as const

type TabKey = (typeof TABS)[number]['key']

interface DriverTripRow {
  id: string
  departure_date: string
  departure_time: string
  price_per_seat: number
  total_seats: number
  available_seats: number
  status: TabKey
  route: { destination: string } | null
  park: { name: string } | null
}

export default function DriverDashboard() {
  const { user, profile } = useAuth()
  const { toast, confirm } = useFeedback()
  const location = useLocationShare()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<TabKey>('scheduled')
  const [detailsTripId, setDetailsTripId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const { data: trips, isLoading, isError, refetch } = useQuery({
    queryKey: ['driver-trips', user?.id],
    enabled: !!user,
    refetchInterval: 60_000, // new bookings come in while the driver waits
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trips')
        .select(
          `id, departure_date, departure_time, price_per_seat, total_seats, available_seats, status,
           route:routes!trips_route_id_fkey (destination),
           park:taxi_parks!trips_park_id_fkey (name)`
        )
        .eq('driver_id', user!.id)
        .order('departure_datetime', { ascending: true })

      if (error) throw error
      return (data || []) as unknown as DriverTripRow[]
    },
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['driver-trips', user?.id] })

  const updateStatus = async (trip: DriverTripRow, status: 'departed' | 'completed' | 'cancelled') => {
    const booked = trip.total_seats - trip.available_seats
    const dest = trip.route?.destination ?? 'the destination'

    const prompts = {
      departed: {
        title: 'Mark as departed?',
        message: `Passengers will see the trip to ${dest} as on the road. Turn on location sharing so they can follow you.`,
        confirmLabel: 'Mark departed',
        danger: false,
      },
      completed: {
        title: 'Mark as completed?',
        message: 'Passengers will be asked to rate the trip.',
        confirmLabel: 'Mark completed',
        danger: false,
      },
      cancelled: {
        title: 'Cancel this trip?',
        message:
          booked > 0
            ? `${plural(booked, 'seat')} ${booked === 1 ? 'is' : 'are'} booked. Those passengers will be notified and their bookings cancelled.`
            : 'Nobody has booked yet. The trip will be removed from the list.',
        confirmLabel: 'Cancel trip',
        danger: true,
      },
    }[status]

    const ok = await confirm({ ...prompts, cancelLabel: 'Go back' })
    if (!ok) return

    const updates: Record<string, string> = { status }
    const now = new Date().toISOString()
    if (status === 'departed') updates.departed_at = now
    if (status === 'completed') updates.completed_at = now
    if (status === 'cancelled') updates.cancelled_at = now

    setBusyId(trip.id)
    const { error } = await supabase.from('trips').update(updates).eq('id', trip.id).eq('driver_id', user!.id)
    setBusyId(null)

    if (error) {
      toast(getErrorMessage(error, 'Trip not updated. Try again.'), 'error')
      return
    }

    toast({ departed: 'Trip marked as departed.', completed: 'Trip completed.', cancelled: 'Trip cancelled.' }[status])
    if (status === 'departed' && !location.sharing) location.start()
    if (status === 'completed' && location.sharing) {
      const stillOnRoad = (trips || []).some((t) => t.status === 'departed' && t.id !== trip.id)
      if (!stillOnRoad) void location.stop()
    }
    setActiveTab(status === 'departed' ? 'departed' : status === 'completed' ? 'completed' : activeTab)
    invalidate()
  }

  const deleteTrip = async (trip: DriverTripRow) => {
    const ok = await confirm({
      title: 'Delete this trip?',
      message: 'It will be removed permanently.',
      confirmLabel: 'Delete',
      danger: true,
    })
    if (!ok) return

    setBusyId(trip.id)
    const { error } = await supabase.from('trips').delete().eq('id', trip.id).eq('driver_id', user!.id)
    setBusyId(null)
    if (error) {
      toast(
        /foreign key/i.test(error.message) ? 'This trip has booking history, so it can’t be deleted. It stays under Cancelled.' : getErrorMessage(error),
        'error'
      )
      return
    }
    toast('Trip deleted.')
    invalidate()
  }

  const all = trips || []
  const completed = all.filter((t) => t.status === 'completed')
  const stats = {
    upcoming: all.filter((t) => t.status === 'scheduled').length,
    completed: completed.length,
    earnings: completed.reduce((sum, t) => sum + (t.total_seats - t.available_seats) * t.price_per_seat, 0),
  }
  const onTheRoad = all.filter((t) => t.status === 'departed')
  const visibleTrips = all.filter((t) => t.status === activeTab)
  if (activeTab !== 'scheduled') visibleTrips.reverse() // newest first for history

  const firstName = profile?.full_name?.split(' ')[0]

  return (
    <PageContainer>
      <PageHeader
        title={firstName ? `Hello, ${firstName}` : 'My trips'}
        subtitle="Your departures, bookings and earnings."
        action={<LinkButton to="/driver/create-trip">Post a trip</LinkButton>}
      />

      {/* Location sharing */}
      <div
        className={`mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4 ${
          location.sharing ? 'bg-route text-white' : onTheRoad.length > 0 ? 'border-2 border-taxi bg-taxi-soft' : 'border border-line bg-card'
        }`}
      >
        <div className="min-w-0">
          <p className="font-semibold">{location.sharing ? 'Sharing your location' : 'Location sharing is off'}</p>
          <p className={`text-sm ${location.sharing ? 'text-white/80' : 'text-muted'}`}>
            {location.sharing
              ? 'Passengers on trips that are on the road can see you on a map. Keep this page open.'
              : onTheRoad.length > 0
                ? 'You have a trip on the road. Share your location so passengers can follow you.'
                : 'Turn it on when you leave so passengers know where you are.'}
          </p>
        </div>
        <Button
          variant={location.sharing ? 'secondary' : onTheRoad.length > 0 ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => (location.sharing ? void location.stop() : location.start())}
        >
          {location.sharing ? 'Stop sharing' : 'Share location'}
        </Button>
      </div>
      {location.error && (
        <div className="-mt-3 mb-6">
          <Notice>{location.error}</Notice>
        </div>
      )}

      {/* Stats */}
      <div className="mb-8 grid grid-cols-3 gap-3">
        {[
          { label: 'Upcoming', value: String(stats.upcoming) },
          { label: 'Completed', value: String(stats.completed) },
          { label: 'Earned', value: formatXAF(stats.earnings) },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-line bg-card px-4 py-3">
            <p className="text-xs font-semibold text-muted sm:text-sm">{s.label}</p>
            <p className="mt-1 truncate text-lg font-extrabold sm:text-2xl">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="-mx-4 mb-4 flex gap-1 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0" role="tablist">
        {TABS.map((tab) => {
          const count = all.filter((t) => t.status === tab.key).length
          return (
            <button
              key={tab.key}
              role="tab"
              aria-selected={activeTab === tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`-mb-px shrink-0 border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors ${
                activeTab === tab.key ? 'border-ink text-ink' : 'border-transparent text-muted hover:text-ink'
              }`}
            >
              {tab.label}
              {count > 0 && <span className="ml-1.5 rounded-full bg-line px-1.5 py-0.5 text-xs">{count}</span>}
            </button>
          )
        })}
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      )}

      {isError && <EmptyState title="Couldn’t load your trips" message="Check your connection and try again." action={<Button onClick={() => refetch()}>Try again</Button>} />}

      {!isLoading && !isError && visibleTrips.length === 0 && (
        <EmptyState
          title={activeTab === 'scheduled' ? 'No upcoming trips' : `No ${TABS.find((t) => t.key === activeTab)?.label.toLowerCase()} trips`}
          message={activeTab === 'scheduled' ? 'Post your next departure so passengers can book seats before they reach the park.' : undefined}
          action={activeTab === 'scheduled' ? <LinkButton to="/driver/create-trip">Post a trip</LinkButton> : undefined}
        />
      )}

      <div className="space-y-3">
        {visibleTrips.map((trip) => {
          const booked = trip.total_seats - trip.available_seats
          const overdue = trip.status === 'scheduled' && isPastDeparture(trip.departure_date, trip.departure_time)
          const busy = busyId === trip.id

          return (
            <article key={trip.id} className="overflow-hidden rounded-2xl border border-line bg-card">
              <button onClick={() => setDetailsTripId(trip.id)} className="flex w-full items-stretch text-left hover:bg-paper/60">
                <div className="flex w-[84px] shrink-0 flex-col items-center justify-center bg-ink px-2 py-3 text-center">
                  <span className="font-condensed text-[28px] font-extrabold leading-none text-taxi">{formatTripTime(trip.departure_time)}</span>
                  <span className="mt-1 text-[11px] font-semibold text-white/70">{formatTripDate(trip.departure_date)}</span>
                </div>
                <div className="min-w-0 flex-1 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <RouteLabel from={trip.park?.name || 'Unknown park'} to={trip.route?.destination || 'Unknown'} size="sm" />
                    <TripStatusBadge status={trip.status} />
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line" aria-hidden="true">
                      <div className="h-full rounded-full bg-taxi" style={{ width: `${(booked / Math.max(1, trip.total_seats)) * 100}%` }} />
                    </div>
                    <span className="shrink-0 text-xs font-semibold text-muted">
                      {booked}/{trip.total_seats} booked, {formatXAF(trip.price_per_seat)}
                    </span>
                  </div>
                </div>
              </button>

              {overdue && (
                <p className="border-t border-line bg-taxi-soft px-4 py-2 text-sm text-[#7a5c00]">Departure time has passed. Mark it as departed or cancel it.</p>
              )}

              {(trip.status === 'scheduled' || trip.status === 'departed' || booked === 0) && (
                <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-3 py-2.5">
                  {trip.status === 'scheduled' && (
                    <>
                      {booked === 0 && (
                        <Button size="sm" variant="ghost" className="mr-auto text-muted" disabled={busy} onClick={() => deleteTrip(trip)}>
                          Delete
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="text-danger" disabled={busy} onClick={() => updateStatus(trip, 'cancelled')}>
                        Cancel
                      </Button>
                      <Link to={`/driver/edit-trip/${trip.id}`} className="inline-flex h-9 items-center rounded-xl px-3 text-sm font-semibold hover:bg-ink/5">
                        Edit
                      </Link>
                      <Button size="sm" variant="dark" loading={busy} onClick={() => updateStatus(trip, 'departed')}>
                        Mark departed
                      </Button>
                    </>
                  )}
                  {trip.status === 'departed' && (
                    <Button size="sm" variant="dark" loading={busy} onClick={() => updateStatus(trip, 'completed')}>
                      Mark completed
                    </Button>
                  )}
                  {(trip.status === 'completed' || trip.status === 'cancelled') && booked === 0 && (
                    <Button size="sm" variant="ghost" className="text-muted" loading={busy} onClick={() => deleteTrip(trip)}>
                      Delete
                    </Button>
                  )}
                </div>
              )}
            </article>
          )
        })}
      </div>

      {detailsTripId && <TripDetailsModal tripId={detailsTripId} onClose={() => setDetailsTripId(null)} />}
    </PageContainer>
  )
}
