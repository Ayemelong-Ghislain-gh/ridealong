import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Modal } from './ui/Modal'
import { Avatar, BookingStatusBadge, TripStatusBadge } from './ui/Display'
import { LoadingCar } from './LoadingCar'
import { RouteLabel } from './RouteLabel'
import { ChatModal } from './ChatModal'
import { formatTripDate, formatTripTime, formatXAF, plural } from '../lib/format'

interface TripDetailsModalProps {
  tripId: string
  onClose: () => void
}

interface PassengerBooking {
  id: string
  seats_booked: number
  status: string
  booking_reference: string
  passenger: { full_name: string | null; phone: string | null; avatar_url: string | null } | null
}

interface TripInfo {
  departure_date: string
  departure_time: string
  price_per_seat: number
  total_seats: number
  available_seats: number
  status: string
  notes: string | null
  route: { destination: string } | null
  park: { name: string } | null
}

/** Driver's view of one trip: who booked, how to reach them. */
export function TripDetailsModal({ tripId, onClose }: TripDetailsModalProps) {
  const { user } = useAuth()
  const [chatWith, setChatWith] = useState<PassengerBooking | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['trip-details', tripId],
    queryFn: async () => {
      const [tripRes, bookingsRes] = await Promise.all([
        supabase
          .from('trips')
          .select(
            `departure_date, departure_time, price_per_seat, total_seats, available_seats, status, notes,
             route:routes!trips_route_id_fkey (destination),
             park:taxi_parks!trips_park_id_fkey (name)`
          )
          .eq('id', tripId)
          .single(),
        supabase
          .from('bookings')
          .select(
            `id, seats_booked, status, booking_reference,
             passenger:users!bookings_passenger_id_fkey (full_name, phone, avatar_url)`
          )
          .eq('trip_id', tripId)
          .order('created_at', { ascending: true }),
      ])
      return {
        trip: tripRes.data as unknown as TripInfo | null,
        bookings: (bookingsRes.data || []) as unknown as PassengerBooking[],
      }
    },
  })

  const trip = data?.trip
  const active = (data?.bookings || []).filter((b) => b.status !== 'cancelled')
  const cancelled = (data?.bookings || []).filter((b) => b.status === 'cancelled')
  const bookedSeats = active.reduce((sum, b) => sum + b.seats_booked, 0)

  return (
    <Modal title="Trip details" onClose={onClose} size="lg">
      {isLoading && <LoadingCar label="Loading trip..." />}

      {trip && (
        <>
          <div className="rounded-xl bg-paper p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-muted">
                {formatTripDate(trip.departure_date)} at {formatTripTime(trip.departure_time)}
              </p>
              <TripStatusBadge status={trip.status} />
            </div>
            <RouteLabel from={trip.park?.name || 'Unknown park'} to={trip.route?.destination || 'Unknown'} />
            <div className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-3 text-center">
              <div>
                <p className="text-lg font-extrabold">
                  {bookedSeats}/{trip.total_seats}
                </p>
                <p className="text-xs text-muted">seats booked</p>
              </div>
              <div>
                <p className="text-lg font-extrabold">{formatXAF(trip.price_per_seat)}</p>
                <p className="text-xs text-muted">per seat</p>
              </div>
              <div>
                <p className="text-lg font-extrabold">{formatXAF(bookedSeats * trip.price_per_seat)}</p>
                <p className="text-xs text-muted">expected</p>
              </div>
            </div>
            {trip.notes && <p className="mt-3 border-t border-line pt-3 text-sm text-muted">“{trip.notes}”</p>}
          </div>

          <h3 className="mt-6 text-sm font-bold">Passengers</h3>
          {active.length === 0 && <p className="mt-2 text-sm text-muted">No bookings yet. Passengers who book appear here.</p>}

          <ul className="mt-2 divide-y divide-line">
            {active.map((b) => (
              <li key={b.id} className="flex items-center gap-3 py-3">
                <Avatar name={b.passenger?.full_name} url={b.passenger?.avatar_url} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{b.passenger?.full_name || 'Passenger'}</p>
                  <p className="text-sm text-muted">
                    {plural(b.seats_booked, 'seat')}, ref {b.booking_reference}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  {b.passenger?.phone && (
                    <a
                      href={`tel:${b.passenger.phone}`}
                      aria-label={`Call ${b.passenger.full_name ?? 'passenger'}`}
                      className="flex h-10 items-center rounded-full border border-line px-3.5 text-sm font-semibold hover:border-ink/30"
                    >
                      Call
                    </a>
                  )}
                  {b.status === 'confirmed' && (
                    <button
                      onClick={() => setChatWith(b)}
                      className="flex h-10 items-center rounded-full bg-ink px-3.5 text-sm font-semibold text-white hover:bg-ink-soft"
                    >
                      Message
                    </button>
                  )}
                  {b.status !== 'confirmed' && <BookingStatusBadge status={b.status} />}
                </div>
              </li>
            ))}
          </ul>

          {cancelled.length > 0 && (
            <p className="mt-3 text-xs text-faint">
              {plural(cancelled.length, 'booking')} cancelled by passengers.
            </p>
          )}
        </>
      )}

      {chatWith && user && (
        <ChatModal
          bookingId={chatWith.id}
          currentUserId={user.id}
          otherPartyName={chatWith.passenger?.full_name || 'Passenger'}
          subtitle={trip ? `${trip.park?.name ?? ''} to ${trip.route?.destination ?? ''}, ${formatTripDate(trip.departure_date)}` : undefined}
          onClose={() => setChatWith(null)}
        />
      )}
    </Modal>
  )
}
