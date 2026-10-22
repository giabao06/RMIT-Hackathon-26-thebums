import type { ReactNode } from 'react'
import { cn } from 'cn'

/** One settings-style row: what this is about on the left, the controls on a panel to the right. */
export function SettingsRow({
  title,
  description,
  aside,
  children,
  className,
}: {
  title: string
  description: ReactNode
  aside?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('grid gap-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:gap-10', className)}>
      <div className="lg:pt-2">
        <h2 className="text-[16px] font-medium">{title}</h2>
        <div className="mt-1 text-[14px] text-slate">{description}</div>
        {aside && <div className="mt-5">{aside}</div>}
      </div>
      <div className="rounded-[16px] bg-panel p-4 sm:p-5">{children}</div>
    </section>
  )
}

/** A label above its field, 8px apart, as on the sheet. */
export function Field({ label, hint, htmlFor, children }: { label: string; hint?: ReactNode; htmlFor: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={htmlFor} className="text-[14px] font-medium">
        {label}
      </label>
      {children}
      {hint && <div className="text-[13px] text-slate">{hint}</div>}
    </div>
  )
}
