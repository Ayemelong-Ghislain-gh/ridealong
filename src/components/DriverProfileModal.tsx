import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { Modal } from './ui/Modal'
import { Avatar, Badge, Stars, VerifiedMark } from './ui/Display'
import { LoadingCar } from './LoadingCar'
import { timeAgo } from '../lib/format'
import type { DriverProfileInfo } from '../types/rows'

interface DriverProfileModalProps {
  driverId: string
  onClose: () => void
}

interface ReviewRow {
  id: string
  rating: number
  comment: string | null
  created_at: string
}

/** What a passenger sees before booking: who the driver is and what others said. */
export function DriverProfileModal({ driverId, onClose }: DriverProfileModalProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['driver-public', driverId],
    queryFn: async () => {
      const [userRes, profileRes, reviewsRes] = await Promise.all([
        supabase.from('users').select('full_name, avatar_url, created_at').eq('id', driverId).maybeSingle(),
        supabase
          .from('driver_profiles')
          .select('id, is_verified_driver, rating, total_trips, vehicle_make, vehicle_model, vehicle_color, vehicle_capacity, skills')
          .eq('id', driverId)
          .maybeSingle(),
        supabase
          .from('reviews')
          .select('id, rating, comment, created_at')
          .eq('driver_id', driverId)
          .order('created_at', { ascending: false })
          .limit(10),
      ])
      return {
        user: userRes.data as unknown as { full_name: string | null; avatar_url: string | null; created_at: string } | null,
        profile: profileRes.data as unknown as DriverProfileInfo | null,
        reviews: (reviewsRes.data || []) as unknown as ReviewRow[],
      }
    },
  })

  const p = data?.profile
  const vehicle = [p?.vehicle_color, p?.vehicle_make, p?.vehicle_model].filter(Boolean).join(' ')
  const since = data?.user?.created_at ? new Date(data.user.created_at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) : null

  return (
    <Modal title="Driver" onClose={onClose}>
      {isLoading && <LoadingCar label="Loading driver..." />}
      {data && (
        <div>
          <div className="flex items-center gap-4">
            <Avatar name={data.user?.full_name} url={data.user?.avatar_url} size="lg" />
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-lg font-bold">
                <span className="truncate">{data.user?.full_name || 'Driver'}</span>
                {p?.is_verified_driver && <VerifiedMark />}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                {(p?.rating ?? 0) > 0 ? <Stars rating={p!.rating!} /> : <span>No ratings yet</span>}
                {(p?.total_trips ?? 0) > 0 && <span>{p!.total_trips} trips</span>}
                {since && <span>On Ride Along since {since}</span>}
              </div>
            </div>
          </div>

          {vehicle && (
            <div className="mt-5 rounded-xl bg-paper px-4 py-3">
              <p className="text-xs font-semibold text-muted">Vehicle</p>
              <p className="mt-0.5 font-semibold">
                {vehicle}
                {p?.vehicle_capacity ? <span className="font-normal text-muted">, {p.vehicle_capacity} seats</span> : null}
              </p>
            </div>
          )}

          {p?.skills && p.skills.length > 0 && (
            <div className="mt-5">
              <p className="text-sm font-semibold">Also offers</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {p.skills.map((s) => (
                  <Badge key={s}>{s}</Badge>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6">
            <p className="text-sm font-semibold">What passengers say</p>
            {data.reviews.length === 0 && <p className="mt-2 text-sm text-muted">No reviews yet.</p>}
            <ul className="mt-2 divide-y divide-line">
              {data.reviews.map((r) => (
                <li key={r.id} className="py-3">
                  <div className="flex items-center justify-between">
                    <Stars rating={r.rating} className="text-sm" />
                    <span className="text-xs text-faint">{timeAgo(r.created_at)}</span>
                  </div>
                  {r.comment && <p className="mt-1 text-sm text-muted">{r.comment}</p>}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </Modal>
  )
}
