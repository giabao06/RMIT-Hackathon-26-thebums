import { useEffect } from 'react'
import { LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'

const EXIT_URL = 'https://www.google.com/'

/**
 * Leaves at once for a neutral page. location.replace swaps this page out of the history
 * entry, so Back does not return to the form. Esc does the same on the reporter portal.
 */
function leaveNow(): void {
  window.location.replace(EXIT_URL)
}

export function QuickExit({ escListens }: { escListens: boolean }) {
  useEffect(() => {
    if (!escListens) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') leaveNow()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [escListens])

  return (
    <Button variant="danger" onClick={leaveNow} aria-keyshortcuts="Escape" title="Leave immediately (Esc)">
      <LogOut aria-hidden />
      Quick exit
      <kbd className="ml-1 rounded-[5px] bg-white/20 px-1.5 text-[12px] font-sans font-medium">Esc</kbd>
    </Button>
  )
}
