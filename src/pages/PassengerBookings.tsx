import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useFeedback } from '../context/FeedbackContext'
import { PageContainer } from '../components/AppLayout'
import { BookingDetailsModal } from '../components/BookingDetailsModal'
import { ReviewModal } from '../components/ReviewModal'
import { RouteLabel } from '../components/RouteLabel'
import { Button, LinkButton } from '../components/ui/Button'
import { BookingStatusBadge, EmptyState, PageHeader, Skeleton, TripStatusBadge } from '../components/ui/Display'
import { formatTripDate, formatTripTime, formatXAF, isPastDeparture, plural } from '../lib/format'
import { getErrorMessage } from '../lib/errors'
import { BOOKING_SELECT } from '../types/rows'
import type { BookingRow } from '../types/rows'

type Tab = 'upcoming' | 'past'

export default function PassengerBookings() {
  const { user } = useAuth()
  const { toast, confirm } = useFeedback()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<Tab>('upcoming')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [detailsBooking, setDetailsBooking] = useState<BookingRow | null>(null)
  const [reviewingBooking, setReviewingBooking] = useState<BookingRow | null>(null)

  const { data: bookings, isLoading, isError, refetch } = useQuery({
    queryKey: ['my-bookings', user?.id],
    enabled: !!user,
    refetchInterval: 60_000, // pick up driver status changes (departed, completed)
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select(BOOKING_SELECT)
        .eq('passenger_id', user!.id)
        .eq('hidden_by_passenger', false)
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data || []) as unknown as BookingRow[]
    },
  })

  const { data: reviewedBookingIds } = useQuery({
    queryKey: ['my-reviews', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from('reviews').select('booking_id').eq('passenger_id', user!.id)
      if (error) throw error
      return new Set((data || []).map((r) => r.booking_id as string))
    },
  })

  const { upcoming, past } = useMemo(() => {
    const up: BookingRow[] = []
    const old: BookingRow[] = []
    for (const b of bookings || []) {
      const live =
        b.status === 'confirmed' &&
        (b.trip?.status === 'departed' || (b.trip?.status === 'scheduled' && !isPastDeparture(b.trip.departure_date, b.trip.departure_time)))
      ;(live ? up : old).push(b)
    }
    // Soonest departure first for upcoming
    up.sort((a, b) => `${a.trip?.departure_date}${a.trip?.departure_time}`.localeCompare(`${b.trip?.departure_date}${b.trip?.departure_time}`))
    return { upcoming: up, past: old }
  }, [bookings])

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['my-bookings', user?.id] })
    queryClient.invalidateQueries({ queryKey: ['trips'] })
  }

  const cancelBooking = async (booking: BookingRow) => {
    const ok = await confirm({
      title: 'Cancel this booking?',
      message: `Your ${plural(booking.seats_booked, 'seat')} to ${booking.trip?.route?.destination ?? 'your destination'} will be released for other passengers.`,
      confirmLabel: 'Cancel booking',
      cancelLabel: 'Keep it',
      danger: true,
    })
    if (!ok) return

    setBusyId(booking.id)
    const { error } = await supabase
      .from('bookings')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
      .eq('id', booking.id)
      .eq('status', 'confirmed')
    setBusyId(null)

    if (error) {
      toast(getErrorMessage(error, 'Booking not cancelled. Try again.'), 'error')
      return
    }
    toast('Booking cancelled.')
    refresh()
  }

  const hideBooking = async (booking: BookingRow) => {
    const ok = await confirm({
      title: 'Remove from your list?',
      message: 'It disappears from your bookings. The driver keeps their record of the trip.',
      confirmLabel: 'Remove',
      cancelLabel: 'Keep it',
    })
    if (!ok) return

    setBusyId(booking.id)
    const { error } = await supabase.from('bookings').update({ hidden_by_passenger: true }).eq('id', booking.id)
    setBusyId(null)

    if (error) {
      toast(getErrorMessage(error, 'Couldn’t remove it. Try again.'), 'error')
      return
    }
    toast('Removed from your list.')
    refresh()
  }

  const list = tab === 'upcoming' ? upcoming : past

  return (
    <PageContainer width="md">
      <PageHeader title="My bookings" action={<LinkButton to="/trips" variant="secondary" size="sm">Find a trip</LinkButton>} />

      <div className="mb-5 inline-flex rounded-xl bg-line/60 p-1" role="tablist">
        {(
          [
            ['upcoming', `Upcoming${upcoming.length ? ` (${upcoming.length})` : ''}`],
            ['past', 'Past'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`h-9 rounded-lg px-4 text-sm font-semibold transition-colors ${tab === key ? 'bg-card text-ink shadow-sm' : 'text-muted hover:text-ink'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-36" />
          ))}
        </div>
      )}

      {isError && (
        <EmptyState title="Couldn’t load your bookings" message="Check your connection and try again." action={<Button onClick={() => refetch()}>Try again</Button>} />
      )}

      {!isLoading && !isError && list.length === 0 && (
        <EmptyState
          title={tab === 'upcoming' ? 'No upcoming trips' : 'No past trips yet'}
          message={tab === 'upcoming' ? 'Book a seat and it shows up here with your reference.' : 'Trips you’ve taken or cancelled appear here.'}
          action={tab === 'upcoming' ? <LinkButton to="/trips">Find a trip</LinkButton> : undefined}
        />
      )}

      <div className="space-y-3">
        {list.map((booking) => {
          const trip = booking.trip
          const alreadyReviewed = reviewedBookingIds?.has(booking.id)
          const canReview = booking.status === 'completed' && !alreadyReviewed
          const canCancel = booking.status === 'confirmed' && trip?.status === 'scheduled'
          const canHide = booking.status === 'cancelled' || booking.status === 'completed'

          return (
            <article key={booking.id} className="overflow-hidden rounded-2xl border border-line bg-card">
              <button onClick={() => setDetailsBooking(booking)} className="block w-full p-4 text-left hover:bg-paper/60">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold">
                    <span className="font-condensed text-xl font-extrabold">{formatTripTime(trip?.departure_time)}</span>
                    <span className="ml-2 text-muted">{formatTripDate(trip?.departure_date)}</span>
                  </p>
                  <div className="flex gap-1.5">
                    {trip?.status === 'departed' && booking.status === 'confirmed' ? (
                      <TripStatusBadge status="departed" />
                    ) : (
                      <BookingStatusBadge status={booking.status} />
                    )}
                  </div>
                </div>
                <RouteLabel from={trip?.park?.name || 'Unknown park'} to={trip?.route?.destination || 'Unknown'} size="sm" />
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
                  <span>
                    Ref <span className="font-semibold text-ink">{booking.booking_reference}</span>
                  </span>
                  <span>
                    {plural(booking.seats_booked, 'seat')}, <span className="font-semibold text-ink">{formatXAF((trip?.price_per_seat || 0) * booking.seats_booked)}</span>
                  </span>
                </div>
              </button>

              {(canCancel || canReview || canHide || alreadyReviewed) && (
                <div className="flex items-center justify-end gap-2 border-t border-line px-4 py-2.5">
                  {alreadyReviewed && booking.status === 'completed' && <span className="mr-auto text-xs font-semibold text-route">Rated, thank you</span>}
                  {canReview && (
                    <Button size="sm" onClick={() => setReviewingBooking(booking)}>
                      Rate driver
                    </Button>
                  )}
                  {canCancel && (
                    <Button size="sm" variant="ghost" className="text-danger" loading={busyId === booking.id} onClick={() => cancelBooking(booking)}>
                      Cancel booking
                    </Button>
                  )}
                  {canHide && (
                    <Button size="sm" variant="ghost" className="text-muted" loading={busyId === booking.id} onClick={() => hideBooking(booking)}>
                      Remove
                    </Button>
                  )}
                </div>
              )}
            </article>
          )
        })}
      </div>

      {detailsBooking && user && <BookingDetailsModal booking={detailsBooking} currentUserId={user.id} onClose={() => setDetailsBooking(null)} />}

      {reviewingBooking && user && reviewingBooking.trip && (
        <ReviewModal
          bookingId={reviewingBooking.id}
          driverId={reviewingBooking.trip.driver_id}
          driverName={reviewingBooking.trip.driver?.full_name || 'your driver'}
          destination={reviewingBooking.trip.route?.destination || 'your destination'}
          passengerId={user.id}
          onClose={() => setReviewingBooking(null)}
          onSubmitted={() => {
            setReviewingBooking(null)
            toast('Thanks. Your rating helps other passengers.')
            queryClient.invalidateQueries({ queryKey: ['my-reviews', user.id] })
          }}
        />
      )}
    </PageContainer>
  )
}
