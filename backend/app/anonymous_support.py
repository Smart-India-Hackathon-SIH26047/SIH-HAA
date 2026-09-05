"""Anonymous support business logic for the MoSJE prototype.

This module is intentionally independent from the existing person-based flow.
It models an anonymous device session, priority escalation, officer alerts, and
optional user-controlled identity linking. It does not perform database writes,
HTTP routing, or automatic external escalation.

Privacy note:
- The browser/device should create and retain a random device_key locally.
- The backend should receive that key only to derive a stable pseudonymous ID.
- This is pseudonymous monitoring, not guaranteed anonymity.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
import hashlib
import hmac
import re
import secrets
from typing import Optional


# Change this through secure application configuration in a real deployment.
# It is only a safe default for this dependency-free business-logic prototype.
DEVICE_ID_SECRET = "replace-in-production-with-a-server-secret"

SESSION_DAYS = 30
ANONYMOUS_ID_PATTERN = re.compile(r"^ANON-[A-F0-9]{12}$")
VALID_BANDS = {"stable", "watch", "elevated", "priority"}


class AnonymousSupportError(ValueError):
    """Raised when an anonymous-support business rule is violated."""


@dataclass
class AnonymousSession:
    """A privacy-minimized representation of one anonymous device session."""

    anonymous_id: str
    device_key_hash: str
    created_at: str
    expires_at: str
    last_active_at: str
    monitoring_consent: bool
    safety_analysis_consent: bool
    risk_band: str = "stable"
    last_score: Optional[float] = None
    history: list[dict[str, object]] = field(default_factory=list)
    identity_linked: bool = False
    ended: bool = False


@dataclass
class PriorityDecision:
    """The next safe action after a risk update."""

    anonymous_id: str
    risk_band: str
    open_priority_page: bool
    show_identity_disclosure_form: bool
    alert_officer: bool
    alert_id: Optional[str]
    message: str


@dataclass
class OfficerAlert:
    """A privacy-safe alert summary; it deliberately contains no identity data."""

    alert_id: str
    anonymous_id: str
    risk_band: str
    reason: str
    status: str
    created_at: str
    follow_up_available: bool = False


@dataclass
class OfficerSessionView:
    """Fields that may be displayed on the officer monitoring dashboard."""

    anonymous_id: str
    risk_band: str
    latest_score: Optional[float]
    last_active_at: str
    trend: str
    follow_up_available: bool
    identity_visible: bool = False


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat()


def create_device_key() -> str:
    """Create a random key for first use on a browser/device.

    The frontend should save this value locally. Do not replace this with an
    IP address, IMEI, hardware fingerprint, or browser fingerprint.
    """

    return secrets.token_urlsafe(32)


def hash_device_key(device_key: str, secret: str = DEVICE_ID_SECRET) -> str:
    """Return a keyed hash so the raw browser key is not stored by the backend."""

    if not isinstance(device_key, str) or len(device_key) < 20:
        raise AnonymousSupportError("device_key must be a random, non-empty key")
    return hmac.new(
        secret.encode("utf-8"),
        device_key.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def anonymous_id_from_hash(device_key_hash: str) -> str:
    """Create a stable display ID without exposing the device key."""

    return "ANON-" + device_key_hash[:12].upper()


def _validate_anonymous_id(anonymous_id: str) -> None:
    if not ANONYMOUS_ID_PATTERN.fullmatch(anonymous_id):
        raise AnonymousSupportError("invalid anonymous user ID")


def _validate_band(risk_band: str) -> None:
    if risk_band not in VALID_BANDS:
        raise AnonymousSupportError(
            "risk_band must be one of: " + ", ".join(sorted(VALID_BANDS))
        )


def _validate_score(score: Optional[float]) -> None:
    if score is not None and (not isinstance(score, (int, float)) or not 0 <= score <= 100):
        raise AnonymousSupportError("score must be between 0 and 100")


class AnonymousSupportManager:
    """Low-complexity in-memory manager for anonymous-support decisions.

    The data store is intentionally in memory so this file stays dependency-free.
    A later API/database layer can persist these same records without changing
    the decision rules.
    """

    def __init__(self, device_id_secret: str = DEVICE_ID_SECRET) -> None:
        if not device_id_secret or device_id_secret == "replace-in-production-with-a-server-secret":
            # This keeps the prototype runnable while making production misuse visible.
            self.device_id_secret = device_id_secret
        else:
            self.device_id_secret = device_id_secret
        self.sessions: dict[str, AnonymousSession] = {}
        self.alerts: dict[str, OfficerAlert] = {}

    def start_or_resume_session(
        self,
        device_key: Optional[str],
        *,
        monitoring_consent: bool,
        safety_analysis_consent: bool,
        now: Optional[datetime] = None,
    ) -> tuple[AnonymousSession, str]:
        """Start or resume the same anonymous device session after consent."""

        if not monitoring_consent or not safety_analysis_consent:
            raise AnonymousSupportError(
                "monitoring and safety-analysis consent are required for this mode"
            )

        current = now or utc_now()
        raw_key = device_key or create_device_key()
        key_hash = hash_device_key(raw_key, self.device_id_secret)
        anonymous_id = anonymous_id_from_hash(key_hash)
        existing = self.sessions.get(anonymous_id)

        if existing and not existing.ended and current < datetime.fromisoformat(existing.expires_at):
            existing.last_active_at = _iso(current)
            return existing, raw_key

        session = AnonymousSession(
            anonymous_id=anonymous_id,
            device_key_hash=key_hash,
            created_at=_iso(current),
            expires_at=_iso(current + timedelta(days=SESSION_DAYS)),
            last_active_at=_iso(current),
            monitoring_consent=monitoring_consent,
            safety_analysis_consent=safety_analysis_consent,
        )
        self.sessions[anonymous_id] = session
        return session, raw_key

    def record_risk_update(
        self,
        anonymous_id: str,
        *,
        score: Optional[float],
        risk_band: str,
        reason: str,
        now: Optional[datetime] = None,
    ) -> PriorityDecision:
        """Record a score and return the required page and alert actions.

        A transition into priority creates one officer alert. Repeated updates
        while already in priority do not create duplicate alerts.
        """

        _validate_anonymous_id(anonymous_id)
        _validate_band(risk_band)
        _validate_score(score)
        session = self.sessions.get(anonymous_id)
        if not session or session.ended:
            raise AnonymousSupportError("anonymous session is not active")

        current = now or utc_now()
        previous_band = session.risk_band
        session.risk_band = risk_band
        session.last_score = float(score) if score is not None else None
        session.last_active_at = _iso(current)
        session.history.append({
            "score": session.last_score,
            "risk_band": risk_band,
            "reason": reason,
            "created_at": session.last_active_at,
        })

        entered_priority = risk_band == "priority" and previous_band != "priority"
        alert_id: Optional[str] = None
        if entered_priority:
            alert_id = "ALERT-" + secrets.token_hex(8).upper()
            self.alerts[alert_id] = OfficerAlert(
                alert_id=alert_id,
                anonymous_id=anonymous_id,
                risk_band=risk_band,
                reason=reason,
                status="open",
                created_at=_iso(current),
            )

        if risk_band == "priority":
            return PriorityDecision(
                anonymous_id=anonymous_id,
                risk_band=risk_band,
                open_priority_page=True,
                show_identity_disclosure_form=True,
                alert_officer=entered_priority,
                alert_id=alert_id,
                message=(
                    "Priority concern detected. Show the safety-support page, "
                    "notify an authorized officer, and let the user voluntarily "
                    "share identity or contact details."
                ),
            )

        return PriorityDecision(
            anonymous_id=anonymous_id,
            risk_band=risk_band,
            open_priority_page=False,
            show_identity_disclosure_form=False,
            alert_officer=False,
            alert_id=None,
            message="Continue anonymous support and monitoring.",
        )

    def link_identity(
        self,
        anonymous_id: str,
        person_reference: str,
        *,
        user_confirmed: bool,
    ) -> None:
        """Mark voluntary user-controlled linking to an existing support case."""

        _validate_anonymous_id(anonymous_id)
        if not user_confirmed:
            raise AnonymousSupportError("user confirmation is required to link identity")
        if not person_reference:
            raise AnonymousSupportError("person_reference is required after confirmation")
        session = self.sessions.get(anonymous_id)
        if not session or session.ended:
            raise AnonymousSupportError("anonymous session is not active")
        session.identity_linked = True

    def get_officer_view(self, anonymous_id: str) -> OfficerSessionView:
        """Return monitoring data without identity or raw device-key details."""

        _validate_anonymous_id(anonymous_id)
        session = self.sessions.get(anonymous_id)
        if not session or session.ended:
            raise AnonymousSupportError("anonymous session is not active")

        trend = "stable"
        if len(session.history) >= 2:
            previous = session.history[-2]["score"]
            current = session.history[-1]["score"]
            if isinstance(previous, (int, float)) and isinstance(current, (int, float)):
                if current > previous:
                    trend = "increasing"
                elif current < previous:
                    trend = "decreasing"

        return OfficerSessionView(
            anonymous_id=session.anonymous_id,
            risk_band=session.risk_band,
            latest_score=session.last_score,
            last_active_at=session.last_active_at,
            trend=trend,
            follow_up_available=session.identity_linked,
            identity_visible=False,
        )

    def end_session(self, anonymous_id: str) -> None:
        """End a session when the user selects delete/end session."""

        _validate_anonymous_id(anonymous_id)
        session = self.sessions.get(anonymous_id)
        if not session:
            raise AnonymousSupportError("anonymous session not found")
        session.ended = True
        # Do not retain device material after the user ends the session.
        session.device_key_hash = ""
        session.history.clear()
