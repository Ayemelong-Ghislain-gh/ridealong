// Shapes of the joined rows the pages select from Supabase.
//
// Without generated `Database` types, supabase-js types to-one joins like
// `route:routes!fkey(...)` as arrays, so queries cast to these interfaces.
// Long term: run `npx supabase gen types typescript` and drop the casts.

export interface PersonLite {
  id?: string
  full_name: string | null
  phone?: string | null
  avatar_url?: string | null
}

export interface TripListRow {
  id: string
  driver_id: string
  departure_date: string
  departure_time: string
  price_per_seat: number
  total_seats: number
  available_seats: number
  status: 'scheduled' | 'departed' | 'completed' | 'cancelled'
  notes: string | null
  driver: PersonLite | null
  route: { destination: string } | null
  park: { name: string; city?: string | null } | null
}

export const TRIP_LIST_SELECT = `
  id, driver_id, departure_date, departure_time, price_per_seat,
  total_seats, available_seats, status, notes,
  driver:users!trips_driver_id_fkey (id, full_name, avatar_url),
  route:routes!trips_route_id_fkey (destination),
  park:taxi_parks!trips_park_id_fkey (name, city)
`

export interface BookingTrip {
  id: string
  driver_id: string
  status: TripListRow['status']
  departure_date: string
  departure_time: string
  price_per_seat: number
  driver: PersonLite | null
  route: { destination: string } | null
  park: { name: string } | null
}

export interface BookingRow {
  id: string
  trip_id: string
  seats_booked: number
  status: 'confirmed' | 'cancelled' | 'completed'
  booking_reference: string
  created_at: string
  trip: BookingTrip | null
}

export const BOOKING_SELECT = `
  id, trip_id, seats_booked, status, booking_reference, created_at,
  trip:trips!bookings_trip_id_fkey (
    id, driver_id, status, departure_date, departure_time, price_per_seat,
    driver:users!trips_driver_id_fkey (full_name, phone, avatar_url),
    route:routes!trips_route_id_fkey (destination),
    park:taxi_parks!trips_park_id_fkey (name)
  )
`

export interface DriverProfileInfo {
  id: string
  is_verified_driver: boolean
  rating: number | null
  total_trips: number | null
  vehicle_make: string | null
  vehicle_model: string | null
  vehicle_color: string | null
  vehicle_capacity?: number | null
  skills?: string[] | null
}
