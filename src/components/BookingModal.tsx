import { useState } from 'react'
import { supabase } from '../lib/supabase'

interface BookingModalProps {
  tripId: string
  tripDestination: string
  tripDate: string
  tripTime: string
  pricePerSeat: number
  availableSeats: number
  onClose: () => void
  onBookingComplete: () => void
  passengerId: string
}

export function BookingModal({
  tripId,
  tripDestination,
  tripDate,
  tripTime,
  pricePerSeat,
  availableSeats,
  onClose,
  onBookingComplete,
  passengerId
}: BookingModalProps) {
  const [seats, setSeats] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const totalPrice = seats * pricePerSeat

  const handleBook = async () => {
    if (seats > availableSeats) {
      setError(`Only ${availableSeats} seats available`)
      return
    }

    setLoading(true)
    setError('')

    try {
      const { error: bookingError } = await supabase
        .from('bookings')
        .insert([{
          trip_id: tripId,
          passenger_id: passengerId,
          seats_booked: seats,
          status: 'confirmed'
        }])

      if (bookingError) throw bookingError

      onClose()
      onBookingComplete()
    } catch (err) {
      console.error('Booking error:', err)
      const message = err instanceof Error ? err.message : 'Booking failed'
      setError(
        message.includes('Not enough available seats')
          ? 'Sorry, those seats were just taken — please refresh and try again.'
          : message
      )
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <h2 className="text-2xl font-bold text-gray-800">Book Seats</h2>
        
        <div className="mt-4 space-y-2">
          <p><span className="font-semibold">Destination:</span> {tripDestination}</p>
          <p><span className="font-semibold">Departure:</span> {tripDate} at {tripTime}</p>
          <p><span className="font-semibold">Price per seat:</span> {pricePerSeat.toLocaleString()} XAF</p>
          <p><span className="font-semibold">Available seats:</span> {availableSeats}</p>
        </div>

        <div className="mt-4">
          <label className="block text-gray-700 font-medium mb-2">
            Number of Seats
          </label>
          <input
            type="number"
            min="1"
            max={Math.min(availableSeats, 5)}
            value={seats}
            onChange={(e) => setSeats(Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-sm text-gray-500 mt-1">
            Max {Math.min(availableSeats, 5)} seats per booking
          </p>
        </div>

        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <p className="font-semibold">Total: {totalPrice.toLocaleString()} XAF</p>
        </div>

        {error && (
          <div className="mt-3 p-2 bg-red-50 text-red-600 text-sm rounded">
            {error}
          </div>
        )}

        <div className="mt-6 flex gap-3">
          <button
            onClick={handleBook}
            disabled={loading}
            className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Booking...' : 'Confirm Booking'}
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}