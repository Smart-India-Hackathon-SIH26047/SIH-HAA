# API contract — as the backend actually behaves

Written from `backend/app/routes/*` and `backend/app/models.py`. Where this
differs from what the original brief assumed, the backend wins and the
difference is noted.

**All three gaps this document used to describe are now closed** — the case
list, the person reference on alerts, and audio upload all exist. Nothing in
`models/` was modified, and no database migration was required: every field
these endpoints return already existed on the models.

## Endpoints

| Endpoint | Notes |
| --- | --- |
| `POST /checkin` | Text check-in. Three response shapes — see below. |
| `POST /checkin/audio` | **Multipart.** Voice check-in that uploads real audio. |
| `GET /people` | Case list, filterable by `district` / `state`. |
| `GET /people/{id}/history` | **Requires** `?accessed_by=` — every read writes an `AccessLog` row. |
| `GET /officers/{id}/alerts` | Open alerts only, scoped by officer role. Now carries the person. |
| `POST /alerts/{id}/acknowledge` | `decision` is `"Agree"` \| `"Disagree"` — capitalised. |
| `POST /case-events` | `event_type` is a fixed enum; `event_date` is `YYYY-MM-DD`. |
| `POST /consent` | Returns `{ error }` with **HTTP 200** on a bad `consent_type`. |

## Pseudonyms, not names

There is no real name anywhere in this system. `Person` stores a **`pseudonym`**
(e.g. `JPR-0001`), and every endpoint exposes it under that key. Do not relabel
it `name` in the UI — the pseudonym is the anonymity design, not a placeholder
for a name the backend forgot to send.

## `POST /checkin` returns one of three shapes

Discriminated by `type`. `src/api/endpoints.js` collapses these into two.

```jsonc
// 1. normal scoring path
{ "type": "score", "person_id": "…", "checkin_id": "…",
  "next_message": "…",           // the chatbot reply
  "score": 62.5, "band": "elevated",
  "components": { "emotion": 0, "voice_stress": 0, "engagement": 0,
                  "case_events": 0, "reported_stressors": 0, "trajectory": 0 },
  "support_offer": { … }         // OPTIONAL — see below
}

// 2. chatbot crisis path — fires BEFORE any ML scoring
{ "type": "safety_flag", "person_id": "…", "message": "…",
  "helplines": [{ "name": "Tele-MANAS", "number": "1860-445-4435" }] }

// 3. scoring engine's own safety layer — fires AFTER scoring
{ "type": "safety_flag", "person_id": "…", "level": "…", "reason": "…",
  "recommended_response": "…",
  "helpline_info": { "tele_manas_india": "14416 or 1-800-891-4416" } }
```

Two things to watch:

- **The reply field is `next_message`, not `ai_response`.** `ai_response` is the
  `checkins` table column; it is never sent to the client under that name.
- **Bands are lowercase** — `stable` / `watch` / `elevated` / `priority`,
  enforced by a DB `CHECK` constraint. Never title-case them before comparing,
  and never derive a band from `score` on the client.

Alert `severity` is a **separate** vocabulary — `low` / `medium` / `high` /
`critical`. Do not render it as if it were a band.

### `support_offer` — optional, and only on `type: "score"`

Present only when the person has just **entered** the `elevated` or `priority`
band. It is an offer, not an escalation, and it is entirely separate from the
crisis path above.

```jsonc
"support_offer": {
  "reason": "elevated_distress",
  "dismissible": true,
  "message": "Whenever you want it, there are people you can talk to…",
  "dismiss_label": "Not right now",
  "options": [
    { "type": "call", "label": "Talk to someone",
      "name": "Tele-MANAS", "number": "1860-445-4435" },
    { "type": "sms",  "label": "Get support by SMS", "name": "…", "number": "…" }
  ]
}
```

Rendering rules:

- **Render it as dismissible buttons, never as a modal or an interruption.** The
  conversation continues either way; `next_message` is still the reply to show.
- **`options` is variable-length. Iterate it — do not index into it.** The `sms`
  option is omitted entirely unless `SUPPORT_SMS_NUMBER` is set on the backend,
  because a support number that nobody answers is worse than no number at all.
- It appears **once per 12 hours** (`SUPPORT_OFFER_COOLDOWN_HOURS`), not once
  per message. Scoring runs on every message and the band oscillates within a
  single conversation, so the backend suppresses repeats rather than nagging.
- `message` and labels are already localised to the detected language.

## `POST /checkin/audio` — voice check-ins

Multipart form. This is the route browsers should use for voice; it is the only
one that can accept audio bytes.

| Field | | |
| --- | --- | --- |
| `person_id` | required | UUID |
| `audio_file` | required | the recording |
| `language` | optional | omit to let Whisper auto-detect |

Accepted containers: `.wav .mp3 .m4a .mp4 .ogg .oga .opus .webm .flac`.
Browser `MediaRecorder` produces `.webm` (Chrome/Firefox) or `.mp4` (Safari),
both fine. Max **25 MB**.

Responses are the same three shapes as `POST /checkin`. Errors:

| Status | Meaning |
| --- | --- |
| 413 | Over 25 MB |
| 415 | Unsupported container |
| 400 | Empty file, or no speech could be made out |
| 422 | `person_id` is not a UUID |
| 404 | No such person (checked *before* transcription runs) |

Unlike the text route, this one runs the **real wav2vec2 voice-stress model**
against the uploaded audio, so `components.voice_stress` is a genuine value
rather than 0. The recording is written to a temp file, used, and deleted
before the response returns — only the transcript is persisted.

> The frontend's current in-browser `SpeechRecognition` workaround
> (`src/hooks/useVoiceInput.js`) predates this endpoint and sends
> `channel: "chat"`, which leaves `voice_stress` at 0. It should be switched to
> post the recorded blob here instead. **This is the one piece of frontend work
> the backend changes have made outstanding.**

`POST /checkin` with `channel: "voice"` still treats `text` as a path to a file
on the *server's* disk. That path predates the upload route and is only usable
by server-side callers. Browsers must not use it.

## `GET /people` — the case list

```
GET /people?district=Jaipur&state=Rajasthan
```

Both params optional and independent. Matching is case-insensitive and tolerant
of surrounding whitespace, so values straight from a dropdown or a text box work.

```jsonc
[ { "id": "…", "pseudonym": "JPR-0001",
    "district": "Jaipur", "state": "Rajasthan",
    "band": "elevated" } ]   // band is null if never scored
```

- `band` is the person's **most recent** score band, not their highest.
- People with **no scores at all appear**, with `band: null`. A newly
  registered person must not vanish from a case list — render the null state.
- Ordered by district, then pseudonym.
- One query regardless of how many people match.

## `GET /officers/{id}/alerts`

Now carries the person and the band, so an officer can see whose case an alert
belongs to before acting on it.

```jsonc
[ { "id": "…", "score_id": "…", "severity": "high",
    "status": "open", "assigned_to": "…",
    "person_id": "…", "pseudonym": "JPR-0001",
    "district": "Jaipur", "band": "elevated" } ]
```

`severity` and `band` are different vocabularies and will often disagree —
show them differently. Scoping is unchanged: admins see everything, district
officers see their district, counsellors see only alerts assigned to them.

## Identities

There is no auth. `VITE_DEMO_PERSON_ID` and `VITE_DEMO_OFFICER_ID` must be
**UUIDs** from the seed scripts — `/checkin` calls `uuid.UUID(person_id)` and
rejects anything else. Get them from:

```
python backend/seed_officers.py          # prints role, district, id
python backend/seed_synthetic_cases.py
```

## Timestamps

`created_at` fields are naive UTC (`datetime.utcnow().isoformat()`) with no
timezone suffix. Parsing them directly reads them as local time and shifts the
trend chart. `src/lib/format.js` appends the `Z` before parsing.

## Known issues on the backend side

Not blocking, but worth knowing while building against this API.

- **A `Score` row is written per message, not per conversation.** A ten-message
  check-in produces ten score rows minutes apart, so the case-detail trend chart
  will show intra-conversation jitter rather than a day-over-day trend. Consider
  aggregating per day in the chart until this is addressed. Fixing it properly
  is a schema change.
- **`voice_stress` returns 50 on any failure.** A corrupt or undecodable
  recording silently scores as moderate stress rather than erroring.
- **The shipped Whisper checkpoint is unused.** `ml_services.load_all_models()`
  calls `whisper.load_model("base")`, which downloads to a cache instead of
  loading `models/whisper/base.pt`.
- **ML dependencies are unpinned.** `torch`, `transformers`, `openai-whisper`
  and `librosa` are absent from `backend/requirements.txt`, and
  `ml/requirements.txt` is empty; the app cannot start without them.
- **`ffmpeg` must be on PATH** for `/checkin/audio` — both Whisper and librosa
  shell out to it for anything that is not a plain `.wav`.
