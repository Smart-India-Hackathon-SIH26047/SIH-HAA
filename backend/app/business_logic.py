"""MoSJE Distress Monitoring Companion - business logic only.

This is a dependency-free prototype engine. It is not a clinical diagnostic
system and does not contact real people or emergency services.

The engine has two separate tracks:
1. Case-support distress score: six named components, including voice stress.
2. Conversation safety-support signal: context-aware, non-diagnostic.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime, timedelta, timezone
from enum import Enum
import re
import uuid
from typing import Any, Optional

from sqlalchemy.orm import Session

from .data_access import (
    acknowledge_alert as persist_acknowledge_alert,
    create_alert,
    create_score,
    get_person_history,
    log_access,
)


# ---------------------------------------------------------------------------
# Constants and configuration
# ---------------------------------------------------------------------------

CASE_WEIGHTS = {
    "Expressed distress": 0.25,
    "Voice stress": 0.15,
    "Engagement change": 0.20,
    "Case-event pressure": 0.20,
    "Reported external stressors": 0.10,
    "Trajectory": 0.10,
}

FALLBACK_WEIGHTS = {
    "Engagement change": 0.50,
    "Case-event pressure": 0.50,
}

# These are configurable prototype defaults, not clinically validated cutoffs.
BAND_THRESHOLDS = {
    "stable_max": 29.99,
    "watch_max": 49.99,
    "elevated_max": 74.99,
}

ALERT_THRESHOLDS = {
    "sharp_delta": 20.0,
    "decline_delta": 10.0,
    "sustained_decline_cycles": 2,
    "disengagement_cycles": 2,
}

# Protected identity fields are rejected by the scoring boundary.
PROHIBITED_SCORING_FIELDS = {
    "caste", "caste_category", "sub_caste", "community", "religion",
    "tribe", "ethnicity", "identity", "political_affiliation", "biometric",
}


# ---------------------------------------------------------------------------
# Basic utilities
# ---------------------------------------------------------------------------


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def iso_now() -> str:
    return utc_now().isoformat()


def validate_score(name: str, value: Optional[float]) -> None:
    if value is None:
        return
    if not isinstance(value, (int, float)) or isinstance(value, bool):
        raise TypeError(f"{name} must be a number from 0 to 100")
    if not 0 <= float(value) <= 100:
        raise ValueError(f"{name} must be between 0 and 100")


def validate_no_identity_fields(payload: dict[str, Any]) -> None:
    """Reject identity fields before data reaches the scoring engine."""
    found = PROHIBITED_SCORING_FIELDS.intersection(
        key.strip().lower() for key in payload
    )
    if found:
        raise ValueError(
            "Identity fields cannot be scoring inputs: " + ", ".join(sorted(found))
        )


def clamp(value: float, low: float = 0, high: float = 100) -> float:
    return round(max(low, min(high, value)), 2)


# ---------------------------------------------------------------------------
# Consent and audit
# ---------------------------------------------------------------------------


class ConsentType(str, Enum):
    ESSENTIAL_SERVICE = "essential_service"
    CONVERSATION_RETENTION = "conversation_retention"
    PERSONALIZATION = "personalization"
    OPTIONAL_CHECKINS = "optional_checkins"
    CASE_SUPPORT_MONITORING = "case_support_monitoring"
    SAFETY_ANALYSIS = "safety_analysis"
    TRUSTED_CONTACT_SHARING = "trusted_contact_sharing"
    IMPROVEMENT_USE = "deidentified_improvement_use"


@dataclass
class ConsentRecord:
    user_ref: str  # pseudonymous reference; not a caste/identity input
    consent_type: ConsentType
    granted: bool
    version: str
    changed_at: str


@dataclass
class AuditEvent:
    event_type: str
    actor_ref: Optional[str]
    subject_ref: Optional[str]
    details: dict[str, Any]
    created_at: str = field(default_factory=iso_now)


class ConsentManager:
    def __init__(self, audit: list[AuditEvent]):
        self.records: dict[tuple[str, ConsentType], ConsentRecord] = {}
        self.audit = audit

    def set_consent(
        self,
        user_ref: str,
        consent_type: ConsentType,
        granted: bool,
        version: str = "v1",
    ) -> ConsentRecord:
        record = ConsentRecord(
            user_ref=user_ref,
            consent_type=consent_type,
            granted=granted,
            version=version,
            changed_at=iso_now(),
        )
        self.records[(user_ref, consent_type)] = record
        self.audit.append(AuditEvent(
            event_type="consent_changed",
            actor_ref=user_ref,
            subject_ref=user_ref,
            details=asdict(record),
        ))
        return record

    def has_consent(self, user_ref: str, consent_type: ConsentType) -> bool:
        record = self.records.get((user_ref, consent_type))
        return bool(record and record.granted)

    def require(self, user_ref: str, consent_type: ConsentType) -> None:
        if not self.has_consent(user_ref, consent_type):
            raise PermissionError(f"Missing consent: {consent_type.value}")


# ---------------------------------------------------------------------------
# Conversation safety-support assessment
# ---------------------------------------------------------------------------


class SafetyLevel(str, Enum):
    NORMAL = "Normal"
    LOW = "Low concern"
    MODERATE = "Moderate concern"
    HIGH = "High concern"
    CRITICAL = "Critical concern"


@dataclass
class SafetyEvidence:
    phrase: str
    self_referential: bool
    current: bool
    specific: bool
    immediate: bool
    quoted_or_fictional: bool
    negated: bool
    historical: bool
    confidence: float


@dataclass
class SafetyAssessment:
    level: SafetyLevel
    support_signal: float
    scoring_skipped: bool
    immediate_human_flag: bool
    evidence: list[SafetyEvidence]
    reason: str
    recommended_response: str
    helpline_info: dict[str, str] = field(default_factory=lambda: {
        "tele_manas_india": "14416 or 1-800-891-4416",
        "emergency_india": "112",
    })
    calculated_at: str = field(default_factory=iso_now)


# These are only a cautious prototype backstop. They are not a clinical model.
_RISK_PATTERNS = [
    r"\bkill myself\b",
    r"\bend my life\b",
    r"\btake my life\b",
    r"\bwant to die\b",
    r"\bdo not want to live\b",
    r"\bdon't want to live\b",
    r"\bself[- ]?harm\b",
    r"\bhurt myself\b",
    r"\bcut myself\b",
]
_IMMEDIACY_WORDS = r"\b(now|right now|today|tonight|immediately|very soon)\b"
_PLAN_WORDS = r"\b(plan|going to|have a way|have the means|specific time)\b"
_NEGATION_WORDS = r"\b(not|no|never|don't|do not|would not|will not)\b"
_HISTORY_WORDS = r"\b(last year|years ago|previously|in the past|before)\b"
_NON_SELF_WORDS = r"\b(my friend|someone else|another person|the character|in the film|in the story)\b"


def _sentences(text: str) -> list[str]:
    return [part.strip() for part in re.split(r"(?<=[.!?])\s+|\n+", text) if part.strip()]


def assess_conversation_safety(
    current_text: str,
    recent_texts: Optional[list[str]] = None,
) -> SafetyAssessment:
    """Return a non-diagnostic safety-support signal.

    The function checks context around candidate phrases instead of treating
    every keyword as an automatic escalation. The formula is transparent:

        signal = 0.40*severity + 0.30*immediacy
               + 0.20*repetition + 0.10*context_confidence

    This formula is a prototype policy and requires expert validation before
    real-world use.
    """
    texts = [current_text] + (recent_texts or [])
    evidence: list[SafetyEvidence] = []

    for text in texts:
        for sentence in _sentences(text or ""):
            lowered = sentence.lower()
            for pattern in _RISK_PATTERNS:
                match = re.search(pattern, lowered)
                if not match:
                    continue

                before = lowered[:match.start()]
                negated = bool(re.search(_NEGATION_WORDS + r"\s+$", before))
                quoted = (
                    sentence.count('"') >= 2
                    or sentence.count("'") >= 2
                    or bool(re.search(_NON_SELF_WORDS, lowered))
                )
                historical = bool(re.search(_HISTORY_WORDS, lowered))
                self_ref = not quoted and not bool(re.search(_NON_SELF_WORDS, lowered))
                immediate = bool(re.search(_IMMEDIACY_WORDS, lowered))
                specific = bool(re.search(_PLAN_WORDS, lowered))
                current = not historical

                confidence = 1.0
                if not self_ref:
                    confidence -= 0.55
                if negated:
                    confidence -= 0.55
                if historical:
                    confidence -= 0.30
                confidence = clamp(confidence, 0, 1)

                evidence.append(SafetyEvidence(
                    phrase=match.group(0),
                    self_referential=self_ref,
                    current=current,
                    specific=specific,
                    immediate=immediate,
                    quoted_or_fictional=quoted,
                    negated=negated,
                    historical=historical,
                    confidence=confidence,
                ))

    if not evidence:
        return SafetyAssessment(
            level=SafetyLevel.NORMAL,
            support_signal=0,
            scoring_skipped=False,
            immediate_human_flag=False,
            evidence=[],
            reason="No contextual safety-support signal detected.",
            recommended_response="Continue the normal companion experience.",
        )

    valid = [e for e in evidence if e.self_referential and not e.negated]
    if not valid:
        return SafetyAssessment(
            level=SafetyLevel.LOW,
            support_signal=clamp(max(e.confidence for e in evidence) * 25),
            scoring_skipped=False,
            immediate_human_flag=False,
            evidence=evidence,
            reason="Potentially concerning language was quoted, historical, negated, or about another person.",
            recommended_response="Acknowledge context gently; do not escalate automatically.",
        )

    severity = 100 if any(e.specific for e in valid) else 65
    immediacy = 100 if any(e.immediate and e.current for e in valid) else 25
    repetition = clamp(25 * min(len(valid), 4))
    context_confidence = 100 * sum(e.confidence for e in valid) / len(valid)
    signal = clamp(
        0.40 * severity
        + 0.30 * immediacy
        + 0.20 * repetition
        + 0.10 * context_confidence
    )

    if any(e.specific and e.immediate and e.current for e in valid):
        level = SafetyLevel.CRITICAL
        action = "Use the approved human-led immediate-safety protocol and show verified local support options."
        skipped = True
    elif signal >= 60:
        level = SafetyLevel.HIGH
        action = "Offer immediate support options and route to an authorized reviewer only if policy and consent permit."
        skipped = False
    elif signal >= 35:
        level = SafetyLevel.MODERATE
        action = "Ask a calm clarifying question and offer optional human or support resources."
        skipped = False
    else:
        level = SafetyLevel.LOW
        action = "Use an empathetic, non-alarmist check-in."
        skipped = False

    return SafetyAssessment(
        level=level,
        support_signal=signal,
        scoring_skipped=True,
        immediate_human_flag=True,
        evidence=evidence,
        reason="Contextual safety-support evidence was detected; this is not a diagnosis.",
        recommended_response=action,
    )


# ---------------------------------------------------------------------------
# Case-support distress score
# ---------------------------------------------------------------------------


@dataclass
class CaseSupportInputs:
    """Only these six named components may enter the case-support score."""

    expressed_distress: Optional[float]
    voice_stress: Optional[float]
    engagement_change: float
    case_event_pressure: float
    reported_external_stressors: Optional[float]
    trajectory: Optional[float]
    check_in_text: str = ""
    text_emotion_layer_enabled: bool = True


@dataclass
class ScoreContribution:
    component: str
    raw_score: float
    weight: float
    contribution: float
    explanation: str


class Band(str, Enum):
    STABLE = "stable"
    WATCH = "watch"
    ELEVATED = "elevated"
    PRIORITY = "priority"


@dataclass
class CaseSupportScore:
    score: float
    mode: str
    contributions: list[ScoreContribution]
    safety_assessment: SafetyAssessment
    band: Optional[Band] = None
    persisted_score_id: Optional[uuid.UUID] = None
    persisted_alert_ids: list[uuid.UUID] = field(default_factory=list)
    human_review_required: bool = True
    calculated_at: str = field(default_factory=iso_now)


def calculate_case_support_score(
    inputs: CaseSupportInputs,
    safety_analysis_enabled: bool = True,
) -> CaseSupportScore | SafetyAssessment:
    """Calculate the transparent case-support score.

    Safety analysis is a separate consent-controlled feature. When enabled,
    the safety gate occurs before ordinary score validation. A Critical concern
    returns immediately and no numerical case-support score is produced.
    """
    if safety_analysis_enabled:
        safety = assess_conversation_safety(inputs.check_in_text)
    else:
        safety = SafetyAssessment(
            level=SafetyLevel.NORMAL,
            support_signal=0,
            scoring_skipped=False,
            immediate_human_flag=False,
            evidence=[],
            reason="Safety analysis is disabled or was not consented to.",
            recommended_response="Continue the normal companion experience.",
        )

    if safety.level == SafetyLevel.CRITICAL:
        return safety

    if not inputs.text_emotion_layer_enabled:
        data = {
            "Engagement change": inputs.engagement_change,
            "Case-event pressure": inputs.case_event_pressure,
        }
        weights = FALLBACK_WEIGHTS
        mode = "ML_OFF_FALLBACK"
    else:
        data = {
            "Expressed distress": inputs.expressed_distress,
            "Voice stress": inputs.voice_stress,
            "Engagement change": inputs.engagement_change,
            "Case-event pressure": inputs.case_event_pressure,
            "Reported external stressors": inputs.reported_external_stressors,
            "Trajectory": inputs.trajectory,
        }
        weights = CASE_WEIGHTS
        mode = "FULL"
        missing = [name for name, value in data.items() if value is None]
        if missing:
            raise ValueError("Full mode is missing: " + ", ".join(missing))

    for name, value in data.items():
        validate_score(name, value)

    explanations = {
        "Expressed distress": "Voluntary text emotion signal.",
        "Voice stress": "Voice-derived stress signal from the separate audio/voice pipeline.",
        "Engagement change": "Change in missed check-ins, reply speed, or answer length against personal baseline.",
        "Case-event pressure": "Verified pressure from hearings, adjournments, delays, or pending compensation/rehabilitation.",
        "Reported external stressors": "Voluntary report of threat, intimidation, boycott, or economic hardship.",
        "Trajectory": "Rate and direction of change against the person’s own baseline.",
    }

    contributions = [
        ScoreContribution(
            component=name,
            raw_score=round(float(value), 2),
            weight=weights[name],
            contribution=round(float(value) * weights[name], 2),
            explanation=explanations[name],
        )
        for name, value in data.items()
    ]

    return CaseSupportScore(
        score=round(sum(item.contribution for item in contributions), 2),
        mode=mode,
        contributions=contributions,
        safety_assessment=safety,
    )


# ---------------------------------------------------------------------------
# Personal-baseline calculations
# ---------------------------------------------------------------------------


@dataclass
class EngagementObservation:
    missed_checkins: int
    reply_delay_hours: float
    answer_length_words: int


@dataclass
class EngagementBaseline:
    normal_missed_checkins: float
    normal_reply_delay_hours: float
    normal_answer_length_words: float


def calculate_engagement_change(
    current: EngagementObservation,
    baseline: EngagementBaseline,
) -> Optional[float]:
    """Calculate engagement concern against the same person's baseline.

    Formula:
        missed_component = min(100, 40 * excess_missed_checkins)
        delay_component = percentage increase in reply delay, capped at 100
        length_component = percentage decrease in answer length, capped at 100
        EngagementChange = .40*missed + .35*delay + .25*length

    A missing/zero baseline is treated as insufficient history, not as zero.
    """
    if baseline.normal_reply_delay_hours <= 0 or baseline.normal_answer_length_words <= 0:
        return None

    missed = clamp(40 * max(0, current.missed_checkins - baseline.normal_missed_checkins))
    delay = clamp(
        100 * max(0, current.reply_delay_hours - baseline.normal_reply_delay_hours)
        / baseline.normal_reply_delay_hours
    )
    length = clamp(
        100 * max(0, baseline.normal_answer_length_words - current.answer_length_words)
        / baseline.normal_answer_length_words
    )
    return round(0.40 * missed + 0.35 * delay + 0.25 * length, 2)


def calculate_trajectory(previous_scores: list[float], current_score: float) -> Optional[float]:
    """Return deterioration severity from a personal score history.

    Formula:
        delta = current_score - previous_score
        Trajectory = max(0, delta) scaled to 0–100 over a 20-point rise.

    Fewer than two prior scores means insufficient history.
    """
    if len(previous_scores) < 2:
        return None
    baseline = sum(previous_scores[-3:]) / len(previous_scores[-3:])
    return round(clamp(100 * max(0, current_score - baseline) / 20), 2)


# ---------------------------------------------------------------------------
# Bands, alerts, routing, feedback, and interventions
# ---------------------------------------------------------------------------


@dataclass
class BandContext:
    score: float = 0.0
    previous_score: Optional[float] = None
    previous_band: Optional[Band] = None
    sustained_decline_cycles: int = 0
    disengagement_cycles: int = 0
    reported_threat: bool = False
    known_distress_event: bool = False


def build_band_context(
    db: Session,
    person_id: uuid.UUID,
    accessed_by: str = "business_logic",
) -> BandContext:
    """Build current-cycle context from the person's persisted history.

    History is read only through data_access.get_person_history(). Scores are
    ordered by created_at when available. A deterioration cycle means a higher
    score than the preceding score, because higher scores represent greater
    concern; consecutive cycles are counted from the newest score backwards.
    Engagement cycles are inferred from persisted component_engagement values
    when available. The current schema has no explicit missed-checkin field,
    so missing engagement data is not treated as disengagement.
    """
    history = get_person_history(db, person_id, accessed_by)
    if history is None:
        raise ValueError(f"Person not found: {person_id}")

    scores = sorted(
        history.get("scores", []),
        key=lambda item: item.created_at or datetime.min,
    )
    events = history.get("case_events", [])

    previous_score = float(scores[-1].value) if scores else None
    previous_band = Band(scores[-1].band) if scores and scores[-1].band else None

    sustained_decline_cycles = 0
    for newer, older in zip(reversed(scores), reversed(scores[:-1])):
        if float(newer.value) > float(older.value):
            sustained_decline_cycles += 1
        else:
            break

    disengagement_cycles = 0
    for score in reversed(scores):
        engagement = getattr(score, "component_engagement", None)
        if engagement is None or float(engagement) < 60:
            break
        disengagement_cycles += 1

    reported_threat = any(
        getattr(event, "event_type", None) == "threat_reported"
        for event in events
    )

    known_distress_event = any(
        getattr(event, "event_type", None) == "hearing_delayed"
        for event in events
    )

    return BandContext(
        score=0.0,
        previous_score=previous_score,
        previous_band=previous_band,
        sustained_decline_cycles=sustained_decline_cycles,
        disengagement_cycles=disengagement_cycles,
        reported_threat=reported_threat,
        known_distress_event=known_distress_event,
    )


def classify_band(context: BandContext) -> Band:
    """Apply exact required band names plus deterioration/event rules."""
    delta = 0 if context.previous_score is None else context.score - context.previous_score

    if (
        context.score >= BAND_THRESHOLDS["elevated_max"] + 0.01
        or context.reported_threat
        or delta >= ALERT_THRESHOLDS["sharp_delta"]
        or context.disengagement_cycles >= 3
    ):
        return Band.PRIORITY

    if (
        context.score >= BAND_THRESHOLDS["watch_max"] + 0.01
        or context.known_distress_event
        or context.sustained_decline_cycles >= 2
        or delta >= ALERT_THRESHOLDS["decline_delta"]
    ):
        return Band.ELEVATED

    if context.score >= BAND_THRESHOLDS["stable_max"] + 0.01 or delta > 0 or context.disengagement_cycles >= 1:
        return Band.WATCH

    return Band.STABLE


@dataclass
class Alert:
    alert_id: str
    case_ref: str
    alert_type: str
    band: Optional[Band]
    recipients: list[str]
    reason: str
    created_at: str = field(default_factory=iso_now)
    acknowledged: bool = False
    acknowledged_by: Optional[str] = None
    acknowledged_at: Optional[str] = None


def evaluate_alerts(
    case_ref: str,
    current_band: Band,
    previous_band: Optional[Band],
    current_score: float,
    previous_score: Optional[float],
    sustained_decline_cycles: int = 0,
    disengagement_cycles: int = 0,
    reported_threat: bool = False,
) -> list[Alert]:
    """Create alert records; this function never sends notifications."""
    alerts: list[Alert] = []
    delta = 0 if previous_score is None else current_score - previous_score

    def add(alert_type: str, recipients: list[str], reason: str) -> None:
        alerts.append(Alert(
            alert_id=f"ALT-{case_ref}-{len(alerts) + 1}",
            case_ref=case_ref,
            alert_type=alert_type,
            band=current_band,
            recipients=recipients,
            reason=reason,
        ))

    entered_serious_band = current_band in {Band.ELEVATED, Band.PRIORITY} and current_band != previous_band
    if entered_serious_band:
        recipients = ["counsellor"] if current_band == Band.ELEVATED else ["counsellor", "district_officer"]
        add("band_crossing", recipients, f"Case entered {current_band.value} band.")

    if delta >= ALERT_THRESHOLDS["sharp_delta"]:
        add("sharp_delta", ["counsellor", "district_officer"], f"Score increased by {delta:.2f} points in one cycle.")

    if sustained_decline_cycles >= ALERT_THRESHOLDS["sustained_decline_cycles"]:
        add("sustained_decline", ["counsellor"], f"Decline continued for {sustained_decline_cycles} cycles.")

    if disengagement_cycles >= ALERT_THRESHOLDS["disengagement_cycles"]:
        add("disengagement_pattern", ["counsellor"], f"Disengagement pattern continued for {disengagement_cycles} cycles.")

    if reported_threat:
        add("reported_threat", ["counsellor", "district_officer"], "A threat was reported; human review is required.")

    return alerts


def acknowledge_alert(alert: Alert, reviewer_ref: str) -> None:
    alert.acknowledged = True
    alert.acknowledged_by = reviewer_ref
    alert.acknowledged_at = iso_now()


@dataclass
class OfficerFeedback:
    reviewer_ref: str
    subject_ref: str
    decision: str  # Agree or Disagree
    reason: str
    created_at: str = field(default_factory=iso_now)


def record_feedback(
    reviewer_ref: str,
    subject_ref: str,
    decision: str,
    reason: str = "",
) -> OfficerFeedback:
    decision = decision.strip().title()
    if decision not in {"Agree", "Disagree"}:
        raise ValueError("decision must be Agree or Disagree")
    if decision == "Disagree" and not reason.strip():
        raise ValueError("A Disagree decision requires a reason")
    return OfficerFeedback(reviewer_ref, subject_ref, decision, reason.strip())


@dataclass
class Provision:
    provision_id: str
    driver: str
    title: str
    source_reference: str
    eligibility_notes: str = "Must be verified by an authorized human."


def intervention_suggestions(
    drivers: list[str],
    provision_catalog: dict[str, list[Provision]],
) -> list[dict[str, Any]]:
    """Return traceable suggestions from an externally approved catalogue.

    The Act's provision list is intentionally injected rather than invented
    or hardcoded here.
    """
    suggestions = []
    for driver in drivers:
        for provision in provision_catalog.get(driver, []):
            suggestions.append({
                "driver": driver,
                "suggestion": provision.title,
                "provision_id": provision.provision_id,
                "source_reference": provision.source_reference,
                "eligibility_notes": provision.eligibility_notes,
                "human_review_required": True,
                "trace": f"Suggested because of driver: {driver}",
            })
    return suggestions


# ---------------------------------------------------------------------------
# SQLAlchemy-backed coordinator
# ---------------------------------------------------------------------------


class BusinessLogicEngine:
    """Coordinates business rules; durable writes go through data_access.py."""

    def __init__(self):
        # Consent remains deliberately in-memory for this hackathon scope.
        self.consent_audit: list[AuditEvent] = []
        self.consent = ConsentManager(self.consent_audit)

    def submit_case_score(
        self,
        db: Session,
        person_id: uuid.UUID,
        checkin_id: Optional[uuid.UUID],
        user_ref: str,
        inputs: CaseSupportInputs,
        band_context: Optional[BandContext] = None,
        actor_ref: str = "business_logic",
        reported_threat: bool = False,
    ) -> CaseSupportScore | SafetyAssessment:
        """Calculate, classify, persist, and create durable alert records.

        The route supplies a live SQLAlchemy Session from get_db(). The
        engine itself never runs raw queries and never stores score/alert/audit
        state in Python dictionaries.
        """
        self.consent.require(user_ref, ConsentType.ESSENTIAL_SERVICE)
        self.consent.require(user_ref, ConsentType.CASE_SUPPORT_MONITORING)

        safety_enabled = self.consent.has_consent(user_ref, ConsentType.SAFETY_ANALYSIS)
        result = calculate_case_support_score(
            inputs,
            safety_analysis_enabled=safety_enabled,
        )

        if isinstance(result, SafetyAssessment):
            log_access(db, person_id, actor_ref, action="edited")
            return result

        context = band_context or build_band_context(db, person_id, actor_ref)
        context.score = result.score
        context.reported_threat = context.reported_threat or reported_threat
        band = classify_band(context)
        result.band = band

        score_record = create_score(
            db=db,
            person_id=person_id,
            checkin_id=checkin_id,
            value=result.score,
            band=band.value,
            component_emotion=_component_value(result, "Expressed distress"),
            component_voice_stress=_component_value(result, "Voice stress"),
            component_engagement=_component_value(result, "Engagement change"),
            component_case_events=_component_value(result, "Case-event pressure"),
            component_reported_stressors=_component_value(result, "Reported external stressors"),
            component_trajectory=_component_value(result, "Trajectory"),
        )
        result.persisted_score_id = score_record.id

        previous_band = context.previous_band
        generated_alerts = evaluate_alerts(
            case_ref=str(person_id),
            current_band=band,
            previous_band=previous_band,
            current_score=result.score,
            previous_score=context.previous_score,
            sustained_decline_cycles=context.sustained_decline_cycles,
            disengagement_cycles=context.disengagement_cycles,
            reported_threat=context.reported_threat,
        )

        for generated in generated_alerts:
            persisted = create_alert(
                db=db,
                score_id=score_record.id,
                severity=_alert_severity(generated.alert_type, band),
                assigned_to=_assigned_role(generated.recipients),
            )
            result.persisted_alert_ids.append(persisted.id)

        # access_log is the repository's current audit table. The durable
        # score/alert rows contain the calculation and alert details.
        log_access(db, person_id, actor_ref, action="edited")
        return result

    def acknowledge(
        self,
        db: Session,
        alert_id: uuid.UUID,
        reviewer_ref: str,
        decision: str,
        reason: str = "",
    ):
        """Persist acknowledgement and officer feedback through data_access."""
        feedback = record_feedback(reviewer_ref, str(alert_id), decision, reason)
        return persist_acknowledge_alert(
            db=db,
            alert_id=alert_id,
            officer_decision=feedback.decision.lower(),
            officer_reason=feedback.reason or None,
        )


def _component_value(result: CaseSupportScore, component: str) -> Optional[float]:
    for item in result.contributions:
        if item.component == component:
            return item.raw_score
    return None


def _alert_severity(alert_type: str, band: Band) -> str:
    if alert_type == "reported_threat" or band == Band.PRIORITY:
        return "critical"
    if band == Band.ELEVATED or alert_type in {"sharp_delta", "sustained_decline"}:
        return "high"
    if alert_type == "disengagement_pattern":
        return "medium"
    return "low"


def _assigned_role(recipients: list[str]) -> Optional[str]:
    # Existing Alert.assigned_to is one string. Keep routing explicit and
    # stable; the notification layer can fan out to the actual recipients.
    if "district_officer" in recipients:
        return "district_officer"
    if "counsellor" in recipients:
        return "counsellor"
    return None


# ---------------------------------------------------------------------------
# Demonstration
# ---------------------------------------------------------------------------


if __name__ == "__main__":
    # This demonstration intentionally exercises only the pure scoring path.
    # Persistence is owned by BusinessLogicEngine and requires a real Session.
    result = calculate_case_support_score(CaseSupportInputs(
        expressed_distress=58,
        voice_stress=52,
        engagement_change=65,
        case_event_pressure=75,
        reported_external_stressors=60,
        trajectory=70,
    ), safety_analysis_enabled=False)
    print(asdict(result))
