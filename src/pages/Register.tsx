import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { isValidCameroonPhone, phoneToAuthEmail } from '../lib/phone'

const registerSchema = z
  .object({
    fullName: z.string().min(2, 'Full name is required'),
    email: z
      .string()
      .optional()
      .refine((val) => !val || val.trim() === '' || z.string().email().safeParse(val).success, {
        message: 'Enter a valid email',
      }),
    phone: z
      .string()
      .min(1, 'Phone number is required')
      .transform((val) => val.replace(/[\s-]/g, ''))
      .refine((val) => /^[6-9][0-9]{8}$/.test(val), {
        message: 'Enter a valid 9-digit number starting with 6, 7, 8 or 9',
      }),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    role: z.enum(['passenger', 'driver']),
    vehicleMake: z.string().optional(),
    vehicleModel: z.string().optional(),
    vehicleColor: z.string().optional(),
    vehiclePlate: z.string().optional(),
    vehicleCapacity: z.coerce.number().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.role !== 'driver') return

    if (!data.vehicleMake) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Vehicle make is required', path: ['vehicleMake'] })
    }
    if (!data.vehicleModel) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Vehicle model is required', path: ['vehicleModel'] })
    }
    if (!data.vehiclePlate) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Plate number is required', path: ['vehiclePlate'] })
    }
    if (!data.vehicleCapacity || data.vehicleCapacity < 4 || data.vehicleCapacity > 30) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Capacity must be between 4 and 30 seats',
        path: ['vehicleCapacity'],
      })
    }
  })

type RegisterFormInput = z.input<typeof registerSchema>
type RegisterFormOutput = z.output<typeof registerSchema>

export default function Register() {
  const navigate = useNavigate()
  const [serverError, setServerError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterFormInput, any, RegisterFormOutput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { role: 'passenger' },
  })

  const role = watch('role')

  const onSubmit = async (data: RegisterFormOutput) => {
    setSubmitting(true)
    setServerError('')

    try {
      // data.phone has already been stripped of spaces/dashes by the zod
      // transform, so it's a bare 9-digit string like "670922913" here.
      const fullPhone = `+237${data.phone}`
      if (!isValidCameroonPhone(fullPhone)) {
        throw new Error('Enter a valid Cameroon phone number')
      }

      const trimmedEmail = data.email?.trim()
      const hasRealEmail = !!trimmedEmail
      // Supabase Auth requires an email. If the user didn't provide one, we
      // derive a stable synthetic email from their phone number so login
      // can later look it up the same way (see src/lib/phone.ts).
      const authEmail = hasRealEmail ? trimmedEmail! : phoneToAuthEmail(fullPhone)

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: authEmail,
        password: data.password,
      })
      if (authError) throw authError
      if (!authData.user) throw new Error('Registration failed — no user returned. Check your email to confirm your account.')

      const userId = authData.user.id

      const { error: profileError } = await supabase.from('users').insert([
        {
          id: userId,
          full_name: data.fullName,
          // Only store a real email on the profile. The synthetic
          // "@ridealong.com" address is an auth-layer implementation detail
          // and should never be shown to the user or treated as their email.
          email: hasRealEmail ? trimmedEmail : null,
          phone: fullPhone,
          role: data.role,
          is_verified: false,
        },
      ])
      if (profileError) throw profileError

      if (data.role === 'driver') {
        const { error: driverError } = await supabase.from('driver_profiles').insert([
          {
            id: userId,
            vehicle_make: data.vehicleMake,
            vehicle_model: data.vehicleModel,
            vehicle_color: data.vehicleColor || null,
            vehicle_plate: data.vehiclePlate,
            vehicle_capacity: data.vehicleCapacity,
            is_verified_driver: false,
            rating: 0,
            total_trips: 0,
            status: 'offline',
          },
        ])
        if (driverError) throw driverError
      }

      navigate('/')
    } catch (err) {
      console.error('Registration error:', err)
      setServerError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Create Account</h1>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <input
              {...register('fullName')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {errors.fullName && <p className="text-red-600 text-sm mt-1">{errors.fullName.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
            <div className="flex">
              <span className="inline-flex items-center px-3 border border-r-0 border-gray-300 rounded-l-lg bg-gray-50 text-gray-600 text-sm">
                +237
              </span>
              <input
                {...register('phone')}
                placeholder="670 922 913"
                inputMode="numeric"
                className="w-full px-3 py-2 border border-gray-300 rounded-r-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {errors.phone && <p className="text-red-600 text-sm mt-1">{errors.phone.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="email"
              {...register('email')}
              placeholder="you@email.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {errors.email && <p className="text-red-600 text-sm mt-1">{errors.email.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              {...register('password')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {errors.password && <p className="text-red-600 text-sm mt-1">{errors.password.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">I am a</label>
            <select
              {...register('role')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="passenger">Passenger</option>
              <option value="driver">Driver</option>
            </select>
          </div>

          {role === 'driver' && (
            <div className="border-t pt-4 space-y-4">
              <p className="text-sm font-semibold text-gray-700">Vehicle Information</p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Make</label>
                  <input
                    {...register('vehicleMake')}
                    placeholder="Toyota"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {errors.vehicleMake && <p className="text-red-600 text-sm mt-1">{errors.vehicleMake.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
                  <input
                    {...register('vehicleModel')}
                    placeholder="Hiace"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {errors.vehicleModel && <p className="text-red-600 text-sm mt-1">{errors.vehicleModel.message}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
                  <input
                    {...register('vehicleColor')}
                    placeholder="White"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Plate Number</label>
                  <input
                    {...register('vehiclePlate')}
                    placeholder="LT 123 AB"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {errors.vehiclePlate && <p className="text-red-600 text-sm mt-1">{errors.vehiclePlate.message}</p>}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Seat Capacity</label>
                <input
                  type="number"
                  {...register('vehicleCapacity')}
                  min={4}
                  max={30}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {errors.vehicleCapacity && (
                  <p className="text-red-600 text-sm mt-1">{errors.vehicleCapacity.message}</p>
                )}
              </div>
            </div>
          )}

          {serverError && <div className="p-2 bg-red-50 text-red-600 text-sm rounded">{serverError}</div>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {submitting ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="text-sm text-gray-600 mt-4 text-center">
          Already have an account?{' '}
          <Link to="/login" className="text-blue-600 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
