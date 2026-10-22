# CLAUDE.md

## Project

SafeThreshold: anonymous escrow platform for misconduct reports (RMIT Hackathon 2026, Challenge 2, team Me & the Bums). A report stays encrypted until at least two independent reports target the same subject; then a quorum of stewards releases the key and an independent investigator reads the files. See [README.md](README.md) for the full pitch.

## Layout

- `frontend/`: React + TypeScript + Vite + Tailwind v4 + shadcn/ui (`npm run dev | build | lint | test`). `src/escrow/` is the escrow engine; `src/portals/` the three portals and the audit log.
- `backend/`: server code; `database/database.ts` and `database/migration`. No run script yet.
- `.env` / `.env.example`: Supabase variables. Never commit `.env`.

## Security invariants (do not break)

1. Encrypt on the client, before anything is sent. The server, admin and AI never see plaintext and never hold a full decryption key.
2. Decryption only happens through TideCloak's steward quorum (e.g. 2/3 or 3/5). Never add a backend path, admin override or debug flag that decrypts a report.
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

## TideCloak rules (details in [docs/tidecloak.md](docs/tidecloak.md))

- Never generate, assemble, store or export a whole key for Tide operations (I-01). Every key operation needs T or more nodes (I-02).
- Reports use **policy-governed VVK encryption** (`IAMService` + signed Forseti policy), not self-encryption: self-encrypted data can only be decrypted by its author.
- Custom Forseti contracts are written and compile-checked here but deployed by the Tide team. Never upload one.
- IGA governs admin changes (roles, stewards). Its quorum is separate from the steward release quorum.
- With IGA on, a `2xx` means accepted, not applied. Verify state after every admin mutation.
- The frontend `escrow/` simulation is a stand-in for the node network. Don't ship it as the production key path.
- Realm setup order is licence → IGA → E2EE. Licence email, terms agreement and hosting choice (Docker or Skycloak) are the team's decisions.

## Conventions

- TypeScript strict. React function components, PascalCase component files, camelCase for everything else.
- Keep changes small and focused; imperative commit messages.
- Tests: Vitest in `frontend/` (`npm test`). When adding logic around matching, withdrawal or expiry, add a test in `src/escrow/*.test.ts`.

## Open questions

Cold-start pilot, steward selection and rotation, proof-of-human that preserves anonymity, legal responsibility after decryption.
