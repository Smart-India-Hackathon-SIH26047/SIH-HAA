# SIH 2026 — PS 94: AI-Powered Dynamic Mental Health Monitoring and Distress Prediction System

**Ministry of Social Justice and Empowerment** · Deadline: 20 September 2026

A system that runs periodic wellbeing check-ins (chat, voice, SMS, web) with victims registered under the SC/ST (Prevention of Atrocities) Act, 1989, and produces a transparent **Dynamic Distress Score** that alerts a counsellor or district officer when risk crosses a threshold — with a plain-language explanation and a human who always makes the final call.

---

## Repository layout

```
backend/     FastAPI service — API, scoring engine, ML inference
  app/
    routes/          HTTP endpoints
    business_logic.py  scoring engine, bands, consent, alerts
    ml_services.py     model loading and inference
    chatbot.py         conversational AI, crisis detection, safety filters
  tests/             test suite (SQLite, no Postgres needed)
frontend/    React PWA — victim check-in and officer console
  src/
    pages/victim/    check-in, status, support
    pages/officer/   case list, case detail, alert review
    i18n/            English and Hindi strings
  docs/              API contract and auth setup
ml/          ML runtime dependencies (torch, transformers, whisper, librosa)
models/      Model weights (Git LFS)
```

---

## Quick start

Two processes: the API on `:8000`, the web app on `:5173`.

```bash
# 1. Backend
cd backend
python -m venv venv
venv\Scripts\activate                  # Windows
pip install -r requirements.txt
pip install -r ../ml/requirements.txt  # torch, transformers, whisper, librosa
# create backend/.env (see below), then:
python -m uvicorn app.main:app --reload

# 2. Frontend, in a second terminal
cd frontend
npm install
cp .env.example .env                   # fill in the values, see below
npm run dev
```

Open **http://127.0.0.1:5173**.

The backend loads three models at startup, so the first boot takes 30–60 seconds before it answers.

---

## Configuration

**`backend/.env`**

```
DATABASE_URL=<Supabase Postgres connection string>
GEMINI_API_KEY=<key from aistudio.google.com/apikey>
```

Optional: `SUPPORT_CALL_NUMBER`, `SUPPORT_SMS_NUMBER`, `SUPPORT_OFFER_COOLDOWN_HOURS`, `GEMINI_MODEL`.
`SUPPORT_SMS_NUMBER` has **no default on purpose** — the SMS option is hidden entirely until a real, monitored number is set, because an unanswered number shown to someone in distress is worse than none.

**`frontend/.env`**

```
VITE_API_BASE_URL=http://127.0.0.1:8000
VITE_DEMO_PERSON_ID=<a people.id UUID>
VITE_DEMO_OFFICER_ID=<an officers.id UUID>
VITE_SUPABASE_URL=<project URL>          # authentication only
VITE_SUPABASE_ANON_KEY=<anon key>
VITE_REQUIRE_LOGIN=false                 # optional: demo mode, no password
```

Both `.env` files are gitignored. Never commit them.

**Model files** (Git LFS — `*.pt` and `*.safetensors`, pulled by `git lfs pull`):

```
models/
  indicbert_5000/    text emotion (config, weights, tokenizer)
  speech_emotion/best_model.pt   voice stress
  whisper/base.pt                speech-to-text
```

**System dependency: `ffmpeg` must be on PATH** — not just the Python package. Whisper and librosa both shell out to it for any container that is not a plain `.wav`, including the `.webm` a browser records. `winget install ffmpeg` on Windows, then add its `bin` to PATH.

**First-time database setup:**

```bash
python reset_tables.py          # WARNING: drops every table first
python seed_officers.py         # 4 test officers
python seed_synthetic_cases.py  # 5 synthetic case timelines
```

`reset_tables.py` calls `drop_all()` before `create_all()`. Never run it against a database that already holds real data.

---

## Backend

### Backend tech stack

| Layer | Technology |
|---|---|
| API framework | FastAPI |
| Database | PostgreSQL, hosted on Supabase (shared across the team) |
| ORM | SQLAlchemy |
| Speech-to-text | Whisper (local, `openai-whisper`) |
| Text emotion | IndicBERTv2 (fine-tuned, BERT-based) |
| Voice stress | Custom fine-tuned `wav2vec2-base` classifier (6 emotion classes) |
| Conversational AI | Google Gemini API (`gemini-3.6-flash`), via `google-genai` |

### API endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `/checkin` | POST | Text check-in — runs the full pipeline |
| `/checkin/audio` | POST | Voice check-in — **multipart** audio upload |
| `/people` | GET | Case list, filterable by `district` / `state` |
| `/people/anonymous` | POST | Register a case with no identifying details |
| `/people/{id}/history` | GET | Check-ins, scores, case events, alerts |
| `/case-events` | POST | Log a case event (hearing, delay, threat, compensation) |
| `/officers/{id}/alerts` | GET | Open alerts, role-filtered (district/counsellor/admin) |
| `/alerts/{id}/acknowledge` | POST | Officer agrees/disagrees, with a reason |
| `/consent` | POST | Set or revoke a person's typed consent |
| `/support-contacts` | GET | Configured helpline numbers, so clients never hardcode one |

The full contract, including response shapes and the non-obvious rules, is in
**[`frontend/docs/api-contract.md`](frontend/docs/api-contract.md)**. Read it before writing a client.

### `/checkin` pipeline

1. **Transcription** — `/checkin/audio` writes the upload to a temp file and Whisper transcribes it. (`/checkin` with `channel: "voice"` expects a path to a file on the *server's* disk and predates the upload route; browsers must use `/checkin/audio`.)
2. **Crisis check** — runs first, before any LLM call and before scoring. If it fires, scoring is **skipped entirely** and the response is a `safety_flag` with no fabricated score, carrying real helpline numbers (Tele-MANAS 1860-445-4435, Emergency 112).
3. **Conversational reply** — Gemini generates the next message, system-prompted to be gentle and non-diagnostic and never to give legal, medical or financial advice. An output safety filter re-checks the reply before it is returned.
4. **Scoring** — the Dynamic Distress Score, from six weighted, named components:

| Component | Weight | Source |
|---|---|---|
| Expressed distress | 0.25 | IndicBERTv2 (ML) |
| Voice stress | 0.15 | Custom wav2vec2 model (ML) |
| Engagement change | 0.20 | Computed from check-in history |
| Case-event pressure | 0.20 | Computed from case events |
| Reported external stressors | 0.10 | Keyword extraction from transcript |
| Trajectory | 0.10 | Computed from score history |

Only two of six components are ML-driven — the system degrades gracefully if a model is unavailable.

5. **Response** — one of two shapes:
   - **`type: "score"`** — score, band (`stable`/`watch`/`elevated`/`priority`), per-component breakdown, and the chatbot's `next_message`. May also carry `ai_available: false` (the reply is a stand-in because the model was unreachable), `support_offer` (see below), and `transcript` on the audio route.
   - **`type: "safety_flag"`** — no score at all, just helpline info and a plain-language reason.

**Clients must branch on `type` and never assume a score exists.**

### Crisis detection

Two tiers, both ahead of the LLM and the scoring engine:

- **Explicit patterns**, matched on word boundaries. Plain substring matching both over- and under-fired: `"in danger"` matched *"the crops are in danger"*, while `"suicide"` did **not** match *"I am suicidal"*.
- **A net** — if the message is about the speaker *and* about dying, it fires whatever the sentence shape, because no list of phrasings is ever complete. Everyday expressions are stripped first, so *"my phone died"* and *"dying to see you"* stay quiet.

Covered by 42 must-fire and 15 must-not-fire phrases in the test suite. One false positive is kept deliberately and commented: over-firing is the right way to be wrong here.

### Score-gated support offer

Separate from, and subordinate to, the crisis path. When a check-in **enters** the elevated or priority band, the response carries an optional `support_offer` — dismissible talk/SMS buttons. It is gated on the classifier's own bands rather than a duplicated threshold, and suppressed for a cooldown window, because per-message scoring makes the band oscillate within a single conversation.

### Design principles

| Principle | Where it lives in the code |
|---|---|
| Explainable by construction | Each of the six score components stored as its own column |
| The system flags, humans decide | Alert acknowledge endpoint; `officer_decision`, `officer_reason` |
| Graceful degradation | Only two of six components are ML-driven |
| Consent before processing | Consent gate runs before scoring — hard stop, typed and revocable per purpose |
| Protected attributes never score | Caste, religion, tribe, ethnicity explicitly rejected at the scoring boundary |
| Crisis content is escalated, never scored | Dedicated safety pathway; a distinct response type carrying no score |
| The person never sees their own score | Scores and bands render on the officer side only |

**Legal and ethical framework grounding:** K.S. Puttaswamy v. Union of India (2017) · UN Declaration of Basic Principles of Justice for Victims (1985) · Digital Personal Data Protection Act, 2023 · SC/ST (Prevention of Atrocities) Act, 1989 · Witness Protection Scheme, 2018

### Database schema

Seven tables: `people`, `officers`, `checkins`, `scores`, `case_events`, `alerts`, `access_log`. Every enum-like column (case phase, channel, band, severity, status) is constrained at the database level — invalid values are rejected by PostgreSQL itself, not only by application code.

People are stored under a **pseudonym**, never a name. No phone number or email is held for anyone, which is why officer-side contact actions reach the support line rather than the person.

### Tests

```bash
cd backend
python -m tests.test_alerts
python -m tests.test_people_list
python -m tests.test_checkin_audio
python -m tests.test_chatbot_behaviour
```

126 assertions. They run against **SQLite in memory** with the real `business_logic`, `engine` and `helpers` — only model inference and the Gemini call are stubbed — so no Postgres, no API key and no model files are needed, and the whole suite finishes in seconds.

---

## Frontend

A React PWA with two deliberately different experiences behind one login.

### Frontend tech stack

| Layer | Technology |
|---|---|
| Build | Vite |
| UI | React 19, Tailwind CSS |
| Routing | react-router |
| Charts | Recharts |
| Auth | Supabase Auth (authentication only — all case data comes from the FastAPI backend) |

### The two experiences

**Victim-facing** (`/`, `/check-in`, `/status`, `/support`) — warm, uncluttered, no navigation chrome competing with the conversation. The animated orb reflects what is actually happening: listening, thinking, speaking, error. **No score, band or clinical language appears anywhere on this side.** The check-in response contains them; the UI drops them on purpose, because showing someone their own distress score turns a conversation into an assessment.

**Officer-facing** (`/officer/*`) — denser and built for scanning. Case list with band, score and last-scored time, filterable by district and state, sorted most-urgent-first with unscored people last rather than hidden. Per-case call and SMS actions read their numbers from `/support-contacts`.

### Voice input

Two paths, chosen automatically:

- **Live transcription** where the browser's `SpeechRecognition` works (Chrome/Edge only) — words appear as you speak.
- **Recording** everywhere else, uploaded to `/checkin/audio` and transcribed server-side by Whisper. This path also runs the wav2vec2 model over the real audio, so `voice_stress` is a genuine measurement rather than 0.

Browser speech recognition is a *cloud* service, and on some networks it opens a session and never returns anything at all — no result, no error. That is detected after a few seconds and falls back to recording automatically.

### Languages

Full English and Hindi across every screen, with a switch in each header. The choice is remembered, defaults to Hindi when the browser asks for it, and drives both the Devanagari font stack and the speech recogniser's language (left on `en-IN`, Hindi speech returns nothing). The chatbot's own replies follow whatever language the person writes in, decided by the backend independently.

### Accounts

Email/password via Supabase, with the role chosen on the same screen. **Anonymous entry** needs no email or name at all — just a generated case code. Setting `VITE_REQUIRE_LOGIN=false` drops credentials entirely for demos.

Setup, including the `profiles` table SQL, is in **[`frontend/docs/auth-setup.md`](frontend/docs/auth-setup.md)**.

---

## Current status

- Backend complete and tested end to end, text and voice, with a 126-assertion suite
- Victim-facing check-in, status and support screens complete, bilingual
- Officer case list complete, with band, score and support actions
- Safety pathway verified live — returns `safety_flag` with real helpline numbers on crisis content
- 5 synthetic case timelines and 4 officers seeded for testing

---

## Known pending items

**Needs attention before a real deployment**

- **The API has no authentication.** Every endpoint answers anyone who can reach it, and none of them verify a token. The login gates the *UI*, not the *data*. Closing this means verifying the Supabase JWT in FastAPI.
- **Roles are self-selected.** Any account can choose "officer" and see every case. Fine for seeded demo data, not for real people.
- **Historical scores are not trustworthy.** Everything scored before the distress-signal fix read the model's *neutral* class as distress, inverting the signal. Rows written since are correct; earlier ones would need re-scoring.
- **`voice_stress` returns 50 on any failure**, so an undecodable recording silently scores as moderate stress rather than erroring.

**Product decisions still open**

- A `Score` row is written per message rather than per conversation, so the case-detail trend chart shows intra-conversation jitter rather than a day-over-day trend. Fixing it properly is a schema change.
- Whether the person should ever see their own score. Currently they never do.
- A past crisis message stays in conversation history indefinitely and keeps steering later replies, because history is the last N check-ins regardless of age.
- Anonymous cases are created with `district: "Unassigned"`, so they do not appear under any district filter — only admins see them.

**Unassigned / in progress**

- Text emotion model retrain (weak Tamil/Bengali accuracy)
- Voice stress model's per-class recall on sad/fear not yet confirmed — aggregate accuracy alone is not reliable enough for this use case
- Officer case-detail and alert-review screens are routed but still placeholders
- Pagination on list endpoints, intervention catalog (SC/ST PoA Act provision mapping), officer notifications
- `anonymous_support.py` remains an unwired in-memory device-session design; `/people/anonymous` does not use it
