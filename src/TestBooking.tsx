import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'

export function TestBooking() {
  const [trips, setTrips] = useState<any[]>([])
  const [user, setUser] = useState<any>(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    const loadData = async () => {
      // Get user
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)

      // Get trips
      const { data, error } = await supabase
        .from('trips')
        .select(`
          id,
          departure_date,
          departure_time,
          price_per_seat,
          available_seats,
          status,
          users!trips_driver_id_fkey (
            full_name
          )
        `)
        .eq('status', 'scheduled')
        .gt('available_seats', 0)
        .limit(1)

      if (!error && data) {
        setTrips(data)
        setMessage('✅ Trip loaded')
      } else {
        setMessage('❌ No trips found')
      }
    }

    loadData()
  }, [])

  const handleBook = async () => {
    if (!user) {
      setMessage('❌ Please login first')
      return
    }

    if (trips.length === 0) {
      setMessage('❌ No trips available')
      return
    }

    const trip = trips[0]
    setMessage('📝 Booking...')

    try {
      const { data, error } = await supabase
        .from('bookings')
        .insert([{
          trip_id: trip.id,
          passenger_id: user.id,
          seats_booked: 1,
          status: 'confirmed'
        }])
        .select()
        .single()

      if (error) {
        setMessage('❌ Error: ' + error.message)
        return
      }

      setMessage('✅ Booking successful! Booking ID: ' + data.id)
    } catch (err) {
      setMessage('❌ Error: ' + (err instanceof Error ? err.message : 'Unknown'))
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
        <h1 className="text-2xl font-bold text-blue-600">🚗 Test Booking</h1>
        
        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
          <p><strong>Status:</strong> {message}</p>
          <p><strong>User:</strong> {user?.email || 'Not logged in'}</p>
          <p><strong>Trips found:</strong> {trips.length}</p>
          {trips.length > 0 && (
            <div className="mt-2 text-sm">
              <p><strong>Trip ID:</strong> {trips[0].id}</p>
              <p><strong>Available seats:</strong> {trips[0].available_seats}</p>
              <p><strong>Price:</strong> {trips[0].price_per_seat} XAF</p>
            </div>
          )}
        </div>

        <button
          onClick={handleBook}
          className="mt-4 w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Test Book 1 Seat
        </button>
      </div>
    </div>
  )
}