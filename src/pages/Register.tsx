import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate, Link, useLocation, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { isValidCameroonPhone, phoneToAuthEmail } from '../lib/phone'
import { getErrorMessage } from '../lib/errors'
import { useAuth, homePathForRole } from '../hooks/useAuth'
import { AuthShell } from '../components/AuthShell'
import { Button } from '../components/ui/Button'
import { FieldShell, Input, Notice, controlClasses } from '../components/ui/Field'

const registerSchema = z
  .object({
    fullName: z.string().trim().min(2, 'Enter your full name'),
    email: z
      .string()
      .trim()
      .optional()
      .refine((val) => !val || z.string().email().safeParse(val).success, { message: 'Enter a valid email, or leave it empty' }),
    phone: z
      .string()
      .min(1, 'Enter your phone number')
      .transform((val) => val.replace(/[\s-]/g, '').replace(/^(\+?237)/, ''))
      .refine((val) => /^[6-9][0-9]{8}$/.test(val), { message: 'Enter the 9 digits, starting with 6 (e.g. 670 922 913)' }),
    password: z.string().min(6, 'Use at least 6 characters'),
    role: z.enum(['passenger', 'driver']),
    vehicleMake: z.string().optional(),
    vehicleModel: z.string().optional(),
    vehicleColor: z.string().optional(),
    vehiclePlate: z.string().optional(),
    vehicleCapacity: z.coerce.number().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.role !== 'driver') return
    if (!data.vehicleMake?.trim()) ctx.addIssue({ code: 'custom', message: 'Enter the make', path: ['vehicleMake'] })
    if (!data.vehicleModel?.trim()) ctx.addIssue({ code: 'custom', message: 'Enter the model', path: ['vehicleModel'] })
    if (!data.vehiclePlate?.trim()) ctx.addIssue({ code: 'custom', message: 'Enter the plate number', path: ['vehiclePlate'] })
    if (!data.vehicleCapacity || data.vehicleCapacity < 1 || data.vehicleCapacity > 30) {
      ctx.addIssue({ code: 'custom', message: 'Between 1 and 30 passenger seats', path: ['vehicleCapacity'] })
    }
  })

type RegisterFormInput = z.input<typeof registerSchema>
type RegisterFormOutput = z.output<typeof registerSchema>

export default function Register() {
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from
  const [searchParams] = useSearchParams()
  const { refreshProfile } = useAuth()
  const [serverError, setServerError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [checkEmail, setCheckEmail] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterFormInput, unknown, RegisterFormOutput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { role: searchParams.get('role') === 'driver' ? 'driver' : 'passenger', vehicleCapacity: 4 },
  })

  const role = watch('role')

  const onSubmit = async (data: RegisterFormOutput) => {
    setSubmitting(true)
    setServerError('')

    try {
      const fullPhone = `+237${data.phone}`
      if (!isValidCameroonPhone(fullPhone)) throw new Error('Enter a valid Cameroon phone number.')

      // One account per phone number
      const { data: existing } = await supabase.rpc('get_auth_email_for_phone', { p_phone: fullPhone })
      if (existing) throw new Error('An account already uses this phone number. Sign in instead.')

      const realEmail = data.email?.trim().toLowerCase() || null
      // Supabase Auth needs an email; phone-only users get a stable synthetic
      // one (see src/lib/phone.ts) that is never shown to them.
      const authEmail = realEmail ?? phoneToAuthEmail(fullPhone)

      const profileFields = {
        full_name: data.fullName.trim(),
        phone: fullPhone,
        role: data.role,
        email: realEmail,
      }
      const driverFields =
        data.role === 'driver'
          ? {
              vehicle_make: data.vehicleMake?.trim(),
              vehicle_model: data.vehicleModel?.trim(),
              vehicle_color: data.vehicleColor?.trim() || null,
              vehicle_plate: data.vehiclePlate?.trim().toUpperCase(),
              vehicle_capacity: data.vehicleCapacity,
            }
          : {}

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: authEmail,
        password: data.password,
        options: {
          // Read by the handle_new_user trigger (supabase/ridealong_fixes.sql)
          // so the profile exists even if email confirmation is switched on.
          data: { ...profileFields, ...driverFields },
          emailRedirectTo: `${window.location.origin}/login`,
        },
      })
      if (authError) throw authError
      if (!authData.user) throw new Error('Account not created. Try again.')

      // Email confirmation is on: there is no session yet, the trigger
      // creates the profile, and the user signs in after confirming.
      if (!authData.session) {
        setCheckEmail(authEmail)
        return
      }

      const userId = authData.user.id
      // Plain insert, then update if the sign-up trigger already created the
      // row. (An "upsert" needs read access to phone numbers, which the
      // database no longer gives out.)
      const { error: insertError } = await supabase.from('users').insert([{ id: userId, ...profileFields, is_verified: false }])
      if (insertError) {
        if (insertError.code !== '23505') throw insertError
        const { error: updateError } = await supabase.from('users').update(profileFields).eq('id', userId)
        if (updateError) throw updateError
      }

      if (data.role === 'driver') {
        const { error: driverError } = await supabase.from('driver_profiles').upsert(
            [{ id: userId, ...driverFields, is_verified_driver: false, rating: 0, total_trips: 0, status: 'offline' }],
            { onConflict: 'id' }
          )
        if (driverError) throw driverError
      }

      await refreshProfile()
      navigate(from || homePathForRole(data.role), { replace: true })
    } catch (err) {
      setServerError(getErrorMessage(err, 'Account not created. Try again.'))
    } finally {
      setSubmitting(false)
    }
  }

  if (checkEmail) {
    return (
      <AuthShell title="Check your email" subtitle={`We sent a confirmation link to ${checkEmail}.`}>
        <p className="text-[15px] text-muted">Open it on this phone, then sign in with your phone number or email.</p>
        <Button className="mt-6" block onClick={() => navigate('/login')}>
          Go to sign in
        </Button>
      </AuthShell>
    )
  }

  const roleOption = (value: 'passenger' | 'driver', title: string, text: string) => (
    <label
      className={`flex cursor-pointer flex-col rounded-2xl border-2 p-4 transition-colors ${
        role === value ? 'border-ink bg-taxi-soft' : 'border-line hover:border-ink/30'
      }`}
    >
      <input type="radio" value={value} className="sr-only" {...register('role')} />
      <span className="font-bold">{title}</span>
      <span className="mt-0.5 text-sm text-muted">{text}</span>
    </label>
  )

  return (
    <AuthShell
      title="Create your account"
      subtitle="It takes a minute. Your phone number is your login."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" state={location.state} className="font-semibold text-ink underline decoration-taxi decoration-2 underline-offset-4">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <fieldset>
          <legend className="mb-2 text-sm font-medium">I want to</legend>
          <div className="grid grid-cols-2 gap-3">
            {roleOption('passenger', 'Book seats', 'Travel as a passenger')}
            {roleOption('driver', 'Drive', 'Post my departures')}
          </div>
        </fieldset>

        <Input label="Full name" autoComplete="name" error={errors.fullName?.message} {...register('fullName')} />

        <FieldShell id="reg-phone" label="Phone number" error={errors.phone?.message}>
          <div className="flex">
            <span className="inline-flex items-center rounded-l-xl border border-r-0 border-line bg-paper px-3 text-[15px] font-medium text-muted">+237</span>
            <input
              id="reg-phone"
              placeholder="670 922 913"
              inputMode="tel"
              autoComplete="tel-national"
              aria-invalid={errors.phone ? true : undefined}
              className={`${controlClasses} h-11 rounded-l-none`}
              {...register('phone')}
            />
          </div>
        </FieldShell>

        <Input
          type="email"
          label="Email"
          optional
          hint="Lets you reset your password by email."
          autoComplete="email"
          placeholder="you@email.com"
          error={errors.email?.message}
          {...register('email')}
        />

        <Input type="password" label="Password" autoComplete="new-password" hint="At least 6 characters." error={errors.password?.message} {...register('password')} />

        {role === 'driver' && (
          <div className="space-y-4 rounded-2xl bg-paper p-4">
            <p className="font-semibold">Your vehicle</p>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Make" placeholder="Toyota" error={errors.vehicleMake?.message} {...register('vehicleMake')} />
              <Input label="Model" placeholder="Corolla" error={errors.vehicleModel?.message} {...register('vehicleModel')} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Colour" optional placeholder="Yellow" {...register('vehicleColor')} />
              <Input
                label="Plate number"
                placeholder="NW 123 AB"
                className="uppercase"
                error={errors.vehiclePlate?.message}
                {...register('vehiclePlate')}
              />
            </div>
            <Input
              type="number"
              label="Passenger seats"
              min={1}
              max={30}
              inputMode="numeric"
              error={errors.vehicleCapacity?.message}
              {...register('vehicleCapacity')}
            />
          </div>
        )}

        {serverError && <Notice>{serverError}</Notice>}

        <Button type="submit" size="lg" block loading={submitting}>
          Create account
        </Button>
        <p className="text-center text-xs text-faint">Drivers are checked by the Ride Along team before they get a verified badge.</p>
      </form>
    </AuthShell>
  )
}
