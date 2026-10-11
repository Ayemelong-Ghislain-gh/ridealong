import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getErrorMessage } from '../lib/errors'
import { useAuth } from '../hooks/useAuth'
import { useFeedback } from '../context/FeedbackContext'
import { AuthShell } from '../components/AuthShell'
import { Button } from '../components/ui/Button'
import { Input, Notice } from '../components/ui/Field'
import { LoadingCar } from '../components/LoadingCar'

/** Landing page for the email reset link. Supabase signs the user in from the link first. */
export default function ResetPassword() {
  const { user, loading: authLoading, homePath } = useAuth()
  const { toast } = useFeedback()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [waited, setWaited] = useState(false)

  // Give the link a moment to sign the user in before showing "link expired"
  useEffect(() => {
    const t = window.setTimeout(() => setWaited(true), 2500)
    return () => window.clearTimeout(t)
  }, [])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (password.length < 6) return setError('Use at least 6 characters.')
    if (password !== confirmPassword) return setError('The two passwords don’t match.')

    setSaving(true)
    setError('')
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setSaving(false)
    if (updateError) {
      setError(getErrorMessage(updateError))
      return
    }
    toast('Password changed.')
    navigate(homePath, { replace: true })
  }

  if (!user && (authLoading || !waited)) return <LoadingCar label="Checking your link..." />

  if (!user) {
    return (
      <AuthShell title="This link has expired" subtitle="Reset links work once and only for a short time.">
        <Link to="/forgot-password" className="block text-center font-semibold underline decoration-taxi decoration-2 underline-offset-4">
          Send a new link
        </Link>
      </AuthShell>
    )
  }

  return (
    <AuthShell title="Choose a new password">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input type="password" label="New password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <Input
          type="password"
          label="Repeat new password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />
        {error && <Notice>{error}</Notice>}
        <Button type="submit" size="lg" block loading={saving}>
          Save new password
        </Button>
      </form>
    </AuthShell>
  )
}
