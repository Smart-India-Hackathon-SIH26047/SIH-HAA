<<<<<<< HEAD
# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.
=======
# SIH 2026 — PS 94: AI-Powered Dynamic Mental Health Monitoring and Distress Prediction System

**Ministry of Social Justice and Empowerment** · Deadline: 20 September 2026

A system that runs periodic wellbeing check-ins (chat, voice, SMS, web) with victims registered under the SC/ST (Prevention of Atrocities) Act, 1989, and produces a transparent **Dynamic Distress Score** that alerts a counsellor or district officer when risk crosses a threshold — with a plain-language explanation and a human who always makes the final call.

---

## Backend

### Tech stack

| Layer | Technology |
|---|---|
| API framework | FastAPI |
| Database | PostgreSQL, hosted on Supabase (shared across the team) |
| ORM | SQLAlchemy |
| Speech-to-text | Whisper (local, `openai-whisper`) |
| Text emotion | IndicBERTv2 (fine-tuned, BERT-based) |
| Voice stress | Custom fine-tuned `wav2vec2-base` classifier (6 emotion classes) |
| Conversational AI | Google Gemini API (`gemini-3.6-flash`), via `google-genai` |

### Setup

```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows
pip install -r requirements.txt
```

**Environment variables** (`backend/.env`):
```
DATABASE_URL=<your Supabase Postgres connection string>
GEMINI_API_KEY=<your Gemini API key — https://aistudio.google.com/apikey>
```

**Model files** (tracked via Git LFS, pulled automatically with `git clone` / `git lfs pull`):
```
models/
  indicbert_5000/         # text emotion model (config, weights, tokenizer)
  speech_emotion/
    best_model.pt         # voice stress model
  whisper/
    base.pt               # speech-to-text model
```

**System dependency:** Whisper requires **ffmpeg** to be installed and on your system PATH (not just the Python package). Install via `winget install ffmpeg` (Windows) and add its `bin` folder to PATH.

**First run:**
```bash
python reset_tables.py          # creates all tables
python seed_officers.py         # seeds 4 test officers
python seed_synthetic_cases.py  # seeds 5 synthetic case timelines
python -m uvicorn app.main:app --reload
```

### API endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `/checkin` | POST | Main check-in — runs the full pipeline (see below) |
| `/people/{id}/history` | GET | Full history: check-ins, scores, case events, alerts |
| `/case-events` | POST | Log a case event (hearing, delay, threat, compensation) |
| `/officers/{id}/alerts` | GET | Open alerts, role-filtered (district/counsellor/admin) |
| `/alerts/{id}/acknowledge` | POST | Officer agrees/disagrees with an alert, with a reason |
| `/consent` | POST | Set or revoke a person's typed consent |

### `/checkin` pipeline

1. **Transcription** — if `channel: "voice"`, Whisper transcribes the audio to text
2. **Crisis check** — the chatbot's keyword-based crisis detector runs first; if triggered, scoring is **skipped entirely** and the response is a `safety_flag` (no fabricated score), with real helpline numbers (Tele-MANAS 1860-445-4435, Emergency 112)
3. **Conversational reply** — if not a crisis, Gemini generates the next check-in message (system-prompted to be gentle, non-diagnostic, and never give legal/medical/financial advice), and an output safety filter re-checks the reply before it's returned
4. **Scoring** — the Dynamic Distress Score is computed from six weighted, named components:

| Component | Weight | Source |
|---|---|---|
| Expressed distress | 0.25 | IndicBERTv2 (ML) |
| Voice stress | 0.15 | Custom wav2vec2 model (ML) |
| Engagement change | 0.20 | Computed from check-in history |
| Case-event pressure | 0.20 | Computed from case events |
| Reported external stressors | 0.10 | Keyword extraction from transcript |
| Trajectory | 0.10 | Computed from score history |

Only two of six components are ML-driven — the system degrades gracefully if a model is unavailable.

5. **Response** — the endpoint returns one of two distinct shapes:
   - **`type: "score"`** — the score, band (`stable`/`watch`/`elevated`/`priority`), per-component breakdown, and the chatbot's next message
   - **`type: "safety_flag"`** — no score at all, just helpline info and a plain-language reason

**The frontend must branch on `type` and never assume a score exists.**

### Design principles

| Principle | Where it lives in the code |
|---|---|
| Explainable by construction | Each of the six score components stored as its own column |
| The system flags, humans decide | Alert acknowledge endpoint; `officer_decision`, `officer_reason` |
| Graceful degradation | Only two of six components are ML-driven |
| Consent before processing | Consent gate runs before scoring — hard stop, typed and revocable per purpose |
| Protected attributes never score | Caste, religion, tribe, ethnicity explicitly rejected at the scoring boundary |
| Crisis content is escalated, never scored | Dedicated safety pathway; a distinct response type carrying no score |

**Legal and ethical framework grounding:** K.S. Puttaswamy v. Union of India (2017) · UN Declaration of Basic Principles of Justice for Victims (1985) · Digital Personal Data Protection Act, 2023 · SC/ST (Prevention of Atrocities) Act, 1989 · Witness Protection Scheme, 2018

### Database schema

Six tables: `people`, `checkins`, `scores`, `case_events`, `alerts`, `access_log`. Every enum-like column (case phase, channel, band, severity, status) is constrained at the database level — invalid values are rejected by PostgreSQL itself, not only by application code.

### Current status

- Backend fully built and tested end-to-end, including both text and voice channels
- Safety-support pathway tested live — correctly returns `safety_flag` with real helpline numbers on crisis content
- 5 synthetic case timelines and 4 officers seeded for testing
- `anonymous_support.py` exists as a separate, in-memory anonymous device-session flow (not yet wired into any route)

### Known pending items

- Text emotion model retrain in progress (fixing weak Tamil/Bengali accuracy)
- Voice stress model's per-class recall on sad/fear not yet confirmed (aggregate accuracy alone isn't reliable enough for this use case)
- Pagination on list endpoints, intervention catalog (SC/ST PoA Act provision mapping), and officer notifications are unassigned/undecided

---

## Frontend

*(to be added)*
>>>>>>> origin/main
