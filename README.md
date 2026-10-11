# Ride Along

Book your seat on taxis leaving Bamenda's parks. Passengers see real departures with the time, price and seats left; drivers post trips, see who booked, and share their location once they leave.

A product by [AsghinLabs](https://asghinlabs.vercel.app/).

## Stack

- React 19 + TypeScript, built with Vite
- Tailwind CSS v4 (design tokens live in `src/index.css`)
- Supabase: auth, Postgres, realtime (chat, live location, notifications) and storage (avatars)
- TanStack Query for data fetching, React Hook Form + Zod for forms, Leaflet for maps
- Deployed on Vercel (`vercel.json` sends every route to the app so deep links work)

## Run it locally

```bash
npm install
cp .env.example .env   # then fill in your Supabase URL and publishable key
npm run dev
```

| Variable | What it is |
| --- | --- |
| `VITE_SUPABASE_URL` | Project URL from Supabase > Settings > API |
| `VITE_SUPABASE_ANON_KEY` | Publishable (anon) key from the same page |
| `VITE_SUPPORT_WHATSAPP` | Optional. Support number, digits only with country code, e.g. `237670000000`. Shows a "Message us on WhatsApp" link to phone-only users who forget their password. |

Add the same variables in Vercel > Project > Settings > Environment Variables.

## Database

`supabase/ridealong_fixes.sql` holds the triggers and policies the app relies on: profile creation at sign-up, protected columns (role, verification, rating), seat recounting, trip-to-booking status updates, ratings, notifications, and who can see chat and live location. Run it in the Supabase SQL editor. It is safe to run more than once.

## Project layout

```
src/
  components/      shared pieces (TripCard, modals, Nav)
    ui/            Button, form fields, Modal, badges
  context/         Auth, toasts/confirm dialogs, driver location sharing
  pages/           one file per route
  lib/             Supabase client, formatting, phone helpers, config
  types/           row shapes for Supabase queries
supabase/          SQL to run in the Supabase dashboard
```

## Accounts and roles

- **Passenger**: browses and books trips, chats with the driver, follows the trip on a map, rates the driver.
- **Driver**: posts and manages trips, sees passengers, shares location, earns a verified badge.
- **Admin**: verifies drivers at `/admin`. Make an account admin in the SQL editor:
  `update public.users set role = 'admin' where phone = '+237XXXXXXXXX';`

Sign-in works with a phone number or email. Phone-only accounts use a hidden synthetic email (`2376XXXXXXXX@ridealong.com`) for Supabase Auth; see `src/lib/phone.ts`.
