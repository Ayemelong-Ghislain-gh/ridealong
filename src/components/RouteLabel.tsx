interface RouteLabelProps {
  from: string
  to: string
  size?: 'sm' | 'base' | 'lg'
}

const SIZE_CLASSES: Record<NonNullable<RouteLabelProps['size']>, string> = {
  sm: 'text-xs px-1.5 py-0.5',
  base: 'text-sm px-2 py-0.5',
  lg: 'text-base px-2.5 py-1',
}

/**
 * Displays a trip's route as "From [origin] to [destination]" with both
 * locations highlighted as distinct, differently-styled badges so the
 * direction of travel is unambiguous at a glance.
 */
export function RouteLabel({ from, to, size = 'base' }: RouteLabelProps) {
  const badgeSize = SIZE_CLASSES[size]

  return (
    <div className="flex items-end flex-wrap gap-x-2 gap-y-1">
      <span className="inline-flex flex-col leading-tight">
        <span className="text-[10px] uppercase tracking-wide text-gray-400">From</span>
        <span
          className={`inline-block rounded-md border border-amber-200 bg-amber-50 font-semibold text-amber-800 ${badgeSize}`}
        >
          {from}
        </span>
      </span>

      <span className="text-gray-300 mb-1">→</span>

      <span className="inline-flex flex-col leading-tight">
        <span className="text-[10px] uppercase tracking-wide text-gray-400">To</span>
        <span
          className={`inline-block rounded-md border border-blue-200 bg-blue-50 font-serif italic font-semibold text-blue-700 ${badgeSize}`}
        >
          {to}
        </span>
      </span>
    </div>
  )
}
