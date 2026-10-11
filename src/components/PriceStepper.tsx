import { useEffect, useState } from 'react'

interface StepperProps {
  value: number
  onChange: (value: number) => void
  step?: number
  min?: number
  max?: number
  id?: string
  suffix?: string
  /** Accessible name for the value, e.g. "Price per seat" */
  label: string
}

/** Number input with large −/+ buttons that are easy to hit on a phone. */
export function Stepper({ value, onChange, step = 1, min = 0, max = 100000, id, suffix, label }: StepperProps) {
  const clamp = (n: number) => Math.min(max, Math.max(min, n))
  const [text, setText] = useState(String(value ?? ''))

  // Keep the visible text in sync when the value changes from outside
  useEffect(() => {
    setText(String(value ?? ''))
  }, [value])

  const commit = (raw: string) => {
    const n = Number(raw)
    onChange(clamp(Number.isFinite(n) && raw.trim() !== '' ? n : min))
  }

  const btn =
    'flex w-12 shrink-0 items-center justify-center text-xl font-semibold text-ink transition-colors hover:bg-paper disabled:opacity-30'

  return (
    <div className="flex h-11 items-stretch overflow-hidden rounded-xl border border-line bg-card focus-within:border-ink focus-within:ring-2 focus-within:ring-taxi/60">
      <button type="button" className={btn} onClick={() => onChange(clamp(value - step))} disabled={value <= min} aria-label={`Decrease ${label}`}>
        −
      </button>
      <div className="flex flex-1 items-center justify-center border-x border-line">
        <input
          id={id}
          type="text"
          inputMode="numeric"
          aria-label={label}
          value={text}
          onChange={(e) => setText(e.target.value.replace(/[^\d]/g, ''))}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commit((e.target as HTMLInputElement).value)
            }
          }}
          className="w-full min-w-0 bg-transparent text-center text-[15px] font-semibold focus:outline-none"
        />
        {suffix && <span className="pr-3 text-sm text-muted">{suffix}</span>}
      </div>
      <button type="button" className={btn} onClick={() => onChange(clamp(value + step))} disabled={value >= max} aria-label={`Increase ${label}`}>
        +
      </button>
    </div>
  )
}

/** Kept for existing imports: a Stepper preset for prices in XAF. */
export function PriceStepper(props: Omit<StepperProps, 'label' | 'suffix'> & { label?: string }) {
  return <Stepper step={50} min={100} {...props} label={props.label ?? 'price per seat'} suffix="XAF" />
}
