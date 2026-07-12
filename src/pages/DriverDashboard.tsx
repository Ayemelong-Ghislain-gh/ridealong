import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { LoadingCar } from '../components/LoadingCar'
import { TripDetailsModal } from '../components/TripDetailsModal'
import { useDriverLocationBroadcast } from '../hooks/useDriverLocationBroadcast'

const STATUS_STYLES: Record<string, string> = {
  scheduled: 'bg-blue-100 text-blue-800',
  departed: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
}

const TABS = [
  { key: 'scheduled', label: 'Available' },
  { key: 'departed', label: 'Departed' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
] as const

type TabKey = (typeof TABS)[number]['key']

// Explicit shape for the joined query below. Without generated Supabase
// `Database` types, `.select()` can't tell that `route:routes!fkey(...)`
// is a to-one relationship, so it defaults to typing it as an array. This
// interface (plus the `as unknown as` cast in queryFn) fixes that.
interface DriverTripRow {
  id: string
  departure_date: string
  departure_time: string
  price_per_seat: number
  total_seats: number
  available_seats: number
  status: string
  route: { destination: string } | null
}

export default function DriverDashboard() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<TabKey>('scheduled')
  const [detailsTripId, setDetailsTripId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const { tracking, error: locationError, startTracking, stopTracking } = useDriverLocationBroadcast(user?.id)

  const { data: trips, isLoading } = useQuery({
    queryKey: ['driver-trips', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trips')
        .select(`
          id, departure_date, departure_time, price_per_seat,
          total_seats, available_seats, status,
          route:routes!trips_route_id_fkey (destination)
        `)
        .eq('driver_id', user!.id)
        .order('departure_datetime', { ascending: false })

      if (error) throw error
      return (data || []) as unknown as DriverTripRow[]
    },
  })

  const updateStatus = async (tripId: string, status: string) => {
    const updates: Record<string, any> = { status }
    if (status === 'departed') updates.departed_at = new Date().toISOString()
    if (status === 'completed') updates.completed_at = new Date().toISOString()
    if (status === 'cancelled') updates.cancelled_at = new Date().toISOString()

    const { error } = await supabase.from('trips').update(updates).eq('id', tripId)
    if (error) {
      alert('Failed to update trip: ' + error.message)
      return
    }
    queryClient.invalidateQueries({ queryKey: ['driver-trips', user?.id] })
  }

  const deleteTrip = async (trip: NonNullable<typeof trips>[number]) => {
    const bookedSeats = trip.total_seats - trip.available_seats

    if (bookedSeats > 0) {
      alert(
        `This trip has ${bookedSeats} booked seat${bookedSeats > 1 ? 's' : ''}. Cancel it instead so passengers are notified — deleting isn't allowed once someone has booked.`
      )
      return
    }

    if (!confirm('Delete this trip permanently? This cannot be undone.')) return

    setDeletingId(trip.id)
    const { error } = await supabase.from('trips').delete().eq('id', trip.id)
    setDeletingId(null)

    if (error) {
      alert('Failed to delete trip: ' + error.message)
      return
    }
    queryClient.invalidateQueries({ queryKey: ['driver-trips', user?.id] })
  }

  const stats = {
    total: trips?.length || 0,
    completed: trips?.filter((t) => t.status === 'completed').length || 0,
    earnings:
      trips
        ?.filter((t) => t.status === 'completed')
        .reduce((sum, t) => sum + (t.total_seats - t.available_seats) * t.price_per_seat, 0) || 0,
  }

  const visibleTrips = trips?.filter((t) => t.status === activeTab) || []

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-6 mt-2 flex-wrap gap-3">
          <h1 className="text-2xl font-bold text-gray-800">My Trips</h1>
          <div className="flex items-center gap-3">
            <button
              onClick={tracking ? stopTracking : startTracking}
              className={`text-sm px-3 py-2 rounded-lg font-medium transition-colors ${
                tracking
                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {tracking ? '🟢 Sharing location' : '📍 Share my location'}
            </button>
            <Link to="/driver/create-trip" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
              + New Trip
            </Link>
          </div>
        </div>

        {locationError && (
          <div className="mb-4 p-2 bg-red-50 text-red-600 text-sm rounded">{locationError}</div>
        )}

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-600">Total Trips</p>
            <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-600">Completed</p>
            <p className="text-2xl font-bold text-gray-800">{stats.completed}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-600">Total Earnings</p>
            <p className="text-2xl font-bold text-blue-600">{stats.earnings.toLocaleString()} XAF</p>
          </div>
        </div>

        <div className="flex gap-2 mb-4 border-b border-gray-200">
          {TABS.map((tab) => {
            const count = trips?.filter((t) => t.status === tab.key).length || 0
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label} {count > 0 && <span className="ml-1 text-xs">({count})</span>}
              </button>
            )
          })}
        </div>

        {isLoading && <LoadingCar label="Loading your trips..." />}

        {!isLoading && visibleTrips.length === 0 && (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <p className="text-gray-600">No {TABS.find((t) => t.key === activeTab)?.label.toLowerCase()} trips.</p>
          </div>
        )}

        <div className="space-y-4">
          {visibleTrips.map((trip) => {
            const bookedSeats = trip.total_seats - trip.available_seats
            return (
              <div key={trip.id} className="bg-white rounded-lg shadow p-4 flex justify-between items-center flex-wrap gap-3">
                <button
                  onClick={() => setDetailsTripId(trip.id)}
                  className="text-left flex-1 min-w-[180px] hover:opacity-80"
                >
                  <p className="font-semibold text-gray-800">{trip.route?.destination}</p>
                  <p className="text-sm text-gray-600">
                    {trip.departure_date} at {trip.departure_time?.slice(0, 5)}
                  </p>
                  <p className="text-sm text-gray-600">
                    {bookedSeats}/{trip.total_seats} seats booked · {trip.price_per_seat.toLocaleString()} XAF/seat
                  </p>
                </button>

                <div className="flex items-center gap-3 flex-wrap">
                  <span className={`text-xs px-2 py-1 rounded-full capitalize ${STATUS_STYLES[trip.status]}`}>
                    {trip.status}
                  </span>

                  {trip.status === 'scheduled' && (
                    <>
                      <Link to={`/driver/edit-trip/${trip.id}`} className="text-sm text-blue-600 hover:underline">
                        Edit
                      </Link>
                      <button
                        onClick={() => updateStatus(trip.id, 'departed')}
                        className="text-sm text-yellow-700 hover:underline"
                      >
                        Mark Departed
                      </button>
                      <button
                        onClick={() => updateStatus(trip.id, 'cancelled')}
                        className="text-sm text-red-600 hover:underline"
                      >
                        Cancel
                      </button>
                      {bookedSeats === 0 && (
                        <button
                          onClick={() => deleteTrip(trip)}
                          disabled={deletingId === trip.id}
                          className="text-sm text-gray-500 hover:underline disabled:opacity-50"
                        >
                          {deletingId === trip.id ? 'Deleting...' : 'Delete'}
                        </button>
                      )}
                    </>
                  )}
                  {trip.status === 'departed' && (
                    <button
                      onClick={() => updateStatus(trip.id, 'completed')}
                      className="text-sm text-green-700 hover:underline"
                    >
                      Mark Completed
                    </button>
                  )}
                  {(trip.status === 'completed' || trip.status === 'cancelled') && bookedSeats === 0 && (
                    <button
                      onClick={() => deleteTrip(trip)}
                      disabled={deletingId === trip.id}
                      className="text-sm text-gray-500 hover:underline disabled:opacity-50"
                    >
                      {deletingId === trip.id ? 'Deleting...' : 'Delete'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {detailsTripId && <TripDetailsModal tripId={detailsTripId} onClose={() => setDetailsTripId(null)} />}
    </div>
  )
}
