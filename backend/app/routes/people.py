import secrets

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.data_access import create_person, get_person_history, list_people

router = APIRouter()


class AnonymousPersonRequest(BaseModel):
    """Everything here is optional — that is the point of the route."""
    language: str = "en"
    district: str = "Unassigned"
    state: str = "Unassigned"
    case_phase: str = "investigation"


@router.post("/people/anonymous")
def create_anonymous_person(payload: AnonymousPersonRequest, db: Session = Depends(get_db)):
    """
    Register someone without asking for anything about them.

    People are already pseudonymous throughout this system — `people` stores a
    pseudonym, never a name — so an anonymous sign-up is the same record with a
    generated code instead of one issued by a case worker.

    Honest about what this is: check-ins ARE still stored against this record,
    because monitoring distress over time is the whole purpose. What is not
    collected is any way to identify the person behind the code. Losing the
    code means losing the history, and there is no recovery.
    """
    for _ in range(5):
        pseudonym = f"ANON-{secrets.token_hex(3).upper()}"
        try:
            person = create_person(
                db,
                pseudonym=pseudonym,
                language=payload.language,
                case_phase=payload.case_phase,
                district=payload.district,
                state=payload.state,
            )
        except Exception:
            db.rollback()
            continue  # pseudonym collision; try another
        return {
            "id": str(person.id),
            "pseudonym": person.pseudonym,
            "district": person.district,
            "state": person.state,
        }

    raise HTTPException(status_code=500, detail="Could not allocate a case code.")


@router.get("/people")
def read_people(
    district: str | None = None,
    state: str | None = None,
    db: Session = Depends(get_db),
):
    """
    Case list for the officer dashboard, optionally filtered by district
    and/or state. `band` is the person's most recent score band, or null if
    they have not been scored yet.
    """
    rows = list_people(db, district=district, state=state)
    return [
        {
            "id": str(person.id),
            # People are recorded under a pseudonym; no real name is stored.
            "pseudonym": person.pseudonym,
            "district": person.district,
            "state": person.state,
            "case_phase": person.case_phase,
            # Most recent score. All three are null for someone never scored.
            "band": band,
            "score": value,
            "last_scored_at": scored_at.isoformat() if scored_at else None,
        }
        for person, band, value, scored_at in rows
    ]


@router.get("/people/{person_id}/history")
def read_person_history(person_id: str, accessed_by: str, db: Session = Depends(get_db)):
    history = get_person_history(db, person_id=person_id, accessed_by=accessed_by)
    if history is None:
        raise HTTPException(status_code=404, detail="Person not found")

    return {
        "person": {
            "id": str(history["person"].id),
            "pseudonym": history["person"].pseudonym,
            "district": history["person"].district,
            "state": history["person"].state,
            "case_phase": history["person"].case_phase,
        },
        "checkins": [
            {"id": str(c.id), "channel": c.channel, "raw_text": c.raw_text, "created_at": c.created_at.isoformat()}
            for c in history["checkins"]
        ],
        "scores": [
            {
                "id": str(s.id), "value": s.value, "band": s.band,
                "created_at": s.created_at.isoformat(),
                "components": {
                    "emotion": s.component_emotion,
                    "voice_stress": s.component_voice_stress,
                    "engagement": s.component_engagement,
                    "case_events": s.component_case_events,
                    "reported_stressors": s.component_reported_stressors,
                    "trajectory": s.component_trajectory,
                },
            }
            for s in history["scores"]
        ],
        "case_events": [
            {"id": str(e.id), "event_type": e.event_type, "event_date": e.event_date.isoformat()}
            for e in history["case_events"]
        ],
        "alerts": [
            {"id": str(a.id), "severity": a.severity, "status": a.status, "assigned_to": a.assigned_to}
            for a in history["alerts"]
        ],
    }