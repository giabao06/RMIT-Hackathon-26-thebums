/**
 * Org admin against the real API (/admin). Every change is a proposal other admins must approve
 * (admin quorum, separate from the steward quorum). The server returns people, settings and case
 * status only: there is no ciphertext, token or decrypt path here. Loaded only when Tide and the API are configured.
 */
import { useEffect, useState } from 'react'
import { useTideCloak } from '@tidecloak/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatDateTime } from '@/lib/format'

interface Person { id: string; display_name?: string; name?: string; body?: string }
interface Change { id: string; kind: string; payload: Record<string, unknown>; created_at: string; approvals: number; mine: boolean }
interface CaseRow { id: string; status: string; eligible_at: string | null; assigned: boolean }
interface Overview {
  settings: { retention_months: number; quorum_m: number; quorum_n: number }
  admin_quorum: { required: number; admins: number }
  stewards: Person[]
  investigators: Person[]
  changes: Change[]
  cases: CaseRow[]
}

const BODIES = ['union', 'ngo', 'oversight']

export function AdminLive({ apiUrl }: { apiUrl: string }) {
  const { isInitializing, authenticated, login, hasRealmRole, secureFetch } = useTideCloak()
  const [data, setData] = useState<Overview | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const [form, setForm] = useState({ tide_user_id: '', name: '', body: 'union', kind: 'steward' })
  const [settings, setSettings] = useState({ retention_months: 12, quorum_m: 2, quorum_n: 3 })
  const isAdmin = authenticated && hasRealmRole('org-admin')

  useEffect(() => {
    if (!isAdmin) return
    secureFetch(`${apiUrl}/admin/overview`)
      .then(async (res) => {
        if (!res.ok) throw new Error(res.status === 403 ? 'Your account is not an org admin.' : 'Could not load the overview.')
        const o = (await res.json()) as Overview
        setData(o)
        setSettings(o.settings)
        setError(null)
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
  }, [isAdmin, apiUrl, secureFetch, tick])

  // A 2xx only means accepted: the overview is reloaded to show what was actually applied.
  async function post(path: string, body: unknown, ok: (r: Record<string, unknown>) => string) {
    setBusy(true)
    setNote(null)
    try {
      const res = await secureFetch(`${apiUrl}/admin${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(res.status === 409 ? 'That is no longer possible.' : 'The request was not accepted.')
      setNote(ok((await res.json()) as Record<string, unknown>))
      setError(null)
      setTick((t) => t + 1)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const propose = (kind: string, payload: Record<string, unknown>) =>
    post('/changes', { kind, payload }, (r) => (r.status === 'applied' ? 'Change applied.' : 'Change proposed: waiting for other admins.'))
  const vote = (id: string, action: 'approve' | 'reject') =>
    post(`/changes/${id}/${action}`, {}, (r) => `Change ${String(r.status)}.`)

  if (isInitializing) return <p className="text-[14px] text-slate">Connecting to Tide…</p>
  if (!authenticated) {
    return (
      <div className="flex flex-col items-start gap-3">
        <h1 className="text-[22px] font-semibold">Organisation admin</h1>
        <p className="text-[14px] text-slate">Sign in with your admin account to manage stewards, investigators and settings.</p>
        <Button onClick={() => void login()}>Sign in with Tide</Button>
      </div>
    )
  }
  if (!isAdmin) return <p role="alert" className="text-[14px] text-danger-ink">This account has no org-admin role. Ask the realm admin to grant it.</p>

  const addPerson = () => {
    if (form.kind === 'steward') void propose('add_steward', { tide_user_id: form.tide_user_id, display_name: form.name, body: form.body })
    else void propose('add_investigator', { tide_user_id: form.tide_user_id, name: form.name })
  }
  const label = (c: Change) => {
    const p = c.payload
    const who = (p.display_name ?? p.name ?? p.id ?? '') as string
    return `${c.kind.replace('_', ' ')}${who ? `: ${who}` : ''}${c.kind === 'set_settings' ? `: ${p.retention_months} months, ${p.quorum_m} of ${p.quorum_n}` : ''}`
  }
  const rotate = (s: Person) => {
    const tide_user_id = window.prompt(`Tide user id of the replacement for ${s.display_name}`)
    const display_name = tide_user_id && window.prompt('Display name of the replacement')
    if (tide_user_id && display_name) void propose('rotate_steward', { id: s.id, tide_user_id, display_name })
  }

  const person = (p: Person, kind: 'steward' | 'investigator') => (
    <li key={p.id} className="flex items-center justify-between gap-3 rounded-[10px] border border-rule bg-white px-4 py-3 text-[14px]">
      <span>{p.display_name ?? p.name}{p.body && <span className="text-slate"> · {p.body}</span>}</span>
      <span className="flex gap-2">
        {kind === 'steward' && <Button size="sm" variant="ghost" disabled={busy} onClick={() => rotate(p)}>Rotate</Button>}
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => void propose(`remove_${kind}`, { id: p.id })}>Remove</Button>
      </span>
    </li>
  )

  return (
    <section aria-labelledby="admin-live" className="flex flex-col gap-8">
      <div>
        <h1 id="admin-live" className="text-[22px] font-semibold">Organisation admin</h1>
        <p className="mt-1 max-w-[68ch] text-[14px] text-slate">
          You manage people and settings. You cannot read reports or open a case: every change needs {data?.admin_quorum.required ?? '…'} of {data?.admin_quorum.admins ?? '…'} admins.
        </p>
        {error && <p role="alert" className="mt-3 text-[14px] text-danger-ink">{error}</p>}
        {note && <p role="status" className="mt-3 text-[14px] text-active-ink">{note}</p>}
      </div>

      {data && (
        <>
          <div>
            <h2 className="text-[16px] font-semibold">Pending changes</h2>
            {data.changes.length === 0 && <p className="mt-2 text-[14px] text-slate">Nothing is waiting for approval.</p>}
            <ul className="mt-2 grid gap-2">
              {data.changes.map((c) => (
                <li key={c.id} className="flex flex-col gap-2 rounded-[10px] border border-rule bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-[14px]">
                    {label(c)}
                    <span className="tabular text-slate"> · {c.approvals}/{data.admin_quorum.required} approvals · {formatDateTime(Date.parse(c.created_at))}</span>
                  </span>
                  <span className="flex gap-2">
                    {c.mine ? <span className="text-[13px] text-active-ink">You approved</span> : (
                      <Button size="sm" disabled={busy} onClick={() => void vote(c.id, 'approve')}>Approve</Button>
                    )}
                    <Button size="sm" variant="ghost" disabled={busy} onClick={() => void vote(c.id, 'reject')}>Reject</Button>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="grid gap-8 lg:grid-cols-2">
            <div>
              <h2 className="text-[16px] font-semibold">Stewards ({data.stewards.length})</h2>
              <ul className="mt-2 grid gap-2">{data.stewards.map((s) => person(s, 'steward'))}</ul>
            </div>
            <div>
              <h2 className="text-[16px] font-semibold">Investigators ({data.investigators.length})</h2>
              <ul className="mt-2 grid gap-2">{data.investigators.map((i) => person(i, 'investigator'))}</ul>
            </div>
          </div>

          <form className="grid gap-2 sm:grid-cols-5" onSubmit={(e) => { e.preventDefault(); addPerson() }}>
            <select aria-label="Role" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} className="h-9 rounded-[10px] border border-input bg-white px-2 text-[14px]">
              <option value="steward">Steward</option>
              <option value="investigator">Investigator</option>
            </select>
            <Input aria-label="Tide user id" placeholder="Tide user id" required value={form.tide_user_id} onChange={(e) => setForm({ ...form, tide_user_id: e.target.value })} />
            <Input aria-label="Name" placeholder="Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <select aria-label="Body" disabled={form.kind !== 'steward'} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} className="h-9 rounded-[10px] border border-input bg-white px-2 text-[14px]">
              {BODIES.map((b) => <option key={b}>{b}</option>)}
            </select>
            <Button type="submit" disabled={busy}>Propose add</Button>
          </form>

          <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); void propose('set_settings', settings) }}>
            <h2 className="w-full text-[16px] font-semibold">Retention and steward quorum</h2>
            {([['retention_months', 'Retention (12–18 months)'], ['quorum_m', 'Approvals needed (M)'], ['quorum_n', 'Stewards (N, 3–5)']] as const).map(([k, l]) => (
              <label key={k} className="flex flex-col gap-1 text-[13px] text-slate">
                {l}
                <Input type="number" className="w-28" value={settings[k]} onChange={(e) => setSettings({ ...settings, [k]: Number(e.target.value) })} />
              </label>
            ))}
            <Button type="submit" disabled={busy}>Propose change</Button>
          </form>

          <div>
            <h2 className="text-[16px] font-semibold">Cases</h2>
            <p className="mt-1 text-[13px] text-slate">Status only. Assignment is for cases the stewards have released.</p>
            <ul className="mt-2 grid gap-2">
              {data.cases.map((c) => (
                <li key={c.id} className="flex flex-col gap-2 rounded-[10px] border border-rule bg-white px-4 py-3 text-[14px] sm:flex-row sm:items-center sm:justify-between">
                  <span><span className="font-mono">{c.id}</span> <span className="text-slate">· {c.status}{c.assigned && ' · assigned'}</span></span>
                  {c.status === 'released' && !c.assigned && (
                    <select aria-label="Assign investigator" defaultValue="" disabled={busy} className="h-9 rounded-[10px] border border-input bg-white px-2 text-[14px]"
                      onChange={(e) => e.target.value && void post(`/cases/${c.id}/assign`, { investigator: e.target.value }, () => 'Investigator assigned.')}>
                      <option value="">Assign investigator…</option>
                      {data.investigators.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                    </select>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </section>
  )
}
