import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useFeedback } from '../context/FeedbackContext'
import { PageContainer } from '../components/AppLayout'
import { LoadingCar } from '../components/LoadingCar'
import { Button } from '../components/ui/Button'
import { Input, Notice } from '../components/ui/Field'
import { Avatar, Badge, Card, Stars, VerifiedMark } from '../components/ui/Display'
import { InstallAppButton } from '../components/InstallAppButton'
import { useInstallApp } from '../lib/installApp'
import { isValidCameroonPhone, normalizePhoneInput } from '../lib/phone'
import { getErrorMessage } from '../lib/errors'
import type { DriverProfileInfo } from '../types/rows'

interface DriverData extends DriverProfileInfo {
  vehicle_plate: string | null
}

const MAX_AVATAR_BYTES = 3 * 1024 * 1024

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <Card className="p-5 sm:p-6">
      <h2 className="text-lg font-bold">{title}</h2>
      {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
      <div className="mt-5">{children}</div>
    </Card>
  )
}

export default function Profile() {
  const { user, profile, role, refreshProfile, signOut } = useAuth()
  const { toast } = useFeedback()
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { installed } = useInstallApp()

  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [driverData, setDriverData] = useState<DriverData | null>(null)
  const [skillInput, setSkillInput] = useState('')

  const [newPassword, setNewPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordError, setPasswordError] = useState('')

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '')
      setPhone(profile.phone || '')
    }
  }, [profile])

  useEffect(() => {
    if (!user || role !== 'driver') return
    supabase
      .from('driver_profiles')
      .select('id, vehicle_make, vehicle_model, vehicle_color, vehicle_plate, vehicle_capacity, is_verified_driver, rating, total_trips, skills')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => setDriverData(data as unknown as DriverData | null))
  }, [user, role])

  const handleAvatarUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow choosing the same file again
    if (!file || !user) return

    if (!file.type.startsWith('image/')) return toast('Choose an image file.', 'error')
    if (file.size > MAX_AVATAR_BYTES) return toast('That photo is too large. Choose one under 3 MB.', 'error')

    setUploading(true)
    try {
      // One fixed path per user, so old photos are replaced rather than piling up
      const path = `${user.id}/avatar`
      const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { upsert: true, contentType: file.type })
      if (uploadError) throw uploadError

      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      const publicUrl = `${data.publicUrl}?t=${Date.now()}`

      const { error: updateError } = await supabase.from('users').update({ avatar_url: publicUrl }).eq('id', user.id)
      if (updateError) throw updateError

      await refreshProfile()
      toast('Photo updated.')
    } catch (err) {
      toast(getErrorMessage(err, 'Photo not uploaded. Try again.'), 'error')
    } finally {
      setUploading(false)
    }
  }

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault()
    if (!user) return
    setError('')

    const normalizedPhone = normalizePhoneInput(phone)
    if (!fullName.trim()) return setError('Enter your full name.')
    if (!isValidCameroonPhone(normalizedPhone)) return setError('Enter a valid Cameroon phone number, e.g. 670 922 913.')

    if (driverData) {
      if (!driverData.vehicle_make?.trim() || !driverData.vehicle_model?.trim() || !driverData.vehicle_plate?.trim()) {
        return setError('Vehicle make, model and plate number are required.')
      }
      const cap = Number(driverData.vehicle_capacity)
      if (!Number.isInteger(cap) || cap < 1 || cap > 30) return setError('Passenger seats must be between 1 and 30.')
    }

    setSaving(true)
    try {
      if (normalizedPhone !== profile?.phone) {
        const { data: taken } = await supabase.rpc('get_auth_email_for_phone', { p_phone: normalizedPhone })
        if (taken) throw new Error('Another account already uses that phone number.')
      }

      const { error: userError } = await supabase.from('users').update({ full_name: fullName.trim(), phone: normalizedPhone }).eq('id', user.id)
      if (userError) throw userError

      if (role === 'driver' && driverData) {
        const { error: driverError } = await supabase
          .from('driver_profiles')
          .update({
            vehicle_make: driverData.vehicle_make?.trim(),
            vehicle_model: driverData.vehicle_model?.trim(),
            vehicle_color: driverData.vehicle_color?.trim() || null,
            vehicle_plate: driverData.vehicle_plate?.trim().toUpperCase(),
            vehicle_capacity: Number(driverData.vehicle_capacity),
            skills: driverData.skills,
          })
          .eq('id', user.id)
        if (driverError) throw driverError
      }

      setPhone(normalizedPhone)
      await refreshProfile()
      toast('Profile saved.')
    } catch (err) {
      setError(getErrorMessage(err, 'Profile not saved. Try again.'))
    } finally {
      setSaving(false)
    }
  }

  const changePassword = async (e: FormEvent) => {
    e.preventDefault()
    if (newPassword.length < 6) return setPasswordError('Use at least 6 characters.')
    setPasswordSaving(true)
    setPasswordError('')
    const { error: pwError } = await supabase.auth.updateUser({ password: newPassword })
    setPasswordSaving(false)
    if (pwError) return setPasswordError(getErrorMessage(pwError))
    setNewPassword('')
    toast('Password changed.')
  }

  const addSkill = () => {
    const skill = skillInput.trim()
    if (!skill || !driverData) return
    if (!driverData.skills?.includes(skill)) {
      setDriverData({ ...driverData, skills: [...(driverData.skills || []), skill] })
    }
    setSkillInput('')
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  if (!user || !profile) return <LoadingCar label="Loading your account..." />

  const roleLabel = role === 'driver' ? 'Driver' : role === 'admin' ? 'Admin' : 'Passenger'

  return (
    <PageContainer width="md">
      {/* Identity */}
      <div className="mb-6 flex items-center gap-4">
        <div className="relative">
          <Avatar name={profile.full_name} url={profile.avatar_url} size="lg" />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            aria-label="Change photo"
            className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-paper bg-taxi text-ink hover:bg-[#e0aa04] disabled:opacity-50"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M4 8h3l2-3h6l2 3h3v11H4z" strokeLinejoin="round" />
              <circle cx="12" cy="13" r="3.5" />
            </svg>
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
        </div>
        <div className="min-w-0">
          <h1 className="flex items-center gap-1.5 truncate font-semi-condensed text-2xl font-extrabold sm:text-3xl">
            {profile.full_name || 'Your account'}
            {driverData?.is_verified_driver && <VerifiedMark />}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
            <Badge tone={role === 'driver' ? 'taxi' : 'neutral'}>{roleLabel}</Badge>
            {role === 'driver' && (driverData?.rating ?? 0) > 0 && <Stars rating={driverData!.rating!} />}
            {role === 'driver' && driverData && !driverData.is_verified_driver && <span>Verification pending</span>}
          </div>
        </div>
      </div>

      <form onSubmit={saveProfile} className="space-y-4">
        <Section title="Your details" description="Drivers and passengers see your name and phone number on bookings.">
          <div className="space-y-4">
            <Input label="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" />
            <Input label="Phone number" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" hint="You sign in with this number." />
            {profile.email && <Input label="Email" value={profile.email} disabled hint="Used for password resets." />}
          </div>
        </Section>

        {role === 'driver' && driverData && (
          <Section title="Your vehicle" description="Passengers see this before they book.">
            <div className="grid grid-cols-2 gap-3">
              <Input label="Make" value={driverData.vehicle_make || ''} onChange={(e) => setDriverData({ ...driverData, vehicle_make: e.target.value })} />
              <Input label="Model" value={driverData.vehicle_model || ''} onChange={(e) => setDriverData({ ...driverData, vehicle_model: e.target.value })} />
              <Input label="Colour" optional value={driverData.vehicle_color || ''} onChange={(e) => setDriverData({ ...driverData, vehicle_color: e.target.value })} />
              <Input
                label="Plate number"
                className="uppercase"
                value={driverData.vehicle_plate || ''}
                onChange={(e) => setDriverData({ ...driverData, vehicle_plate: e.target.value })}
              />
              <Input
                type="number"
                label="Passenger seats"
                min={1}
                max={30}
                inputMode="numeric"
                value={driverData.vehicle_capacity ?? ''}
                onChange={(e) => setDriverData({ ...driverData, vehicle_capacity: e.target.value === '' ? null : Number(e.target.value) })}
              />
            </div>

            <div className="mt-6 border-t border-line pt-5">
              <p className="font-semibold">Other services</p>
              <p className="mt-0.5 text-sm text-muted">Deliveries, errands, airport runs: anything you offer outside your trips.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(driverData.skills || []).map((skill) => (
                  <span key={skill} className="inline-flex items-center gap-1 rounded-full bg-paper py-1 pl-3 pr-1 text-sm font-medium ring-1 ring-line">
                    {skill}
                    <button
                      type="button"
                      onClick={() => setDriverData({ ...driverData, skills: (driverData.skills || []).filter((s) => s !== skill) })}
                      aria-label={`Remove ${skill}`}
                      className="flex h-6 w-6 items-center justify-center rounded-full text-muted hover:bg-line hover:text-ink"
                    >
                      ×
                    </button>
                  </span>
                ))}
                {(!driverData.skills || driverData.skills.length === 0) && <span className="text-sm text-faint">None added yet.</span>}
              </div>
              <div className="mt-3 flex gap-2">
                <Input
                  aria-label="New service"
                  wrapperClassName="flex-1"
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addSkill()
                    }
                  }}
                  placeholder="e.g. Package delivery"
                />
                <Button variant="secondary" onClick={addSkill}>
                  Add
                </Button>
              </div>
            </div>
          </Section>
        )}

        {error && <Notice>{error}</Notice>}
        <Button type="submit" size="lg" block loading={saving}>
          Save changes
        </Button>
      </form>

      <div className="mt-8 space-y-4">
        <Section title="Password">
          <form onSubmit={changePassword} className="flex flex-col gap-3 sm:flex-row sm:items-start">
            <Input
              type="password"
              aria-label="New password"
              placeholder="New password"
              autoComplete="new-password"
              wrapperClassName="flex-1"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              error={passwordError || undefined}
            />
            <Button type="submit" variant="dark" loading={passwordSaving} disabled={!newPassword}>
              Change password
            </Button>
          </form>
        </Section>

        {!installed && (
          <Section title="Get the app" description="Add Ride Along to your home screen for one-tap access to your trips.">
            <InstallAppButton variant="dark" />
          </Section>
        )}

        <Button variant="secondary" block onClick={handleSignOut}>
          Sign out
        </Button>
      </div>
    </PageContainer>
  )
}
