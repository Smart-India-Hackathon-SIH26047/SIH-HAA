from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Literal
from app.database import get_db
from app.data_access import get_open_alerts_for_officer
from app.business_logic import BusinessLogicEngine
from app.engine import engine
router = APIRouter()



class AcknowledgeRequest(BaseModel):
    reviewer_ref: str
    decision: Literal["Agree", "Disagree"]
    reason: str = ""


@router.get("/officers/{officer_id}/alerts")
def read_open_alerts(officer_id: str, db: Session = Depends(get_db)):
    rows = get_open_alerts_for_officer(db, officer_id=officer_id)
    return [
        {
            # Existing fields — unchanged.
            "id": str(alert.id),
            "score_id": str(alert.score_id),
            "severity": alert.severity,
            "status": alert.status,
            "assigned_to": alert.assigned_to,
            # Who the alert is about. People are recorded under a pseudonym;
            # there is no real name stored anywhere in this system.
            "person_id": str(person.id),
            "pseudonym": person.pseudonym,
            "district": person.district,
            # The band from the score that raised this alert. Note this is a
            # different vocabulary from `severity` above.
            "band": score.band,
        }
        for alert, person, score in rows
    ]


@router.post("/alerts/{alert_id}/acknowledge")
def acknowledge(alert_id: str, payload: AcknowledgeRequest, db: Session = Depends(get_db)):
    try:
        result = engine.acknowledge(
            db=db,
            alert_id=alert_id,
            reviewer_ref=payload.reviewer_ref,
            decision=payload.decision,
            reason=payload.reason,
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    if result is None:
        raise HTTPException(status_code=404, detail="Alert not found")

    return {
        "id": str(result.id),
        "status": result.status,
        "officer_decision": result.officer_decision,
        "officer_reason": result.officer_reason,
        "acknowledged_at": result.acknowledged_at.isoformat() if result.acknowledged_at else None,
    }