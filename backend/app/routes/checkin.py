"""
Main check-in endpoint. Handles text/voice input, runs the conversational
AI, ML scoring models, and the business-logic scoring engine.
"""

import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.data_access import create_checkin, get_person_history, get_recent_checkins_for_person
from app.schemas import CheckinRequest
from app.business_logic import (
    CaseSupportInputs,
    ConsentType,
    CaseSupportScore,
    SafetyAssessment,
)
from app.engine import engine
from app.chatbot import generate_reply
from app.ml_services import predict_text_emotion, predict_voice_stress, transcribe_audio
from app.helpers import (
    calculate_engagement_change,
    calculate_case_event_pressure,
    calculate_trajectory,
    extract_reported_stressors,
)

router = APIRouter()


@router.post("/checkin")
def submit_checkin(payload: CheckinRequest, db: Session = Depends(get_db)):
    person_id = uuid.UUID(payload.person_id)

    history = get_person_history(db, person_id, accessed_by="checkin_endpoint")
    if history is None:
        raise HTTPException(status_code=404, detail="Person not found")

    # Step 1: transcribe audio if this is a voice check-in
    user_input_text = payload.text
    if payload.channel == "voice" and payload.text:
        try:
            user_input_text = transcribe_audio(payload.text, language="hi")
            if not user_input_text:
                raise HTTPException(status_code=400, detail="Whisper transcription failed")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Audio processing error: {str(e)}")

    # Step 2: consent (demo only; remove once real consent flow exists)
    engine.consent.set_consent(str(person_id), ConsentType.ESSENTIAL_SERVICE, True)
    engine.consent.set_consent(str(person_id), ConsentType.CASE_SUPPORT_MONITORING, True)
    engine.consent.set_consent(str(person_id), ConsentType.SAFETY_ANALYSIS, True)

    # Step 3: conversational AI (crisis check + Gemini reply)
    conversation_history = get_recent_checkins_for_person(db, person_id, limit=10)
    chat_result = generate_reply(
        person_id=str(person_id),
        user_input=user_input_text,
        conversation_history=conversation_history,
    )

    # Step 4: crisis path — store, skip ML scoring entirely
    if chat_result["is_crisis"]:
        create_checkin(
            db,
            person_id=person_id,
            channel=payload.channel,
            raw_text=user_input_text,
            ai_response=None,
            is_crisis=True,
            language=chat_result["language"],
        )
        return {
            "type": "safety_flag",
            "person_id": str(person_id),
            "message": "Your wellbeing is important. Please reach out immediately:",
            "helplines": chat_result["helplines"],
        }

    # Step 5: normal path — run ML models
    try:
        expressed_distress = predict_text_emotion(user_input_text)
    except Exception as e:
        print(f"[ERROR] IndicBERT failed: {e}")
        expressed_distress = 50

    voice_stress = 0
    if payload.channel == "voice" and payload.text:
        try:
            voice_stress = predict_voice_stress(payload.text)
        except Exception as e:
            print(f"[ERROR] Voice stress failed: {e}")
            voice_stress = 50

    engagement_change = calculate_engagement_change(db, person_id)
    case_event_pressure = calculate_case_event_pressure(db, person_id)
    reported_external_stressors = extract_reported_stressors(user_input_text)
    trajectory = calculate_trajectory(db, person_id)

    # Step 6: create the checkin record with the chatbot's reply attached
    checkin = create_checkin(
        db,
        person_id=person_id,
        channel=payload.channel,
        raw_text=user_input_text,
        ai_response=chat_result["message"],
        is_crisis=False,
        language=chat_result["language"],
    )

    # Step 7: run the scoring engine
    inputs = CaseSupportInputs(
        expressed_distress=expressed_distress,
        voice_stress=voice_stress,
        engagement_change=engagement_change,
        case_event_pressure=case_event_pressure,
        reported_external_stressors=reported_external_stressors,
        trajectory=trajectory,
        check_in_text=user_input_text,
    )

    result = engine.submit_case_score(
        db=db,
        person_id=person_id,
        checkin_id=checkin.id,
        user_ref=str(person_id),
        inputs=inputs,
    )

    # Step 8: the engine's own safety layer can still trigger independently
    if isinstance(result, SafetyAssessment):
        return {
            "type": "safety_flag",
            "person_id": str(person_id),
            "level": result.level.value,
            "reason": result.reason,
            "recommended_response": result.recommended_response,
            "helpline_info": result.helpline_info,
        }

    components = {c.component: c.raw_score for c in result.contributions}
    return {
        "type": "score",
        "person_id": str(person_id),
        "checkin_id": str(checkin.id),
        "next_message": chat_result["message"],
        "score": result.score,
        "band": result.band.value if result.band else None,
        "components": {
            "emotion": components.get("Expressed distress", 0),
            "voice_stress": components.get("Voice stress", 0),
            "engagement": components.get("Engagement change", 0),
            "case_events": components.get("Case-event pressure", 0),
            "reported_stressors": components.get("Reported external stressors", 0),
            "trajectory": components.get("Trajectory", 0),
        },
    }