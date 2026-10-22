[![Built with TideCloak](https://tide.org/badges/built-with-tidecloak.svg)](https://tide.org/tidecloak?utm_source=github&utm_medium=readme&utm_campaign=unlocked)

# SafeThreshold

SafeThreshold is an anonymous escrow platform for reporting misconduct. A report stays sealed until at least two independent people report the same subject. No school, IT admin or AI can open a single report on its own.

Built with [TideCloak](https://tide.org/tidecloak?utm_source=github&utm_medium=readme&utm_campaign=unlocked). Team *Me & the Bums*, RMIT Hackathon 2026, Challenge 2.

## 1. Vision & originality

SafeThreshold is a "sealed report escrow". A report is encrypted and held until a second, independent report about the same person appears. Only then is the full file decrypted and handed to an independent investigator.

The core idea is that nobody stands alone. The first reporter is fully protected from exposure and retaliation until there is collective evidence.

## 2. Trust constraint insight

People who are harassed, bullied or abused by someone with power fear three things:

- Their identity being exposed.
- Retaliation.
- The report being buried, or read in secret, by the organisation they are reporting.

Traditional channels (internal forms, hotlines, vendor software) share one weakness: whoever runs the system holds the keys or has full backend access. They can read, filter, delete or delay any report.

SafeThreshold removes that control. No server, admin or AI ever holds a decryption key.

## 3. Value & impact

- A student harassed by a lecturer can report without being exposed until a second person comes forward.
- If nobody else reports the same subject, the report stays sealed forever or is deleted.
- When a second report arrives, both files open together and go to an independent investigator.
- Repeat offenders are found earlier, before they harm more people.
- It can extend to student-to-student, staff-to-leadership, and other hierarchical organisations (hospitals, NGOs, companies).

## 4. Why TideCloak matters

With a normal login plus backend, the admin is the trust hole. TideCloak splits the decryption key across Tide's node network, and the key is never assembled on any single machine. Decryption is only authorised through a quorum of stewards, and the network verifies their signatures itself.

## 5. How it works

| Mechanism | Behaviour |
|---|---|
| Client-side encryption | The report is encrypted on the user's device before it is sent. |
| Anonymous matching | Each report produces a blinded token from the subject's identifier, normalised name and unit. The token is only used for matching and is never exposed. Two matching tokens make the case *eligible*. |
| Withdrawal | The reporter can delete their report completely before the threshold. After it, withdrawal is not possible (or limited to removing personal identity details). |
| Expiry | Reports live at most 12–18 months. If the threshold isn't reached, the ciphertext is permanently deleted. |
| Steward quorum | The key is shared across nodes. Only a quorum of independent stewards (e.g. 2/3 or 3/5) can release it. Stewards never see the content before decryption. |

### Design decisions

| Item | Decision | Notes |
|---|---|---|
| Matching | Blinded token from subject identity | Needs collision and dictionary-attack resistance |
| Withdrawal | Free before threshold, restricted after | |
| Retention | 12–18 months | Configurable per organisation |
| Stewards | 3–5, chosen by the organisation, can rotate | Student Union + NGO + oversight body |
| Admin / server | Never holds plaintext or a full key | |
| Reporter identity | Anonymous until they choose to reveal | |

## 6. Prototype & demo (adversarial storytelling)

1. Student A submits a sealed report. An IT admin dumps the whole database and sees only ciphertext.
2. The admin tries to forge an approval, bribe one steward and self-promote. Every node rejects it.
3. Student B submits a report. The blinded tokens match and the case becomes *eligible*.
4. Once 2/3 of stewards approve, the nodes release the key. The investigator reads both reports at once.
5. A steward stalls. The system keeps waiting for quorum and nobody can force it.
6. Student A withdraws before the threshold. Their token disappears and the case is no longer eligible.

## 7. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Cold start (no second report, trust is lost) | Pilot in a small community with a strong student union and a clear campaign |
| Steward influence | Quorum, periodic rotation, public audit log (no content) |
| False matching | Blinded tokens plus a light review after decryption |
| Fake reports | Rate limiting and light proof-of-human, keeping anonymity |
| Legal and sensitive data storage | Store ciphertext only, automatic deletion policy, clear responsibility after decryption |

## Repository layout

```
backend/    Server code and database (database/database.ts, database/migration)
frontend/   React + TypeScript + Vite app
.env.example  Required environment variables
```

## Setup

Requirements: Node.js, a Supabase project, and a TideCloak realm.

1. Copy the env template and fill it in:

   ```bash
   cp .env.example .env
   ```

   Variables: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `SUPABASE_JWKS_URL`.

2. Run the frontend:

   ```bash
   cd frontend
   npm install
   npm run dev
   ```

Other frontend scripts: `npm run build`, `npm run lint`.

The backend has no run script yet.
