import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Nav } from './components/Nav'
import LandingPage from './pages/LandingPage'
import TripsPage from './pages/TripsPage'
import Login from './pages/Login'
import Register from './pages/Register'
import CreateTrip from './pages/CreateTrip'
import EditTrip from './pages/EditTrip'
import DriverDashboard from './pages/DriverDashboard'
import PassengerBookings from './pages/PassengerBookings'
import Profile from './pages/Profile'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/trips" element={<TripsPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Nav />
                <Profile />
              </ProtectedRoute>
            }
          />

          <Route
            path="/driver/create-trip"
            element={
              <ProtectedRoute requiredRole="driver">
                <Nav />
                <CreateTrip />
              </ProtectedRoute>
            }
          />
          <Route
            path="/driver/edit-trip/:tripId"
            element={
              <ProtectedRoute requiredRole="driver">
                <Nav />
                <EditTrip />
              </ProtectedRoute>
            }
          />
          <Route
            path="/driver/dashboard"
            element={
              <ProtectedRoute requiredRole="driver">
                <Nav />
                <DriverDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/passenger/bookings"
            element={
              <ProtectedRoute requiredRole="passenger">
                <Nav />
                <PassengerBookings />
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App