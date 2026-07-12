import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { supabase } from '../lib/supabase'

// Leaflet's default marker icons don't load correctly with bundlers —
// this fixes them by pointing at the CDN-hosted icon images instead.
const driverIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
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

export function LiveLocationMap({ driverId, driverName = 'Your driver' }: LiveLocationMapProps) {
  const [location, setLocation] = useState<LocationRow | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel>

    const load = async () => {
      const { data } = await supabase
        .from('driver_locations')
        .select('latitude, longitude, updated_at')
        .eq('driver_id', driverId)
        .maybeSingle()

      setLocation(data)
      setLoading(false)

      channel = supabase
        .channel(`driver-location:${driverId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'driver_locations', filter: `driver_id=eq.${driverId}` },
          (payload) => {
            if (payload.eventType === 'DELETE') return
            setLocation(payload.new as LocationRow)
          }
        )
        .subscribe()
    }

    load()

    return () => {
      if (channel) supabase.removeChannel(channel)
    }
  }, [driverId])

  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
        <p className="text-sm text-gray-400">Loading location...</p>
      </div>
    )
  }

  if (!location) {
    return (
      <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg text-center px-4">
        <p className="text-sm text-gray-400">
          {driverName} hasn't started sharing their location yet.
        </p>
      </div>
    )
  }

  const isStale = Date.now() - new Date(location.updated_at).getTime() > 5 * 60 * 1000 // 5 min

  return (
    <div className="rounded-lg overflow-hidden border border-gray-200">
      <MapContainer
        center={[location.latitude, location.longitude]}
        zoom={14}
        style={{ height: '256px', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={[location.latitude, location.longitude]} icon={driverIcon}>
          <Popup>{driverName}</Popup>
        </Marker>
      </MapContainer>
      <div className={`text-xs px-3 py-2 ${isStale ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700'}`}>
        {isStale ? '⚠ Last seen ' : '● Live — updated '}
        {new Date(location.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </div>
    </div>
  )
}
