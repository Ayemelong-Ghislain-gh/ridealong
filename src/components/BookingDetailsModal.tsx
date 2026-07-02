interface BookingDetailsModalProps {
  booking: {
    booking_reference: string
    seats_booked: number
    status: string
    created_at: string
    trip: {
      departure_date: string
      departure_time: string
      price_per_seat: number
      route: { destination: string } | null
      park?: { name: string } | null
      users?: { full_name: string } | null
    } | null
  }
  onClose: () => void
}

export function BookingDetailsModal({ booking, onClose }: BookingDetailsModalProps) {
  const total = (booking.trip?.price_per_seat || 0) * booking.seats_booked

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-xl font-bold text-gray-800">Booking Details</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">
            ×
          </button>
        </div>

        <div className="space-y-2 text-sm">
          <p className="font-semibold text-gray-800 text-base">
            {booking.trip?.park?.name ? `${booking.trip.park.name} → ` : ''}
            {booking.trip?.route?.destination}
          </p>
          <p className="text-gray-600">
            {booking.trip?.departure_date} at {booking.trip?.departure_time?.slice(0, 5)}
          </p>
          {booking.trip?.users?.full_name && (
            <p className="text-gray-600">Driver: {booking.trip.users.full_name}</p>
          )}
          <p className="text-gray-600">Booking Reference: {booking.booking_reference}</p>
          <p className="text-gray-600">
            {booking.seats_booked} seat{booking.seats_booked > 1 ? 's' : ''} ×{' '}
            {(booking.trip?.price_per_seat || 0).toLocaleString()} XAF ={' '}
            <span className="font-medium text-blue-600">{total.toLocaleString()} XAF</span>
          </p>
          <p className="text-gray-500 text-xs">Booked on {new Date(booking.created_at).toLocaleString()}</p>
          <span className="inline-block mt-1 text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700 capitalize">
            {booking.status}
          </span>
        </div>
      </div>
    </div>
  )
}
