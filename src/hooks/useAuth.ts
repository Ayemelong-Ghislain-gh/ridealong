import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { User } from '../types'

interface AuthState {
  authUser: any | null
  profile: User | null
  loading: boolean
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    authUser: null,
    profile: null,
    loading: true,
  })

  const loadProfile = useCallback(async (authUser: any | null) => {
    if (!authUser) {
      setState({ authUser: null, profile: null, loading: false })
      return
    }

    const { data: profile, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', authUser.id)
      .single()

    if (error) {
      console.error('Failed to load user profile:', error)
    }

    setState({ authUser, profile: profile ?? null, loading: false })
  }, [])

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => loadProfile(data.user))

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      loadProfile(session?.user ?? null)
    })

    return () => listener.subscription.unsubscribe()
  }, [loadProfile])

  const signOut = async () => {
    await supabase.auth.signOut()
    setState({ authUser: null, profile: null, loading: false })
  }

  const refreshProfile = useCallback(async () => {
    const { data } = await supabase.auth.getUser()
    await loadProfile(data.user)
  }, [loadProfile])

  return {
    user: state.authUser,
    profile: state.profile,
    role: state.profile?.role ?? null,
    loading: state.loading,
    signOut,
    refreshProfile,
  }
}
