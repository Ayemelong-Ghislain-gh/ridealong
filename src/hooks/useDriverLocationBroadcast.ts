import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

const UPDATE_INTERVAL_MS = 15000 // don't hammer the DB — update at most every 15s

/**
 * Call this hook on the driver's dashboard while a trip is active
 * (status 'scheduled' or 'departed'). It watches the device's GPS
 * and periodically upserts the driver's location so passengers with
 * a confirmed booking can see it.
 *
 * Usage:
 *   const { tracking, error, startTracking, stopTracking } = useDriverLocationBroadcast(user.id)
 */
export function useDriverLocationBroadcast(driverId: string | undefined) {
  const [tracking, setTracking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const watchIdRef = useRef<number | null>(null)
  const lastSentRef = useRef<number>(0)

  const pushLocation = async (latitude: number, longitude: number) => {
    if (!driverId) return
    const { error: upsertError } = await supabase
      .from('driver_locations')
      .upsert([{ driver_id: driverId, latitude, longitude, updated_at: new Date().toISOString() }])

    if (upsertError) console.error('Failed to update location:', upsertError.message)
  }

  const startTracking = () => {
    if (!driverId) return
    if (!('geolocation' in navigator)) {
      setError('Location is not supported on this device')
      return
    }

    setError(null)
    setTracking(true)

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now()
        if (now - lastSentRef.current < UPDATE_INTERVAL_MS) return
        lastSentRef.current = now
        pushLocation(pos.coords.latitude, pos.coords.longitude)
      },
      (err) => {
        setError(err.message || 'Unable to get location')
        setTracking(false)
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    )
  }

  const stopTracking = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    setTracking(false)
  }

  // Always clean up the GPS watch when the component unmounts
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current)
    }
  }, [])

  return { tracking, error, startTracking, stopTracking }
}
