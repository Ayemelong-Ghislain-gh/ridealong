import { useState, useMemo } from 'react'
import { Navigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Nav } from '../components/Nav'
import { BookingModal } from '../components/BookingModal'
import { LoadingCar } from '../components/LoadingCar'

interface DriverProfileInfo {
  is_verified_driver: boolean
  rating: number
  vehicle_make: string | null
  vehicle_model: string | null
}

export default function TripsPage() {
  const { user, role, loading: authLoading } = useAuth()
  const [selectedTrip, setSelectedTrip] = useState<any>(null)
  const [showBookingModal, setShowBookingModal] = useState(false)

  const [search, setSearch] = useState('')
  const [park, setPark] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const queryClient = useQueryClient()

  const { data: trips, isLoading } = useQuery({
    queryKey: ['trips'],
    enabled: role !== 'driver',
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trips')
        .select(`
          id,
          departure_date,
          departure_time,
          price_per_seat,
          available_seats,
          status,
          driver_id,
          users!trips_driver_id_fkey (
            full_name,
            id
          ),
          route:routes!trips_route_id_fkey (
            destination
          ),
          park:taxi_parks!trips_park_id_fkey (
            name,
            city
          )
        `)
        .eq('status', 'scheduled')
        .gt('available_seats', 0)
        .order('departure_datetime', { ascending: true })

      if (error) throw error
      return data || []
    },
  })

  const driverIds = useMemo(() => {
    const ids = new Set((trips || []).map((t: any) => t.driver_id))
    return Array.from(ids)
  }, [trips])

  const { data: driverProfiles } = useQuery({
    queryKey: ['trip-driver-profiles', driverIds],
    enabled: driverIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('driver_profiles')
        .select('id, is_verified_driver, rating, vehicle_make, vehicle_model')
        .in('id', driverIds)

      if (error) throw error
      const map: Record<string, DriverProfileInfo> = {}
      for (const row of data || []) {
        map[row.id] = row
      }
      return map
    },
  })

  const parkOptions = useMemo(() => {
    const names = new Set((trips || []).map((t: any) => t.park?.name).filter(Boolean))
    return Array.from(names) as string[]
  }, [trips])

  const filteredTrips = useMemo(() => {
    if (!trips) return []
    const term = search.trim().toLowerCase()

    return trips.filter((trip: any) => {
      if (term) {
        const destMatch = trip.route?.destination?.toLowerCase().includes(term)
        const parkMatch = trip.park?.name?.toLowerCase().includes(term)
        if (!destMatch && !parkMatch) return false
      }
      if (park && trip.park?.name !== park) return false
      if (dateFrom && trip.departure_date < dateFrom) return false
      if (dateTo && trip.departure_date > dateTo) return false
      return true
    })
  }, [trips, search, park, dateFrom, dateTo])

  const handleBookingComplete = async () => {
    await queryClient.invalidateQueries({ queryKey: ['trips'] })
    setShowBookingModal(false)
  }

  if (!authLoading && role === 'driver') {
    return <Navigate to="/driver/dashboard" replace />
  }

  const seatsBadge = (availableSeats: number) => {
    if (availableSeats <= 1) {
      return <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded-full">Almost Full</span>
    }
    if (availableSeats === 2) {
      return <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded-full">Filling Fast</span>
    }
    return (
      <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
        {availableSeats} seats left
      </span>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      <Nav />

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-6">Available Trips</h2>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search destination or park..."
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm lg:col-span-2"
          />
          <select
            value={park}
            onChange={(e) => setPark(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="">All parks</option>
            {parkOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-2 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-2 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
        </div>

        {(authLoading || isLoading) && <LoadingCar label="Loading trips..." />}

        {!authLoading && !isLoading && filteredTrips.length === 0 && (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow">
            <p className="text-gray-600 dark:text-gray-300">No trips match your search.</p>
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredTrips.map((trip: any) => {
            const driverInfo = driverProfiles?.[trip.driver_id]
            return (
              <div key={trip.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
                <div className="p-6">
                  <div className="flex justify-between items-start gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100 leading-snug">
                        From <span className="text-gray-900 dark:text-gray-50">{trip.park?.name || 'Unknown'}</span>
                        {' '}to{' '}
                        <span className="text-blue-600 dark:text-blue-400">{trip.route?.destination || 'Unknown'}</span>
                      </h3>
                    </div>
                    {seatsBadge(trip.available_seats)}
                  </div>

                  <div className="mt-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Departure:</span>
                      <span className="dark:text-gray-200">
                        {trip.departure_date} at {trip.departure_time?.slice(0, 5)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Price:</span>
                      <span className="font-medium text-blue-600">
                        {trip.price_per_seat.toLocaleString()} XAF
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Driver:</span>
                      <span className="flex items-center gap-1 dark:text-gray-200">
                        {trip.users?.full_name || 'Unknown'}
                        {driverInfo?.is_verified_driver && (
                          <span title="Verified driver" className="text-blue-500">
                            ✅
                          </span>
                        )}
                      </span>
                    </div>
                    {driverInfo && driverInfo.rating > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">Rating:</span>
                        <span className="text-amber-500">★ {driverInfo.rating.toFixed(1)}</span>
                      </div>
                    )}
                  </div>

                  <button
                    className="mt-4 w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors"
                    onClick={() => {
                      if (!user) {
                        alert('Please login first to book seats')
                        return
                      }
                      setSelectedTrip(trip)
                      setShowBookingModal(true)
                    }}
                  >
                    Book Seat
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </main>

      {showBookingModal && selectedTrip && user && (
        <BookingModal
          tripId={selectedTrip.id}
          tripDestination={selectedTrip.route?.destination || 'Unknown'}
          tripDate={selectedTrip.departure_date}
          tripTime={selectedTrip.departure_time?.slice(0, 5) || '00:00'}
          pricePerSeat={selectedTrip.price_per_seat}
          availableSeats={selectedTrip.available_seats}
          passengerId={user.id}
          onClose={() => setShowBookingModal(false)}
          onBookingComplete={handleBookingComplete}
        />
      )}
    </div>
  )
}
