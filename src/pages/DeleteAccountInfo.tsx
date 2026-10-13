import { Link } from 'react-router-dom'
import { PageContainer } from '../components/AppLayout'
import { LinkButton } from '../components/ui/Button'
import { SupportContact } from '../components/SupportContact'
import { useAuth } from '../hooks/useAuth'

/** Public page explaining how to delete a Ride Along account (required by Google Play). */
export default function DeleteAccountInfo() {
  const { user } = useAuth()

  return (
    <PageContainer width="md">
      <div className="max-w-[68ch]">
        <h1 className="font-semi-condensed text-[32px] font-extrabold leading-tight tracking-tight">Delete your Ride Along account</h1>

        <ol className="mt-8 space-y-4">
          {[
            user ? 'Open your Account page.' : 'Sign in to Ride Along with your phone number or email.',
            'Scroll to the bottom and tap Delete my account.',
            'Confirm. Your account is deleted straight away and you’re signed out.',
          ].map((step, i) => (
            <li key={step} className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-taxi text-sm font-extrabold text-ink">{i + 1}</span>
              <span className="pt-0.5 text-[16px] leading-relaxed">{step}</span>
            </li>
          ))}
        </ol>

        <div className="mt-8">
          <LinkButton to={user ? '/profile' : '/login'} state={user ? undefined : { from: '/profile' }}>
            {user ? 'Go to my account' : 'Sign in to delete my account'}
          </LinkButton>
        </div>

        <h2 className="mt-12 text-xl font-bold">What gets deleted</h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[16px] leading-relaxed text-ink-soft marker:text-taxi-dark">
          <li>Your name, phone number, email and profile photo</li>
          <li>Your driver and vehicle details, and any shared location</li>
          <li>Your chat messages and notifications</li>
          <li>Your upcoming bookings are cancelled, and drivers’ upcoming trips are cancelled with passengers notified</li>
        </ul>
        <p className="mt-4 text-[16px] leading-relaxed text-ink-soft">
          Past trips and bookings stay in the other person’s history so their records stay correct, but they no longer show your name or
          contact details. Ratings you gave remain without your name.
        </p>

        <h2 className="mt-12 text-xl font-bold">Can’t sign in?</h2>
        <p className="mt-3 text-[16px] leading-relaxed text-ink-soft">
          Contact <SupportContact subject="Please delete my Ride Along account" /> from the phone number or email on your account, and ask us to
          delete it. We’ll confirm once it’s done.
        </p>

        <p className="mt-10 text-sm text-muted">
          See our{' '}
          <Link to="/privacy" className="font-semibold underline decoration-taxi decoration-2 underline-offset-4">
            privacy policy
          </Link>{' '}
          for how we handle your information.
        </p>
      </div>
    </PageContainer>
  )
}
