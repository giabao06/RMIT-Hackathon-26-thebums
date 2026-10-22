import { Suspense, lazy, useRef, useState, type FormEvent } from 'react'
import { Link } from '@/app/Link'
import { EMAIL_HINT, checkMemberEmail, signInAs, type Member } from '@/app/membership'
import { ROUTES, navigate } from '@/app/router'
import { useTideConfigured } from '@/app/tideContext'
import { BrandMark } from '@/components/BrandMark'
import { useQuickExitKey } from './motion'
import './landing.css'

const TideSignIn = lazy(() => import('@/app/TideConnected').then((m) => ({ default: m.TideSignIn })))

const CHOICES: { id: Member; title: string; detail: string }[] = [
  { id: 'student', title: 'Student', detail: 'Any course, any campus' },
  { id: 'staff', title: 'Staff', detail: 'Academic or professional' },
]

function initialChoice(): Member {
  return new URLSearchParams(window.location.search).get('as') === 'staff' ? 'staff' : 'student'
}

export function SignInPage() {
  useQuickExitKey()
  const tide = useTideConfigured()
  const [member, setMember] = useState<Member>(initialChoice)
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)

  function choose(next: Member) {
    setMember(next)
    setError(null)
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    const problem = checkMemberEmail(member, email)
    if (problem) {
      setError(problem)
      input.current?.focus()
      return
    }
    // The address has done its job: only the group is kept.
    setEmail('')
    signInAs(member)
    navigate(ROUTES.report)
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
            <h1>Sign in to file a report</h1>
            <p className="lede">
              Only current RMIT students and staff can file. Signing in proves you belong here; it never travels with your report.
            </p>

            <div className="si-choice" role="group" aria-label="I am">
              {CHOICES.map((c) => (
                <button key={c.id} type="button" aria-pressed={member === c.id} onClick={() => choose(c.id)}>
                  <b>{c.title}</b>
                  <span>{c.detail}</span>
                </button>
              ))}
            </div>

            {tide ? (
              <div className="si-submit">
                <Suspense fallback={<span className="si-hint">Connecting to Tide…</span>}>
                  <TideSignIn member={member} />
                </Suspense>
              </div>
            ) : (
              <>
                <div className="si-field">
                  <label htmlFor="rmit-email">RMIT email</label>
                  <input
                    ref={input}
                    id="rmit-email"
                    type="email"
                    inputMode="email"
                    autoComplete="off"
                    spellCheck={false}
                    placeholder={EMAIL_HINT[member]}
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value)
                      setError(null)
                    }}
                    aria-invalid={error ? true : undefined}
                    aria-describedby="email-note"
                  />
                  {error ? (
                    <span id="email-note" role="alert" className="si-error">
                      {error}
                    </span>
                  ) : (
                    <span id="email-note" className="si-hint">
                      Checked here, then discarded. Demo sign-in: TideCloak is not connected in this build.
                    </span>
                  )}
                </div>
                <div className="si-submit">
                  <button type="submit" className="lp-btn">
                    Continue as {member} <span className="lp-dot" aria-hidden />
                  </button>
                </div>
              </>
            )}

            <ul className="si-facts">
              <li>Your report carries no name, email or student number.</li>
              <li>Nothing is saved on this device. Closing the tab signs you out.</li>
              <li>Press Esc at any moment to leave for google.com.</li>
            </ul>
          </form>
        </main>
      </div>
    </div>
  )
}
