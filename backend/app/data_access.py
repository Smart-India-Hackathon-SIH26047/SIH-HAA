"""
Data access layer for the MoSJE Distress Monitoring Chatbot.

Every function here is the ONLY way the rest of the app touches the
database. No other file should write raw SQLAlchemy queries directly.
"""

import uuid
from datetime import datetime, timedelta
from sqlalchemy import func, select
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


def person_exists(db: Session, person_id: uuid.UUID) -> bool:
    """
    Cheap existence check: a single indexed primary-key lookup selecting no
    columns beyond the id.

    Callers that only need to know whether a person is real should use this
    rather than get_person_history, which loads every check-in, score, case
    event and alert for that person and writes an audit row.
    """
    return db.query(Person.id).filter(Person.id == person_id).first() is not None


def get_recent_bands(db: Session, person_id: uuid.UUID, within_hours: int) -> list[str]:
    """
    Every band this person has been scored into over the last `within_hours`.

    A window rather than just the previous band, because scoring runs on each
    message and the band can oscillate mid-conversation (elevated -> watch ->
    elevated). Comparing against only the immediately preceding score would
    read each bounce as a fresh transition and re-offer support repeatedly.
    """
    cutoff = datetime.utcnow() - timedelta(hours=within_hours)
    rows = (
        db.query(Score.band)
        .filter(Score.person_id == person_id, Score.created_at >= cutoff)
        .all()
    )
    return [row[0] for row in rows]


def list_people(
    db: Session,
    district: str | None = None,
    state: str | None = None,
) -> list[tuple[Person, str | None, float | None, datetime | None]]:
    """
    People, optionally narrowed by district and/or state, each paired with the
    band, value and timestamp of their most recent score. All three are None
    if they have never been scored.

    The latest score is picked with a window function rather than a per-person
    query, so this stays one round trip however many people match. People with
    no scores are kept via an outer join — a newly registered person must still
    appear in a case list.

    Matching on district/state is case-insensitive so query params coming from
    a UI do not have to match the seed data's capitalisation exactly.
    """
    ranked_scores = (
        select(
            Score.person_id.label("person_id"),
            Score.band.label("band"),
            Score.value.label("value"),
            Score.created_at.label("created_at"),
            func.row_number()
            .over(
                partition_by=Score.person_id,
                # id breaks ties when two scores share a timestamp, so the
                # "latest" is stable rather than arbitrary.
                order_by=(Score.created_at.desc(), Score.id.desc()),
            )
            .label("rank"),
        )
        .subquery()
    )

    query = db.query(
        Person,
        ranked_scores.c.band,
        ranked_scores.c.value,
        ranked_scores.c.created_at,
    ).outerjoin(
        ranked_scores,
        (ranked_scores.c.person_id == Person.id) & (ranked_scores.c.rank == 1),
    )

    if district:
        query = query.filter(func.lower(Person.district) == district.strip().lower())
    if state:
        query = query.filter(func.lower(Person.state) == state.strip().lower())

    query = query.order_by(Person.district, Person.pseudonym)

    return [(row.Person, row.band, row.value, row.created_at) for row in query.all()]


def create_checkin(
    db: Session,
    person_id: uuid.UUID,
    channel: str,
    raw_text: str,
    ai_response: str | None = None,
    is_crisis: bool = False,
    language: str | None = None,
    response_time_sec: int | None = None,
) -> CheckIn:
    checkin = CheckIn(
        person_id=person_id,
        channel=channel,
        raw_text=raw_text,
        ai_response=ai_response,
        is_crisis=is_crisis,
        language=language,
        response_time_sec=response_time_sec,
    )
    db.add(checkin)
    db.commit()
    db.refresh(checkin)
    return checkin

def get_recent_checkins_for_person(db: Session, person_id: uuid.UUID, limit: int = 10) -> list[dict]:
    """
    Returns the last `limit` check-ins for a person, formatted as
    conversation history for the chatbot (Gemini's expected shape).
    """
    checkins = (
        db.query(CheckIn)
        .filter(CheckIn.person_id == person_id)
        .order_by(CheckIn.created_at.desc())
        .limit(limit)
        .all()
    )
    checkins.reverse()  # oldest first

    history = []
    for checkin in checkins:
        history.append({"role": "user", "parts": [checkin.raw_text]})
        if checkin.ai_response:
            history.append({"role": "model", "parts": [checkin.ai_response]})

    return history

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


def get_open_alerts_for_officer(
    db: Session, officer_id: uuid.UUID
) -> list[tuple[Alert, Person, Score]]:
    """
    Open alerts visible to this officer, each paired with the person the alert
    is about and the score that raised it.

    Both joins were already required for district scoping; selecting the joined
    rows as well means a caller can name the case without a second query.
    """
    officer = db.query(Officer).filter(Officer.id == officer_id).first()
    if officer is None:
        return []

    query = (
        db.query(Alert, Person, Score)
        .select_from(Alert)
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

    return [(row.Alert, row.Person, row.Score) for row in query.all()]