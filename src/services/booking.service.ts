import { supabase } from '../lib/supabase'

export const bookingService = {
  // Create a new booking
  async createBooking(tripId: string, passengerId: string, seatsBooked: number) {
    console.log('🔍 Creating booking:', { tripId, passengerId, seatsBooked })
    
    try {
      // First, check if enough seats are available
      const { data: trip, error: tripError } = await supabase
        .from('trips')
        .select('available_seats')
        .eq('id', tripId)
        .single()

      if (tripError) {
        console.error('❌ Trip fetch error:', tripError)
        throw new Error(`Trip fetch error: ${tripError.message}`)
      }
      
      if (!trip) {
        console.error('❌ Trip not found')
        throw new Error('Trip not found')
      }
      
      if (trip.available_seats < seatsBooked) {
        console.error('❌ Not enough seats:', { available: trip.available_seats, requested: seatsBooked })
        throw new Error('Not enough seats available')
      }

      console.log('✅ Trip found, available seats:', trip.available_seats)

      // Create the booking
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .insert([{
          trip_id: tripId,
          passenger_id: passengerId,
          seats_booked: seatsBooked,
          status: 'confirmed'
        }])
        .select()
        .single()

      if (bookingError) {
        console.error('❌ Booking insert error:', bookingError)
        throw new Error(`Booking insert error: ${bookingError.message}`)
      }

      console.log('✅ Booking created:', booking)

      // Update available seats
      const { error: updateError } = await supabase
        .from('trips')
        .update({ 
          available_seats: trip.available_seats - seatsBooked 
        })
        .eq('id', tripId)

      if (updateError) {
        console.error('❌ Update seats error:', updateError)
        throw new Error(`Update seats error: ${updateError.message}`)
      }

      console.log('✅ Seats updated successfully')
      return booking

    } catch (err) {
      console.error('❌ Booking error:', err)
      throw err
    }
  },

  // Get bookings for a passenger
  async getPassengerBookings(passengerId: string) {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          trip:trips(
            *,
            route:routes(*),
            park:taxi_parks(*),
            driver:users(id, full_name)
          )
        `)
        .eq('passenger_id', passengerId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('❌ Get bookings error:', error)
        throw new Error(`Get bookings error: ${error.message}`)
      }

      console.log('✅ Bookings fetched:', data?.length || 0)
      return data
    } catch (err) {
      console.error('❌ Get bookings error:', err)
      throw err
    }
  },

  // Cancel a booking
  async cancelBooking(bookingId: string) {
    try {
      // Get the booking details first
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .select('trip_id, seats_booked')
        .eq('id', bookingId)
        .single()

      if (bookingError) {
        console.error('❌ Get booking error:', bookingError)
        throw new Error(`Get booking error: ${bookingError.message}`)
      }

      // Get current available seats
      const { data: trip, error: tripError } = await supabase
        .from('trips')
        .select('available_seats')
        .eq('id', booking.trip_id)
        .single()

      if (tripError) {
        console.error('❌ Get trip error:', tripError)
        throw new Error(`Get trip error: ${tripError.message}`)
      }

      // Update booking status
      const { data, error } = await supabase
        .from('bookings')
        .update({ 
          status: 'cancelled',
          cancelled_at: new Date().toISOString()
        })
        .eq('id', bookingId)
        .select()
        .single()

      if (error) {
        console.error('❌ Update booking error:', error)
        throw new Error(`Update booking error: ${error.message}`)
      }

      // Restore available seats
      const { error: updateError } = await supabase
        .from('trips')
        .update({ 
          available_seats: trip.available_seats + booking.seats_booked 
        })
        .eq('id', booking.trip_id)

      if (updateError) {
        console.error('❌ Update seats error:', updateError)
        throw new Error(`Update seats error: ${updateError.message}`)
      }

      console.log('✅ Booking cancelled successfully')
      return data
    } catch (err) {
      console.error('❌ Cancel booking error:', err)
      throw err
    }
  }
}