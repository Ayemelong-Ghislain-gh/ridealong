import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { Modal } from './ui/Modal'
import { getErrorMessage } from '../lib/errors'

interface Message {
  id: string
  booking_id: string
  sender_id: string
  content: string
  created_at: string
}

interface ChatModalProps {
  bookingId: string
  currentUserId: string
  otherPartyName: string
  subtitle?: string
  onClose: () => void
}

/** Chat between a passenger and the driver, scoped to one booking. */
export function ChatModal({ bookingId, currentUserId, otherPartyName, subtitle, onClose }: ChatModalProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    let channel: ReturnType<typeof supabase.channel> | null = null

    const addMessage = (msg: Message) =>
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]))

    const load = async () => {
      const { data, error: loadError } = await supabase
        .from('messages')
        .select('*')
        .eq('booking_id', bookingId)
        .order('created_at', { ascending: true })

      if (cancelled) return
      if (loadError) setError('Couldn’t load messages.')
      else setMessages((data || []) as unknown as Message[])
      setLoading(false)

      channel = supabase
        .channel(`messages:${bookingId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages', filter: `booking_id=eq.${bookingId}` },
          (payload) => addMessage(payload.new as unknown as Message)
        )
        .subscribe()
    }

    void load()
    return () => {
      cancelled = true
      if (channel) void supabase.removeChannel(channel)
    }
  }, [bookingId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages])

  const sendMessage = async (e: FormEvent) => {
    e.preventDefault()
    const content = draft.trim()
    if (!content || sending) return

    setSending(true)
    setError('')
    setDraft('')

    const { data, error: sendError } = await supabase
      .from('messages')
      .insert([{ booking_id: bookingId, sender_id: currentUserId, content }])
      .select('*')
      .maybeSingle()

    if (sendError) {
      setError(getErrorMessage(sendError, 'Message not sent. Try again.'))
      setDraft(content) // keep what they typed
    } else if (data) {
      // Show it straight away, even before the realtime echo arrives
      setMessages((prev) => (prev.some((m) => m.id === (data as unknown as Message).id) ? prev : [...prev, data as unknown as Message]))
    }
    setSending(false)
  }

  return (
    <Modal title={otherPartyName} description={subtitle} onClose={onClose} bare>
      <div className="flex h-[60dvh] flex-col sm:h-[480px]">
        <div className="flex-1 space-y-2 overflow-y-auto border-t border-line bg-paper px-4 py-4">
          {loading && <p className="mt-4 text-center text-sm text-muted">Loading messages...</p>}
          {!loading && messages.length === 0 && (
            <p className="mt-4 text-center text-sm text-muted">No messages yet. Ask about pickup, luggage or timing.</p>
          )}

          {messages.map((msg) => {
            const isMine = msg.sender_id === currentUserId
            return (
              <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-[15px] leading-snug ${
                    isMine ? 'rounded-br-md bg-ink text-white' : 'rounded-bl-md border border-line bg-card text-ink'
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                  <p className={`mt-1 text-right text-[11px] ${isMine ? 'text-white/60' : 'text-faint'}`}>
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>

        {error && <p className="bg-danger-soft px-4 py-2 text-sm text-danger">{error}</p>}

        <form onSubmit={sendMessage} className="flex gap-2 border-t border-line px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <label htmlFor={`chat-${bookingId}`} className="sr-only">
            Message
          </label>
          <input
            id={`chat-${bookingId}`}
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Write a message"
            maxLength={1000}
            autoComplete="off"
            className="h-11 flex-1 rounded-full border border-line bg-card px-4 text-[15px] focus:border-ink focus:outline-none focus:ring-2 focus:ring-taxi/60"
          />
          <button
            type="submit"
            disabled={!draft.trim() || sending}
            aria-label="Send message"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-taxi text-ink transition-colors hover:bg-[#e0aa04] disabled:opacity-40"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h13M13 6l6 6-6 6" />
            </svg>
          </button>
        </form>
      </div>
    </Modal>
  )
}
