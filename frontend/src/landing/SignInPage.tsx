import { useRef, useState, type FormEvent } from 'react'
import { Link } from '@/app/Link'
import { supabase } from '@/app/supabase'
import { ROUTES, navigate } from '@/app/router'
import { BrandMark } from '@/components/BrandMark'
import { useQuickExitKey } from './motion'
import './landing.css'

// Demo shortcuts for recording a walkthrough: only shown when VITE_DEMO_PASSWORD is set in a
// local .env.local. That value ships in the page, so never set it on a real deployment.
const DEMO_PASSWORD = import.meta.env.VITE_DEMO_PASSWORD as string | undefined
const DEMO_ACCOUNTS = [
  { email: 'admin@mock.safethreshold.test', title: 'Org admin', detail: 'People, settings, assign', to: ROUTES.admin },
  { email: 'steward@mock.safethreshold.test', title: 'Steward 1', detail: 'Union', to: ROUTES.quorum },
  { email: 'student1@mock.safethreshold.test', title: 'Steward 2', detail: 'NGO', to: ROUTES.quorum },
  { email: 'student2@mock.safethreshold.test', title: 'Steward 3', detail: 'Oversight', to: ROUTES.quorum },
  { email: 'staff@mock.safethreshold.test', title: 'Investigator', detail: 'Opens released cases', to: ROUTES.quorum },
] as const

export function SignInPage() {
  useQuickExitKey()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  async function signIn(address: string, secret: string, to: string) {
    setBusy(true)
    setError(null)
    const { error: failed } = await supabase.auth.signInWithPassword({ email: address.trim(), password: secret })
    setBusy(false)
    if (failed) return setError('That email and password do not match an account.')
    setPassword('')
    navigate(to)
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    void signIn(email, password, ROUTES.quorum)
  }

  return (
    <div className="lp">
      <div className="si">
        <aside className="si-art">
          <div className="lp-lockup" style={{ position: 'relative', zIndex: 2 }}>
            <img className="lp-rmit" src="/landing/rmit-logo-white.svg" width={97} height={34} alt="RMIT University" />
            <Link href={ROUTES.home} className="lp-brand" aria-label="SafeThreshold home">
              <BrandMark size={34} />
              <b>SafeThreshold</b>
            </Link>
          </div>
          <p className="si-art-text">Your report waits, sealed, until someone else names the same person. Then you are not alone.</p>
          <div className="lp-discs" aria-hidden>
            <div className="lp-disc lp-disc--sealed" />
            <div className="lp-disc lp-disc--second">
              <img src="/landing/person-in-fog.jpg" width={1000} height={1400} alt="" />
            </div>
          </div>
        </aside>

        <main className="si-main">
          <form className="si-form" onSubmit={submit} noValidate>
            <h1>Staff sign in</h1>
            <p className="lede">
              For stewards, investigators and org admins. Reporters do not need an account: <Link href={ROUTES.report}>file a report</Link>.
            </p>

            <div className="si-field">
              <label htmlFor="staff-email">Email</label>
              <input ref={input} id="staff-email" type="email" autoComplete="username" spellCheck={false} value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="si-field">
              <label htmlFor="staff-password">Password</label>
              <input id="staff-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
              {error && (
                <span role="alert" className="si-error">
                  {error}
                </span>
              )}
            </div>
            <div className="si-submit">
              <button type="submit" className="lp-btn" disabled={busy || !email || !password}>
                {busy ? 'Signing in…' : 'Sign in'} <span className="lp-dot" aria-hidden />
              </button>
            </div>

            {DEMO_PASSWORD && (
              <div className="si-choice" role="group" aria-label="Demo accounts">
                {DEMO_ACCOUNTS.map((a) => (
                  <button key={a.email} type="button" disabled={busy} onClick={() => void signIn(a.email, DEMO_PASSWORD, a.to)}>
                    <b>{a.title}</b>
                    <span>{a.detail}</span>
                  </button>
                ))}
              </div>
            )}

            <ul className="si-facts">
              <li>Your role is checked by the server on every request, not by this page.</li>
              <li>Press Esc at any moment to leave for google.com.</li>
            </ul>
          </form>
        </main>
      </div>
    </div>
  )
}
