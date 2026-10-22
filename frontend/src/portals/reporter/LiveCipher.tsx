import { useEffect, useRef, useState } from 'react'
import { randomBytes, toHex, utf8 } from '@/escrow/bytes'
import { seal } from '@/escrow/crypto'

/**
 * Encrypts what is typed, as it is typed, with AES-256-GCM in this browser, and shows the
 * result: what would leave the device. The preview key never leaves this component; sealing
 * the report uses a fresh key.
 */
export function LiveCipher({ text, tone = 'light' }: { text: string; tone?: 'light' | 'vault' }) {
  const key = useRef(randomBytes(32))
  const [hex, setHex] = useState('')

  useEffect(() => {
    let cancelled = false
    const timer = window.setTimeout(async () => {
      if (!text.trim()) {
        if (!cancelled) setHex('')
        return
      }
      const { iv, ciphertext } = await seal(key.current, utf8(text), utf8('preview'))
      if (!cancelled) setHex(toHex(iv) + toHex(ciphertext))
    }, 150)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [text])

  const shown = hex.length > 132 ? `${hex.slice(0, 132)}…` : hex
  return (
    <div
      aria-live="off"
      className={
        tone === 'vault'
          ? 'font-mono text-[12px] leading-[1.6] break-all text-vault-muted'
          : 'font-mono text-[12px] leading-[1.6] break-all text-slate'
      }
    >
      {hex ? (
        <>
          <span className={tone === 'vault' ? 'text-vault-ink' : 'text-ink'}>0x</span>
          {shown}
          <span className="mt-1 block font-sans text-[12px]">{hex.length / 2} bytes for {utf8(text).length} bytes of text</span>
        </>
      ) : (
        <span className="font-sans">Start typing to see the ciphertext that would leave this device.</span>
      )}
    </div>
  )
}
