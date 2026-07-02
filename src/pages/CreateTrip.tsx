import { useState, useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { PriceStepper } from '../components/PriceStepper'
import { LoadingCar } from '../components/LoadingCar'
import { BAMENDA_LOCATIONS } from '../lib/bamendaLocations'

const OTHER_PARK = '__other__'

const tripSchema = z.object({
  parkId: z.string().min(1, 'Select a departure point'),
  customParkName: z.string().optional(),
  destination: z.string().min(2, 'Destination is required'),
  departureDate: z.string().min(1, 'Select a date'),
  departureTime: z.string().min(1, 'Select a time'),
  pricePerSeat: z.number().min(100, 'Enter a valid price'),
  totalSeats: z.number().min(4, 'Minimum 4 seats').max(30, 'Maximum 30 seats'),
  notes: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.parkId === OTHER_PARK && !data.customParkName?.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Enter the departure point name', path: ['customParkName'] })
  }
})

type TripForm = z.infer<typeof tripSchema>

interface Park {
  id: string
  name: string
  city: string
}

export default function CreateTrip() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [parks, setParks] = useState<Park[]>([])
  const [loadingParks, setLoadingParks] = useState(true)
  const [serverError, setServerError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    control,
    formState: { errors },
  } = useForm<TripForm>({
    resolver: zodResolver(tripSchema),
    defaultValues: { pricePerSeat: 500, totalSeats: 4 },
  })

  const selectedPark = watch('parkId')

  useEffect(() => {
    supabase
      .from('taxi_parks')
      .select('id, name, city')
      .eq('is_active', true)
      .eq('city', 'Bamenda')
      .then(({ data, error }) => {
        if (error) console.error('Failed to load parks:', error)
        setParks(data || [])
        setLoadingParks(false)
      })
  }, [])

  const onSubmit = async (data: TripForm) => {
    if (!user) return
    setSubmitting(true)
    setServerError('')

    try {
      let parkId = data.parkId

      // Create a new park if the driver typed a custom departure point
      if (parkId === OTHER_PARK) {
        const { data: newPark, error: parkError } = await supabase
          .from('taxi_parks')
          .insert([{
            name: data.customParkName!.trim(),
            city: 'Bamenda',
            region: 'North West',
            // Approximate central Bamenda coordinates — placeholder until
            // an admin/driver can pin the exact location later.
            latitude: 5.9631,
            longitude: 10.1591,
            is_active: true,
          }])
          .select('id')
          .single()

        if (parkError) throw parkError
        parkId = newPark.id
      }

      // Find an existing route for this park + destination, or create one
      let routeId: string

      const { data: existingRoute } = await supabase
        .from('routes')
        .select('id')
        .eq('park_id', parkId)
        .ilike('destination', data.destination.trim())
        .maybeSingle()

      if (existingRoute) {
        routeId = existingRoute.id
      } else {
        const { data: newRoute, error: routeError } = await supabase
          .from('routes')
          .insert([{ park_id: parkId, destination: data.destination.trim(), is_active: true }])
          .select('id')
          .single()

        if (routeError) throw routeError
        routeId = newRoute.id
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
          notes: data.notes || null,
          status: 'scheduled',
        },
      ])

      if (tripError) throw tripError

      navigate('/driver/dashboard')
    } catch (err: any) {
      console.error('Create trip error:', err)
      const message =
        err?.message || err?.error_description || err?.details || (typeof err === 'string' ? err : null) || 'Failed to create trip'
      setServerError(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-lg mx-auto bg-white rounded-lg shadow-xl p-6 mt-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Publish a Trip</h1>

        {loadingParks ? (
          <LoadingCar label="Loading departure points..." />
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Departure Point</label>
              <select
                {...register('parkId')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select a departure point</option>
                {parks.map((park) => (
                  <option key={park.id} value={park.id}>
                    {park.name}
                  </option>
                ))}
                <option value={OTHER_PARK}>Other (type it below)</option>
              </select>
              {errors.parkId && <p className="text-red-600 text-sm mt-1">{errors.parkId.message}</p>}
            </div>

            {selectedPark === OTHER_PARK && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Departure Point Name</label>
                <input
                  {...register('customParkName')}
                  list="bamenda-locations"
                  placeholder="e.g. Bambili"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {errors.customParkName && (
                  <p className="text-red-600 text-sm mt-1">{errors.customParkName.message}</p>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Destination</label>
              <input
                {...register('destination')}
                list="bamenda-locations"
                placeholder="e.g. Mile 4 Nkwen"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.destination && <p className="text-red-600 text-sm mt-1">{errors.destination.message}</p>}
            </div>

            <datalist id="bamenda-locations">
              {BAMENDA_LOCATIONS.map((loc) => (
                <option key={loc} value={loc} />
              ))}
            </datalist>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Departure Date</label>
                <input
                  type="date"
                  {...register('departureDate')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {errors.departureDate && <p className="text-red-600 text-sm mt-1">{errors.departureDate.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Departure Time</label>
                <input
                  type="time"
                  {...register('departureTime')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {errors.departureTime && <p className="text-red-600 text-sm mt-1">{errors.departureTime.message}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Price per Seat (XAF)</label>
                <Controller
                  name="pricePerSeat"
                  control={control}
                  render={({ field }) => (
                    <PriceStepper value={field.value} onChange={field.onChange} step={50} min={100} />
                  )}
                />
                {errors.pricePerSeat && <p className="text-red-600 text-sm mt-1">{errors.pricePerSeat.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Total Seats</label>
                <input
                  type="number"
                  {...register('totalSeats', { valueAsNumber: true })}
                  min={4}
                  max={30}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {errors.totalSeats && <p className="text-red-600 text-sm mt-1">{errors.totalSeats.message}</p>}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
              <textarea
                {...register('notes')}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {serverError && <div className="p-2 bg-red-50 text-red-600 text-sm rounded">{serverError}</div>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {submitting ? 'Publishing...' : 'Publish Trip'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
