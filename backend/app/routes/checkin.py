from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.data_access import create_checkin
from app.schemas import CheckinRequest, CheckinResponse, ScoreComponents
from app.business_logic import (
    BusinessLogicEngine,
    CaseSupportInputs,
    ConsentType,
    CaseSupportScore,
)

router = APIRouter()
engine = BusinessLogicEngine()


@router.post("/checkin", response_model=CheckinResponse)
def submit_checkin(payload: CheckinRequest, db: Session = Depends(get_db)):
    checkin = create_checkin(
        db,
        person_id=payload.person_id,
        channel=payload.channel,
        raw_text=payload.text,
    )

    # consent — simplified for now, real consent flow comes later
    engine.consent.set_consent(payload.person_id, ConsentType.ESSENTIAL_SERVICE, True)
    engine.consent.set_consent(payload.person_id, ConsentType.CASE_SUPPORT_MONITORING, True)
    engine.consent.set_consent(payload.person_id, ConsentType.SAFETY_ANALYSIS, True)

    # still fake ML inputs — real values come from your ML teammate later
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

    # his engine can return TWO different types — handle both
    if isinstance(result, CaseSupportScore):
        components = {c.component: c.raw_score for c in result.contributions}
        return CheckinResponse(
            person_id=payload.person_id,
            score=result.score,
            band=result.band.value,
            components=ScoreComponents(
                emotion=components.get("Expressed distress", 0),
                voice_stress=components.get("Voice stress", 0),
                engagement=components.get("Engagement change", 0),
                case_events=components.get("Case-event pressure", 0),
                reported_stressors=components.get("Reported external stressors", 0),
                trajectory=components.get("Trajectory", 0),
            ),
        )
    else:
        # SafetyAssessment — critical safety content was detected
        # this needs its own response shape eventually; for now return something safe
        return CheckinResponse(
            person_id=payload.person_id,
            score=100,
            band="priority",
            components=ScoreComponents(
                emotion=0, voice_stress=0, engagement=0,
                case_events=0, reported_stressors=0, trajectory=0,
            ),
        )