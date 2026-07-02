import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { LoadingCar } from './LoadingCar'

interface TripDetailsModalProps {
  tripId: string
  onClose: () => void
}

interface PassengerBooking {
  id: string
  seats_booked: number
  status: string
  booking_reference: string
  passenger: { full_name: string; phone: string } | null
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

export function TripDetailsModal({ tripId, onClose }: TripDetailsModalProps) {
  const [trip, setTrip] = useState<TripInfo | null>(null)
  const [bookings, setBookings] = useState<PassengerBooking[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase
        .from('trips')
        .select(`
          departure_date, departure_time, price_per_seat, total_seats,
          available_seats, status, notes,
          route:routes!trips_route_id_fkey (destination),
          park:taxi_parks!trips_park_id_fkey (name)
        `)
        .eq('id', tripId)
        .single(),
      supabase
        .from('bookings')
        .select(`
          id, seats_booked, status, booking_reference,
          passenger:users!bookings_passenger_id_fkey (full_name, phone)
        `)
        .eq('trip_id', tripId)
        .order('created_at', { ascending: true }),
    ]).then(([tripRes, bookingsRes]) => {
      setTrip(tripRes.data as any)
      setBookings((bookingsRes.data as any) || [])
      setLoading(false)
    })
  }, [tripId])

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 max-h-[85vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-xl font-bold text-gray-800">Trip Details</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">
            ×
          </button>
        </div>

        {loading && <LoadingCar label="Loading details..." />}

        {!loading && trip && (
          <>
            <div className="space-y-1 text-sm mb-4">
              <p className="font-semibold text-gray-800 text-base">
                {trip.park?.name} → {trip.route?.destination}
              </p>
              <p className="text-gray-600">
                {trip.departure_date} at {trip.departure_time?.slice(0, 5)}
              </p>
              <p className="text-gray-600">
                {trip.price_per_seat.toLocaleString()} XAF/seat · {trip.total_seats - trip.available_seats}/
                {trip.total_seats} seats booked
              </p>
              {trip.notes && <p className="text-gray-600 italic">"{trip.notes}"</p>}
              <span className="inline-block mt-1 text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700 capitalize">
                {trip.status}
              </span>
            </div>

            <div className="border-t pt-4">
              <h3 className="font-medium text-gray-700 mb-2 text-sm">
                Passengers ({bookings.filter((b) => b.status === 'confirmed').length})
              </h3>
              {bookings.length === 0 && <p className="text-sm text-gray-400">No bookings yet.</p>}
              <div className="space-y-2">
                {bookings.map((b) => (
                  <div key={b.id} className="flex justify-between items-center text-sm bg-gray-50 rounded-lg px-3 py-2">
                    <div>
                      <p className="font-medium text-gray-800">{b.passenger?.full_name || 'Unknown'}</p>
                      <p className="text-gray-500">
                        {b.passenger?.phone} · {b.seats_booked} seat{b.seats_booked > 1 ? 's' : ''} · Ref:{' '}
                        {b.booking_reference}
                      </p>
                    </div>
                    <span
                      className={`text-xs px-2 py-1 rounded-full capitalize ${
                        b.status === 'confirmed' ? 'bg-blue-100 text-blue-800' : 'bg-gray-200 text-gray-600'
                      }`}
                    >
                      {b.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
