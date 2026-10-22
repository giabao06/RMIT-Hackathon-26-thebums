import { useState, type ReactNode } from 'react'
import { Database, FilePlus2, KeyRound, Menu, ScrollText } from 'lucide-react'
import { cn } from 'cn'
import { Link } from '@/app/Link'
import { Account } from '@/app/Account'
import { ROUTES } from '@/app/router'
import { BrandMark } from '@/components/BrandMark'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { QuickExit } from './QuickExit'

const NAV = [
  { href: ROUTES.report, label: 'Report misconduct', icon: FilePlus2 },
  { href: ROUTES.admin, label: 'Admin IT view', icon: Database },
  { href: ROUTES.quorum, label: 'Steward quorum', icon: KeyRound },
  { href: ROUTES.audit, label: 'Public audit log', icon: ScrollText },
] as const

export function AppShell({ path, children }: { path: string; children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const onReport = path === ROUTES.report
  const current = NAV.find((n) => n.href === path)

  return (
    <div className="flex min-h-svh bg-frame">
      <aside className="sticky top-0 hidden h-svh w-[228px] shrink-0 flex-col px-3 pt-3 pb-4 lg:flex">
        <SidebarContent path={path} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 items-center gap-3 px-4">
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu" onClick={() => setMenuOpen(true)}>
            <Menu />
          </Button>
          <span className="truncate text-[15px] font-semibold lg:hidden">{current?.label ?? 'SafeThreshold'}</span>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden sm:inline">
              <Account />
            </span>
            {onReport && <QuickExit escListens />}
          </div>
        </header>

        <main className="flex-1 bg-sheet px-4 py-5 sm:px-6 sm:py-6 lg:mr-2 lg:mb-2 lg:rounded-[16px] lg:border lg:border-sheet-edge">
          {children}
        </main>
      </div>

      <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
        <DialogContent className="top-0 left-0 h-svh max-w-[280px] translate-x-0 translate-y-0 rounded-none bg-frame p-3 sm:max-w-[280px]">
          <DialogTitle className="sr-only">Menu</DialogTitle>
          <DialogDescription className="sr-only">Portals and demo controls</DialogDescription>
          <div className="flex h-full flex-col" onClick={(e) => (e.target as HTMLElement).closest('a') && setMenuOpen(false)}>
            <SidebarContent path={path} />
            <div className="pt-3 sm:hidden">
              <Account />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function SidebarContent({ path }: { path: string }) {
  return (
    <>
      <Link href={ROUTES.home} className="flex items-center gap-2.5 rounded-lg px-2 pt-1 pb-5" aria-label="SafeThreshold home">
        <BrandMark />
        <div className="leading-tight">
          <div className="text-[15px] font-semibold">SafeThreshold</div>
          <div className="text-[12px] text-chrome-muted">University pilot</div>
        </div>
      </Link>

      <nav aria-label="Portals" className="flex flex-col gap-0.5">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = path === href
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-[14px] transition-colors',
                active ? 'bg-[#dde4ec] font-medium text-ink' : 'text-[#475569] hover:bg-[#e4e9f0] hover:text-ink',
              )}
            >
              <Icon className="size-4" strokeWidth={1.75} aria-hidden />
              <span className="flex-1 truncate">{label}</span>
            </Link>
          )
        })}
      </nav>
    </>
  )
}

