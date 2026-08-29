from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.data_access import create_checkin
from app.schemas import CheckinRequest, ScoreComponents
from app.business_logic import (
    BusinessLogicEngine,
    CaseSupportInputs,
    ConsentType,
    CaseSupportScore,
)

router = APIRouter()
engine = BusinessLogicEngine()


@router.post("/checkin")
def submit_checkin(payload: CheckinRequest, db: Session = Depends(get_db)):
    checkin = create_checkin(
        db,
        person_id=payload.person_id,
        channel=payload.channel,
        raw_text=payload.text,
    )

    engine.consent.set_consent(payload.person_id, ConsentType.ESSENTIAL_SERVICE, True)
    engine.consent.set_consent(payload.person_id, ConsentType.CASE_SUPPORT_MONITORING, True)
    engine.consent.set_consent(payload.person_id, ConsentType.SAFETY_ANALYSIS, True)

    inputs = CaseSupportInputs(
        expressed_distress=60,
        voice_stress=40,
        engagement_change=50,
        case_event_pressure=70,
        reported_external_stressors=30,
        trajectory=50,
        check_in_text=payload.text,
    )

    result = engine.submit_case_score(
        db=db,
        person_id=payload.person_id,
        checkin_id=checkin.id,
        user_ref=payload.person_id,
        inputs=inputs,
    )

    if isinstance(result, CaseSupportScore):
        components = {c.component: c.raw_score for c in result.contributions}
        return {
            "type": "score",
            "person_id": payload.person_id,
            "score": result.score,
            "band": result.band.value,
            "components": {
                "emotion": components.get("Expressed distress", 0),
                "voice_stress": components.get("Voice stress", 0),
                "engagement": components.get("Engagement change", 0),
                "case_events": components.get("Case-event pressure", 0),
                "reported_stressors": components.get("Reported external stressors", 0),
                "trajectory": components.get("Trajectory", 0),
            },
        }
    else:
        # genuinely a SafetyAssessment — surface it honestly, no faked score
        return {
            "type": "safety_flag",
            "person_id": payload.person_id,
            "level": result.level.value,
            "reason": result.reason,
            "recommended_response": result.recommended_response,
            "helpline_info": result.helpline_info,
        }