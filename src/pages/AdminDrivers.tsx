import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useFeedback } from '../context/FeedbackContext'
import { PageContainer } from '../components/AppLayout'
import { Button } from '../components/ui/Button'
import { controlClasses } from '../components/ui/Field'
import { Avatar, Badge, EmptyState, PageHeader, Skeleton, Stars } from '../components/ui/Display'
import { getErrorMessage } from '../lib/errors'

interface DriverRow {
  id: string
  vehicle_make: string | null
  vehicle_model: string | null
  vehicle_color: string | null
  vehicle_plate: string | null
  vehicle_capacity: number | null
  is_verified_driver: boolean
  rating: number | null
  total_trips: number | null
  created_at: string
  user: { full_name: string | null; phone: string | null; avatar_url: string | null } | null
}

type Filter = 'pending' | 'verified' | 'all'

/** Admin-only: check drivers and grant or remove the verified badge. */
export default function AdminDrivers() {
  const { toast, confirm } = useFeedback()
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<Filter>('pending')
  const [search, setSearch] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-drivers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('driver_profiles')
        .select(
          `id, vehicle_make, vehicle_model, vehicle_color, vehicle_plate, vehicle_capacity,
           is_verified_driver, rating, total_trips, created_at,
           user:users (full_name, phone, avatar_url)`
        )
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data || []) as unknown as DriverRow[]
    },
  })

  const drivers = useMemo(() => {
    const term = search.trim().toLowerCase()
    return (data || []).filter((d) => {
      if (filter === 'pending' && d.is_verified_driver) return false
      if (filter === 'verified' && !d.is_verified_driver) return false
      if (!term) return true
      return [d.user?.full_name, d.user?.phone, d.vehicle_plate].some((v) => v?.toLowerCase().includes(term))
    })
  }, [data, filter, search])

  const pendingCount = (data || []).filter((d) => !d.is_verified_driver).length

  const setVerified = async (driver: DriverRow, verified: boolean) => {
    if (!verified) {
      const ok = await confirm({
        title: 'Remove verification?',
        message: `${driver.user?.full_name ?? 'This driver'} will lose the verified badge.`,
        confirmLabel: 'Remove badge',
        danger: true,
      })
      if (!ok) return
    }
    setBusyId(driver.id)
    const { error } = await supabase.from('driver_profiles').update({ is_verified_driver: verified }).eq('id', driver.id)
    setBusyId(null)
    if (error) return toast(getErrorMessage(error), 'error')
    toast(verified ? 'Driver verified.' : 'Verification removed.')
    queryClient.invalidateQueries({ queryKey: ['admin-drivers'] })
    queryClient.invalidateQueries({ queryKey: ['driver-profiles'] })
  }

  return (
    <PageContainer>
      <PageHeader title="Drivers" subtitle="Check each driver’s details by phone or in person before verifying them." />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-xl bg-line/60 p-1" role="tablist">
          {(
            [
              ['pending', `Waiting${pendingCount ? ` (${pendingCount})` : ''}`],
              ['verified', 'Verified'],
              ['all', 'All'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              role="tab"
              aria-selected={filter === key}
              onClick={() => setFilter(key)}
              className={`h-9 rounded-lg px-4 text-sm font-semibold ${filter === key ? 'bg-card text-ink shadow-sm' : 'text-muted hover:text-ink'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, phone or plate"
          aria-label="Search drivers"
          className={`${controlClasses} h-11 max-w-xs`}
        />
      </div>

      {isLoading && <Skeleton className="h-64" />}
      {isError && (
        <EmptyState
          title="Couldn’t load drivers"
          message="Your account may not have admin access in the database yet. See the Supabase setup notes."
          action={<Button onClick={() => refetch()}>Try again</Button>}
        />
      )}
      {!isLoading && !isError && drivers.length === 0 && (
        <EmptyState title={filter === 'pending' ? 'No drivers waiting' : 'No drivers found'} message="New drivers appear here after they sign up." />
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {drivers.map((d) => (
          <article key={d.id} className="rounded-2xl border border-line bg-card p-4">
            <div className="flex items-start gap-3">
              <Avatar name={d.user?.full_name} url={d.user?.avatar_url} />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate font-bold">{d.user?.full_name || 'Unnamed driver'}</p>
                  {d.is_verified_driver ? <Badge tone="route">Verified</Badge> : <Badge tone="taxi">Waiting</Badge>}
                </div>
                {d.user?.phone && (
                  <a href={`tel:${d.user.phone}`} className="text-sm text-muted underline-offset-4 hover:underline">
                    {d.user.phone}
                  </a>
                )}
              </div>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl bg-paper p-3 text-sm">
              <div>
                <dt className="text-xs text-muted">Vehicle</dt>
                <dd className="font-medium">{[d.vehicle_color, d.vehicle_make, d.vehicle_model].filter(Boolean).join(' ') || 'Not given'}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Plate</dt>
                <dd className="font-medium">{d.vehicle_plate || 'Not given'}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Seats</dt>
                <dd className="font-medium">{d.vehicle_capacity ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Rating</dt>
                <dd className="font-medium">{(d.rating ?? 0) > 0 ? <Stars rating={d.rating!} /> : 'None yet'}</dd>
              </div>
            </dl>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-faint">Joined {new Date(d.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              {d.is_verified_driver ? (
                <Button size="sm" variant="ghost" className="text-danger" loading={busyId === d.id} onClick={() => setVerified(d, false)}>
                  Remove badge
                </Button>
              ) : (
                <Button size="sm" variant="dark" loading={busyId === d.id} onClick={() => setVerified(d, true)}>
                  Verify driver
                </Button>
              )}
            </div>
          </article>
        ))}
      </div>
    </PageContainer>
  )
}
