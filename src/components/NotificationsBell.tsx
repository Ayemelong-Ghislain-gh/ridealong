import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { timeAgo } from '../lib/format'

interface NotificationRow {
  id: string
  title: string
  message: string
  is_read: boolean
  created_at: string
}

/**
 * Bell with unread count and a dropdown of recent notifications
 * (booking made, trip cancelled, time changed...). Rows are created by the
 * database triggers in supabase/ridealong_fixes.sql. If the notifications
 * table isn't set up yet, the bell simply stays hidden.
 */
export function NotificationsBell() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const key = ['notifications', user?.id]

  const { data, isError } = useQuery({
    queryKey: key,
    enabled: !!user,
    staleTime: 30_000,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('id, title, message, is_read, created_at')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(20)
      if (error) throw error
      return (data || []) as unknown as NotificationRow[]
    },
  })

  // Live updates when a new notification arrives
  useEffect(() => {
    if (!user) return
    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        () => queryClient.invalidateQueries({ queryKey: ['notifications', user.id] })
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [user, queryClient])

  // Close when tapping outside
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!user || isError) return null

  const unread = (data || []).filter((n) => !n.is_read).length

  const toggle = async () => {
    const next = !open
    setOpen(next)
    if (next && unread > 0) {
      await supabase.from('notifications').update({ is_read: true, read_at: new Date().toISOString() }).eq('user_id', user.id).eq('is_read', false)
      queryClient.invalidateQueries({ queryKey: key })
    }
  }

  return (
    <div className="relative" ref={wrapRef}>
      <button
        onClick={toggle}
        aria-expanded={open}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        className="relative flex h-10 w-10 items-center justify-center rounded-full text-white/85 hover:bg-white/10 hover:text-white"
      >
        <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M6 9a6 6 0 1112 0c0 5 2 6.5 2 6.5H4S6 14 6 9z" strokeLinejoin="round" />
          <path d="M10 19a2 2 0 004 0" strokeLinecap="round" />
        </svg>
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-taxi px-1 text-[11px] font-bold text-ink">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="animate-sheet-up fixed inset-x-3 top-16 z-50 overflow-hidden rounded-2xl border border-line bg-card text-ink shadow-2xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-96">
          <div className="border-b border-line px-4 py-3 text-sm font-bold">Notifications</div>
          <div className="max-h-[60vh] overflow-y-auto">
            {(data || []).length === 0 && <p className="px-4 py-8 text-center text-sm text-muted">Nothing new. Updates about your trips show up here.</p>}
            {(data || []).map((n) => (
              <div key={n.id} className={`border-b border-line px-4 py-3 last:border-0 ${n.is_read ? '' : 'bg-taxi-soft/50'}`}>
                <p className="text-sm font-semibold">{n.title}</p>
                <p className="mt-0.5 text-sm text-muted">{n.message}</p>
                <p className="mt-1 text-xs text-faint">{timeAgo(n.created_at)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
