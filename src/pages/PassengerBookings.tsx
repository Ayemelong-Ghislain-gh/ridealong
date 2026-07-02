import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { LoadingCar } from '../components/LoadingCar'
import { BookingDetailsModal } from '../components/BookingDetailsModal'
import { ReviewModal } from '../components/ReviewModal'

const STATUS_STYLES: Record<string, string> = {
  confirmed: 'bg-blue-100 text-blue-800',
  cancelled: 'bg-red-100 text-red-800',
  completed: 'bg-green-100 text-green-800',
}

// Explicit shape for the joined query below. Without generated Supabase
// `Database` types, `.select()` can't tell that `trip:trips!fkey(...)` and
// its nested `driver`/`route`/`park` relations are to-one, so it defaults
// to typing all of them as arrays. This interface (plus the
// `as unknown as` cast in queryFn) fixes that.
interface BookingTripRow {
  driver_id: string
  departure_date: string
  departure_time: string
  price_per_seat: number
  driver: { full_name: string } | null
  route: { destination: string } | null
  park: { name: string } | null
}

interface BookingRow {
  id: string
  seats_booked: number
  status: string
  booking_reference: string
  created_at: string
  trip: BookingTripRow | null
}

export default function PassengerBookings() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [detailsBooking, setDetailsBooking] = useState<any | null>(null)
  const [reviewingBooking, setReviewingBooking] = useState<any | null>(null)

  const { data: bookings, isLoading } = useQuery({
    queryKey: ['my-bookings', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          id, seats_booked, status, booking_reference, created_at,
          trip:trips!bookings_trip_id_fkey (
            driver_id,
            departure_date, departure_time, price_per_seat,
            driver:users!trips_driver_id_fkey (full_name),
            route:routes!trips_route_id_fkey (destination),
            park:taxi_parks!trips_park_id_fkey (name)
          )
        `)
        .eq('passenger_id', user!.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data || []) as unknown as BookingRow[]
    },
  })

  const { data: reviewedBookingIds } = useQuery({
    queryKey: ['my-reviews', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reviews')
        .select('booking_id')
        .eq('passenger_id', user!.id)

      if (error) throw error
      return new Set((data || []).map((r) => r.booking_id))
    },
  })

  const cancelBooking = async (bookingId: string) => {
    if (!confirm('Cancel this booking? Your seats will be released.')) return

    setCancellingId(bookingId)
    const { error } = await supabase
      .from('bookings')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
      .eq('id', bookingId)

    setCancellingId(null)

    if (error) {
      alert('Failed to cancel booking: ' + error.message)
      return
    }
    queryClient.invalidateQueries({ queryKey: ['my-bookings', user?.id] })
    queryClient.invalidateQueries({ queryKey: ['trips'] })
  }

  const deleteBooking = async (bookingId: string) => {
    if (!confirm('Remove this booking from your history? This cannot be undone.')) return

    setDeletingId(bookingId)
    const { error } = await supabase.from('bookings').delete().eq('id', bookingId)
    setDeletingId(null)

    if (error) {
      alert('Failed to remove booking: ' + error.message)
      return
    }
    queryClient.invalidateQueries({ queryKey: ['my-bookings', user?.id] })
  }

  const handleReviewSubmitted = () => {
    setReviewingBooking(null)
    queryClient.invalidateQueries({ queryKey: ['my-reviews', user?.id] })
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-800 mb-6 mt-2">My Bookings</h1>

        {isLoading && <LoadingCar label="Loading your bookings..." />}

        {!isLoading && (!bookings || bookings.length === 0) && (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <p className="text-gray-600">You don't have any bookings yet.</p>
          </div>
        )}

        <div className="space-y-4">
          {bookings?.map((booking) => {
            const alreadyReviewed = reviewedBookingIds?.has(booking.id)
            const canReview = booking.status === 'completed' && !alreadyReviewed

            return (
              <div key={booking.id} className="bg-white rounded-lg shadow p-4">
                <div className="flex justify-between items-start flex-wrap gap-3">
                  <button onClick={() => setDetailsBooking(booking)} className="text-left flex-1 min-w-[180px] hover:opacity-80">
                    <p className="font-semibold text-gray-800">{booking.trip?.route?.destination}</p>
                    <p className="text-sm text-gray-600">
                      {booking.trip?.departure_date} at {booking.trip?.departure_time?.slice(0, 5)}
                    </p>
                    <p className="text-sm text-gray-600">Ref: {booking.booking_reference}</p>
                    <p className="text-sm text-gray-600">
                      {booking.seats_booked} seat{booking.seats_booked > 1 ? 's' : ''} ·{' '}
                      {((booking.trip?.price_per_seat || 0) * booking.seats_booked).toLocaleString()} XAF
                    </p>
                  </button>

                  <div className="flex flex-col items-end gap-2">
                    <span className={`text-xs px-2 py-1 rounded-full capitalize ${STATUS_STYLES[booking.status]}`}>
                      {booking.status}
                    </span>
                    {booking.status === 'confirmed' && (
                      <button
                        onClick={() => cancelBooking(booking.id)}
                        disabled={cancellingId === booking.id}
                        className="text-sm text-red-600 hover:underline disabled:opacity-50"
                      >
                        {cancellingId === booking.id ? 'Cancelling...' : 'Cancel'}
                      </button>
                    )}
                    {canReview && (
                      <button
                        onClick={() => setReviewingBooking(booking)}
                        className="text-sm text-amber-600 hover:underline font-medium"
                      >
                        ★ Rate Driver
                      </button>
                    )}
                    {alreadyReviewed && booking.status === 'completed' && (
                      <span className="text-xs text-gray-400">Rated ✓</span>
                    )}
                    {(booking.status === 'cancelled' || booking.status === 'completed') && (
                      <button
                        onClick={() => deleteBooking(booking.id)}
                        disabled={deletingId === booking.id}
                        className="text-sm text-gray-500 hover:underline disabled:opacity-50"
                      >
                        {deletingId === booking.id ? 'Removing...' : 'Remove'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {detailsBooking && <BookingDetailsModal booking={detailsBooking} onClose={() => setDetailsBooking(null)} />}

      {reviewingBooking && (
        <ReviewModal
          bookingId={reviewingBooking.id}
          driverId={reviewingBooking.trip.driver_id}
          driverName={reviewingBooking.trip?.driver?.full_name || 'your driver'}
          destination={reviewingBooking.trip?.route?.destination || 'this trip'}
          passengerId={user!.id}
          onClose={() => setReviewingBooking(null)}
          onSubmitted={handleReviewSubmitted}
        />
      )}
    </div>
  )
}
