interface LoadingCarProps {
  label?: string
}

/** Small taxi driving along a dashed road. Used while lists load. */
export function LoadingCar({ label = 'Loading...' }: LoadingCarProps) {
  return (
    <div className="flex flex-col items-center justify-center py-14" role="status">
      <style>{`
        @keyframes ra-drive { 0% { transform: translateX(-36px); } 50% { transform: translateX(36px); } 100% { transform: translateX(-36px); } }
        @keyframes ra-road { to { background-position: -24px 0; } }
        .ra-car { animation: ra-drive 1.6s ease-in-out infinite; }
        .ra-road { background-image: linear-gradient(90deg, var(--color-faint) 50%, transparent 50%); background-size: 12px 2px; animation: ra-road .6s linear infinite; }
      `}</style>
      <div className="relative h-9 w-32">
        <svg className="ra-car absolute left-1/2 top-0 -ml-5 h-7 w-10" viewBox="0 0 40 28" aria-hidden="true">
          <path d="M3 20v-6.5c0-1 .4-1.9 1.1-2.5l4-3.7c.7-.6 1.6-1 2.5-1h18.8c.9 0 1.8.4 2.5 1l4 3.7c.7.6 1.1 1.5 1.1 2.5V20c0 .8-.7 1.5-1.5 1.5h-31C3.7 21.5 3 20.8 3 20z" fill="var(--color-taxi)" />
          <path d="M10 12l2.6-2.5c.3-.3.7-.5 1.1-.5h12.6c.4 0 .8.2 1.1.5L30 12z" fill="var(--color-ink)" />
          <circle cx="11" cy="22" r="3.5" fill="var(--color-ink)" />
          <circle cx="29" cy="22" r="3.5" fill="var(--color-ink)" />
        </svg>
        <div className="ra-road absolute bottom-0 left-0 right-0 h-0.5" />
      </div>
      <p className="mt-3 text-sm text-muted">{label}</p>
    </div>
  )
}
