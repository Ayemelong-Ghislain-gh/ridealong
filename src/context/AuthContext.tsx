import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { User as AuthUser } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { User } from '../types'

// One auth state for the whole app. Previously every component that called
// useAuth() opened its own listener and re-fetched the profile, so a single
// page load hit the database three or more times.

export type Role = User['role']

interface AuthContextValue {
  user: AuthUser | null
  profile: User | null
  role: Role | null
  loading: boolean
  /** Where this user's "home" is: driver dashboard, trips list or admin. */
  homePath: string
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function homePathForRole(role: Role | null | undefined): string {
  if (role === 'driver') return '/driver/dashboard'
  if (role === 'admin') return '/admin'
  if (role === 'passenger') return '/trips'
  return '/'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [profile, setProfile] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const loadedFor = useRef<string | null>(null)

  const loadProfile = useCallback(async (authUser: AuthUser | null, force = false) => {
    if (!authUser) {
      loadedFor.current = null
      setUser(null)
      setProfile(null)
      setLoading(false)
      return
    }

    setUser(authUser)
    if (!force && loadedFor.current === authUser.id) {
      setLoading(false)
      return
    }

    // A different account just signed in: hold protected pages until its
    // profile (and role) is known, so nobody is redirected by mistake.
    if (loadedFor.current !== authUser.id) setLoading(true)

    // get_my_profile returns your own row including phone and email, which
    // other users can't read (see supabase/ridealong_privacy.sql)
    let { data, error } = await supabase.rpc('get_my_profile').maybeSingle()
    if (error) {
      // Database not updated yet (function missing): fall back to the old way
      const fallback = await supabase.from('users').select('*').eq('id', authUser.id).maybeSingle()
      data = fallback.data as typeof data
      error = fallback.error
    }
    if (error) console.error('Failed to load user profile:', error.message)
    loadedFor.current = authUser.id
    setProfile((data as unknown as User | null) ?? null)
    setLoading(false)
  }, [])

  useEffect(() => {
    // onAuthStateChange fires INITIAL_SESSION straight away, so no separate
    // getSession() call is needed. Supabase recommends not awaiting other
    // Supabase calls inside this callback, hence the setTimeout.
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      const next = session?.user ?? null
      setTimeout(() => {
        void loadProfile(next, event === 'USER_UPDATED')
      }, 0)
    })
    return () => listener.subscription.unsubscribe()
  }, [loadProfile])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    loadedFor.current = null
    setUser(null)
    setProfile(null)
  }, [])

  const refreshProfile = useCallback(async () => {
    const { data } = await supabase.auth.getUser()
    await loadProfile(data.user, true)
  }, [loadProfile])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      role: profile?.role ?? null,
      loading,
      homePath: homePathForRole(profile?.role),
      signOut,
      refreshProfile,
    }),
    [user, profile, loading, signOut, refreshProfile]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
