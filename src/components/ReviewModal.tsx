import { useState } from 'react'
import { supabase } from '../lib/supabase'

interface ReviewModalProps {
  bookingId: string
  driverId: string
  driverName: string
  destination: string
  passengerId: string
  onClose: () => void
  onSubmitted: () => void
}

export function ReviewModal({
  bookingId,
  driverId,
  driverName,
  destination,
  passengerId,
  onClose,
  onSubmitted,
}: ReviewModalProps) {
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (rating < 1 || rating > 5) {
      setError('Select a star rating before submitting.')
      return
    }

    setSubmitting(true)
    setError('')

    const { error: insertError } = await supabase.from('reviews').insert([
      {
        booking_id: bookingId,
        driver_id: driverId,
        passenger_id: passengerId,
        rating,
        comment: comment.trim() || null,
      },
    ])

    setSubmitting(false)

    if (insertError) {
      if (insertError.code === '23505') {
        setError('You already rated this trip.')
      } else {
        setError(insertError.message || 'Failed to submit review')
      }
      return
    }

    onSubmitted()
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-sm w-full p-6">
        <div className="flex justify-between items-start mb-1">
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">Rate your driver</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl leading-none"
          >
            ×
          </button>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          {driverName} · {destination}
        </p>

        <div className="flex justify-center gap-2 mb-4">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(0)}
              className="text-3xl leading-none transition-transform hover:scale-110"
              aria-label={`${star} star${star > 1 ? 's' : ''}`}
            >
              <span
                className={
                  star <= (hoverRating || rating) ? 'text-amber-400' : 'text-gray-300 dark:text-gray-600'
                }
              >
                ★
              </span>
            </button>
          ))}
        </div>

        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Optional comment about the ride..."
          rows={3}
          maxLength={500}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
        />

        {error && <div className="mt-2 p-2 bg-red-50 text-red-600 text-sm rounded">{error}</div>}

        <div className="flex gap-3 mt-4">
          <button
            onClick={handleSubmit}
            disabled={submitting || rating === 0}
            className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {submitting ? 'Submitting...' : 'Submit Rating'}
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-2 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}