import { useEffect, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate, useParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useFeedback } from '../context/FeedbackContext'
import { PageContainer } from '../components/AppLayout'
import { PriceStepper, Stepper } from '../components/PriceStepper'
import { LoadingCar } from '../components/LoadingCar'
import { RouteLabel } from '../components/RouteLabel'
import { Button, LinkButton } from '../components/ui/Button'
import { FieldShell, Input, Notice, Textarea } from '../components/ui/Field'
import { EmptyState, PageHeader } from '../components/ui/Display'
import { plural, todayISODate, tripDeparture } from '../lib/format'
import { getErrorMessage } from '../lib/errors'

const editSchema = z
  .object({
    departureDate: z.string().min(1, 'Choose a date'),
    departureTime: z.string().min(1, 'Choose a time'),
    pricePerSeat: z.number().min(100, 'Price must be at least 100 XAF'),
    totalSeats: z.number().int().min(1, 'At least 1 seat').max(30, 'At most 30 seats'),
    notes: z.string().max(300, 'Keep notes under 300 characters').optional(),
  })
  .superRefine((data, ctx) => {
    const dep = tripDeparture(data.departureDate, data.departureTime)
    if (dep && dep.getTime() < Date.now()) {
      ctx.addIssue({ code: 'custom', message: 'This time has already passed', path: ['departureTime'] })
    }
  })

type EditForm = z.infer<typeof editSchema>

interface TripRecord {
  id: string
  driver_id: string
  departure_date: string
  departure_time: string
  price_per_seat: number
  total_seats: number
  available_seats: number
  notes: string | null
  status: string
  route: { destination: string } | null
  park: { name: string } | null
}

export default function EditTrip() {
  const { tripId } = useParams<{ tripId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const { toast } = useFeedback()

  const [trip, setTrip] = useState<TripRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [serverError, setServerError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<EditForm>({ resolver: zodResolver(editSchema) })

  useEffect(() => {
    if (!tripId || !user) return
    supabase
      .from('trips')
      .select(
        `id, driver_id, departure_date, departure_time, price_per_seat, total_seats, available_seats, notes, status,
         route:routes!trips_route_id_fkey (destination),
         park:taxi_parks!trips_park_id_fkey (name)`
      )
      .eq('id', tripId)
      .eq('driver_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        const row = data as unknown as TripRecord | null
        setTrip(row)
        if (row) {
          reset({
            departureDate: row.departure_date,
            departureTime: row.departure_time?.slice(0, 5),
            pricePerSeat: row.price_per_seat,
            totalSeats: row.total_seats,
            notes: row.notes || '',
          })
        }
        setLoading(false)
      })
  }, [tripId, user, reset])

  const bookedSeats = trip ? trip.total_seats - trip.available_seats : 0

  const onSubmit = async (data: EditForm) => {
    if (!trip || !user) return
    if (data.totalSeats < bookedSeats) {
      setServerError(`${plural(bookedSeats, 'seat')} already booked. Total seats can’t go below that.`)
      return
    }

    setSubmitting(true)
    setServerError('')

    try {
      // available_seats is recalculated from live bookings by the database
      // trigger in supabase/ridealong_fixes.sql, so a booking made while this
      // form was open can't be overwritten. The value sent here is a fallback.
      const { error } = await supabase
        .from('trips')
        .update({
          departure_date: data.departureDate,
          departure_time: data.departureTime,
          price_per_seat: data.pricePerSeat,
          total_seats: data.totalSeats,
          available_seats: data.totalSeats - bookedSeats,
          notes: data.notes?.trim() || null,
        })
        .eq('id', trip.id)
        .eq('driver_id', user.id)
        .eq('status', 'scheduled')

      if (error) throw error

      await queryClient.invalidateQueries({ queryKey: ['driver-trips', user.id] })
      toast(bookedSeats > 0 ? 'Changes saved. Booked passengers have been notified.' : 'Changes saved.')
      navigate('/driver/dashboard')
    } catch (err) {
      setServerError(getErrorMessage(err, 'Changes not saved. Try again.'))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <LoadingCar label="Loading trip..." />

  if (!trip || trip.status !== 'scheduled') {
    return (
      <PageContainer width="sm">
        <EmptyState
          title={trip ? 'This trip can’t be edited' : 'Trip not found'}
          message={trip ? 'Only upcoming trips can be changed. Trips on the road, completed or cancelled are locked.' : 'It may have been deleted.'}
          action={<LinkButton to="/driver/dashboard">Back to my trips</LinkButton>}
        />
      </PageContainer>
    )
  }

  return (
    <PageContainer width="sm">
      <PageHeader title="Edit trip" />

      <div className="mb-5 rounded-2xl border border-line bg-card p-4">
        <RouteLabel from={trip.park?.name || 'Unknown park'} to={trip.route?.destination || 'Unknown'} />
        <p className="mt-3 text-xs text-muted">To change the route, cancel this trip and post a new one.</p>
      </div>

      {bookedSeats > 0 && (
        <div className="mb-5">
          <Notice tone="warning">
            {plural(bookedSeats, 'seat')} already booked. Passengers are notified if you change the date, time or price.
          </Notice>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        <div className="grid grid-cols-2 gap-3">
          <Input type="date" label="Date" min={todayISODate()} error={errors.departureDate?.message} {...register('departureDate')} />
          <Input type="time" label="Time" error={errors.departureTime?.message} {...register('departureTime')} />
        </div>

        <div className="grid gap-5 sm:grid-cols-2 sm:gap-3">
          <Controller
            name="pricePerSeat"
            control={control}
            render={({ field }) => (
              <FieldShell id="price" label="Price per seat" error={errors.pricePerSeat?.message}>
                <PriceStepper id="price" value={field.value} onChange={field.onChange} />
              </FieldShell>
            )}
          />
          <Controller
            name="totalSeats"
            control={control}
            render={({ field }) => (
              <FieldShell id="seats" label="Seats for passengers" error={errors.totalSeats?.message} hint={bookedSeats > 0 ? `At least ${bookedSeats}` : undefined}>
                <Stepper id="seats" value={field.value} onChange={field.onChange} min={Math.max(1, bookedSeats)} max={30} label="seats for passengers" />
              </FieldShell>
            )}
          />
        </div>

        <Textarea label="Notes for passengers" optional rows={3} error={errors.notes?.message} {...register('notes')} />

        {serverError && <Notice>{serverError}</Notice>}

        <div className="flex gap-3 pt-1">
          <LinkButton to="/driver/dashboard" variant="secondary" className="flex-1">
            Cancel
          </LinkButton>
          <Button type="submit" loading={submitting} className="flex-[2]">
            Save changes
          </Button>
        </div>
      </form>
    </PageContainer>
  )
}
