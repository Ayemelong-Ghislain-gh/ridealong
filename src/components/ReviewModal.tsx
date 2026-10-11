import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { Notice, Textarea } from './ui/Field'
import { getErrorMessage } from '../lib/errors'

interface ReviewModalProps {
  bookingId: string
  driverId: string
  driverName: string
  destination: string
  passengerId: string
  onClose: () => void
  onSubmitted: () => void
}

const LABELS = ['', 'Poor', 'Below average', 'Okay', 'Good', 'Excellent']

export function ReviewModal({ bookingId, driverId, driverName, destination, passengerId, onClose, onSubmitted }: ReviewModalProps) {
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const shown = hoverRating || rating

  const handleSubmit = async () => {
    if (rating < 1) {
      setError('Choose a star rating first.')
      return
    }
    setSubmitting(true)
    setError('')

    const { error: insertError } = await supabase.from('reviews').insert([
      { booking_id: bookingId, driver_id: driverId, passenger_id: passengerId, rating, comment: comment.trim() || null },
    ])

    setSubmitting(false)
    if (insertError) {
      setError(insertError.code === '23505' ? 'You already rated this trip.' : getErrorMessage(insertError, 'Rating not saved. Try again.'))
      return
    }
    onSubmitted()
  }

  return (
    <Modal
      title={`Rate ${driverName}`}
      description={`Your trip to ${destination}`}
      onClose={onClose}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Later
          </Button>
          <Button onClick={handleSubmit} loading={submitting} disabled={rating === 0} className="flex-[2]">
            Submit rating
          </Button>
        </>
      }
    >
      <div className="flex justify-center gap-1" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={rating === star}
            aria-label={`${star} star${star > 1 ? 's' : ''}, ${LABELS[star]}`}
            onClick={() => setRating(star)}
            onMouseEnter={() => setHoverRating(star)}
            onMouseLeave={() => setHoverRating(0)}
            className="p-1 transition-transform hover:scale-110"
          >
            <svg viewBox="0 0 20 20" className={`h-10 w-10 ${star <= shown ? 'text-taxi' : 'text-line'}`} fill="currentColor" aria-hidden="true">
              <path d="M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 14.9l-5.2 2.7 1-5.8L1.5 7.7l5.9-.9z" />
            </svg>
          </button>
        ))}
      </div>
      <p className="mt-1 h-5 text-center text-sm font-semibold text-muted">{LABELS[shown]}</p>

      <Textarea
        wrapperClassName="mt-4"
        label="Comment"
        optional
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Punctual? Safe driving? Clean car?"
        rows={3}
        maxLength={500}
      />

      {error && (
        <div className="mt-3">
          <Notice>{error}</Notice>
        </div>
      )}
    </Modal>
  )
}
