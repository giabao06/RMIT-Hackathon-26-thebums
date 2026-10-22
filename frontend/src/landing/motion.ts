import { useEffect, type RefObject } from 'react'
import { leaveNow } from '@/components/shell/leaveNow'

/**
 * Marks each [data-reveal] section with .is-in once it scrolls into view. Content is hidden
 * only after .lp-js is set here, so without script or IntersectionObserver it simply shows.
 */
export function useReveal(root: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const el = root.current
    if (!el || !('IntersectionObserver' in window)) return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          entry.target.classList.add('is-in')
          observer.unobserve(entry.target)
        }
      },
      { rootMargin: '0px 0px -12% 0px' },
    )
    el.querySelectorAll('[data-reveal]').forEach((section) => observer.observe(section))
    el.classList.add('lp-js')
    return () => observer.disconnect()
  }, [root])
}

/** Esc leaves for a neutral page, as on the reporter portal, unless something used it to close. */
export function useQuickExitKey(): void {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) leaveNow()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
