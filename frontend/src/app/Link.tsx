import type { AnchorHTMLAttributes, MouseEvent } from 'react'
import { navigate } from './router'

/** An anchor that navigates in place, and still opens in a new tab with a modifier key. */
export function Link({ href, onClick, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event)
    if (event.defaultPrevented || event.button !== 0) return
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    navigate(href)
  }
  return <a href={href} onClick={handleClick} {...props} />
}
