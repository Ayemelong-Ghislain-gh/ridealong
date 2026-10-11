import { useEffect, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useFeedback } from '../context/FeedbackContext'
import { PageContainer } from '../components/AppLayout'
import { PriceStepper, Stepper } from '../components/PriceStepper'
import { LoadingCar } from '../components/LoadingCar'
import { Button } from '../components/ui/Button'
import { FieldShell, Input, Notice, Select, Textarea } from '../components/ui/Field'
import { PageHeader } from '../components/ui/Display'
import { BAMENDA_LOCATIONS } from '../lib/bamendaLocations'
import { escapeLike, todayISODate, tripDeparture } from '../lib/format'
import { getErrorMessage } from '../lib/errors'

const OTHER_PARK = '__other__'

const tripSchema = z
  .object({
    parkId: z.string().min(1, 'Choose where you leave from'),
    customParkName: z.string().optional(),
    destination: z.string().trim().min(2, 'Enter where you’re going'),
    departureDate: z.string().min(1, 'Choose a date'),
    departureTime: z.string().min(1, 'Choose a time'),
    pricePerSeat: z.number().min(100, 'Price must be at least 100 XAF'),
    totalSeats: z.number().int().min(1, 'At least 1 seat').max(30, 'At most 30 seats'),
    notes: z.string().max(300, 'Keep notes under 300 characters').optional(),
  })
  .superRefine((data, ctx) => {
    if (data.parkId === OTHER_PARK && !data.customParkName?.trim()) {
      ctx.addIssue({ code: 'custom', message: 'Enter the name of the departure point', path: ['customParkName'] })
    }
    const dep = tripDeparture(data.departureDate, data.departureTime)
    if (dep && dep.getTime() < Date.now()) {
      ctx.addIssue({ code: 'custom', message: 'This time has already passed', path: ['departureTime'] })
    }
  })

type TripForm = z.infer<typeof tripSchema>

interface Park {
  id: string
  name: string
}

export default function CreateTrip() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const { toast } = useFeedback()
  const [parks, setParks] = useState<Park[]>([])
  const [loadingParks, setLoadingParks] = useState(true)
  const [serverError, setServerError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    control,
    setValue,
    formState: { errors },
  } = useForm<TripForm>({
    resolver: zodResolver(tripSchema),
    defaultValues: { pricePerSeat: 500, totalSeats: 4, departureDate: todayISODate() },
  })

  const selectedPark = watch('parkId')

  useEffect(() => {
    if (!user) return
    // Departure points, plus the driver's vehicle size to pre-fill seats
    Promise.all([
      supabase.from('taxi_parks').select('id, name').eq('is_active', true).eq('city', 'Bamenda').order('name'),
      supabase.from('driver_profiles').select('vehicle_capacity').eq('id', user.id).maybeSingle(),
    ]).then(([parksRes, driverRes]) => {
      if (parksRes.error) setServerError('Couldn’t load departure points. Refresh to try again.')
      setParks((parksRes.data || []) as unknown as Park[])
      const capacity = (driverRes.data as unknown as { vehicle_capacity?: number } | null)?.vehicle_capacity
      if (capacity && capacity > 0) setValue('totalSeats', Math.min(30, capacity))
      setLoadingParks(false)
    })
  }, [user, setValue])

  const onSubmit = async (data: TripForm) => {
    if (!user) return
    setSubmitting(true)
    setServerError('')

    try {
      let parkId = data.parkId

      // Typed-in departure point: reuse an existing park with the same name before creating one
      if (parkId === OTHER_PARK) {
        const name = data.customParkName!.trim()
        const { data: existing } = await supabase
          .from('taxi_parks')
          .select('id')
          .eq('city', 'Bamenda')
          .ilike('name', escapeLike(name))
          .limit(1)
          .maybeSingle()

        if (existing) {
          parkId = (existing as unknown as { id: string }).id
        } else {
          const { data: newPark, error: parkError } = await supabase
            .from('taxi_parks')
            .insert([
              {
                name,
                city: 'Bamenda',
                region: 'North West',
                // Central Bamenda until an admin pins the exact spot
                latitude: 5.9631,
                longitude: 10.1591,
                is_active: true,
              },
            ])
            .select('id')
            .single()
          if (parkError) throw parkError
          parkId = (newPark as unknown as { id: string }).id
        }
      }

      // Reuse the route for this park + destination, or create it
      const destination = data.destination.trim()
      const { data: existingRoute } = await supabase
        .from('routes')
        .select('id')
        .eq('park_id', parkId)
        .ilike('destination', escapeLike(destination))
        .limit(1)
        .maybeSingle()

      let routeId: string
      if (existingRoute) {
        routeId = (existingRoute as unknown as { id: string }).id
      } else {
        const { data: newRoute, error: routeError } = await supabase
          .from('routes')
          .insert([{ park_id: parkId, destination, is_active: true }])
          .select('id')
          .single()
        if (routeError) throw routeError
        routeId = (newRoute as unknown as { id: string }).id
      }

      const { error: tripError } = await supabase.from('trips').insert([
        {
          driver_id: user.id,
          route_id: routeId,
          park_id: parkId,
          departure_date: data.departureDate,
          departure_time: data.departureTime,
          price_per_seat: data.pricePerSeat,
          total_seats: data.totalSeats,
          available_seats: data.totalSeats,
          notes: data.notes?.trim() || null,
          status: 'scheduled',
        },
      ])
      if (tripError) throw tripError

      await queryClient.invalidateQueries({ queryKey: ['driver-trips', user.id] })
      toast('Trip posted. Passengers can book it now.')
      navigate('/driver/dashboard')
    } catch (err) {
      setServerError(getErrorMessage(err, 'Trip not posted. Try again.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <PageContainer width="sm">
      <PageHeader title="Post a trip" subtitle="Passengers see it straight away and can book seats." />

      {loadingParks ? (
        <LoadingCar label="Loading departure points..." />
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
          <Select label="Leaving from" error={errors.parkId?.message} {...register('parkId')}>
            <option value="">Choose a park</option>
            {parks.map((park) => (
              <option key={park.id} value={park.id}>
                {park.name}
              </option>
            ))}
            <option value={OTHER_PARK}>Somewhere else (type it)</option>
          </Select>

          {selectedPark === OTHER_PARK && (
            <Input
              label="Departure point name"
              list="bamenda-locations"
              placeholder="e.g. Bambili Three Corners"
              error={errors.customParkName?.message}
              {...register('customParkName')}
            />
          )}

          <Input
            label="Going to"
            list="bamenda-locations"
            placeholder="e.g. Mile 4 Nkwen"
            autoComplete="off"
            error={errors.destination?.message}
            {...register('destination')}
          />

          <datalist id="bamenda-locations">
            {BAMENDA_LOCATIONS.map((loc) => (
              <option key={loc} value={loc} />
            ))}
          </datalist>

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
                <FieldShell id="seats" label="Seats for passengers" error={errors.totalSeats?.message}>
                  <Stepper id="seats" value={field.value} onChange={field.onChange} min={1} max={30} label="seats for passengers" />
                </FieldShell>
              )}
            />
          </div>

          <Textarea
            label="Notes for passengers"
            optional
            rows={3}
            placeholder="e.g. Pickup at the Total station, one bag per person"
            error={errors.notes?.message}
            {...register('notes')}
          />

          {serverError && <Notice>{serverError}</Notice>}

          <div className="flex gap-3 pt-1">
            <Button variant="secondary" onClick={() => navigate(-1)} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" loading={submitting} className="flex-[2]">
              Post trip
            </Button>
          </div>
        </form>
      )}
    </PageContainer>
  )
}
