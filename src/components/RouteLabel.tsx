interface RouteLabelProps {
  from: string
  to: string
  size?: 'sm' | 'base' | 'lg'
}

const TEXT: Record<NonNullable<RouteLabelProps['size']>, string> = {
  sm: 'text-[15px]',
  base: 'text-base',
  lg: 'text-xl',
}

/**
 * A trip's route drawn as a short line between two stops: hollow dot for
 * the departure park, filled dot for the destination. Direction is clear
 * without needing "From" / "To" labels.
 */
export function RouteLabel({ from, to, size = 'base' }: RouteLabelProps) {
  return (
    <div className={`flex min-w-0 flex-col gap-0.5 ${TEXT[size]}`}>
      <span className="flex min-w-0 items-center gap-2.5">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full border-2 border-ink bg-card" aria-hidden="true" />
        <span className="truncate font-medium text-muted">
          <span className="sr-only">From </span>
          {from}
        </span>
      </span>
      <span className="ml-[4px] h-2.5 w-0.5 bg-line" aria-hidden="true" />
      <span className="flex min-w-0 items-center gap-2.5">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-taxi ring-2 ring-ink" aria-hidden="true" />
        <span className="truncate font-bold text-ink">
          <span className="sr-only">To </span>
          {to}
        </span>
      </span>
    </div>
  )
}
