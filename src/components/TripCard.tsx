import type { ReactNode } from 'react'
import { RouteLabel } from './RouteLabel'
import { Avatar, Stars, VerifiedMark } from './ui/Display'
import { formatTripDate, formatTripTime, formatXAF, plural } from '../lib/format'
import type { DriverProfileInfo, TripListRow } from '../types/rows'

interface TripCardProps {
  trip: TripListRow
  driverInfo?: DriverProfileInfo
  onDriverClick?: () => void
  action?: ReactNode
}

function seatsLabel(available: number) {
  if (available <= 0) return { text: 'Full', className: 'text-danger' }
  if (available === 1) return { text: 'Last seat', className: 'text-danger' }
  if (available <= 2) return { text: `${available} seats left`, className: 'text-[#9a6f00]' }
  return { text: plural(available, 'seat') + ' left', className: 'text-route' }
}

/**
 * The departure "ticket": the time is set large on an ink panel, like the
 * route boards at the park, with the route, driver and price beside it.
 */
export function TripCard({ trip, driverInfo, onDriverClick, action }: TripCardProps) {
  const seats = seatsLabel(trip.available_seats)
  const vehicle = [driverInfo?.vehicle_color, driverInfo?.vehicle_make, driverInfo?.vehicle_model].filter(Boolean).join(' ')
  const rating = driverInfo?.rating ?? 0

  return (
    <article className="flex overflow-hidden rounded-2xl border border-line bg-card">
      <div className="flex w-[92px] shrink-0 flex-col items-center justify-center bg-ink px-2 py-4 text-center sm:w-[104px]">
        <span className="font-condensed text-[34px] font-extrabold leading-none tracking-tight text-taxi sm:text-[38px]">
          {formatTripTime(trip.departure_time)}
        </span>
        <span className="mt-1.5 text-xs font-semibold text-white/70">{formatTripDate(trip.departure_date)}</span>
      </div>

      <div className="flex min-w-0 flex-1 flex-col p-4">
        <RouteLabel from={trip.park?.name || 'Unknown park'} to={trip.route?.destination || 'Unknown'} />

        <button
          type="button"
          onClick={onDriverClick}
          disabled={!onDriverClick}
          className="mt-3 flex min-w-0 items-center gap-2 self-start rounded-lg text-left enabled:hover:opacity-80"
        >
          <Avatar name={trip.driver?.full_name} url={trip.driver?.avatar_url} size="sm" />
          <span className="min-w-0">
            <span className="flex items-center gap-1 text-sm font-semibold text-ink">
              <span className="truncate">{trip.driver?.full_name || 'Driver'}</span>
              {driverInfo?.is_verified_driver && <VerifiedMark />}
              {rating > 0 && <Stars rating={rating} className="ml-1 text-xs" />}
            </span>
            {vehicle && <span className="block truncate text-xs text-muted">{vehicle}</span>}
          </span>
        </button>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-lg font-extrabold leading-none text-ink">
              {formatXAF(trip.price_per_seat)}
              <span className="ml-1 text-xs font-medium text-muted">per seat</span>
            </p>
            <p className={`mt-1.5 text-xs font-semibold ${seats.className}`}>{seats.text}</p>
          </div>
          {action}
        </div>

        {trip.notes && <p className="mt-3 border-t border-line pt-3 text-sm text-muted">“{trip.notes}”</p>}
      </div>
    </article>
  )
}
