import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './context/AuthContext'
import { FeedbackProvider } from './context/FeedbackContext'
import { LocationShareProvider } from './context/LocationShareContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AppLayout } from './components/AppLayout'
import LandingPage from './pages/LandingPage'
import TripsPage from './pages/TripsPage'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import CreateTrip from './pages/CreateTrip'
import EditTrip from './pages/EditTrip'
import DriverDashboard from './pages/DriverDashboard'
import PassengerBookings from './pages/PassengerBookings'
import Profile from './pages/Profile'
import AdminDrivers from './pages/AdminDrivers'
import NotFound from './pages/NotFound'

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
