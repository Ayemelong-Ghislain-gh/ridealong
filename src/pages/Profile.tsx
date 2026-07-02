import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { LoadingCar } from '../components/LoadingCar'
import { TripDetailsModal } from '../components/TripDetailsModal'
import { BookingDetailsModal } from '../components/BookingDetailsModal'

interface DriverProfileData {
  vehicle_make: string
  vehicle_model: string
  vehicle_color: string | null
  vehicle_plate: string
  vehicle_capacity: number
  is_verified_driver: boolean
  rating: number
  total_trips: number
  skills: string[] | null
}

export default function Profile() {
  const { user, profile, role, refreshProfile } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const [driverData, setDriverData] = useState<DriverProfileData | null>(null)
  const [skillInput, setSkillInput] = useState('')
  const [history, setHistory] = useState<any[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [detailsTripId, setDetailsTripId] = useState<string | null>(null)
  const [detailsBooking, setDetailsBooking] = useState<any | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '')
      setPhone(profile.phone || '')
      setAvatarUrl(profile.avatar_url || null)
    }
  }, [profile])

  const loadHistory = () => {
    if (!user) return
    setLoadingHistory(true)

    if (role === 'driver') {
      supabase
        .from('driver_profiles')
        .select('*')
        .eq('id', user.id)
        .single()
        .then(({ data }) => setDriverData(data))

      supabase
        .from('trips')
        .select(`
          id, departure_date, departure_time, status, price_per_seat,
          total_seats, available_seats,
          route:routes!trips_route_id_fkey (destination)
        `)
        .eq('driver_id', user.id)
        .order('departure_datetime', { ascending: false })
        .limit(20)
        .then(({ data }) => {
          setHistory(data || [])
          setLoadingHistory(false)
        })
    } else {
      supabase
        .from('bookings')
        .select(`
          id, seats_booked, status, booking_reference, created_at,
          trip:trips!bookings_trip_id_fkey (
            departure_date, departure_time, price_per_seat,
            route:routes!trips_route_id_fkey (destination),
            park:taxi_parks!trips_park_id_fkey (name)
          )
        `)
        .eq('passenger_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20)
        .then(({ data }) => {
          setHistory(data || [])
          setLoadingHistory(false)
        })
    }
  }

  useEffect(loadHistory, [user, role])

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return

    setUploading(true)
    setError('')

    try {
      const ext = file.name.split('.').pop()
      const path = `${user.id}/avatar.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true })

      if (uploadError) throw uploadError

      const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(path)
      const publicUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`

      const { error: updateError } = await supabase
        .from('users')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id)

      if (updateError) throw updateError

      setAvatarUrl(publicUrl)
      await refreshProfile()
    } catch (err: any) {
      setError(err?.message || 'Failed to upload photo')
    } finally {
      setUploading(false)
    }
  }

  const saveProfile = async () => {
    if (!user) return
    setSaving(true)
    setMessage('')
    setError('')

    try {
      const { error: userError } = await supabase
        .from('users')
        .update({ full_name: fullName, phone })
        .eq('id', user.id)

      if (userError) throw userError

      if (role === 'driver' && driverData) {
        const { error: driverError } = await supabase
          .from('driver_profiles')
          .update({
            vehicle_make: driverData.vehicle_make,
            vehicle_model: driverData.vehicle_model,
            vehicle_color: driverData.vehicle_color,
            vehicle_plate: driverData.vehicle_plate,
            vehicle_capacity: driverData.vehicle_capacity,
            skills: driverData.skills,
          })
          .eq('id', user.id)

        if (driverError) throw driverError
      }

      await refreshProfile()
      setMessage('Profile updated')
    } catch (err: any) {
      setError(err?.message || 'Failed to save profile')
    } finally {
      setSaving(false)
    }
  }

  const addSkill = () => {
    const skill = skillInput.trim()
    if (!skill || !driverData) return
    if (driverData.skills?.includes(skill)) {
      setSkillInput('')
      return
    }
    setDriverData({ ...driverData, skills: [...(driverData.skills || []), skill] })
    setSkillInput('')
  }

  const removeSkill = (skill: string) => {
    if (!driverData) return
    setDriverData({ ...driverData, skills: (driverData.skills || []).filter((s) => s !== skill) })
  }

  const deleteDriverTrip = async (tripId: string, bookedSeats: number) => {
    if (bookedSeats > 0) {
      alert('This trip has booked seats and can only be cancelled, not deleted. Manage it from My Trips.')
      return
    }
    if (!confirm('Delete this trip permanently?')) return

    setRemovingId(tripId)
    const { error } = await supabase.from('trips').delete().eq('id', tripId)
    setRemovingId(null)

    if (error) {
      alert('Failed to delete: ' + error.message)
      return
    }
    loadHistory()
  }

  const deletePassengerBooking = async (bookingId: string) => {
    if (!confirm('Remove this booking from your history?')) return

    setRemovingId(bookingId)
    const { error } = await supabase.from('bookings').delete().eq('id', bookingId)
    setRemovingId(null)

    if (error) {
      alert('Failed to remove: ' + error.message)
      return
    }
    loadHistory()
  }

  if (!profile) {
    return <LoadingCar label="Loading profile..." />
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-2xl mx-auto space-y-6 mt-2">
        {/* Avatar + basic info */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-gray-200 overflow-hidden flex items-center justify-center text-2xl font-bold text-gray-500">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  fullName.charAt(0).toUpperCase() || '?'
                )}
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="absolute -bottom-1 -right-1 bg-blue-600 text-white text-xs rounded-full w-7 h-7 flex items-center justify-center hover:bg-blue-700 disabled:opacity-50"
                title="Change photo"
              >
                {uploading ? '…' : '✎'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
              />
            </div>
            <div>
              <p className="font-semibold text-gray-800">{fullName || 'Your name'}</p>
              <p className="text-sm text-gray-600 capitalize">{role}</p>
              {role === 'driver' && driverData?.is_verified_driver && (
                <span className="inline-block mt-1 text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                  ✓ Verified Driver
                </span>
              )}
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                value={profile.email ?? ''}
                disabled
                className="w-full px-3 py-2 border border-gray-200 bg-gray-50 text-gray-500 rounded-lg"
              />
            </div>
          </div>
        </div>

        {/* Driver-only: vehicle + skills */}
        {role === 'driver' && driverData && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="font-semibold text-gray-800 mb-4">Vehicle Information</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Make</label>
                <input
                  value={driverData.vehicle_make}
                  onChange={(e) => setDriverData({ ...driverData, vehicle_make: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
                <input
                  value={driverData.vehicle_model}
                  onChange={(e) => setDriverData({ ...driverData, vehicle_model: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
                <input
                  value={driverData.vehicle_color || ''}
                  onChange={(e) => setDriverData({ ...driverData, vehicle_color: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Plate Number</label>
                <input
                  value={driverData.vehicle_plate}
                  onChange={(e) => setDriverData({ ...driverData, vehicle_plate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Seat Capacity</label>
                <input
                  type="number"
                  min={4}
                  max={30}
                  value={driverData.vehicle_capacity}
                  onChange={(e) => setDriverData({ ...driverData, vehicle_capacity: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="mt-6">
              <h3 className="font-medium text-gray-700 mb-1">Other Services</h3>
              <p className="text-sm text-gray-500 mb-3">
                Let passengers know what else you offer during off-hours — deliveries, errands, etc.
              </p>
              <div className="flex flex-wrap gap-2 mb-3">
                {(driverData.skills || []).map((skill) => (
                  <span
                    key={skill}
                    className="flex items-center gap-1 bg-blue-50 text-blue-700 text-sm px-3 py-1 rounded-full"
                  >
                    {skill}
                    <button onClick={() => removeSkill(skill)} className="text-blue-400 hover:text-blue-700">
                      ×
                    </button>
                  </span>
                ))}
                {(!driverData.skills || driverData.skills.length === 0) && (
                  <span className="text-sm text-gray-400">No services added yet</span>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addSkill()
                    }
                  }}
                  placeholder="e.g. Package delivery"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={addSkill}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        )}

        {message && <div className="p-3 bg-green-50 text-green-700 text-sm rounded-lg">{message}</div>}
        {error && <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg">{error}</div>}

        <button
          onClick={saveProfile}
          disabled={saving}
          className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>

        {/* Ride history */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="font-semibold text-gray-800 mb-4">
            {role === 'driver' ? 'Trip History' : 'Booking History'}
          </h2>

          {loadingHistory && <LoadingCar label="Loading history..." />}

          {!loadingHistory && history.length === 0 && (
            <p className="text-sm text-gray-500">Nothing here yet.</p>
          )}

          <div className="space-y-2">
            {history.map((item) => {
              const bookedSeats = role === 'driver' ? item.total_seats - item.available_seats : 0
              const canRemove =
                role === 'driver'
                  ? (item.status === 'completed' || item.status === 'cancelled') && bookedSeats === 0
                  : item.status === 'completed' || item.status === 'cancelled'

              return (
                <div
                  key={item.id}
                  className="flex justify-between items-center text-sm border-b border-gray-100 pb-2"
                >
                  <button
                    onClick={() => (role === 'driver' ? setDetailsTripId(item.id) : setDetailsBooking(item))}
                    className="text-left hover:opacity-80"
                  >
                    <p className="font-medium text-gray-800">
                      {role === 'driver' ? item.route?.destination : item.trip?.route?.destination}
                    </p>
                    <p className="text-gray-500">
                      {role === 'driver'
                        ? `${item.departure_date} at ${item.departure_time?.slice(0, 5)}`
                        : `${item.trip?.departure_date} at ${item.trip?.departure_time?.slice(0, 5)} · Ref: ${item.booking_reference}`}
                    </p>
                  </button>
                  <div className="flex items-center gap-3">
                    <span className="capitalize text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                      {item.status}
                    </span>
                    {canRemove && (
                      <button
                        onClick={() =>
                          role === 'driver' ? deleteDriverTrip(item.id, bookedSeats) : deletePassengerBooking(item.id)
                        }
                        disabled={removingId === item.id}
                        className="text-xs text-gray-400 hover:text-red-600 disabled:opacity-50"
                      >
                        {removingId === item.id ? '…' : 'Remove'}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {detailsTripId && <TripDetailsModal tripId={detailsTripId} onClose={() => setDetailsTripId(null)} />}
      {detailsBooking && <BookingDetailsModal booking={detailsBooking} onClose={() => setDetailsBooking(null)} />}
    </div>
  )
}
