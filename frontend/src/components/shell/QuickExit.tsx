import { useEffect } from 'react'
import { LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { leaveNow } from './leaveNow'

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
