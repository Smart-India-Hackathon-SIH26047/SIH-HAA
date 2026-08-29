"""
Data access layer for the MoSJE Distress Monitoring Chatbot.

Every function here is the ONLY way the rest of the app touches the
database. No other file should write raw SQLAlchemy queries directly.
"""

import uuid
from datetime import datetime
from sqlalchemy.orm import Session
from .models import Person, Officer, CheckIn, Score, CaseEvent, Alert, AccessLog


def _log_access(db: Session, person_id: uuid.UUID, accessed_by: str, action: str):
    log_entry = AccessLog(person_id=person_id, accessed_by=accessed_by, action=action)
    db.add(log_entry)
    db.commit()


def create_person(
    db: Session,
    pseudonym: str,
    language: str,
    case_phase: str,
    district: str,
    state: str = "",
) -> Person:
    person = Person(
        pseudonym=pseudonym,
        language=language,
        case_phase=case_phase,
        district=district,
        state=state,
    )
    db.add(person)
    db.commit()
    db.refresh(person)
    return person


def log_access(db: Session, person_id: uuid.UUID, accessed_by: str, action: str = "edited") -> None:
    """Persist an access/audit record through the data-access boundary."""
    _log_access(db, person_id=person_id, accessed_by=accessed_by, action=action)


def get_person_history(db: Session, person_id: uuid.UUID, accessed_by: str) -> dict:
    person = db.query(Person).filter(Person.id == person_id).first()
    if person is None:
        return None

    _log_access(db, person_id=person_id, accessed_by=accessed_by, action="viewed")

    return {
        "person": person,
        "checkins": db.query(CheckIn).filter(CheckIn.person_id == person_id).all(),
        "scores": db.query(Score).filter(Score.person_id == person_id).all(),
        "case_events": db.query(CaseEvent).filter(CaseEvent.person_id == person_id).all(),
        "alerts": (
            db.query(Alert)
            .join(Score, Alert.score_id == Score.id)
            .filter(Score.person_id == person_id)
            .all()
        ),
    }


def create_checkin(
    db: Session,
    person_id: uuid.UUID,
    channel: str,
    raw_text: str,
    response_time_sec: int | None = None,
) -> CheckIn:
    checkin = CheckIn(
        person_id=person_id,
        channel=channel,
        raw_text=raw_text,
        response_time_sec=response_time_sec,
    )
    db.add(checkin)
    db.commit()
    db.refresh(checkin)
    return checkin


def create_score(
    db: Session,
    person_id: uuid.UUID,
    value: float,
    band: str,
    checkin_id: uuid.UUID | None = None,
    component_emotion: float | None = None,
    component_voice_stress: float | None = None,
    component_engagement: float | None = None,
    component_case_events: float | None = None,
    component_reported_stressors: float | None = None,
    component_trajectory: float | None = None,
) -> Score:
    score = Score(
        person_id=person_id,
        checkin_id=checkin_id,
        value=value,
        band=band,
        component_emotion=component_emotion,
        component_voice_stress=component_voice_stress,
        component_engagement=component_engagement,
        component_case_events=component_case_events,
        component_reported_stressors=component_reported_stressors,
        component_trajectory=component_trajectory,
    )
    db.add(score)
    db.commit()
    db.refresh(score)
    return score


def create_case_event(db: Session, person_id: uuid.UUID, event_type: str, event_date) -> CaseEvent:
    event = CaseEvent(person_id=person_id, event_type=event_type, event_date=event_date)
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


def create_alert(db: Session, score_id: uuid.UUID, severity: str, assigned_to: str | None = None) -> Alert:
    alert = Alert(
        score_id=score_id,
        severity=severity,
        status="open",
        assigned_to=assigned_to,
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)
    return alert


def acknowledge_alert(
    db: Session,
    alert_id: uuid.UUID,
    officer_decision: str,
    officer_reason: str | None = None,
) -> Alert:
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if alert is None:
        return None

    alert.status = "acknowledged"
    alert.acknowledged_at = datetime.utcnow()
    alert.officer_decision = officer_decision
    alert.officer_reason = officer_reason
    db.commit()
    db.refresh(alert)
    return alert


def get_open_alerts_for_officer(db: Session, officer_id: uuid.UUID) -> list[Alert]:
    officer = db.query(Officer).filter(Officer.id == officer_id).first()
    if officer is None:
        return []

    query = (
        db.query(Alert)
        .join(Score, Alert.score_id == Score.id)
        .join(Person, Score.person_id == Person.id)
        .filter(Alert.status == "open")
    )

    if officer.role == "admin":
        pass
    elif officer.role == "district_officer":
        query = query.filter(Person.district == officer.district)
    else:
        query = query.filter(Alert.assigned_to == str(officer.id))

    return query.all()
