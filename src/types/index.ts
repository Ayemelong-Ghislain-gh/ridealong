// USER TYPES
export interface User {
  id: string
  full_name: string
  email?: string | null
  phone: string
  avatar_url?: string
  role: 'passenger' | 'driver' | 'admin'
  is_verified: boolean
  created_at: string
  updated_at: string
}

// DRIVER PROFILE TYPES
export interface DriverProfile {
  id: string
  vehicle_make: string
  vehicle_model: string
  vehicle_color?: string
  vehicle_plate: string
  vehicle_capacity: number
  is_verified_driver: boolean
  rating: number
  total_trips: number
  status: 'online' | 'offline'
  created_at: string
  updated_at: string
}

// TAXI PARK TYPES
export interface TaxiPark {
  id: string
  name: string
  city: string
  region: string
  latitude: number
  longitude: number
  address?: string
  description?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

// ROUTE TYPES
export interface Route {
  id: string
  park_id: string
  destination: string
  destination_lat?: number
  destination_lng?: number
  estimated_duration?: string
  default_price?: number
  is_active: boolean
  created_at: string
  updated_at: string
  park?: TaxiPark
}

// TRIP TYPES
export interface Trip {
  id: string
  driver_id: string
  route_id: string
  park_id: string
  departure_date: string
  departure_time: string
  departure_datetime: string
  price_per_seat: number
  total_seats: number
  available_seats: number
  notes?: string
  status: 'scheduled' | 'departed' | 'completed' | 'cancelled'
  cancelled_at?: string
  departed_at?: string
  completed_at?: string
  created_at: string
  updated_at: string
  driver?: User
  route?: Route
  park?: TaxiPark
}

// BOOKING TYPES
export interface Booking {
  id: string
  trip_id: string
  passenger_id: string
  seats_booked: number
  status: 'confirmed' | 'cancelled' | 'completed'
  booking_reference: string
  cancelled_at?: string
  completed_at?: string
  created_at: string
  updated_at: string
  trip?: Trip
  passenger?: User
}

// REVIEW TYPES
export interface Review {
  id: string
  booking_id: string
  driver_id: string
  passenger_id: string
  rating: number
  comment?: string
  created_at: string
}

// NOTIFICATION TYPES
export interface Notification {
  id: string
  user_id: string
  type: 'booking_confirmed' | 'booking_cancelled' | 'trip_cancelled' | 'trip_reminder'
  title: string
  message: string
  data?: any
  is_read: boolean
  read_at?: string
  created_at: string
}

// FAVORITE TYPES
export interface Favorite {
  id: string
  passenger_id: string
  driver_id: string
  created_at: string
}
