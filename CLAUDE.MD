# CLAUDE.md

## Project

SafeThreshold: anonymous escrow platform for misconduct reports (RMIT Hackathon 2026, Challenge 2, team Me & the Bums). A report stays encrypted until at least two independent reports target the same subject; then a quorum of stewards releases the key and an independent investigator reads the files. See [README.md](README.md) for the full pitch.

## Layout

- `frontend/`: React + TypeScript + Vite + Tailwind v4 + shadcn/ui (`npm run dev | build | lint | test`). `src/escrow/` holds the browser crypto (AES-GCM, Shamir, key wrapping) and the reporter API client; `src/portals/` the three portals and the audit log.
- `backend/`: Express API (`npm run dev`, port 3000); SQL in `src/database/migration` (001 to 008, run in the Supabase SQL editor).
- Repo root: `npm run dev` starts both.
- `.env` / `.env.example`: Supabase variables. Never commit `.env`.

## Security invariants (do not break)

1. Encrypt on the client, before anything is sent. The server, admin and AI never see plaintext and never hold a full decryption key.
2. Decryption only happens with a quorum of steward-held Shamir shares (e.g. 2 of 3), re-wrapped on the stewards' devices to the assigned investigator. Never add a backend path, admin override or debug flag that decrypts a report or holds an unwrapped share or key.
3. Matching uses a blinded token from the subject (identifier + normalised name + unit). The token is used only for matching and must never be returned to clients, logged or exposed. It must resist collisions and dictionary attacks (keyed/salted, not a plain hash).
4. The reporter can withdraw before the threshold: delete the ciphertext and its token completely. After the threshold, withdrawal is restricted.
5. Reports expire after 12–18 months (configurable). Expired ciphertext without a threshold is permanently deleted.
6. Reporter identity stays anonymous unless they choose to reveal. Do not log IPs, user identifiers or content alongside reports.
7. The audit log is public but contains no report content.
8. Enforce authorization on the server. UI-only checks don't count.
9. Never hardcode secrets, keys or admin passwords; use `.env`.

## Domain terms

- **Sealed report**: ciphertext plus blinded token.
- **Eligible case**: two or more independent matching tokens.
- **Steward**: independent approver (Student Union, NGO, oversight body); 3–5, rotatable.
- **Investigator**: independent party who receives decrypted files.

## Key custody rules (details in [docs/key-custody.md](docs/key-custody.md))

- Each report gets a fresh AES-256-GCM key in the reporter's browser. It is split with Shamir (quorum_m of one share per active steward) and each share is wrapped (ECDH P-256 + HKDF + AES-GCM) to one steward's public key. The server stores ciphertext and wrapped shares only.
- Stewards and investigators hold their private key in their browser (non-extractable) plus a passphrase-wrapped backup on the server. Neither the passphrase nor the key ever reaches the server.
- Release order: the case is eligible, an admin assigns one investigator, each steward unwraps and re-wraps their shares to that investigator, and the case releases at quorum_m approvals (`steward_approve`).
- Sign-in is Supabase Auth. A role is an active row in `stewards` / `investigators` / `org_admins`, checked server-side by `has_role`, never a token claim. Reporters have no account.
- Admin changes need an admin quorum (`max(1, floor(0.7 × admins))`), separate from the steward quorum. A 2xx means accepted; re-read state.
- `tide_user_id` columns and `p_tide_user` params in the SQL hold the Supabase user id (kept to avoid rewriting old migrations).

## Conventions

- TypeScript strict. React function components, PascalCase component files, camelCase for everything else.
- Keep changes small and focused; imperative commit messages.
- Tests: Vitest in `frontend/` (`npm test`). When adding logic around matching, withdrawal, expiry, sharing or key wrapping, add a test in `src/escrow/*.test.ts`.

## Open questions

Cold-start pilot, steward selection and rotation, proof-of-human that preserves anonymity, legal responsibility after decryption.
