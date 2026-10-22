import { useEffect, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { fromBase64, type Bytes } from '@/escrow/bytes'
import { createStaffKey, restoreStaffKey, type StaffKey } from '@/escrow/keys'
import { loadKey, saveKey } from '@/escrow/keyStore'

const MIN_PASSPHRASE = 12
const toBase64 = (b: Bytes) => btoa(String.fromCharCode(...b))

/**
 * Makes sure this browser holds the signed-in steward's or investigator's private key before showing
 * the portal. First use creates the key and uploads the public half plus a passphrase-wrapped backup;
 * a new device restores it from that backup. The passphrase and private key never leave the browser.
 */
export function KeyGate({
  apiUrl,
  role,
  userId,
  secureFetch,
  children,
}: {
  apiUrl: string
  role: 'steward' | 'investigator'
  userId: string
  secureFetch: (url: string, init?: RequestInit) => Promise<Response>
  children: (key: StaffKey) => ReactNode
}) {
  const [key, setKey] = useState<StaffKey | null>(null)
  const [state, setState] = useState<'loading' | 'create' | 'restore'>('loading')
  const [remote, setRemote] = useState<{ publicKey: Bytes; backup: Bytes } | null>(null)
  const [passphrase, setPassphrase] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const local = await loadKey(userId).catch(() => undefined)
      if (local) return !cancelled && setKey(local)
      const res = await secureFetch(`${apiUrl}/${role}/key`)
      if (!res.ok) throw new Error('Could not check your key.')
      const body = (await res.json()) as { publicKey: string | null; backup: string | null }
      if (cancelled) return
      if (body.publicKey && body.backup) {
        setRemote({ publicKey: fromBase64(body.publicKey), backup: fromBase64(body.backup) })
        setState('restore')
      } else setState('create')
    })().catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : String(e)))
    return () => {
      cancelled = true
    }
  }, [apiUrl, role, userId, secureFetch])

  async function submit() {
    setBusy(true)
    setError(null)
    try {
      let next: StaffKey
      if (state === 'restore' && remote) {
        next = await restoreStaffKey(remote.backup, remote.publicKey, passphrase)
      } else {
        if (passphrase.length < MIN_PASSPHRASE) throw new Error(`Use a passphrase of at least ${MIN_PASSPHRASE} characters.`)
        if (passphrase !== confirm) throw new Error('The two passphrases differ.')
        const made = await createStaffKey(passphrase)
        const res = await secureFetch(`${apiUrl}/${role}/key`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ publicKey: toBase64(made.key.publicKey), backup: toBase64(made.backup) }),
        })
        if (!res.ok) throw new Error('The server did not accept your key.')
        next = made.key
      }
      await saveKey(userId, next)
      setKey(next)
      setPassphrase('')
      setConfirm('')
    } catch (e) {
      setError(state === 'restore' ? 'That passphrase does not open your key backup.' : e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  if (key) return <>{children(key)}</>
  if (state === 'loading') return error ? <p role="alert" className="text-[14px] text-danger-ink">{error}</p> : <p className="text-[14px] text-slate">Checking your key…</p>

  return (
    <form
      className="flex max-w-[460px] flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
    >
      <h1 className="text-[22px] font-semibold">{state === 'restore' ? 'Unlock your key' : 'Create your key'}</h1>
      <p className="text-[14px] text-slate">
        {state === 'restore'
          ? 'This device does not have your key yet. Enter the passphrase you chose to restore it.'
          : 'Your key is created in this browser and protected by a passphrase. Reports are shared to you through it. If you lose both the device and the passphrase, your share of every report is lost.'}
      </p>
      <Input aria-label="Passphrase" type="password" autoComplete="off" placeholder="Passphrase" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} />
      {state === 'create' && (
        <Input aria-label="Repeat the passphrase" type="password" autoComplete="off" placeholder="Repeat the passphrase" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      )}
      {error && <p role="alert" className="text-[14px] text-danger-ink">{error}</p>}
      <Button type="submit" disabled={busy || !passphrase}>
        {busy ? 'Working…' : state === 'restore' ? 'Unlock' : 'Create key'}
      </Button>
    </form>
  )
}
