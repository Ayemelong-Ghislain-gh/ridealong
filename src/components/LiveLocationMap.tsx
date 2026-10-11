import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { supabase } from '../lib/supabase'

// Bundled marker that matches the app instead of Leaflet's default blue
// pin (which also needed images from an external CDN).
const driverIcon = L.divIcon({
  className: '',
  html: `<div style="width:34px;height:34px;border-radius:9999px;background:#1C2321;border:3px solid #F2B705;box-shadow:0 2px 8px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center">
    <svg viewBox="0 0 40 28" width="20" height="14"><path d="M3 20v-6.5c0-1 .4-1.9 1.1-2.5l4-3.7c.7-.6 1.6-1 2.5-1h18.8c.9 0 1.8.4 2.5 1l4 3.7c.7.6 1.1 1.5 1.1 2.5V20c0 .8-.7 1.5-1.5 1.5h-31C3.7 21.5 3 20.8 3 20z" fill="#F2B705"/><circle cx="11" cy="22" r="3.5" fill="#F2B705"/><circle cx="29" cy="22" r="3.5" fill="#F2B705"/></svg>
  </div>`,
  iconSize: [34, 34],
  iconAnchor: [17, 17],
  popupAnchor: [0, -18],
})

interface LiveLocationMapProps {
  driverId: string
  driverName?: string
}

interface LocationRow {
  latitude: number
  longitude: number
  updated_at: string
}

/** Keeps the map centred on the driver as new positions arrive. */
function FollowDriver({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap()
  useEffect(() => {
    map.panTo([lat, lng], { animate: true })
  }, [lat, lng, map])
  return null
}

export function LiveLocationMap({ driverId, driverName = 'Your driver' }: LiveLocationMapProps) {
  const [location, setLocation] = useState<LocationRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    let channel: ReturnType<typeof supabase.channel> | null = null

    const load = async () => {
      const { data } = await supabase
        .from('driver_locations')
        .select('latitude, longitude, updated_at')
        .eq('driver_id', driverId)
        .maybeSingle()

      if (cancelled) return
      setLocation(data as unknown as LocationRow | null)
      setLoading(false)

      channel = supabase
        .channel(`driver-location:${driverId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'driver_locations', filter: `driver_id=eq.${driverId}` },
          (payload) => {
            if (payload.eventType === 'DELETE') setLocation(null)
            else setLocation(payload.new as unknown as LocationRow)
          }
        )
        .subscribe()
    }

    void load()
    // Re-render every 30s so the "updated x min ago" label stays honest
    const timer = window.setInterval(() => setTick((t) => t + 1), 30_000)

    return () => {
      cancelled = true
      window.clearInterval(timer)
      if (channel) void supabase.removeChannel(channel)
    }
  }, [driverId])

  if (loading) {
    return <div className="flex h-56 items-center justify-center rounded-xl bg-paper text-sm text-muted">Loading location...</div>
  }

  if (!location) {
    return (
      <div className="flex h-40 items-center justify-center rounded-xl bg-paper px-6 text-center text-sm text-muted">
        {driverName} isn’t sharing their location right now. It appears here when they turn it on.
      </div>
    )
  }

  const minutesAgo = Math.floor((Date.now() - new Date(location.updated_at).getTime()) / 60_000)
  const isStale = minutesAgo >= 5

  return (
    <div className="overflow-hidden rounded-xl border border-line">
      <MapContainer center={[location.latitude, location.longitude]} zoom={15} style={{ height: '240px', width: '100%' }} scrollWheelZoom={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={[location.latitude, location.longitude]} icon={driverIcon}>
          <Popup>{driverName}</Popup>
        </Marker>
        <FollowDriver lat={location.latitude} lng={location.longitude} />
      </MapContainer>
      <div className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold ${isStale ? 'bg-taxi-soft text-[#7a5c00]' : 'bg-route-soft text-route'}`}>
        <span className={`h-2 w-2 rounded-full ${isStale ? 'bg-taxi-dark' : 'animate-pulse bg-route'}`} aria-hidden="true" />
        {isStale ? `Last update ${minutesAgo} min ago. The driver may have lost signal.` : minutesAgo < 1 ? 'Live, updated just now' : `Live, updated ${minutesAgo} min ago`}
      </div>
    </div>
  )
}
