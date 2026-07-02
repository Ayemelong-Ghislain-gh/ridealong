import { supabase } from '../lib/supabase'
import type { Trip, Route, TaxiPark } from '../types'

export const tripService = {
  // Get all available trips
  async getAvailableTrips() {
    const { data, error } = await supabase
      .from('trips')
      .select(`
        *,
        driver:users(
          id,
          full_name,
          avatar_url
        ),
        route:routes(
          *,
          park:taxi_parks(*)
        ),
        park:taxi_parks(*)
      `)
      .eq('status', 'scheduled')
      .gt('available_seats', 0)
      .order('departure_datetime', { ascending: true })

    if (error) throw error
    return data as Trip[]
  },

  // Get a single trip by ID
  async getTripById(tripId: string) {
    const { data, error } = await supabase
      .from('trips')
      .select(`
        *,
        driver:users(
          id,
          full_name,
          avatar_url
        ),
        route:routes(
          *,
          park:taxi_parks(*)
        ),
        park:taxi_parks(*)
      `)
      .eq('id', tripId)
      .single()

    if (error) throw error
    return data as Trip
  },

  // Create a new trip (driver only)
  async createTrip(tripData: Partial<Trip>) {
    const { data, error } = await supabase
      .from('trips')
      .insert([tripData])
      .select()
      .single()

    if (error) throw error
    return data as Trip
  },

  // Get trips by driver
  async getDriverTrips(driverId: string) {
    const { data, error } = await supabase
      .from('trips')
      .select(`
        *,
        route:routes(
          *,
          park:taxi_parks(*)
        ),
        park:taxi_parks(*)
      `)
      .eq('driver_id', driverId)
      .order('departure_datetime', { ascending: true })

    if (error) throw error
    return data as Trip[]
  },

  // Update trip status
  async updateTripStatus(tripId: string, status: Trip['status']) {
    const updateData: any = { status }
    
    if (status === 'departed') {
      updateData.departed_at = new Date().toISOString()
    } else if (status === 'completed') {
      updateData.completed_at = new Date().toISOString()
    } else if (status === 'cancelled') {
      updateData.cancelled_at = new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('trips')
      .update(updateData)
      .eq('id', tripId)
      .select()
      .single()

    if (error) throw error
    return data as Trip
  },

  // Get parks
  async getParks() {
    const { data, error } = await supabase
      .from('taxi_parks')
      .select('*')
      .eq('is_active', true)
      .order('name')

    if (error) throw error
    return data as TaxiPark[]
  },

  // Get routes by park
  async getRoutesByPark(parkId: string) {
    const { data, error } = await supabase
      .from('routes')
      .select('*')
      .eq('park_id', parkId)
      .eq('is_active', true)

    if (error) throw error
    return data as Route[]
  }
}