import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthContext } from './AuthContext'

// Driver location sharing, held at app level so it keeps running while the
// driver moves between pages (it used to stop as soon as they left the
// dashboard). Stopping deletes the stored position so passengers never see
// a stale "last known" location.

const UPDATE_INTERVAL_MS = 15000 // at most one database write every 15s

interface LocationShareValue {
  sharing: boolean
  error: string | null
  start: () => void
  stop: () => Promise<void>
}

const LocationShareContext = createContext<LocationShareValue | null>(null)

export function LocationShareProvider({ children }: { children: ReactNode }) {
  const { user, role } = useAuthContext()
  const driverId = role === 'driver' ? user?.id : undefined

  const [sharing, setSharing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const watchIdRef = useRef<number | null>(null)
  const lastSentRef = useRef(0)
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null)

  const clearWatch = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    wakeLockRef.current?.release().catch(() => {})
    wakeLockRef.current = null
  }

  const start = useCallback(() => {
    if (!driverId) return
    if (!('geolocation' in navigator)) {
      setError('This phone or browser can’t share location.')
      return
    }

    setError(null)
    setSharing(true)
    lastSentRef.current = 0

    // Ask the screen to stay on while sharing; browsers pause GPS when it sleeps
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }
    nav.wakeLock
      ?.request('screen')
      .then((lock) => {
        wakeLockRef.current = lock
      })
      .catch(() => {})

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now()
        if (now - lastSentRef.current < UPDATE_INTERVAL_MS) return
        lastSentRef.current = now
        void supabase
          .from('driver_locations')
          .upsert([
            {
              driver_id: driverId,
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              updated_at: new Date().toISOString(),
            },
          ])
          .then(({ error: upsertError }) => {
            if (upsertError) setError('Couldn’t update your location. Check your connection.')
          })
      },
      (err) => {
        setError(
          err.code === err.PERMISSION_DENIED
            ? 'Location permission is off. Allow location for this site in your browser settings.'
            : 'Couldn’t get your location. Move to an open area and try again.'
        )
        clearWatch()
        setSharing(false)
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
    )
  }, [driverId])

  const stop = useCallback(async () => {
    clearWatch()
    setSharing(false)
    if (driverId) {
      await supabase.from('driver_locations').delete().eq('driver_id', driverId)
    }
  }, [driverId])

  // Stop when the driver signs out or switches account
  useEffect(() => {
    if (!driverId && watchIdRef.current !== null) {
      clearWatch()
      setSharing(false)
    }
  }, [driverId])

  useEffect(() => () => clearWatch(), [])

  const value = useMemo(() => ({ sharing, error, start, stop }), [sharing, error, start, stop])
  return <LocationShareContext.Provider value={value}>{children}</LocationShareContext.Provider>
}

export function useLocationShare(): LocationShareValue {
  const ctx = useContext(LocationShareContext)
  if (!ctx) throw new Error('useLocationShare must be used inside <LocationShareProvider>')
  return ctx
}
