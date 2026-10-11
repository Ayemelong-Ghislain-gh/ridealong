import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Modal } from '../components/ui/Modal'
import { Button } from '../components/ui/Button'

// Replaces window.alert() and window.confirm() with in-app toasts and
// confirmation dialogs that match the rest of the interface.

type ToastTone = 'success' | 'error' | 'info'

interface Toast {
  id: number
  message: string
  tone: ToastTone
}

interface ConfirmOptions {
  title: string
  message?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

interface FeedbackContextValue {
  toast: (message: string, tone?: ToastTone) => void
  confirm: (options: ConfirmOptions) => Promise<boolean>
}

const FeedbackContext = createContext<FeedbackContextValue | null>(null)

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const [pending, setPending] = useState<ConfirmOptions | null>(null)
  const resolverRef = useRef<((ok: boolean) => void) | null>(null)
  const nextId = useRef(1)

  const toast = useCallback((message: string, tone: ToastTone = 'success') => {
    const id = nextId.current++
    setToasts((prev) => [...prev.slice(-2), { id, message, tone }])
    window.setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), tone === 'error' ? 6000 : 3500)
  }, [])

  const confirm = useCallback((options: ConfirmOptions) => {
    setPending(options)
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve
    })
  }, [])

  const settle = (ok: boolean) => {
    resolverRef.current?.(ok)
    resolverRef.current = null
    setPending(null)
  }

  const value = useMemo(() => ({ toast, confirm }), [toast, confirm])

  return (
    <FeedbackContext.Provider value={value}>
      {children}

      {pending && (
        <Modal
          title={pending.title}
          onClose={() => settle(false)}
          size="sm"
          footer={
            <>
              <Button variant="secondary" block onClick={() => settle(false)}>
                {pending.cancelLabel ?? 'Go back'}
              </Button>
              <Button variant={pending.danger ? 'danger' : 'dark'} block onClick={() => settle(true)}>
                {pending.confirmLabel ?? 'Confirm'}
              </Button>
            </>
          }
        >
          {pending.message && <div className="text-[15px] leading-relaxed text-muted">{pending.message}</div>}
        </Modal>
      )}

      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.tone === 'error' ? 'alert' : 'status'}
            className={`animate-sheet-up pointer-events-auto flex max-w-md items-start gap-2.5 rounded-xl px-4 py-3 text-sm font-medium shadow-lg ${
              t.tone === 'error' ? 'bg-danger text-white' : 'bg-ink text-white'
            }`}
          >
            {t.tone === 'success' && <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-taxi" aria-hidden="true" />}
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </FeedbackContext.Provider>
  )
}

export function useFeedback(): FeedbackContextValue {
  const ctx = useContext(FeedbackContext)
  if (!ctx) throw new Error('useFeedback must be used inside <FeedbackProvider>')
  return ctx
}
