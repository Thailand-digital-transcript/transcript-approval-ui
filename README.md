# Transcript Approval UI

Registrar / dean single-page application for the
[Thai ETDA Digital Transcript](../CLAUDE.md) platform. Built with React 19,
Vite 8, TanStack Query, react-router 7, and Keycloak-js. The SPA consumes
the orchestrator's `/api/v1/...` REST surface to drive the approval flow:

- **Queue** — the pending batches for the caller's gate (`PENDING_REGISTRAR`
  or `PENDING_DEAN`), derived from the Keycloak `registrar` / `dean` realm
  role.
- **Batch detail** — the audit header + sealed transcript XML for one
  batch, plus the approve / reject decision dialog. After a successful
  decision, the page polls the batch until it leaves the pending gate.
- **Monitor** — paginated, gate-agnostic list of every batch in the
  system (operations view).

## Quick start

```bash
npm install
cp .env.example .env       # see "Environment variables" below
npm run dev
```

`npm run dev` boots Vite on `http://localhost:5173`. The Vite dev server
proxies `/admin` and `/ai` to `localhost:8080` / `localhost:8081`; the
SPA's own REST calls go directly to `VITE_API_BASE_URL` (default
`http://localhost:8095`, the orchestrator).

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server on `http://localhost:5173` with HMR. |
| `npm run test` | Vitest in watch mode (interactive). |
| `npm run test -- --run` | Vitest in CI mode (one-shot, no watch). |
| `npm run build` | TypeScript project build + Vite production bundle to `dist/`. |
| `npm run lint` | ESLint over `**/*.{ts,tsx}`. |
| `npm run preview` | Serve the production build from `dist/` for local sanity-checking. |

## Tests

`npm run test -- --run` runs the Vitest suite (9 files, **32 tests**,
~14 s). The suites are MSW-backed: `src/test/mocks/handlers.ts` defines
the in-test HTTP stubs, and the pages and API client exercise them
end-to-end. Notable test files:

- `src/api/batches.test.ts` — API client + error mapping
- `src/lib/roles.test.ts` — role-to-gate resolution
- `src/lib/transcript-xml.test.ts` — ETDA XML parser (handles `ds:Signature`)
- `src/auth/AuthProvider.test.tsx` — `VITE_AUTH_DISABLED` mock path
- `src/components/DecisionDialog.test.tsx` — approve / reject validation
- `src/pages/QueuePage.test.tsx` — gate toggle + no-role fallback
- `src/pages/BatchDetailPage.test.tsx` — decision POST + 409 toast
- `src/pages/MonitorPage.test.tsx` — pagination + empty / error / loading
- `src/components/TranscriptView.test.tsx` — parsed-transcript render +
  malformed-XML fallback

## Environment variables

The app reads only `VITE_*` keys (Vite inlines them at build time).
Defaults match the local dev topology in `e2e-harness/docker-compose.yml`.

| Key | Default | Purpose |
| --- | --- | --- |
| `VITE_API_BASE_URL` | `http://localhost:8095` | Orchestrator base URL. The SPA's `/api/v1/batches` and `/api/v1/transcripts/:id/content` calls go here. |
| `VITE_KEYCLOAK_URL` | `http://localhost:8080` | Keycloak base URL (realm auth server). |
| `VITE_KEYCLOAK_REALM` | `transcript` | Realm name. Must match the imported realm. |
| `VITE_KEYCLOAK_CLIENT_ID` | `transcript-approval-ui` | Public client ID. Must match the client in the realm export. |
| `VITE_AUTH_DISABLED` | `false` | Dev/test escape hatch. When `true`, `AuthProvider` skips Keycloak and authenticates with a fake token. **Hard-fails in production builds** — see the "PROD guard" note below. |
| `VITE_MOCK_ROLES` | (unset) | Comma-separated roles granted to the mock user when `VITE_AUTH_DISABLED=true` (e.g. `registrar,dean`). |
| `VITE_MOCK_INSTITUTION` | (unset) | `institution_code` claim for the mock user, used to exercise the per-institution scoping. |

### `VITE_AUTH_DISABLED` PROD guard

`src/auth/AuthProvider.tsx` throws synchronously at module load when
`VITE_AUTH_DISABLED === 'true'` is set in a `PROD` (production) build:

```ts
if (
  import.meta.env.VITE_AUTH_DISABLED === 'true' &&
  import.meta.env.PROD
) {
  throw new Error('VITE_AUTH_DISABLED must not be set in production builds');
}
```

This is intentional: a misconfigured production build must **hard-fail**
at startup, not silently bypass authentication. Leave the key unset (or
set it to `false`) for any deployment that is not a local dev / test
sandbox.

## Keycloak dev realm

`keycloak/realm-export.json` is a Keycloak 24+ realm export for the
`transcript` realm. It contains:

- Realm roles: `registrar`, `dean`.
- A public PKCE client `transcript-approval-ui`
  (`publicClient: true`, `standardFlowEnabled: true`, no client secret,
  redirect URIs `http://localhost:5173/*` and `http://localhost:5173/`,
  web origins `+`).
- Two client protocol mappers:
  - a `User Attribute` mapper copying the user's `institution_code`
    attribute into the access/ID token (read by `AuthProvider` as
    `tokenParsed.institution_code`);
  - a `User Realm Role` mapper emitting the user's realm roles as the
    multivalued `realm_access.roles` claim (read by `AuthProvider` as
    `tokenParsed.realm_access.roles`). Without this mapper the standard
    `roles` scope is absent and roles never populate.
- Three demo users — `registrar1` (role `registrar`, institution
  `acme-uni`), `dean1` (role `dean`, institution `acme-uni`), and
  `dual1` (both roles, institution `globex-edu`) — for exercising the
  single-queue, dual-queue, and no-approver-role code paths.

**This realm is dev-only.** The client carries **no client secret** (it is a
public PKCE client). The three demo users **intentionally ship with seed
password credentials** (bcrypt hashes in `credentials[]`) so the realm is
usable for local login the moment it is imported — this is a deliberate,
reviewed dev-convenience choice, not an oversight, and is the one knowing
exception to the "no `credentials`" guidance in the build plan. Production
realms (and their users) are configured out-of-repo (operator-managed). **Do
not import `realm-export.json`, or reuse its seed users, in any realm that is
not a throwaway dev / test sandbox** — copying it elsewhere seeds accounts
with known passwords.

### Importing into a local Keycloak

```bash
# Keycloak 24+ (start --optimized or start-dev both work)
bin/kc.sh import --file keycloak/realm-export.json
# ...then start the server:
bin/kc.sh start-dev
```

On first start the realm will be present at `http://localhost:8080/realms/transcript`.
The demo users' passwords are seed bcrypt hashes embedded in the export (see
the dev-only note above); the `credentials` list in the file is the single
source of truth for local dev. To rotate a demo password, reset it in the
Keycloak Admin UI (or via `kcadm.sh set-password`) after import — do not commit
real passwords.

## Fixtures

`src/test/fixtures/Transcript_v2.0.xml` is a real ETDA v2.0 sample used
by the parser tests. To refresh it from the upstream `transcript-lib`
canonical fixture, run:

```bash
./scripts/sync-fixtures.sh
```

The script reads `TRANSCRIPT_LIB` (default `../transcript-lib`) and
copies `src/main/resources/transcript/example/Transcript_v2.0.xml` into
`src/test/fixtures/`. Run it whenever the upstream fixture changes; it
is **not** invoked by `npm test` or `npm run build`.

## Architecture

- **Routing** — `react-router-dom` v7 with three routes:
  `/queue` (B9 `QueuePage`, default landing), `/batches/:id` (B10
  `BatchDetailPage`), and `/monitor` (B11 `MonitorPage`). The
  `AuthGuard` wrapper redirects unauthenticated users to the Keycloak
  login flow; `AppNav` exposes the routes.
- **Data** — TanStack Query (`@tanstack/react-query`) with
  `staleTime: 30_000` and `retry: false`. The query keys are
  `['batches', 'queue', gate]`, `['batch', id]`, and
  `['batches', 'all', page]`. `BatchDetailPage` switches its
  `refetchInterval` to 2 s after a successful decision POST and stops
  polling when the batch leaves the pending gate.
- **Auth** — `AuthProvider` wraps `keycloak-js` with
  `onLoad: 'check-sso'` + PKCE S256, and a `VITE_AUTH_DISABLED` mock
  path for Vitest. `useAuth()` exposes `{ token, isAuthenticated,
  isLoading, roles, institutionCode, login, logout }`. The PROD guard
  at the top of the file is the only thing above the imports.
- **UI** — shadcn/ui components under `src/components/ui/` (Radix
  primitives + Tailwind v4), composed by the page-level components
  (`QueueTable`, `TranscriptView`, `DecisionDialog`,
  `BatchStatusBadge`, `ErrorToast`, `AppNav`).
- **XML parsing** — `src/lib/transcript-xml.ts` parses the ETDA v2.0
  schema with `DOMParser`. The parser tolerates a `ds:Signature` block
  (the test suite pins this behavior) and falls back to a
  "transcript content unavailable" view with a download link when the
  XML is malformed.

## Backend

The SPA is read-only against the orchestrator except for the decision
endpoint. Endpoints consumed:

| Method | Path | Used by |
| --- | --- | --- |
| `GET` | `/api/v1/batches?status=<GATE>` | `QueuePage` — registrar / dean queue. |
| `GET` | `/api/v1/batches?page=&size=` | `MonitorPage` — paginated, all-gates. |
| `GET` | `/api/v1/batches/{id}` | `BatchDetailPage` — audit header + items. |
| `POST` | `/api/v1/batches/{id}/decision` | `BatchDetailPage` — approve / reject. |
| `GET` | `/api/v1/transcripts/{id}/content` | `BatchDetailPage` — sealed XML. |

The orchestrator (Spring Boot, port 8095) is the source of truth for
approver-side authorization. The SPA does not enforce role gating in
the UI; it only routes the user to the right queue. Decisions are
authorized by the orchestrator's `CallerContext`, which reads the
`registrar` / `dean` realm role + the `institution_code` claim from
the JWT issued by the `transcript` realm.

## Development conventions

- **Do not** add `Co-Authored-By:` (or any co-author attribution) to
  commit messages — see the root `CLAUDE.md` for the workspace-wide
  rule.
- `dist/`, `node_modules/`, `.env`, `CLAUDE.md`, `.claude/`, and
  `docs/superpowers/` are gitignored — they stay local.
- `src/components/ui/*` carries the four pre-existing
  `react-refresh/only-export-components` lint errors. They are shadcn
  scaffold leftovers (helper exports co-located with component
  exports) and are out of scope for feature work. `npm run lint` will
  continue to report them.
- The `transcript` realm export and this `README.md` are the only
  documentation / config files committed at the repo root; everything
  else lives under `src/`.
