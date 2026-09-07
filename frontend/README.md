# Saathi — frontend

React PWA for the SIH 2026 (PS 94, MoSJE) distress-monitoring system. Two
audiences, two deliberately different experiences, one codebase.

## Running

```bash
cd frontend
npm install
cp .env.example .env      # then fill in the two UUIDs
npm run dev               # http://localhost:5173
```

The backend must be running separately (`uvicorn app.main:app --reload` from
`backend/`). It already allows all CORS origins in development.

`VITE_DEMO_PERSON_ID` and `VITE_DEMO_OFFICER_ID` must be real UUIDs from the
seed scripts — see [docs/api-contract.md](docs/api-contract.md#identities).

| Script | |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Production build + service worker |
| `npm run preview` | Serve the build |
| `npm run lint` | oxlint |
| `node scripts/generate-icons.mjs` | Regenerate PWA icons |

## The two experiences

The split is enforced by layout, palette and routing — not by convention.

**Victim-facing** (`/`, `/check-in`) — `VictimLayout`, `.theme-victim`.
Warm off-white ground, generous spacing, no navigation chrome, no branding
lockup. **No score, band or clinical language is ever rendered here.** The
check-in response carries `score` and `band`; the conversation hook drops them
on purpose. Showing someone their own distress score turns a conversation into
an assessment.

**Officer-facing** (`/officer/*`) — `OfficerLayout`, `.theme-officer`.
Cooler neutral ground, persistent nav, denser type, built for scanning.

Both palettes are CSS custom properties swapped by a single class, so Tailwind
utilities (`bg-canvas`, `text-muted`, `bg-accent`) resolve differently per
shell without duplicated classes. See `src/index.css` and `tailwind.config.js`.

Risk band colours are shared across both shells so a colour never means two
things, and are kept non-alarming — soft green, soft amber, warm orange, muted
red. Defined once in `src/index.css`, consumed via `src/lib/bands.js`.

## Layout

```
src/
  api/          client.js (fetch wrapper, ApiError) + endpoints.js (one fn per route)
  components/ui Button, BandPill, States (loading/error/empty)
  hooks/        useCheckinConversation, useVoiceInput
  layouts/      VictimLayout, OfficerLayout
  lib/          bands.js (band + severity vocabulary), format.js (UTC-safe dates)
  pages/
    victim/     WelcomePage, CheckinPage + components/
    officer/    DashboardPage, CaseDetailPage, AlertReviewPage
  config.js     env-derived runtime config
docs/           api-contract.md  ← read this before touching src/api
```

## Status

Built: project setup, design system, API layer, app shell, and the
victim-facing welcome + check-in screens (text and voice, chatbot replies,
crisis/safety handoff, retry on failure).

Not yet built: the three officer screens. They are routed and reachable, with
placeholders that name what each one needs.

**They are no longer blocked.** The three backend gaps are closed: `GET /people`
lists cases filterable by district and state, `/officers/{id}/alerts` now
carries `person_id` / `pseudonym` / `district` / `band`, and `POST /checkin/audio`
accepts uploaded audio. See [docs/api-contract.md](docs/api-contract.md).

One piece of frontend work fell out of that: `src/hooks/useVoiceInput.js` still
transcribes in-browser and posts `channel: "chat"`, which leaves
`components.voice_stress` at 0. It should post the recorded blob to
`/checkin/audio` instead, so the real wav2vec2 model runs. The check-in response
can also now include an optional `support_offer` — dismissible talk/SMS buttons
shown once when someone enters the elevated band — which the UI does not render
yet.

## Privacy notes

- The service worker precaches the app shell only. API responses are never
  cached to disk — check-in content is personal data.
- `robots: noindex, nofollow` and `referrer: no-referrer` are set.
- `GET /people/{id}/history` writes an audit row on every read, so
  `accessed_by` is always the real viewer's id, never a placeholder.
