import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Nav } from '../components/Nav'

export default function LandingPage() {
  const { user, role } = useAuth()

  const primaryDestination = !user ? '/register' : role === 'driver' ? '/driver/dashboard' : '/trips'

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Nav />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-20 text-center">
          <span className="inline-block text-xs font-semibold tracking-wide uppercase text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-3 py-1 rounded-full mb-6">
            Built for Cameroon's taxi parks
          </span>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 dark:text-gray-50 tracking-tight leading-tight">
            Book your seat
            <br />
            <span className="text-blue-600">before you get to the park.</span>
          </h1>
          <p className="mt-5 text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Ride Along lists real scheduled departures from real drivers at your local park —
            so you know the time, the price, and the seats left, before you leave the house.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to={primaryDestination}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              {!user ? 'Get Started' : role === 'driver' ? 'Go to My Trips' : 'Find a Trip'}
            </Link>
            {!user && (
              <Link
                to="/login"
                className="border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 px-6 py-3 rounded-lg font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>

        {/* Signature element: a route line with stops */}
        <div className="max-w-3xl mx-auto px-4 pb-6">
          <div className="relative flex items-center justify-between">
            <div className="absolute left-0 right-0 h-0.5 bg-amber-300 dark:bg-amber-700" />
            {['Park', 'On the way', 'Destination'].map((label, i) => (
              <div key={label} className="relative flex flex-col items-center gap-2 bg-gray-50 dark:bg-gray-900 px-2">
                <div
                  className={`w-3 h-3 rounded-full ${
                    i === 0 ? 'bg-amber-500' : i === 2 ? 'bg-blue-600' : 'bg-amber-300 dark:bg-amber-700'
                  }`}
                />
                <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid gap-8 md:grid-cols-3">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="text-2xl mb-3">🕒</div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-50 mb-2">See real departure times</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Drivers publish their schedule in advance, so you're not guessing when the next bus leaves.
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="text-2xl mb-3">💺</div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-50 mb-2">Reserve your seat</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Book ahead and skip standing around the park waiting for a vehicle to fill up.
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="text-2xl mb-3">✅</div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-50 mb-2">Ride with rated drivers</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Verified drivers and passenger ratings help you know who you're riding with.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-blue-600">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-14 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
            {!user ? 'Ready to skip the wait?' : role === 'driver' ? 'Manage your next departure' : 'Your next trip is a search away'}
          </h2>
          <Link
            to={primaryDestination}
            className="inline-block mt-2 bg-white text-blue-600 px-6 py-3 rounded-lg font-medium hover:bg-gray-100 transition-colors"
          >
            {!user ? 'Create Free Account' : role === 'driver' ? 'Go to My Trips' : 'Browse Trips'}
          </Link>
        </div>
      </section>

      <footer className="border-t border-gray-200 dark:border-gray-800">
  <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row justify-between items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
    <span>🚗 Ride Along</span>
    <div className="flex flex-wrap items-center justify-center gap-2">
      <span>Version 1.0</span>
      <span className="hidden sm:inline text-gray-300 dark:text-gray-700">|</span>
      <span>
  A Product by{' '}
  <a 
    href="https://asghinlabs.vercel.app/" 
    target="_blank" 
    rel="noopener noreferrer"
    className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline transition-all duration-200 font-medium"
  >
    AsghinLabs
  </a>
</span>
    </div>
  </div>
</footer>
    </div>
  )
}