import type { ReactNode } from 'react'

/** Narrow centred column used by sign-in, sign-up and password pages. */
export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-8 sm:py-14">
      <div className="rounded-3xl border border-line bg-card p-6 sm:p-8">
        <h1 className="font-semi-condensed text-[28px] font-extrabold leading-tight tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1.5 text-[15px] text-muted">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </div>
      {footer && <div className="mt-5 text-center text-[15px] text-muted">{footer}</div>}
    </div>
  )
}
