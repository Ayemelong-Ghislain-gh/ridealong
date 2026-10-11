import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { Notice } from './ui/Field'
import { Stepper } from './PriceStepper'
import { RouteLabel } from './RouteLabel'
import { formatTripDate, formatTripTime, formatXAF } from '../lib/format'
import { getErrorMessage } from '../lib/errors'
import { MAX_SEATS_PER_BOOKING } from '../lib/config'
import type { TripListRow } from '../types/rows'

interface BookingModalProps {
  trip: TripListRow
  passengerId: string
  onClose: () => void
  onBookingComplete: (bookingReference: string | null) => void
}

export function BookingModal({ trip, passengerId, onClose, onBookingComplete }: BookingModalProps) {
  const maxSeats = Math.max(1, Math.min(trip.available_seats, MAX_SEATS_PER_BOOKING))
  const [seats, setSeats] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleBook = async () => {
    if (!Number.isInteger(seats) || seats < 1 || seats > maxSeats) {
      setError(`Choose between 1 and ${maxSeats} seats.`)
      return
    }

    setLoading(true)
    setError('')

    const { data, error: bookingError } = await supabase
      .from('bookings')
      .insert([{ trip_id: trip.id, passenger_id: passengerId, seats_booked: seats, status: 'confirmed' }])
      .select('booking_reference')
      .maybeSingle()

    if (bookingError) {
      setError(getErrorMessage(bookingError, 'Booking failed. Try again.'))
      setLoading(false)
      return
    }

    onBookingComplete((data as unknown as { booking_reference?: string } | null)?.booking_reference ?? null)
  }

  return (
    <Modal
      title="Book your seat"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Not now
          </Button>
          <Button onClick={handleBook} loading={loading} className="flex-[2]">
            Book {seats === 1 ? '1 seat' : `${seats} seats`}
          </Button>
        </>
      }
    >
      <div className="rounded-xl bg-paper p-4">
        <p className="mb-3 text-sm font-semibold text-muted">
          {formatTripDate(trip.departure_date)} at {formatTripTime(trip.departure_time)}
        </p>
        <RouteLabel from={trip.park?.name || 'Unknown park'} to={trip.route?.destination || 'Unknown'} />
        {trip.driver?.full_name && <p className="mt-3 text-sm text-muted">Driver: {trip.driver.full_name}</p>}
      </div>

      <div className="mt-5">
        <p className="mb-1.5 text-sm font-medium">Seats</p>
        <Stepper value={seats} onChange={setSeats} min={1} max={maxSeats} label="number of seats" />
        <p className="mt-1.5 text-sm text-muted">
          {trip.available_seats} available. Up to {maxSeats} per booking.
        </p>
      </div>

      <div className="mt-5 flex items-baseline justify-between border-t border-line pt-4">
        <span className="text-[15px] text-muted">
          {seats} × {formatXAF(trip.price_per_seat)}
        </span>
        <span className="text-xl font-extrabold">{formatXAF(seats * trip.price_per_seat)}</span>
      </div>
      <p className="mt-1 text-right text-xs text-muted">Pay the driver at the park.</p>

      {error && (
        <div className="mt-4">
          <Notice>{error}</Notice>
        </div>
      )}
    </Modal>
  )
}
