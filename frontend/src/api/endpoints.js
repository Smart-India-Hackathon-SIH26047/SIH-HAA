/**
 * One function per backend endpoint. These mirror the FastAPI routes exactly —
 * field names here are the ones the server actually sends, not the ones the
 * database columns use. See `docs/api-contract.md` for the full shapes and the
 * three places where the contract does not yet cover what the UI needs.
 */
import { get, post } from "./client";

/**
 * POST /checkin
 *
 * Returns ONE OF three shapes, discriminated by `type`:
 *
 *  { type: "score", person_id, checkin_id, next_message, score, band, components }
 *      `next_message` is the chatbot reply. (The `ai_response` name in the
 *      brief is the DB column, not the API field.)
 *      `band` is lowercase: "stable" | "watch" | "elevated" | "priority".
 *
 *  { type: "safety_flag", person_id, message, helplines }
 *      Crisis path — the chatbot detected risk before scoring ran.
 *
 *  { type: "safety_flag", person_id, level, reason, recommended_response, helpline_info }
 *      The scoring engine's own safety layer fired after scoring.
 *
 * `normalizeCheckinResponse` below collapses the two safety shapes into one.
 *
 * NOTE ON channel: "voice" — the backend feeds `text` straight to Whisper and
 * librosa as a *server-side file path*. A browser cannot produce one, so the
 * voice UI transcribes in-browser and sends channel "chat". See docs.
 */
export async function submitCheckin({ personId, text, channel = "chat", signal }) {
  // Measured against the real backend on a Supabase pooler in ap-northeast-1:
  // ~18s warm, ~67s on the first request of a server's life (connection pool
  // and model warm-up). 45s was not enough and timed out on a cold start.
  const data = await post(
    "/checkin",
    { person_id: personId, text, channel },
    { signal, timeoutMs: 120_000 },
  );
  return normalizeCheckinResponse(data);
}

/**
 * POST /checkin/audio — multipart voice check-in.
 *
 * Unlike the text route this runs the real wav2vec2 voice-stress model over
 * the uploaded recording, so `components.voice_stress` is a genuine value
 * rather than 0. Whisper auto-detects the language when none is given.
 *
 * Max 25MB; the backend rejects an unsupported container with 415 and a
 * recording it cannot make out with 400.
 */
export async function submitCheckinAudio({ personId, blob, filename = "checkin.webm", signal }) {
  const form = new FormData();
  form.append("person_id", personId);
  form.append("audio_file", blob, filename);

  const data = await post("/checkin/audio", form, { signal, timeoutMs: 180_000 });
  return normalizeCheckinResponse(data);
}

export function normalizeCheckinResponse(data) {
  if (data?.type === "safety_flag") {
    return {
      type: "safety_flag",
      personId: data.person_id,
      // The two safety shapes name their prose differently.
      message: data.message || data.recommended_response || "",
      reason: data.reason || null,
      level: data.level || null,
      helplines: normalizeHelplines(data.helplines ?? data.helpline_info),
    };
  }

  return {
    type: "score",
    personId: data.person_id,
    checkinId: data.checkin_id,
    message: data.next_message || "",
    score: data.score,
    band: data.band || null,
    components: data.components || {},
    // Optional. Present only when this check-in crossed into the elevated or
    // priority band. `options` is variable-length — the SMS entry is absent
    // unless the backend has a real number configured — so always iterate it.
    // Only present on /checkin/audio: what Whisper heard. Lets the client
    // show the person their own words instead of a generic "voice message".
    transcript: data.transcript || null,
    aiAvailable: data.ai_available !== false,
    supportOffer: data.support_offer
      ? {
          message: data.support_offer.message || "",
          dismissLabel: data.support_offer.dismiss_label || "Not right now",
          options: data.support_offer.options || [],
        }
      : null,
  };
}

/**
 * Helplines arrive in two shapes depending on which safety layer fired:
 *   chatbot crisis path -> [{ name: "Tele-MANAS", number: "1860-445-4435" }]
 *   engine safety layer -> { tele_manas_india: "14416 or 1-800-891-4416" }
 */
function normalizeHelplines(value) {
  if (!value) return [];
  if (typeof value === "string") return [{ label: value, number: null }];
  if (Array.isArray(value)) {
    return value.map((item) =>
      typeof item === "string"
        ? { label: item, number: null }
        : { label: item.name || item.label || "Helpline", number: item.number || item.phone || null },
    );
  }
  return Object.entries(value).map(([key, number]) => ({
    label: titleCaseKey(key),
    number: String(number),
  }));
}

/** "tele_manas_india" -> "Tele Manas India" */
function titleCaseKey(key) {
  return key
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * GET /people/{person_id}/history?accessed_by=...
 *
 * `accessed_by` is REQUIRED — the backend writes an AccessLog row for every
 * read. Always pass the real viewer's identity; never a placeholder.
 */
export function fetchPersonHistory({ personId, accessedBy, signal }) {
  return get(`/people/${encodeURIComponent(personId)}/history`, {
    query: { accessed_by: accessedBy },
    signal,
  });
}

/**
 * GET /people?district=&state=
 * Officer-facing case list. `band`, `score` and `last_scored_at` are null for
 * anyone never scored — render that state rather than filtering them out.
 */
export function fetchPeople({ district, state, signal } = {}) {
  return get("/people", { query: { district, state }, signal });
}

/**
 * POST /people/anonymous — start a case with no identifying details.
 * Returns a generated case code (pseudonym) and the id to check in against.
 */
export function createAnonymousPerson({ language = "en", signal } = {}) {
  return post("/people/anonymous", { language }, { signal });
}

/**
 * GET /support-contacts
 * Configured support channels. Either may be null, meaning that channel is
 * not configured — disable the action, never substitute another number.
 */
export function fetchSupportContacts({ signal } = {}) {
  return get("/support-contacts", { signal });
}

/** GET /officers/{officer_id}/alerts — open alerts only, per officer role. */
export function fetchOfficerAlerts({ officerId, signal }) {
  return get(`/officers/${encodeURIComponent(officerId)}/alerts`, { signal });
}

/**
 * POST /alerts/{alert_id}/acknowledge
 * `decision` must be capitalised exactly "Agree" | "Disagree" (Literal type).
 */
export function acknowledgeAlert({ alertId, reviewerRef, decision, reason = "", signal }) {
  return post(
    `/alerts/${encodeURIComponent(alertId)}/acknowledge`,
    { reviewer_ref: reviewerRef, decision, reason },
    { signal },
  );
}

/** POST /case-events — event_type is a fixed enum, event_date is YYYY-MM-DD. */
export const CASE_EVENT_TYPES = [
  "hearing_scheduled",
  "hearing_delayed",
  "threat_reported",
  "compensation_released",
];

export function createCaseEvent({ personId, eventType, eventDate, signal }) {
  return post("/case-events", { person_id: personId, event_type: eventType, event_date: eventDate }, { signal });
}

/**
 * POST /consent
 * Returns `{ error }` with HTTP 200 on an invalid consent_type, so callers
 * must check the body rather than relying on the status code.
 */
export const CONSENT_TYPES = {
  ESSENTIAL_SERVICE: "essential_service",
  CONVERSATION_RETENTION: "conversation_retention",
  PERSONALIZATION: "personalization",
  OPTIONAL_CHECKINS: "optional_checkins",
  CASE_SUPPORT_MONITORING: "case_support_monitoring",
  SAFETY_ANALYSIS: "safety_analysis",
  TRUSTED_CONTACT_SHARING: "trusted_contact_sharing",
  IMPROVEMENT_USE: "deidentified_improvement_use",
};

export async function setConsent({ personId, consentType, granted, signal }) {
  const data = await post(
    "/consent",
    { person_id: personId, consent_type: consentType, granted },
    { signal },
  );
  if (data?.error) throw new Error(data.error);
  return data;
}
