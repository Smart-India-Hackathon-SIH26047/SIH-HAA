from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.data_access import create_checkin, create_score
from app.schemas import CheckinRequest, CheckinResponse, ScoreComponents

router = APIRouter()

@router.post("/checkin", response_model=CheckinResponse)
def submit_checkin(payload: CheckinRequest, db: Session = Depends(get_db)):
    checkin = create_checkin(
        db,
        person_id=payload.person_id,
        channel=payload.channel,
        raw_text=payload.text,
    )

    components = ScoreComponents(
        emotion=0.5,
        voice_stress=0.5,
        engagement=0.5,
        case_events=0.5,
        reported_stressors=0.5,
        trajectory=0.5,
    )

    score = create_score(
        db,
        person_id=payload.person_id,
        checkin_id=checkin.id,
        value=0.5,
        band="stable",
        component_emotion=0.5,
        component_voice_stress=0.5,
        component_engagement=0.5,
        component_case_events=0.5,
        component_reported_stressors=0.5,
        component_trajectory=0.5,
    )

    return CheckinResponse(
        person_id=payload.person_id,
        score=score.value,
        band=score.band,
        components=components,
    )