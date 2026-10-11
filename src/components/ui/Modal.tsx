import { useEffect, useId, useRef } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'

// Open modals, newest last. Only the top one reacts to Escape, and body
// scrolling stays locked until the last one closes.
const openStack: string[] = []

interface ModalProps {
  title: ReactNode
  description?: ReactNode
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg'
  /** Remove body padding, for content like chat that manages its own layout. */
  bare?: boolean
}

const WIDTHS = { sm: 'sm:max-w-sm', md: 'sm:max-w-md', lg: 'sm:max-w-lg' }

/**
 * Accessible dialog. A bottom sheet on phones, a centred card on larger
 * screens. Closes on Escape and on backdrop tap.
 */
export function Modal({ title, description, onClose, children, footer, size = 'md', bare = false }: ModalProps) {
  const id = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    openStack.push(id)
    const previouslyFocused = document.activeElement as HTMLElement | null
    document.body.style.overflow = 'hidden'

    // Focus the first focusable control, or the panel itself
    const panel = panelRef.current
    const focusable = panel?.querySelector<HTMLElement>(
      'input:not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([data-close]):not([disabled]), a[href]'
    )
    ;(focusable ?? panel)?.focus({ preventScroll: true })

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && openStack[openStack.length - 1] === id) {
        e.stopPropagation()
        onCloseRef.current()
      }
    }
    document.addEventListener('keydown', onKey)

    return () => {
      document.removeEventListener('keydown', onKey)
      const idx = openStack.indexOf(id)
      if (idx !== -1) openStack.splice(idx, 1)
      if (openStack.length === 0) document.body.style.overflow = ''
      previouslyFocused?.focus?.({ preventScroll: true })
    }
  }, [id])

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="animate-fade-in absolute inset-0 bg-ink/55" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={description ? `${id}-desc` : undefined}
        tabIndex={-1}
        className={`animate-sheet-up relative flex max-h-[92dvh] w-full flex-col rounded-t-3xl bg-card shadow-2xl outline-none sm:rounded-2xl ${WIDTHS[size]}`}
      >
        <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-line sm:hidden" aria-hidden="true" />
        <div className="flex items-start justify-between gap-4 px-5 pt-4 pb-3 sm:pt-5">
          <div className="min-w-0">
            <h2 id={`${id}-title`} className="text-lg font-bold leading-tight text-ink">
              {title}
            </h2>
            {description && (
              <p id={`${id}-desc`} className="mt-1 text-sm text-muted">
                {description}
              </p>
            )}
          </div>
          <button
            data-close
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted hover:bg-paper hover:text-ink"
          >
            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className={bare ? 'flex min-h-0 flex-1 flex-col' : 'min-h-0 flex-1 overflow-y-auto px-5 pb-5'}>{children}</div>
        {footer && (
          <div className="flex gap-3 border-t border-line px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-4">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
