import { cn } from 'cn'

export function UnderlineTabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: { id: T; label: string; count?: number }[]
  value: T
  onChange: (id: T) => void
  label: string
}) {
  return (
    <div role="tablist" aria-label={label} className="flex gap-6 overflow-x-auto border-b border-rule">
      {tabs.map((tab) => {
        const active = tab.id === value
        return (
          <button
            key={tab.id}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className={cn(
              'relative flex h-10 shrink-0 items-center gap-1.5 text-[14px] transition-colors',
              active ? 'font-semibold text-ink' : 'text-slate hover:text-ink',
            )}
          >
            {tab.label}
            {tab.count !== undefined && <span className="tabular font-normal text-slate">{tab.count}</span>}
            <span
              aria-hidden
              className={cn(
                'absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-active-ink transition-transform duration-300',
                active ? 'scale-x-100' : 'scale-x-0',
              )}
            />
          </button>
        )
      })}
    </div>
  )
}
