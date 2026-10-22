import { useEffect, useRef, useState } from 'react'
import { Link } from '@/app/Link'
import { ROUTES } from '@/app/router'
import { randomBytes, toHex, utf8 } from '@/escrow/bytes'
import { seal } from '@/escrow/crypto'
import { useQuickExitKey, useReveal } from './motion'
import { Nav } from './Nav'
import './landing.css'

const IMG = '/landing'

const SIGN_IN_STUDENT = `${ROUTES.signIn}?as=student`
const SIGN_IN_STAFF = `${ROUTES.signIn}?as=staff`

export function LandingPage() {
  const root = useRef<HTMLDivElement>(null)
  useReveal(root)
  useQuickExitKey()

  return (
    <div ref={root} className="lp">
      <Nav />
      <section className="lp-hero" aria-labelledby="hero-title">
        <div className="lp-discs" aria-hidden>
          <div className="lp-disc lp-disc--sealed">
            <span className="lp-disc-label">Your report, sealed</span>
          </div>
          <div className="lp-disc lp-disc--second">
            <span className="lp-disc-label">A second, independent report</span>
          </div>
          <span className="lp-lens-label">The case opens only here</span>
        </div>
        <div className="lp-hero-body">
          <h1 id="hero-title">You don't have to speak up alone.</h1>
          <p className="lp-hero-lede">
            Report harassment or misconduct at RMIT safely. Your report is encrypted and sealed, and opens only when a second,
            independent report names the same person.
          </p>
          <div className="lp-hero-actions">
            <Link href={ROUTES.signIn} className="lp-btn">
              File a sealed report <span className="lp-dot" aria-hidden />
            </Link>
            <a href="#how-it-works" className="lp-textlink">
              See how it works
            </a>
          </div>
        </div>
        <ul className="lp-hero-facts">
          <li>Encrypted in your browser before it is sent</li>
          <li>Opens only when a second report names the same person</li>
          <li>Deleted for good after 12 or 18 months without a match</li>
        </ul>
      </section>

      <WhySafe />
      <Steps />
      <WhoSees />
      <div className="lp-band">
        <div className="lp-band-dots" aria-hidden>
          {Array.from({ length: 24 }, (_, i) => (
            <span key={i} className={i === 11 || i === 12 ? 'on' : undefined} />
          ))}
        </div>
        <p>
          <span>24 sealed reports. Two of them name the same person.</span>
          <span>Only those two open. The other 22 stay sealed.</span>
        </p>
      </div>
      <AboutTide />
      <Faq />
      <Cta />
      <Footer />
    </div>
  )
}

function WhySafe() {
  return (
    <section className="lp-section lp-wrap" aria-labelledby="safe-title" data-reveal>
      <div className="lp-grid">
        <div className="lp-safe-head">
          <h2 id="safe-title" className="lp-r">Why you are safe</h2>
          <p className="lp-r" style={{ ['--r' as string]: 1 }}>
            Three locks, and none of them is a person you have to trust.
          </p>
        </div>
        <div className="lp-safe-tiles">
          <article className="lp-spec lp-r" style={{ ['--r' as string]: 2 }}>
            <div className="lp-tile lp-tile--4-5 lp-f2">
              <div className="lp-mask">
                <img src={`${IMG}/solex-99-30-padlock-with-keys-dscf2659.jpg`} width={1600} height={1457} alt="A brass padlock with its keys on a wooden table" loading="lazy" />
              </div>
            </div>
            <h3>Encrypted on your device</h3>
            <p>Your words are sealed with AES-256 in this browser before anything is sent. Nobody can read them until the case opens.</p>
          </article>
          <article className="lp-spec lp-r" style={{ ['--r' as string]: 3 }}>
            <div className="lp-tile lp-tile--8-5 lp-f1">
              <div className="lp-mask">
                <img src={`${IMG}/flinders-street-station-melbourne-at-the-intersection.jpg`} width={1600} height={1154} alt="A crowd crossing Swanston and Flinders Streets in Melbourne, 1927" loading="lazy" />
              </div>
            </div>
            <h3>Blind matching</h3>
            <p>
              The person you name becomes a keyed, blinded token. Two reports about the same person match without anyone learning who
              either of them names.
            </p>
          </article>
          <article className="lp-spec lp-r" style={{ ['--r' as string]: 4 }}>
            <div className="lp-tile lp-tile--4-5 lp-f3">
              <div className="lp-mask">
                <img src={`${IMG}/safe-deposit-boxes-in-japan-2024-12.jpg`} width={1200} height={1600} alt="A bank vault lined with rows of steel safe deposit boxes" loading="lazy" />
              </div>
            </div>
            <h3>No master key</h3>
            <p>TideCloak splits the key across a network. No admin, server or AI can open a report on its own.</p>
          </article>
        </div>
      </div>
    </section>
  )
}

const STEPS = [
  {
    name: 'You write it',
    text: 'Name the person, describe what happened, attach evidence. It stays in your browser.',
    fill: 'lp-f1',
    art: (
      <svg viewBox="0 0 200 200" aria-hidden>
        <circle cx="100" cy="100" r="58" fill="#ffffff" />
      </svg>
    ),
  },
  {
    name: 'It is sealed',
    text: 'The report is encrypted and stored as ciphertext with a blinded token. The database holds nothing readable.',
    fill: 'lp-f2',
    art: (
      <svg viewBox="0 0 200 200" aria-hidden>
        <circle cx="100" cy="100" r="66" fill="#e60028" />
      </svg>
    ),
  },
  {
    name: 'An ally is found',
    text: 'A second, independent report produces the same token. The case becomes eligible; nobody has read either report yet.',
    fill: 'lp-f1',
    art: (
      <svg viewBox="0 0 240 200" aria-hidden>
        <circle cx="92" cy="100" r="66" fill="#e60028" />
        <circle cx="148" cy="100" r="66" fill="#c9cbe0" style={{ mixBlendMode: 'multiply' }} />
      </svg>
    ),
  },
  {
    name: 'Two of three stewards open it',
    text: 'The Student Union, a victim-support NGO and the university ombudsman each review. Two approvals release the key to an investigator.',
    fill: 'lp-f3',
    art: (
      <svg viewBox="0 0 240 220" aria-hidden>
        <circle cx="92" cy="96" r="66" fill="#e60028" />
        <circle cx="148" cy="96" r="66" fill="#e8e8f4" style={{ mixBlendMode: 'screen' }} />
        <circle cx="84" cy="196" r="12" fill="#e60028" />
        <circle cx="120" cy="196" r="12" fill="#e60028" />
        <circle cx="156" cy="196" r="12" fill="#16166e" stroke="#b4b4d4" strokeWidth="3" />
      </svg>
    ),
  },
]

function Steps() {
  return (
    <section id="how-it-works" className="lp-section lp-wrap lp-steps" aria-labelledby="steps-title" data-reveal>
      <div className="lp-steps-head">
        <h2 id="steps-title" className="lp-r">Four steps to an open case</h2>
        <p className="lp-r" style={{ ['--r' as string]: 1 }}>
          Each step only happens if the one before it did. Most reports stop at step two, sealed, until someone else comes forward.
        </p>
      </div>
      <ol className="lp-steps-row" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {STEPS.map((s, i) => (
          <li key={s.name} className="lp-step lp-r" style={{ ['--r' as string]: i + 2 }}>
            <div className={`lp-step-tile ${s.fill}`}>{s.art}</div>
            <h3>{s.name}</h3>
            <p>{s.text}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}

type Viewer = 'you' | 'admin' | 'stewards'

const SAMPLE = 'After the lab on 14 March my supervisor told me my contract depended on meeting him alone.'

function WhoSees() {
  const [viewer, setViewer] = useState<Viewer>('admin')
  const [text, setText] = useState(SAMPLE)
  const hex = useCiphertext(text)
  const tabs: { id: Viewer; label: string }[] = [
    { id: 'you', label: 'You' },
    { id: 'admin', label: 'IT admin' },
    { id: 'stewards', label: 'Stewards' },
  ]

  return (
    <section className="lp-show" aria-labelledby="show-title" data-reveal>
      <figure className="lp-show-photo" style={{ margin: 0 }}>
        <div className="lp-frame lp-shutter">
          <img src={`${IMG}/people-crossing-swanston-street-at-little-bourke.jpg`} width={1600} height={954} alt="People crossing Swanston Street at Little Bourke Street, Melbourne" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          <span className="lp-ring" aria-hidden />
        </div>
        <figcaption>Swanston Street, a few blocks from RMIT's city campus.</figcaption>
      </figure>

      <div className="lp-show-body">
        <div className="lp-tabs lp-r" role="tablist" aria-label="Who is looking">
          {tabs.map((t) => (
            <button key={t.id} type="button" role="tab" id={`tab-${t.id}`} aria-selected={viewer === t.id} aria-controls="sees-panel" onClick={() => setViewer(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="lp-r" style={{ ['--r' as string]: 1 }}>
          <h2 id="show-title">Who sees what</h2>
          <p>Type a sentence and switch who is looking. The encryption below runs for real, in this browser, as you type.</p>
          <label htmlFor="try-text" className="sr-only">
            A sentence to encrypt
          </label>
          <textarea id="try-text" className="lp-write" style={{ marginTop: 24 }} value={text} onChange={(e) => setText(e.target.value)} maxLength={400} />
          <div id="sees-panel" role="tabpanel" aria-labelledby={`tab-${viewer}`} className="lp-sees" aria-live="polite">
            {viewer === 'you' && (
              <p>
                <strong>You see your own words.</strong> {text || 'Nothing typed yet.'}
                <span className="lp-sees-note">Only on this device, and only until you close the tab.</span>
              </p>
            )}
            {viewer === 'admin' && (
              <p>
                <code>
                  <b>0x</b>
                  {hex ? (hex.length > 150 ? `${hex.slice(0, 150)}…` : hex) : 'nothing to show'}
                </code>
                <span className="lp-sees-note">AES-256-GCM ciphertext and a blinded token. Dumping the whole database shows no more than this.</span>
              </p>
            )}
            {viewer === 'stewards' && (
              <p>
                <strong>One sealed report. No match yet. Nothing to approve.</strong>
                <span className="lp-sees-note">Stewards learn a case exists only once a second report matches, and never see content before they approve.</span>
              </p>
            )}
          </div>
        </div>

        <div className="lp-cells lp-r" style={{ ['--r' as string]: 2 }}>
          <Link href={ROUTES.admin} className="lp-cell lp-cell--ink">
            Try to break in as IT admin <span aria-hidden>→</span>
          </Link>
          <Link href={ROUTES.quorum} className="lp-cell lp-cell--tone">
            Open the steward quorum <span aria-hidden>→</span>
          </Link>
        </div>
      </div>
    </section>
  )
}

/** Encrypts a preview with a throwaway key; the key never leaves this hook. */
function useCiphertext(text: string): string {
  const key = useRef(randomBytes(32))
  const [hex, setHex] = useState('')
  useEffect(() => {
    let cancelled = false
    const timer = window.setTimeout(async () => {
      if (!text.trim()) return void (!cancelled && setHex(''))
      const { iv, ciphertext } = await seal(key.current, utf8(text), utf8('preview'))
      if (!cancelled) setHex(toHex(iv) + toHex(ciphertext))
    }, 120)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [text])
  return hex
}

function AboutTide() {
  return (
    <section id="tidecloak" className="lp-section" aria-labelledby="tide-title" data-reveal>
      <div className="lp-about">
        <div>
          <h2 id="tide-title" className="lp-r">No one holds the whole key.</h2>
          <div className="lp-about-cols">
            <div className="lp-r" style={{ ['--r' as string]: 1 }}>
              <h3>The key is split across TideCloak's network</h3>
              <p>
                TideCloak shares the decryption key among independent nodes. It is never put together on one machine, so there is no
                server to raid and no admin password that opens everything.
              </p>
            </div>
            <div className="lp-r" style={{ ['--r' as string]: 2 }}>
              <h3>Three stewards, two needed</h3>
              <p>The nodes release the key only when they verify two of these three signatures:</p>
              <ul>
                <li>RMIT University Student Union</li>
                <li>An independent victim-support NGO</li>
                <li className="off">The university ombudsman</li>
              </ul>
            </div>
          </div>
          <div className="lp-about-action lp-r" style={{ ['--r' as string]: 3 }}>
            <a className="lp-btn lp-btn--accent" href="https://tide.org/tidecloak" target="_blank" rel="noreferrer noopener">
              Read about TideCloak
            </a>
          </div>
        </div>
        <div className="lp-about-photo lp-r" style={{ ['--r' as string]: 2 }}>
          <img src={`${IMG}/person-facing-sea.jpg`} width={1400} height={1400} alt="A person in a hooded coat seen from behind, facing a misty sea" loading="lazy" />
        </div>
      </div>
    </section>
  )
}

const FAQ = [
  {
    tab: 'Privacy',
    q: 'Who can read my report?',
    a: 'Nobody, until a second independent report names the same person and two of three stewards approve. Then only the appointed investigator reads it. RMIT IT, the server and any AI only ever hold ciphertext.',
  },
  {
    tab: 'No match',
    q: 'What if nobody else reports?',
    a: 'Your report stays sealed. After 12 or 18 months, whichever you choose, it is deleted for good, together with its token. Nobody will ever have read it.',
  },
  {
    tab: 'Withdraw',
    q: 'Can I change my mind?',
    a: 'Yes. Before a match you can withdraw with your passphrase and the ciphertext and token are erased completely. After a match the case is with the stewards and withdrawal is restricted.',
  },
  {
    tab: 'Sign-in',
    q: 'Why do I have to sign in?',
    a: 'Only current RMIT students and staff can file, which keeps out spam and fake reports. Signing in proves you belong; your name, email and student number are never attached to the report.',
  },
  {
    tab: 'Stewards',
    q: 'Who are the stewards?',
    a: 'Three independent bodies: the Student Union, a victim-support NGO and the university ombudsman. They rotate, they cannot read anything before they approve, and every approval is written to the public audit log without any content.',
  },
  {
    tab: 'After',
    q: 'What happens when a case opens?',
    a: 'An independent investigator reads both reports side by side, each with its own timeline, and decides what to do. You stay anonymous unless you choose to reveal who you are.',
  },
]

const CARD_FILL = ['lp-f2', 'lp-f1', 'lp-paper']

function Faq() {
  const [open, setOpen] = useState(0)
  return (
    <section className="lp-section lp-wrap lp-faq" aria-labelledby="faq-title" data-reveal>
      <div className="lp-faq-inner">
        <h2 id="faq-title" className="lp-r">Questions people ask first</h2>
        <div className="lp-cards">
          {FAQ.map((f, i) => (
            <div key={f.tab} className={`lp-card ${CARD_FILL[i % 3]} lp-r`} data-open={open === i} style={{ ['--i' as string]: i, ['--r' as string]: i + 1 }}>
              <span className="lp-card-tab" aria-hidden>
                {f.tab}
              </span>
              <h3 style={{ letterSpacing: 0, lineHeight: 1.3 }}>
                <button type="button" aria-expanded={open === i} aria-controls={`faq-${i}`} onClick={() => setOpen(i)}>
                  {f.q}
                  <span className="lp-dot" aria-hidden />
                </button>
              </h3>
              {open === i && (
                <p id={`faq-${i}`} className="lp-card-answer">
                  {f.a}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Cta() {
  return (
    <section className="lp-section lp-wrap" aria-labelledby="cta-title" data-reveal>
      <div className="lp-cta">
        <div className="lp-cta-side lp-r">
          <img src={`${IMG}/person-in-fog.jpg`} width={1000} height={1400} alt="A person in a corduroy jacket and knitted beanie, seen from behind in fog" loading="lazy" />
        </div>
        <div className="lp-cta-main lp-r" style={{ ['--r' as string]: 1 }}>
          <div>
            <h2 id="cta-title">File a sealed report</h2>
            <p>Sign in with your RMIT account to prove you study or work here. It takes about ten minutes, and you can leave at any moment with Esc.</p>
            <div className="lp-hero-actions">
              <Link href={SIGN_IN_STUDENT} className="lp-btn">
                I'm a student
              </Link>
              <Link href={SIGN_IN_STAFF} className="lp-btn lp-btn--paper">
                I'm staff
              </Link>
            </div>
          </div>
          <div className="lp-cta-need">
            <h3>What you will need</h3>
            <ul>
              <li>The person's name, staff or student ID if you know it, and their school or unit</li>
              <li>What happened and roughly when</li>
              <li>Any screenshots, emails or files, if you have them</li>
              <li>A passphrase only you know, to withdraw later</li>
            </ul>
          </div>
        </div>
        <div className="lp-cta-side lp-f3 lp-r" style={{ ['--r' as string]: 2 }} />
      </div>
    </section>
  )
}

const CREDITS = [
  { title: 'Flinders Street Station at Swanston Street, 1927', by: 'Victoria State Transport Authority, restored by Adam Cuerden', licence: 'public domain', href: 'https://commons.wikimedia.org/wiki/File:Flinders_Street_Station,_Melbourne,_at_the_intersection_of_Swanston_Street_and_Flinders_Street,_1927_-_Glass_plate.jpg' },
  { title: 'People crossing Swanston Street at Little Bourke Street', by: 'Philip Mallis', licence: 'CC BY-SA 2.0', href: 'https://commons.wikimedia.org/wiki/File:People_crossing_Swanston_Street_at_Little_Bourke_Street,_Melbourne.jpg' },
  { title: 'Solex 99 30 padlock with keys', by: 'Trougnouf', licence: 'CC BY 4.0', href: 'https://commons.wikimedia.org/w/index.php?curid=65582711' },
  { title: 'Safe deposit boxes in Japan', by: 'Asanagi', licence: 'CC0', href: 'https://commons.wikimedia.org/w/index.php?curid=160364429' },
  { title: 'Person facing a misty sea', by: 'Patryk Sobczak', licence: 'Unsplash licence', href: 'https://unsplash.com/' },
  { title: 'RMIT University logo', by: 'RMIT University', licence: 'public domain, trademark of RMIT', href: 'https://commons.wikimedia.org/wiki/File:RMIT_University_Logo.svg' },
  { title: 'Person in fog', by: 'Luke Pamer', licence: 'Unsplash licence', href: 'https://unsplash.com/' },
]

function Footer() {
  return (
    <footer className="lp-footer">
      <div className="lp-footer-mark" aria-hidden>
        <svg viewBox="0 0 220 260">
          <path d="M50 120V78a60 60 0 0 1 120 0v42" fill="none" stroke="#e8e8f4" strokeWidth="26" />
          <rect x="0" y="124" width="220" height="136" fill="#e8e8f4" />
          <circle cx="70" cy="192" r="30" fill="#e60028" />
          <circle cx="150" cy="192" r="30" fill="#000054" />
        </svg>
        <p className="lp-footer-name">SafeThreshold</p>
      </div>

      <div className="lp-footer-body">
        <div className="lp-footer-about">
          <p className="lp-footer-slogan">Escrow your report. It opens when you have allies.</p>
          <img className="lp-footer-rmit" src={`${IMG}/rmit-logo-white.svg`} width={125} height={44} alt="RMIT University" />
          <p className="lp-disclaimer">
            A student prototype built for RMIT Hackathon 2026, Challenge 2, by team Me &amp; the Bums. It is not an official RMIT
            University service; to report misconduct today, use RMIT's own channels.
          </p>
        </div>

        <div className="lp-footer-cols">
          <div>
            <h3>SafeThreshold</h3>
            <ul>
              <li><a href="#how-it-works">How it works</a></li>
              <li><a href="#tidecloak">About TideCloak</a></li>
              <li><Link href={ROUTES.signIn}>File a report</Link></li>
            </ul>
          </div>
          <div>
            <h3>Demo views</h3>
            <ul>
              <li><Link href={ROUTES.signIn}>Reporter</Link></li>
              <li><Link href={ROUTES.admin}>IT admin</Link></li>
              <li><Link href={ROUTES.quorum}>Steward quorum</Link></li>
              <li><Link href={ROUTES.audit}>Public audit log</Link></li>
            </ul>
          </div>
          <div>
            <h3>Sign in</h3>
            <ul>
              <li><Link href={SIGN_IN_STUDENT}>Students</Link></li>
              <li><Link href={SIGN_IN_STAFF}>Staff</Link></li>
            </ul>
          </div>
          <div>
            <h3>Safety</h3>
            <ul>
              <li>Press Esc to leave at once</li>
              <li>Nothing is saved on this device</li>
            </ul>
          </div>
        </div>
      </div>

      <p className="lp-credits">
        Photographs:{' '}
        {CREDITS.map((c, i) => (
          <span key={c.title}>
            <a href={c.href} target="_blank" rel="noreferrer noopener">{c.title}</a> by {c.by}, {c.licence}
            {i < CREDITS.length - 1 ? '; ' : '.'}
          </span>
        ))}
      </p>

      <div className="lp-footer-last">
        <span>© 2026 SafeThreshold prototype</span>
        <Link href={ROUTES.signIn} className="lp-btn lp-btn--accent lp-nav-cta">
          File a report
        </Link>
      </div>
    </footer>
  )
}
