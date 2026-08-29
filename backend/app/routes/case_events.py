from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import date
from app.database import get_db
from app.data_access import create_case_event

router = APIRouter()


class CaseEventRequest(BaseModel):
    person_id: str
    event_type: str
    event_date: date


@router.post("/case-events")
def add_case_event(payload: CaseEventRequest, db: Session = Depends(get_db)):
    event = create_case_event(
        db,
        person_id=payload.person_id,
        event_type=payload.event_type,
        event_date=payload.event_date,
    )
    return {
        "id": str(event.id),
        "person_id": str(event.person_id),
        "event_type": event.event_type,
        "event_date": event.event_date.isoformat(),
    }