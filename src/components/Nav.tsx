import { Link, NavLink, useNavigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useLocationShare } from '../context/LocationShareContext'
import { NotificationsBell } from './NotificationsBell'
import { Avatar } from './ui/Display'
import { buttonClasses } from './ui/Button'

interface NavItem {
  to: string
  label: string
  icon: ReactNode
  end?: boolean
}

const icon = (d: string) => (
  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
)

const ICONS = {
  search: icon('M11 18a7 7 0 100-14 7 7 0 000 14zM20 20l-4-4'),
  ticket: icon('M4 7a2 2 0 012-2h12a2 2 0 012 2v2a2 2 0 000 4v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2a2 2 0 000-4V7zM14 5v12'),
  route: icon('M6 19a2 2 0 100-4 2 2 0 000 4zM18 9a2 2 0 100-4 2 2 0 000 4zM8 17h6a3 3 0 000-6h-4a3 3 0 010-6h6'),
  plus: icon('M12 5v14M5 12h14'),
  user: icon('M12 12a4 4 0 100-8 4 4 0 000 8zM4 20a8 8 0 0116 0'),
  shield: icon('M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3zM9 12l2 2 4-4'),
}

export function navItemsForRole(role: string | null): NavItem[] {
  if (role === 'driver') {
    return [
      { to: '/driver/dashboard', label: 'My trips', icon: ICONS.route },
      { to: '/driver/create-trip', label: 'Post a trip', icon: ICONS.plus },
      { to: '/profile', label: 'Account', icon: ICONS.user },
    ]
  }
  if (role === 'admin') {
    return [
      { to: '/admin', label: 'Drivers', icon: ICONS.shield },
      { to: '/trips', label: 'Trips', icon: ICONS.search },
      { to: '/profile', label: 'Account', icon: ICONS.user },
    ]
  }
  return [
    { to: '/trips', label: 'Find a trip', icon: ICONS.search },
    { to: '/passenger/bookings', label: 'My bookings', icon: ICONS.ticket },
    { to: '/profile', label: 'Account', icon: ICONS.user },
  ]
}

export function Logo({ to = '/' }: { to?: string }) {
  return (
    <Link to={to} className="flex items-center gap-2.5 text-white" aria-label="Ride Along home">
      <svg viewBox="0 0 64 64" className="h-8 w-8" aria-hidden="true">
        <rect width="64" height="64" rx="14" fill="#F2B705" />
        <path d="M14 40V30.5c0-1.4.6-2.7 1.6-3.6l5.2-4.9c1-.9 2.3-1.4 3.6-1.4h15.2c1.3 0 2.6.5 3.6 1.4l5.2 4.9c1 .9 1.6 2.2 1.6 3.6V40c0 1.1-.9 2-2 2H16c-1.1 0-2-.9-2-2z" fill="#1C2321" />
        <path d="M22 28l3.4-3.2c.4-.4.9-.6 1.4-.6h10.4c.5 0 1 .2 1.4.6L42 28z" fill="#F2B705" />
        <circle cx="22" cy="42" r="5" fill="#F2B705" />
        <circle cx="42" cy="42" r="5" fill="#F2B705" />
        <circle cx="22" cy="42" r="2.2" fill="#1C2321" />
        <circle cx="42" cy="42" r="2.2" fill="#1C2321" />
      </svg>
      <span className="font-wide text-lg font-extrabold tracking-tight">Ride Along</span>
    </Link>
  )
}

export function Nav() {
  const { user, profile, role, signOut, homePath, loading } = useAuth()
  const { sharing } = useLocationShare()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  const desktopLink = ({ isActive }: { isActive: boolean }) =>
    `rounded-lg px-3 py-2 text-[15px] font-medium transition-colors ${
      isActive ? 'bg-white/10 text-white' : 'text-white/70 hover:text-white'
    }`

  return (
    <header className="sticky top-0 z-40 bg-ink pt-[env(safe-area-inset-top)] text-white">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Logo to={user ? homePath : '/'} />

        {user && (
          <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
            {navItemsForRole(role)
              .filter((item) => item.to !== '/profile')
              .map((item) => (
                <NavLink key={item.to} to={item.to} className={desktopLink}>
                  {item.label}
                </NavLink>
              ))}
          </nav>
        )}

        <div className="flex items-center gap-1.5">
          {sharing && (
            <span className="mr-1 hidden items-center gap-1.5 rounded-full bg-route px-2.5 py-1 text-xs font-semibold sm:inline-flex">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" aria-hidden="true" />
              Sharing location
            </span>
          )}

          {user ? (
            <>
              <NotificationsBell />
              <Link to="/profile" className="ml-1 hidden items-center gap-2 rounded-full py-1 pl-1 pr-3 hover:bg-white/10 md:flex">
                <Avatar name={profile?.full_name} url={profile?.avatar_url} size="sm" />
                <span className="max-w-[140px] truncate text-sm font-medium text-white/90">{profile?.full_name?.split(' ')[0] || 'Account'}</span>
              </Link>
              <button onClick={handleSignOut} className="hidden rounded-lg px-3 py-2 text-sm text-white/60 hover:text-white md:block">
                Sign out
              </button>
            </>
          ) : (
            !loading && (
              <>
                <NavLink to="/trips" className={({ isActive }) => `hidden sm:block ${desktopLink({ isActive })}`}>
                  Find a trip
                </NavLink>
                <Link to="/login" className="rounded-lg px-3 py-2 text-[15px] font-medium text-white/80 hover:text-white">
                  Sign in
                </Link>
                <Link to="/register" className={buttonClasses('primary', 'sm', 'hidden sm:inline-flex')}>
                  Create account
                </Link>
              </>
            )
          )}
        </div>
      </div>
    </header>
  )
}

/** Thumb-friendly bottom bar for signed-in users on phones. */
export function MobileTabBar() {
  const { user, role } = useAuth()
  if (!user) return null

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <div className="mx-auto grid max-w-md grid-cols-3">
        {navItemsForRole(role).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold ${isActive ? 'text-ink' : 'text-faint'}`
            }
          >
            {({ isActive }) => (
              <>
                <span className={`flex h-8 w-14 items-center justify-center rounded-full ${isActive ? 'bg-taxi' : ''}`}>{item.icon}</span>
                {item.label}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
