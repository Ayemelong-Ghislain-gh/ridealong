import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export function Nav() {
  const { user, profile, role, signOut } = useAuth()

  const logoDestination = role === 'driver' ? '/driver/dashboard' : role === 'passenger' ? '/trips' : '/'

  return (
    <header className="bg-white dark:bg-gray-800 shadow">
      <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex justify-between items-center flex-wrap gap-3">
        <Link to={logoDestination} className="text-2xl font-bold text-blue-600">
          🚗 Ride Along
        </Link>
        <div className="flex items-center gap-4 flex-wrap">
          {role !== 'driver' && (
            <Link to="/trips" className="text-sm text-blue-600 hover:underline">
              Browse Trips
            </Link>
          )}
          {user ? (
            <>
              {profile?.role === 'driver' && (
                <>
                  <Link to="/driver/create-trip" className="text-sm text-blue-600 hover:underline">
                    New Trip
                  </Link>
                  <Link to="/driver/dashboard" className="text-sm text-blue-600 hover:underline">
                    My Trips
                  </Link>
                </>
              )}
              {profile?.role === 'passenger' && (
                <Link to="/passenger/bookings" className="text-sm text-blue-600 hover:underline">
                  My Bookings
                </Link>
              )}
              <Link to="/profile" className="flex items-center gap-2 group">
                <div className="w-7 h-7 rounded-full bg-gray-200 overflow-hidden flex items-center justify-center text-xs font-bold text-gray-500 group-hover:ring-2 group-hover:ring-blue-400">
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    (profile?.full_name || user.email || '?').charAt(0).toUpperCase()
                  )}
                </div>
                <span className="text-sm text-gray-600 dark:text-gray-300 group-hover:underline">
                  {profile?.full_name || user.email}
                </span>
              </Link>
              <button onClick={signOut} className="text-sm text-red-600 hover:underline">
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="text-sm text-blue-600 hover:underline">
                Sign In
              </Link>
              <Link to="/register" className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
                Register
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}