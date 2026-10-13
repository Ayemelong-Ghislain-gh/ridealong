import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { PageContainer } from '../components/AppLayout'
import { SupportContact } from '../components/SupportContact'

const UPDATED = '13 October 2026'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-xl font-bold">{title}</h2>
      <div className="mt-3 space-y-3 text-[16px] leading-relaxed text-ink-soft">{children}</div>
    </section>
  )
}

function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5 marker:text-taxi-dark">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  )
}

export default function PrivacyPolicy() {
  return (
    <PageContainer width="md">
      <article className="max-w-[68ch]">
        <h1 className="font-semi-condensed text-[32px] font-extrabold leading-tight tracking-tight">Privacy policy</h1>
        <p className="mt-2 text-sm text-muted">Last updated {UPDATED}</p>

        <p className="mt-6 text-[17px] leading-relaxed">
          Ride Along helps passengers book seats on taxis leaving parks in and around Bamenda, and helps drivers publish their departures. It is
          run by AsghinLabs, Bamenda, Cameroon. This page explains what information we collect, why, who can see it, and how to delete it.
        </p>

        <Section title="What we collect">
          <Bullets
            items={[
              <>
                <strong>Account details:</strong> your name, phone number, password (stored encrypted, we can’t read it), and your email if you
                give one.
              </>,
              <>
                <strong>Profile photo:</strong> only if you upload one.
              </>,
              <>
                <strong>Driver details:</strong> vehicle make, model, colour, plate number, seat count and any extra services you list.
              </>,
              <>
                <strong>Trips and bookings:</strong> the trips drivers post, the seats passengers book, and their status.
              </>,
              <>
                <strong>Messages:</strong> the chat between a passenger and the driver of their booking.
              </>,
              <>
                <strong>Driver location:</strong> only while a driver has turned on location sharing. We keep the latest position only, and delete it
                when sharing stops.
              </>,
              <>
                <strong>Ratings and reviews</strong> that passengers give drivers.
              </>,
            ]}
          />
          <p>We don’t collect passengers’ location, contacts, or payment details. Ride Along doesn’t show ads.</p>
        </Section>

        <Section title="Why we use it">
          <Bullets
            items={[
              'To create your account and let you sign in.',
              'To show trips, take bookings and keep seat counts right.',
              'To let passengers and their driver contact each other about a booking.',
              'To show passengers where their driver is once the trip has left.',
              'To send you notifications about your trips, such as a new booking or a cancelled trip.',
              'To verify drivers and keep the service safe.',
            ]}
          />
        </Section>

        <Section title="Who can see your information">
          <Bullets
            items={[
              'Anyone can see trips, drivers’ names, photos, vehicles and ratings.',
              'A driver’s phone number is shown only to passengers with a booking on their trip, and a passenger’s phone number only to the driver of their booking.',
              'Messages are visible only to the passenger and driver of that booking.',
              'A driver’s live location is visible only to passengers on a trip that has left.',
              'The Ride Along team can see account information to verify drivers and handle problems.',
            ]}
          />
          <p>
            We don’t sell your information. We store it with service providers that run the app for us: Supabase (database and sign-in) and
            Vercel (website hosting). Maps are shown using OpenStreetMap.
          </p>
        </Section>

        <Section title="How long we keep it">
          <p>
            We keep your information while you have an account. When you delete your account, we remove your name, phone number, email, photo,
            driver details, messages and notifications. Bookings and trips you were part of stay in the other person’s history, but without your
            name or contact details.
          </p>
        </Section>

        <Section title="Your choices">
          <Bullets
            items={[
              <>You can change your name, phone number, photo and vehicle details on your Account page.</>,
              <>You can stop sharing location at any time from My trips.</>,
              <>
                You can delete your account from the Account page, or see{' '}
                <Link to="/delete-account" className="font-semibold underline decoration-taxi decoration-2 underline-offset-4">
                  how to delete your account
                </Link>
                .
              </>,
            ]}
          />
        </Section>

        <Section title="Children">
          <p>Ride Along is not meant for children under 13, and we don’t knowingly collect their information.</p>
        </Section>

        <Section title="Changes and contact">
          <p>If we change this policy, we’ll update the date at the top of this page.</p>
          <p>
            Questions about your information? Contact <SupportContact subject="Privacy question" />.
          </p>
        </Section>
      </article>
    </PageContainer>
  )
}
