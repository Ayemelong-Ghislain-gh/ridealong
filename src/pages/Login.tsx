import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { isEmailFormat, isValidCameroonPhone, normalizePhoneInput } from '../lib/phone'
import { getErrorMessage } from '../lib/errors'
import { useAuth, homePathForRole } from '../hooks/useAuth'
import { AuthShell } from '../components/AuthShell'
import { Button } from '../components/ui/Button'
import { Input, Notice } from '../components/ui/Field'

function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, homePath, loading: authLoading } = useAuth()
  const from = (location.state as { from?: string } | null)?.from

  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Already signed in? Skip the form.
  useEffect(() => {
    if (!authLoading && user && !loading) navigate(from || homePath, { replace: true })
  }, [authLoading, user, loading, from, homePath, navigate])

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const trimmed = identifier.trim()
      let authEmail: string

      if (isEmailFormat(trimmed)) {
        authEmail = trimmed.toLowerCase()
      } else {
        const phone = normalizePhoneInput(trimmed)
        if (!isValidCameroonPhone(phone)) {
          throw new Error('Enter a valid phone number (e.g. 670 922 913) or email address.')
        }
        // The account's sign-in email is either the user's real email or a
        // synthetic one made from their phone; look up which.
        const { data: lookedUp, error: lookupError } = await supabase.rpc('get_auth_email_for_phone', { p_phone: phone })
        if (lookupError || !lookedUp) throw new Error('No account uses this phone number. Check it or create an account.')
        authEmail = lookedUp as string
      }

      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email: authEmail, password })
      if (signInError) throw signInError

      const { data: profile } = await supabase.from('users').select('role').eq('id', data.user.id).maybeSingle()
      navigate(from || homePathForRole((profile as unknown as { role?: 'passenger' | 'driver' | 'admin' } | null)?.role), { replace: true })
    } catch (err) {
      setError(getErrorMessage(err, 'Sign in failed. Try again.'))
      setLoading(false)
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle={from === '/trips' ? 'Sign in to book your seat.' : 'Sign in with your phone number or email.'}
      footer={
        <>
          New to Ride Along?{' '}
          <Link to="/register" state={location.state} className="font-semibold text-ink underline decoration-taxi decoration-2 underline-offset-4">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={handleLogin} className="space-y-4">
        <Input
          label="Phone number or email"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder="670 922 913"
          autoComplete="username"
          required
        />

        <div>
          <div className="mb-1.5 flex items-baseline justify-between">
            <label htmlFor="login-password" className="text-sm font-medium">
              Password
            </label>
            <Link to="/forgot-password" className="text-sm font-medium text-muted hover:text-ink">
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="pr-16"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute inset-y-0 right-0 px-3.5 text-sm font-semibold text-muted hover:text-ink"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        {error && <Notice>{error}</Notice>}

        <Button type="submit" size="lg" block loading={loading}>
          Sign in
        </Button>
      </form>
    </AuthShell>
  )
}

export default Login
