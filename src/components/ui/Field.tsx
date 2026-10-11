import { useId } from 'react'
import type { ComponentProps, ReactNode } from 'react'

export const controlClasses =
  'w-full rounded-xl border border-line bg-card px-3.5 text-[15px] text-ink placeholder:text-faint ' +
  'transition-colors focus:border-ink focus:outline-none focus:ring-2 focus:ring-taxi/60 ' +
  'disabled:bg-paper disabled:text-muted aria-[invalid=true]:border-danger'

interface FieldShellProps {
  id: string
  label?: ReactNode
  hint?: ReactNode
  error?: string
  optional?: boolean
  children: ReactNode
  className?: string
}

/** Label + control + hint/error, wired together for screen readers. */
export function FieldShell({ id, label, hint, error, optional, children, className = '' }: FieldShellProps) {
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink">
          {label}
          {optional && <span className="ml-1 font-normal text-faint">(optional)</span>}
        </label>
      )}
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-sm text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-sm text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

interface CommonProps {
  label?: ReactNode
  hint?: ReactNode
  error?: string
  optional?: boolean
  wrapperClassName?: string
}

function describedBy(id: string, error?: string, hint?: ReactNode) {
  if (error) return `${id}-error`
  if (hint) return `${id}-hint`
  return undefined
}

export function Input({ label, hint, error, optional, wrapperClassName, className = '', id, ...rest }: CommonProps & ComponentProps<'input'>) {
  const autoId = useId()
  const fieldId = id || autoId
  return (
    <FieldShell id={fieldId} label={label} hint={hint} error={error} optional={optional} className={wrapperClassName}>
      <input
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fieldId, error, hint)}
        className={`${controlClasses} h-11 ${className}`}
        {...rest}
      />
    </FieldShell>
  )
}

export function Select({ label, hint, error, optional, wrapperClassName, className = '', id, children, ...rest }: CommonProps & ComponentProps<'select'>) {
  const autoId = useId()
  const fieldId = id || autoId
  return (
    <FieldShell id={fieldId} label={label} hint={hint} error={error} optional={optional} className={wrapperClassName}>
      <select
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fieldId, error, hint)}
        className={`${controlClasses} h-11 pr-8 ${className}`}
        {...rest}
      >
        {children}
      </select>
    </FieldShell>
  )
}

export function Textarea({ label, hint, error, optional, wrapperClassName, className = '', id, ...rest }: CommonProps & ComponentProps<'textarea'>) {
  const autoId = useId()
  const fieldId = id || autoId
  return (
    <FieldShell id={fieldId} label={label} hint={hint} error={error} optional={optional} className={wrapperClassName}>
      <textarea
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fieldId, error, hint)}
        className={`${controlClasses} py-2.5 ${className}`}
        {...rest}
      />
    </FieldShell>
  )
}

/** Inline banner for form-level errors and notices. */
export function Notice({ tone = 'danger', children }: { tone?: 'danger' | 'info' | 'success' | 'warning'; children: ReactNode }) {
  const styles = {
    danger: 'bg-danger-soft text-danger',
    info: 'bg-info-soft text-info',
    success: 'bg-route-soft text-route',
    warning: 'bg-taxi-soft text-[#7a5c00]',
  }[tone]
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={`rounded-xl px-3.5 py-3 text-sm ${styles}`}>
      {children}
    </div>
  )
}
