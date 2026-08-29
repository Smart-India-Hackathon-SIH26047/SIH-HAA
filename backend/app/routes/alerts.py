from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Literal
from app.database import get_db
from app.data_access import get_open_alerts_for_officer
from app.business_logic import BusinessLogicEngine

router = APIRouter()
engine = BusinessLogicEngine()


class AcknowledgeRequest(BaseModel):
    reviewer_ref: str
    decision: Literal["Agree", "Disagree"]
    reason: str = ""


@router.get("/officers/{officer_id}/alerts")
def read_open_alerts(officer_id: str, db: Session = Depends(get_db)):
    alerts = get_open_alerts_for_officer(db, officer_id=officer_id)
    return [
        {
            "id": str(a.id),
            "score_id": str(a.score_id),
            "severity": a.severity,
            "status": a.status,
            "assigned_to": a.assigned_to,
        }
        for a in alerts
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