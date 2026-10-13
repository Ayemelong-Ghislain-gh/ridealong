import { lazy, Suspense, useState } from 'react'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { Avatar, BookingStatusBadge, TripStatusBadge } from './ui/Display'
import { ChatModal } from './ChatModal'
import { RouteLabel } from './RouteLabel'
import { formatTripDate, formatTripTime, formatXAF, plural } from '../lib/format'
import type { BookingRow } from '../types/rows'
import { useContactPhones } from '../hooks/useContactPhones'

// The map library is large; only download it when a trip is actually on the road
const LiveLocationMap = lazy(() => import('./LiveLocationMap').then((m) => ({ default: m.LiveLocationMap })))

interface BookingDetailsModalProps {
  booking: BookingRow
  currentUserId: string
  onClose: () => void
}

export function BookingDetailsModal({ booking, currentUserId, onClose }: BookingDetailsModalProps) {
  const [showChat, setShowChat] = useState(false)
  const trip = booking.trip
  const driverName = trip?.driver?.full_name || 'Your driver'
  const total = (trip?.price_per_seat || 0) * booking.seats_booked
  const isActive = booking.status === 'confirmed'
  const onTheRoad = isActive && trip?.status === 'departed'
  const { data: phones } = useContactPhones([trip?.driver_id], isActive)
  const driverPhone = trip ? phones?.[trip.driver_id] : undefined

  return (
    <Modal title="Booking details" onClose={onClose}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-muted">Reference</p>
          <p className="font-condensed text-2xl font-extrabold tracking-wide">{booking.booking_reference || '—'}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <BookingStatusBadge status={booking.status} />
          {trip && trip.status !== 'scheduled' && <TripStatusBadge status={trip.status} />}
        </div>
      </div>

      <div className="mt-4 rounded-xl bg-paper p-4">
        <p className="mb-3 text-sm font-semibold text-muted">
          {formatTripDate(trip?.departure_date)} at {formatTripTime(trip?.departure_time)}
        </p>
        <RouteLabel from={trip?.park?.name || 'Unknown park'} to={trip?.route?.destination || 'Unknown'} />
        <div className="mt-4 flex items-baseline justify-between border-t border-line pt-3 text-sm">
          <span className="text-muted">
            {plural(booking.seats_booked, 'seat')} × {formatXAF(trip?.price_per_seat)}
          </span>
          <span className="text-base font-extrabold">{formatXAF(total)}</span>
        </div>
      </div>

      {trip?.driver && (
        <div className="mt-4 flex items-center gap-3">
          <Avatar name={trip.driver.full_name} url={trip.driver.avatar_url} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{driverName}</p>
            <p className="text-sm text-muted">Your driver</p>
          </div>
          {isActive && driverPhone && (
            <a
              href={`tel:${driverPhone}`}
              className="flex h-10 items-center rounded-full border border-line px-4 text-sm font-semibold hover:border-ink/30"
            >
              Call
            </a>
          )}
        </div>
      )}

      {isActive && trip && (
        <>
          <div className="mt-5">
            <p className="mb-2 text-sm font-semibold">Where’s my driver?</p>
            {onTheRoad ? (
              <Suspense fallback={<div className="flex h-56 items-center justify-center rounded-xl bg-paper text-sm text-muted">Loading map...</div>}>
                <LiveLocationMap driverId={trip.driver_id} driverName={driverName} />
              </Suspense>
            ) : (
              <p className="rounded-xl bg-paper px-4 py-3 text-sm text-muted">
                The live map turns on once {driverName} marks the trip as departed.
              </p>
            )}
          </div>

          <Button variant="secondary" block className="mt-5" onClick={() => setShowChat(true)}>
            Message {driverName.split(' ')[0]}
          </Button>
        </>
      )}

      <p className="mt-5 text-xs text-faint">Booked {new Date(booking.created_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</p>

      {showChat && (
        <ChatModal
          bookingId={booking.id}
          currentUserId={currentUserId}
          otherPartyName={driverName}
          subtitle={`${trip?.park?.name ?? ''} to ${trip?.route?.destination ?? ''}, ${formatTripDate(trip?.departure_date)}`}
          onClose={() => setShowChat(false)}
        />
      )}
    </Modal>
  )
}
