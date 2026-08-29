from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.data_access import get_person_history

router = APIRouter()


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