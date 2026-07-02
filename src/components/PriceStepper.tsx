interface PriceStepperProps {
  value: number
  onChange: (value: number) => void
  step?: number
  min?: number
  max?: number
}

export function PriceStepper({ value, onChange, step = 50, min = 100, max = 100000 }: PriceStepperProps) {
  const clamp = (n: number) => Math.min(max, Math.max(min, n))

  return (
    <div className="flex items-stretch border border-gray-300 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => onChange(clamp(value - step))}
        className="px-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-lg transition-colors"
        aria-label="Decrease price"
      >
        −
      </button>
      <input
        type="number"
        value={value}
        step={step}
        min={min}
        max={max}
        onChange={(e) => {
          const n = Number(e.target.value)
          if (!Number.isNaN(n)) onChange(n)
        }}
        onBlur={(e) => onChange(clamp(Number(e.target.value) || min))}
        className="flex-1 text-center px-2 py-2 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
      <button
        type="button"
        onClick={() => onChange(clamp(value + step))}
        className="px-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-lg transition-colors"
        aria-label="Increase price"
      >
        +
      </button>
    </div>
  )
}
