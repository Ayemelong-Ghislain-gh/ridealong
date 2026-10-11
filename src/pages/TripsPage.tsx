import { useMemo, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useDriverProfiles } from '../hooks/useDriverProfiles'
import { useFeedback } from '../context/FeedbackContext'
import { PageContainer } from '../components/AppLayout'
import { BookingModal } from '../components/BookingModal'
import { DriverProfileModal } from '../components/DriverProfileModal'
import { TripCard } from '../components/TripCard'
import { Button } from '../components/ui/Button'
import { controlClasses } from '../components/ui/Field'
import { EmptyState, PageHeader, Skeleton } from '../components/ui/Display'
import { isPastDeparture, todayISODate } from '../lib/format'
import { TRIP_LIST_SELECT } from '../types/rows'
import type { TripListRow } from '../types/rows'

type DateFilter = 'any' | 'today' | 'tomorrow' | 'pick'

function addDays(iso: string, days: number) {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d + days)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

export default function TripsPage() {
  const { user, role, loading: authLoading } = useAuth()
  const { toast } = useFeedback()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [bookingTrip, setBookingTrip] = useState<TripListRow | null>(null)
  const [driverId, setDriverId] = useState<string | null>(null)
  const [fromFilter, setFromFilter] = useState('')
  const [toFilter, setToFilter] = useState('')
  const [dateFilter, setDateFilter] = useState<DateFilter>('any')
  const [pickedDate, setPickedDate] = useState('')

  const { data: trips, isLoading, isError, refetch } = useQuery({
    queryKey: ['trips'],
    enabled: role !== 'driver',
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trips')
        .select(TRIP_LIST_SELECT)
        .eq('status', 'scheduled')
        .gt('available_seats', 0)
        .gte('departure_date', todayISODate())
        .order('departure_datetime', { ascending: true })

      if (error) throw error
      // Also drop trips whose departure time already passed today
      return ((data || []) as unknown as TripListRow[]).filter((t) => !isPastDeparture(t.departure_date, t.departure_time))
    },
  })

  const { data: driverProfiles } = useDriverProfiles((trips || []).map((t) => t.driver_id))

  // Only offer places that actually have trips, so no filter leads to an empty list
  const { fromOptions, toOptions } = useMemo(() => {
    const from = new Set<string>()
    const to = new Set<string>()
    for (const t of trips || []) {
      if (t.park?.name) from.add(t.park.name)
      if (t.route?.destination) to.add(t.route.destination)
    }
    const sort = (s: Set<string>) => [...s].sort((a, b) => a.localeCompare(b))
    return { fromOptions: sort(from), toOptions: sort(to) }
  }, [trips])

  const filteredTrips = useMemo(() => {
    const today = todayISODate()
    const wantedDate =
      dateFilter === 'today' ? today : dateFilter === 'tomorrow' ? addDays(today, 1) : dateFilter === 'pick' ? pickedDate : ''

    return (trips || []).filter((trip) => {
      if (fromFilter && trip.park?.name !== fromFilter) return false
      if (toFilter && trip.route?.destination !== toFilter) return false
      if (wantedDate && trip.departure_date !== wantedDate) return false
      return true
    })
  }, [trips, fromFilter, toFilter, dateFilter, pickedDate])

  const hasFilters = !!(fromFilter || toFilter || dateFilter !== 'any')

  if (!authLoading && role === 'driver') return <Navigate to="/driver/dashboard" replace />

  const startBooking = (trip: TripListRow) => {
    if (!user) {
      toast('Sign in to book your seat.', 'info')
      navigate('/login', { state: { from: '/trips' } })
      return
    }
    if (role === 'admin') {
      toast('Admin accounts can’t book seats.', 'info')
      return
    }
    setBookingTrip(trip)
  }

  const handleBookingComplete = async (reference: string | null) => {
    setBookingTrip(null)
    toast(reference ? `Seat booked. Your reference is ${reference}.` : 'Seat booked.')
    await queryClient.invalidateQueries({ queryKey: ['trips'] })
    await queryClient.invalidateQueries({ queryKey: ['my-bookings'] })
    navigate('/passenger/bookings')
  }

  const chip = (value: DateFilter, label: string) => (
    <button
      type="button"
      onClick={() => setDateFilter(value)}
      aria-pressed={dateFilter === value}
      className={`h-9 shrink-0 rounded-full px-4 text-sm font-semibold transition-colors ${
        dateFilter === value ? 'bg-ink text-white' : 'border border-line bg-card text-ink hover:border-ink/30'
      }`}
    >
      {label}
    </button>
  )

  return (
    <PageContainer>
      <PageHeader title="Find a trip" subtitle="Upcoming departures with seats still free." />

      <div className="mb-6 space-y-3">
        <div className="grid grid-cols-2 gap-3 md:max-w-xl">
          <select value={fromFilter} onChange={(e) => setFromFilter(e.target.value)} aria-label="Leaving from" className={`${controlClasses} h-11`}>
            <option value="">Leaving from anywhere</option>
            {fromOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <select value={toFilter} onChange={(e) => setToFilter(e.target.value)} aria-label="Going to" className={`${controlClasses} h-11`}>
            <option value="">Going anywhere</option>
            {toOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
          {chip('any', 'Any day')}
          {chip('today', 'Today')}
          {chip('tomorrow', 'Tomorrow')}
          <input
            type="date"
            aria-label="Pick a date"
            min={todayISODate()}
            value={pickedDate}
            onChange={(e) => {
              setPickedDate(e.target.value)
              setDateFilter(e.target.value ? 'pick' : 'any')
            }}
            className={`h-9 shrink-0 rounded-full border px-3 text-sm font-semibold ${
              dateFilter === 'pick' ? 'border-ink bg-ink text-white' : 'border-line bg-card text-ink'
            }`}
          />
          {hasFilters && (
            <button
              type="button"
              onClick={() => {
                setFromFilter('')
                setToFilter('')
                setDateFilter('any')
                setPickedDate('')
              }}
              className="ml-1 shrink-0 text-sm font-semibold text-muted underline underline-offset-4 hover:text-ink"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {(authLoading || isLoading) && (
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-44" />
          ))}
        </div>
      )}

      {isError && (
        <EmptyState
          title="Couldn’t load trips"
          message="Check your internet connection and try again."
          action={<Button onClick={() => refetch()}>Try again</Button>}
        />
      )}

      {!authLoading && !isLoading && !isError && filteredTrips.length === 0 && (
        <EmptyState
          title={hasFilters ? 'No trips match these filters' : 'No upcoming trips yet'}
          message={hasFilters ? 'Try another day or place.' : 'Drivers post departures through the day. Check back soon.'}
          action={
            hasFilters ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setFromFilter('')
                  setToFilter('')
                  setDateFilter('any')
                  setPickedDate('')
                }}
              >
                Show all trips
              </Button>
            ) : undefined
          }
        />
      )}

      {filteredTrips.length > 0 && (
        <>
          <p className="mb-3 text-sm text-muted" aria-live="polite">
            {filteredTrips.length} {filteredTrips.length === 1 ? 'trip' : 'trips'}
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            {filteredTrips.map((trip) => (
              <TripCard
                key={trip.id}
                trip={trip}
                driverInfo={driverProfiles?.[trip.driver_id]}
                onDriverClick={() => setDriverId(trip.driver_id)}
                action={
                  <Button size="sm" onClick={() => startBooking(trip)} className="px-5">
                    Book seat
                  </Button>
                }
              />
            ))}
          </div>
        </>
      )}

      {bookingTrip && user && (
        <BookingModal trip={bookingTrip} passengerId={user.id} onClose={() => setBookingTrip(null)} onBookingComplete={handleBookingComplete} />
      )}
      {driverId && <DriverProfileModal driverId={driverId} onClose={() => setDriverId(null)} />}
    </PageContainer>
  )
}
