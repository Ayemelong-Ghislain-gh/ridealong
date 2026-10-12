import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { LinkButton, buttonClasses } from '../components/ui/Button'
import { InstallAppButton } from '../components/InstallAppButton'
import { formatTripDate, formatTripTime, formatXAF, isPastDeparture, todayISODate } from '../lib/format'
import { TRIP_LIST_SELECT } from '../types/rows'
import type { TripListRow } from '../types/rows'

/** Live departure board: the next real trips, read straight from the database. */
function DepartureBoard() {
  const { data, isLoading } = useQuery({
    queryKey: ['next-departures'],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trips')
        .select(TRIP_LIST_SELECT)
        .eq('status', 'scheduled')
        .gt('available_seats', 0)
        .gte('departure_date', todayISODate())
        .order('departure_datetime', { ascending: true })
        .limit(12)
      if (error) throw error
      return ((data || []) as unknown as TripListRow[]).filter((t) => !isPastDeparture(t.departure_date, t.departure_time)).slice(0, 5)
    },
  })

  return (
    <div className="overflow-hidden rounded-3xl border border-white/10 bg-ink-soft">
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-3.5">
        <p className="font-semibold text-white">Next departures</p>
        <span className="flex items-center gap-1.5 text-xs font-medium text-white/60">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-taxi" aria-hidden="true" />
          Live
        </span>
      </div>

      {isLoading && (
        <div className="space-y-px">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[68px] animate-pulse bg-white/[0.03]" />
          ))}
        </div>
      )}

      {!isLoading && (!data || data.length === 0) && (
        <div className="px-5 py-10 text-center">
          <p className="font-semibold text-white">No departures posted right now</p>
          <p className="mt-1 text-sm text-white/60">Drivers post trips through the day. Check back soon.</p>
        </div>
      )}

      <ul>
        {(data || []).map((trip) => (
          <li key={trip.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-4 border-b border-white/5 px-5 py-3 last:border-0">
            <div className="w-[68px]">
              <p className="font-condensed text-[28px] font-extrabold leading-none text-taxi">{formatTripTime(trip.departure_time)}</p>
              <p className="mt-1 text-[11px] font-medium text-white/50">{formatTripDate(trip.departure_date)}</p>
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold text-white">{trip.route?.destination}</p>
              <p className="truncate text-sm text-white/55">from {trip.park?.name}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-white">{formatXAF(trip.price_per_seat)}</p>
              <p className={`text-xs ${trip.available_seats <= 2 ? 'text-taxi' : 'text-white/55'}`}>
                {trip.available_seats} {trip.available_seats === 1 ? 'seat' : 'seats'} left
              </p>
            </div>
          </li>
        ))}
      </ul>

      <Link to="/trips" className="block border-t border-white/10 px-5 py-3.5 text-center text-sm font-semibold text-taxi hover:bg-white/5">
        See all trips
      </Link>
    </div>
  )
}

const STEPS = [
  {
    title: 'Find your departure',
    text: 'See trips leaving your park with the time, the price per seat and how many seats are left.',
  },
  {
    title: 'Book your seat',
    text: 'Reserve one or more seats in a few taps and get a booking reference to show the driver.',
  },
  {
    title: 'Ride with confidence',
    text: 'Message or call your driver, and follow them on a live map once the trip leaves.',
  },
]

export default function LandingPage() {
  const { user, role, homePath } = useAuth()

  return (
    <>
      {/* Hero: continues the ink header so the board reads as part of the park */}
      <section className="bg-ink text-white">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-14 pt-8 sm:px-6 md:grid-cols-[1.1fr_1fr] md:pb-20 md:pt-14">
          <div>
            <h1 className="font-semi-condensed text-[42px] font-extrabold leading-[1.02] tracking-tight sm:text-[56px]">
              Your seat is booked before you reach the park.
            </h1>
            <p className="mt-5 max-w-lg text-lg text-white/70">
              Ride Along shows real departures from drivers around Bamenda, so you know the time, the price and the seats left before you leave home.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              {user ? (
                <LinkButton to={homePath} size="lg">
                  {role === 'driver' ? 'Go to my trips' : 'Find a trip'}
                </LinkButton>
              ) : (
                <>
                  <LinkButton to="/trips" size="lg">
                    Find a trip
                  </LinkButton>
                  <Link to="/register?role=driver" className={buttonClasses('ghost', 'lg', 'border border-white/25 text-white hover:bg-white/10')}>
                    I’m a driver
                  </Link>
                </>
              )}
            </div>
            <div className="mt-5">
              <InstallAppButton variant="onDark" className="-ml-4" label="Download the mobile app" />
            </div>
          </div>
          <DepartureBoard />
        </div>
      </section>

      {/* How it works: a real sequence, so the steps are numbered */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-20">
        <h2 className="font-semi-condensed text-3xl font-extrabold tracking-tight">How it works</h2>
        <ol className="mt-8 grid gap-8 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <li key={step.title} className="flex gap-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-taxi font-condensed text-lg font-extrabold text-ink">
                {i + 1}
              </span>
              <div>
                <h3 className="text-lg font-bold">{step.title}</h3>
                <p className="mt-1.5 text-[15px] leading-relaxed text-muted">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Drivers */}
      {role !== 'passenger' && (
        <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 md:pb-24">
          <div className="grid items-center gap-8 rounded-3xl bg-taxi p-6 text-ink sm:p-10 md:grid-cols-[1.4fr_1fr]">
            <div>
              <h2 className="font-semi-condensed text-3xl font-extrabold tracking-tight sm:text-4xl">Drive a taxi? Fill your seats faster.</h2>
              <p className="mt-3 max-w-xl text-[17px] text-ink/75">
                Post your next departure and passengers book before you load. See who’s coming, call or message them, and track what you earn.
              </p>
            </div>
            <div className="md:text-right">
              <LinkButton to={user ? homePath : '/register?role=driver'} variant="dark" size="lg">
                {role === 'driver' ? 'Post a trip' : 'Start driving with Ride Along'}
              </LinkButton>
            </div>
          </div>
        </section>
      )}
    </>
  )
}
