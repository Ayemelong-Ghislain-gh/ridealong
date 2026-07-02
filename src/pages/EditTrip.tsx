import { useState, useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { PriceStepper } from '../components/PriceStepper'
import { LoadingCar } from '../components/LoadingCar'

const editSchema = z.object({
  departureDate: z.string().min(1, 'Select a date'),
  departureTime: z.string().min(1, 'Select a time'),
  pricePerSeat: z.number().min(100, 'Enter a valid price'),
  totalSeats: z.number().min(4, 'Minimum 4 seats').max(30, 'Maximum 30 seats'),
  notes: z.string().optional(),
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
  const { user } = useAuth()

  const [trip, setTrip] = useState<TripRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [serverError, setServerError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [bookedSeats, setBookedSeats] = useState(0)

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<EditForm>({ resolver: zodResolver(editSchema) })

  useEffect(() => {
    if (!tripId) return

    supabase
      .from('trips')
      .select(`
        id, driver_id, departure_date, departure_time, price_per_seat,
        total_seats, available_seats, notes, status,
        route:routes!trips_route_id_fkey (destination),
        park:taxi_parks!trips_park_id_fkey (name)
      `)
      .eq('id', tripId)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          setServerError('Trip not found')
          setLoading(false)
          return
        }
        setTrip(data as any)
        const booked = data.total_seats - data.available_seats
        setBookedSeats(booked)
        reset({
          departureDate: data.departure_date,
          departureTime: data.departure_time?.slice(0, 5),
          pricePerSeat: data.price_per_seat,
          totalSeats: data.total_seats,
          notes: data.notes || '',
        })
        setLoading(false)
      })
  }, [tripId, reset])

  const onSubmit = async (data: EditForm) => {
    if (!trip || !user) return

    if (data.totalSeats < bookedSeats) {
      setServerError(`Total seats can't be less than the ${bookedSeats} already booked.`)
      return
    }

    setSubmitting(true)
    setServerError('')

    try {
      const newAvailable = data.totalSeats - bookedSeats

      const { error } = await supabase
        .from('trips')
        .update({
          departure_date: data.departureDate,
          departure_time: data.departureTime,
          price_per_seat: data.pricePerSeat,
          total_seats: data.totalSeats,
          available_seats: newAvailable,
          notes: data.notes || null,
        })
        .eq('id', trip.id)
        .eq('driver_id', user.id)

      if (error) throw error

      navigate('/driver/dashboard')
    } catch (err: any) {
      setServerError(err?.message || 'Failed to update trip')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <LoadingCar label="Loading trip..." />

  if (!trip) {
    return (
      <div className="min-h-screen bg-gray-100 p-4">
        <div className="max-w-lg mx-auto bg-white rounded-lg shadow-xl p-6 mt-6 text-center">
          <p className="text-gray-600">{serverError || 'Trip not found'}</p>
          <Link to="/driver/dashboard" className="text-blue-600 hover:underline mt-4 inline-block">
            Back to My Trips
          </Link>
        </div>
      </div>
    )
  }

  if (trip.status !== 'scheduled') {
    return (
      <div className="min-h-screen bg-gray-100 p-4">
        <div className="max-w-lg mx-auto bg-white rounded-lg shadow-xl p-6 mt-6 text-center">
          <p className="text-gray-600">
            This trip is <span className="capitalize font-medium">{trip.status}</span> and can no longer be edited.
          </p>
          <Link to="/driver/dashboard" className="text-blue-600 hover:underline mt-4 inline-block">
            Back to My Trips
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-lg mx-auto bg-white rounded-lg shadow-xl p-6 mt-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-1">Edit Trip</h1>
        <p className="text-sm text-gray-500 mb-6">
          {trip.park?.name} → {trip.route?.destination}
        </p>

        {bookedSeats > 0 && (
          <div className="mb-4 p-3 bg-yellow-50 text-yellow-800 text-sm rounded-lg">
            {bookedSeats} seat{bookedSeats > 1 ? 's' : ''} already booked. Total seats can't go below this number.
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
                min={Math.max(4, bookedSeats)}
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

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Save Changes'}
            </button>
            <Link
              to="/driver/dashboard"
              className="flex-1 text-center bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
