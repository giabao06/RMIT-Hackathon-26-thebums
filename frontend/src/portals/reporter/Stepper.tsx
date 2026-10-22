import { Check } from 'lucide-react'
import { cn } from 'cn'

const STEPS = ['Who it is about', 'What happened', 'Escrow settings'] as const

/** Underline tabs: the current step carries the 2px emerald line; finished steps can be revisited. */
export function Stepper({ current, onSelect }: { current: number; onSelect: (step: number) => void }) {
  return (
    <ol className="flex gap-6 overflow-x-auto border-b border-rule" aria-label="Report steps">
      {STEPS.map((label, i) => {
        const done = i < current
        const active = i === current
        return (
          <li key={label} className="shrink-0">
            <button
              type="button"
              disabled={!done}
              onClick={() => onSelect(i)}
              aria-current={active ? 'step' : undefined}
              className={cn(
                'relative flex h-10 items-center gap-1.5 text-[14px] transition-colors',
                active ? 'font-semibold text-ink' : done ? 'text-ink hover:text-active-ink' : 'text-slate',
              )}
            >
              {done && <Check className="size-3.5 text-active-ink" strokeWidth={2.5} aria-hidden />}
              {label}
              <span
                aria-hidden
                className={cn(
                  'absolute inset-x-0 -bottom-px h-0.5 origin-left rounded-full bg-active-ink transition-transform duration-300',
                  active ? 'scale-x-100' : 'scale-x-0',
                )}
              />
            </button>
          </li>
        )
      })}
    </ol>
  )
}
