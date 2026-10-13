import { lazy } from 'react'
import type { ComponentType } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './context/AuthContext'
import { FeedbackProvider } from './context/FeedbackContext'
import { LocationShareProvider } from './context/LocationShareContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AppLayout } from './components/AppLayout'
import LandingPage from './pages/LandingPage'

// After a new version is deployed, a phone that still has the old app open
// may ask for a page file that no longer exists. Reload once to get the new one.
function lazyPage(load: () => Promise<{ default: ComponentType }>) {
  return lazy(() =>
    load()
      .then((mod) => {
        try {
          sessionStorage.removeItem('ra-chunk-reload')
        } catch {
          /* storage unavailable */
        }
        return mod
      })
      .catch((err) => {
        let reloaded = true
        try {
          reloaded = sessionStorage.getItem('ra-chunk-reload') === '1'
          sessionStorage.setItem('ra-chunk-reload', '1')
        } catch {
          /* storage unavailable */
        }
        if (!reloaded) window.location.reload()
        throw err
      })
  )
}
// Every other page is downloaded only when someone opens it, so the first
// visit on mobile data loads a much smaller file.
const TripsPage = lazyPage(() => import('./pages/TripsPage'))
const Login = lazyPage(() => import('./pages/Login'))
const Register = lazyPage(() => import('./pages/Register'))
const ForgotPassword = lazyPage(() => import('./pages/ForgotPassword'))
const ResetPassword = lazyPage(() => import('./pages/ResetPassword'))
const CreateTrip = lazyPage(() => import('./pages/CreateTrip'))
const EditTrip = lazyPage(() => import('./pages/EditTrip'))
const DriverDashboard = lazyPage(() => import('./pages/DriverDashboard'))
const PassengerBookings = lazyPage(() => import('./pages/PassengerBookings'))
const Profile = lazyPage(() => import('./pages/Profile'))
const AdminDrivers = lazyPage(() => import('./pages/AdminDrivers'))
const PrivacyPolicy = lazyPage(() => import('./pages/PrivacyPolicy'))
const DeleteAccountInfo = lazyPage(() => import('./pages/DeleteAccountInfo'))
const NotFound = lazyPage(() => import('./pages/NotFound'))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // trips and seats change often, keep this short
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <FeedbackProvider>
            <LocationShareProvider>
              <Routes>
                <Route element={<AppLayout />}>
                  <Route path="/" element={<LandingPage />} />
                  <Route path="/trips" element={<TripsPage />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="/privacy" element={<PrivacyPolicy />} />
                  <Route path="/delete-account" element={<DeleteAccountInfo />} />

                  <Route
                    path="/profile"
                    element={
                      <ProtectedRoute>
                        <Profile />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/driver/create-trip"
                    element={
                      <ProtectedRoute requiredRole="driver">
                        <CreateTrip />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/driver/edit-trip/:tripId"
                    element={
                      <ProtectedRoute requiredRole="driver">
                        <EditTrip />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/driver/dashboard"
                    element={
                      <ProtectedRoute requiredRole="driver">
                        <DriverDashboard />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/passenger/bookings"
                    element={
                      <ProtectedRoute requiredRole="passenger">
                        <PassengerBookings />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin"
                    element={
                      <ProtectedRoute requiredRole="admin">
                        <AdminDrivers />
                      </ProtectedRoute>
                    }
                  />
                  <Route path="*" element={<NotFound />} />
                </Route>
              </Routes>
            </LocationShareProvider>
          </FeedbackProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
