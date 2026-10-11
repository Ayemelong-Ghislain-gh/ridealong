import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getErrorMessage } from '../lib/errors'
import { isEmailFormat } from '../lib/phone'
import { supportWhatsAppLink } from '../lib/config'
import { AuthShell } from '../components/AuthShell'
import { Button } from '../components/ui/Button'
import { Input, Notice } from '../components/ui/Field'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const support = supportWhatsAppLink('Hello, I can’t sign in to Ride Along. My phone number is: ')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const value = email.trim().toLowerCase()
    if (!isEmailFormat(value)) {
      setError('Enter the email address on your account.')
      return
    }
    setLoading(true)
    setError('')
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(value, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setLoading(false)
    if (resetError) {
      setError(getErrorMessage(resetError))
      return
    }
    setSent(true)
  }

  if (sent) {
    return (
      <AuthShell title="Check your email" subtitle={`If an account uses ${email.trim()}, a reset link is on its way.`}>
        <p className="text-[15px] text-muted">The link opens a page where you choose a new password. It can take a few minutes; check spam too.</p>
        <Link to="/login" className="mt-6 block text-center font-semibold underline decoration-taxi decoration-2 underline-offset-4">
          Back to sign in
        </Link>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter the email on your account and we’ll send you a link."
      footer={
        <Link to="/login" className="font-semibold text-ink underline decoration-taxi decoration-2 underline-offset-4">
          Back to sign in
        </Link>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input type="email" label="Email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        {error && <Notice>{error}</Notice>}
        <Button type="submit" size="lg" block loading={loading}>
          Send reset link
        </Button>
      </form>

      <div className="mt-6 rounded-2xl bg-paper p-4 text-sm text-muted">
        <p className="font-semibold text-ink">Signed up with only a phone number?</p>
        <p className="mt-1">
          Email reset isn’t available for your account.{' '}
          {support ? (
            <>
              <a href={support} target="_blank" rel="noopener noreferrer" className="font-semibold text-ink underline decoration-taxi decoration-2 underline-offset-4">
                Message us on WhatsApp
              </a>{' '}
              and we’ll help you get back in.
            </>
          ) : (
            'Contact the Ride Along team and we’ll help you get back in.'
          )}
        </p>
      </div>
    </AuthShell>
  )
}
