import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { ChevronDown } from 'lucide-react'
import { Link } from '@/app/Link'
import { ROUTES } from '@/app/router'
import { BrandMark } from '@/components/BrandMark'

const DEMO_VIEWS = [
  { href: ROUTES.signIn, label: 'Reporter', detail: 'Sign in, write and seal a report' },
  { href: ROUTES.admin, label: 'IT admin (adversary)', detail: 'Dump the database, try to force a decrypt' },
  { href: ROUTES.quorum, label: 'Steward quorum', detail: 'Two of three approve an eligible case' },
  { href: ROUTES.audit, label: 'Public audit log', detail: 'Every action, never any content' },
] as const

/** Wordmark, three plain links, one action. On a phone the links fold into one menu. */
export function Nav() {
  const [demoOpen, setDemoOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const root = useRef<HTMLElement>(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!demoOpen && !menuOpen) return
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) close()
    }
    document.addEventListener('pointerdown', onPointer)
    return () => document.removeEventListener('pointerdown', onPointer)
  }, [demoOpen, menuOpen])

  function close() {
    setDemoOpen(false)
    setMenuOpen(false)
  }

  // Esc closes an open menu first; only with nothing open does it leave the site.
  function onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape' && (demoOpen || menuOpen)) {
      event.preventDefault()
      close()
    }
  }

  return (
    <header ref={root} className="lp-nav" data-scrolled={scrolled || menuOpen} onKeyDown={onKeyDown}>
      <Link href={ROUTES.home} className="lp-brand" aria-label="SafeThreshold home" onClick={close}>
        <BrandMark size={32} />
        <b>SafeThreshold</b>
      </Link>

      <nav className="lp-links" aria-label="Main" data-open={menuOpen}>
        <a href="#how-it-works" onClick={close}>
          How it works
        </a>
        <a href="#tidecloak" onClick={close}>
          About TideCloak
        </a>
        <div className="lp-demo">
          <button type="button" className="lp-demo-toggle" aria-expanded={demoOpen} aria-controls="demo-views" onClick={() => setDemoOpen((o) => !o)}>
            Demo views <ChevronDown aria-hidden className="lp-chev" />
          </button>
          <ul id="demo-views" className="lp-demo-menu" hidden={!demoOpen && !menuOpen}>
            {DEMO_VIEWS.map((v) => (
              <li key={v.href}>
                <Link href={v.href} onClick={close}>
                  <span>{v.label}</span>
                  <small>{v.detail}</small>
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <Link href={ROUTES.signIn} className="lp-btn lp-nav-cta" onClick={close}>
          File a report
        </Link>
      </nav>

      <button type="button" className="lp-menu-toggle" aria-expanded={menuOpen} aria-label={menuOpen ? 'Close menu' : 'Open menu'} onClick={() => setMenuOpen((o) => !o)}>
        <span aria-hidden className="lp-menu-dots">
          <i />
          <i />
        </span>
        {menuOpen ? 'Close' : 'Menu'}
      </button>
    </header>
  )
}
