"""
Main check-in endpoints. Handles text/voice input, runs the conversational
AI, ML scoring models, and the business-logic scoring engine.

Two entry points share one pipeline:
  POST /checkin        JSON. Text, or a server-side audio path (see below).
  POST /checkin/audio  Multipart. An audio file uploaded by a client.

Both converge on `run_checkin_pipeline`, so the chatbot, crisis handling,
scoring engine and persistence behave identically however the input arrived.
Only the way the transcript and the audio path are obtained differs.
"""

import os
import tempfile
import uuid
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app.data_access import (
    create_checkin,
    get_recent_bands,
    get_recent_checkins_for_person,
    log_access,
    person_exists,
)
from app.schemas import CheckinRequest
from app.business_logic import (
    CaseSupportInputs,
    ConsentType,
    CaseSupportScore,
    SafetyAssessment,
)
from app.engine import engine
from app.chatbot import (
    SUPPORT_OFFER_BANDS,
    SUPPORT_OFFER_COOLDOWN_HOURS,
    build_support_offer,
    generate_reply,
)
from app.ml_services import predict_text_emotion, predict_voice_stress, transcribe_audio
from app.helpers import (
    calculate_engagement_change,
    calculate_case_event_pressure,
    calculate_trajectory,
    extract_reported_stressors,
)

router = APIRouter()

# Roughly 20 minutes of speech at a typical mobile bitrate. Enforced while
# streaming to disk so an oversized upload never lands in memory.
MAX_AUDIO_BYTES = 25 * 1024 * 1024

# Containers Whisper/ffmpeg and librosa can decode. Browser MediaRecorder
# produces .webm (Chrome/Firefox) or .mp4 (Safari).
ALLOWED_AUDIO_SUFFIXES = {
    ".wav", ".mp3", ".m4a", ".mp4", ".ogg", ".oga", ".opus", ".webm", ".flac",
}


def run_checkin_pipeline(
    db: Session,
    person_id: uuid.UUID,
    user_input_text: str,
    channel: str,
    audio_path: str | None = None,
):
    """
    The shared check-in pipeline: chatbot, crisis handling, ML scoring,
    persistence, and the business-logic scoring engine.

    `audio_path` is the only branch point. When it is set, the wav2vec2 voice
    stress model runs against that file; when it is None, that component stays
    at 0 exactly as the text path has always behaved.

    None of the scoring math in business_logic.py is touched here — this only
    assembles its inputs.
    """
    # Read the recent bands BEFORE scoring writes a new row, so we can tell
    # entering a band from already having been in it.
    prior_bands = get_recent_bands(db, person_id, within_hours=SUPPORT_OFFER_COOLDOWN_HOURS)

    # Step 1: consent (demo only; remove once real consent flow exists)
    engine.consent.set_consent(str(person_id), ConsentType.ESSENTIAL_SERVICE, True)
    engine.consent.set_consent(str(person_id), ConsentType.CASE_SUPPORT_MONITORING, True)
    engine.consent.set_consent(str(person_id), ConsentType.SAFETY_ANALYSIS, True)

    # Step 2: conversational AI (crisis check + Gemini reply)
    conversation_history = get_recent_checkins_for_person(db, person_id, limit=10)
    chat_result = generate_reply(
        person_id=str(person_id),
        user_input=user_input_text,
        conversation_history=conversation_history,
    )

    # Step 3: crisis path — store, skip ML scoring entirely
    if chat_result["is_crisis"]:
        create_checkin(
            db,
            person_id=person_id,
            channel=channel,
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

    # Step 4: normal path — run ML models
    try:
        expressed_distress = predict_text_emotion(user_input_text)
    except Exception as e:
        print(f"[ERROR] IndicBERT failed: {e}")
        expressed_distress = 50

    voice_stress = 0
    if audio_path:
        try:
            voice_stress = predict_voice_stress(audio_path)
        except Exception as e:
            print(f"[ERROR] Voice stress failed: {e}")
            voice_stress = 50

    engagement_change = calculate_engagement_change(db, person_id)
    case_event_pressure = calculate_case_event_pressure(db, person_id)
    reported_external_stressors = extract_reported_stressors(user_input_text)
    trajectory = calculate_trajectory(db, person_id)

    # Step 5: create the checkin record with the chatbot's reply attached
    checkin = create_checkin(
        db,
        person_id=person_id,
        channel=channel,
        raw_text=user_input_text,
        ai_response=chat_result["message"],
        is_crisis=False,
        language=chat_result["language"],
    )

    # Step 6: run the scoring engine
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

    # Step 7: the engine's own safety layer can still trigger independently
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
    band = result.band.value if result.band else None

    response = {
        "type": "score",
        "person_id": str(person_id),
        "checkin_id": str(checkin.id),
        "next_message": chat_result["message"],
        # False when next_message is a stand-in because the model was
        # unreachable, so the client can label it rather than present it as
        # a real reply.
        "ai_available": chat_result.get("ai_available", True),
        "score": result.score,
        "band": band,
        "components": {
            "emotion": components.get("Expressed distress", 0),
            "voice_stress": components.get("Voice stress", 0),
            "engagement": components.get("Engagement change", 0),
            "case_events": components.get("Case-event pressure", 0),
            "reported_stressors": components.get("Reported external stressors", 0),
            "trajectory": components.get("Trajectory", 0),
        },
    }

    # Step 8: optional support offer, on ENTERING the elevated/priority bands.
    #
    # Gated on the band from business_logic's own classifier rather than a
    # score threshold, so there is one definition of "elevated" in the system.
    #
    # Offered only when they were not already in an offer band during the
    # cooldown window. Because scoring runs per message, the band bounces
    # around mid-conversation; comparing against only the previous score would
    # treat each bounce as a new transition and offer support again and again.
    #
    # This is additive. The crisis path returned at step 3, long before here,
    # so nothing about this can delay or replace it.
    already_offered = any(b in SUPPORT_OFFER_BANDS for b in prior_bands)
    if band in SUPPORT_OFFER_BANDS and not already_offered:
        response["support_offer"] = build_support_offer(
            language=chat_result.get("language", "en")
        )

    return response


def _require_person(db: Session, person_id: uuid.UUID):
    """
    Confirm the person is real, and record the access.

    The existence test is a primary-key lookup rather than get_person_history,
    which loaded that person's entire history — every check-in, score, case
    event and alert — purely to test it for None, on every single message.

    The audit row that get_person_history used to write is kept, just written
    explicitly: a person's own check-in still touches their record, so it
    belongs in the access log. Only the full-history read was dropped.
    """
    if not person_exists(db, person_id):
        raise HTTPException(status_code=404, detail="Person not found")

    log_access(db, person_id=person_id, accessed_by="checkin_endpoint", action="viewed")


@router.post("/checkin")
def submit_checkin(payload: CheckinRequest, db: Session = Depends(get_db)):
    person_id = uuid.UUID(payload.person_id)
    _require_person(db, person_id)

    # NOTE: on this route, `text` for a "voice" channel is a path to a file on
    # the SERVER's filesystem — it predates the upload endpoint below and is
    # only reachable by server-side callers. Browser clients should post to
    # /checkin/audio instead.
    user_input_text = payload.text
    audio_path = None
    if payload.channel == "voice" and payload.text:
        audio_path = payload.text
        try:
            user_input_text = transcribe_audio(audio_path, language="hi")
            if not user_input_text:
                raise HTTPException(status_code=400, detail="Whisper transcription failed")
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Audio processing error: {str(e)}")

    return run_checkin_pipeline(
        db,
        person_id=person_id,
        user_input_text=user_input_text,
        channel=payload.channel,
        audio_path=audio_path,
    )


def _save_upload_to_temp(audio_file: UploadFile) -> str:
    """
    Stream an upload to a temp file and return its path.

    The caller owns the file and must delete it. Written in chunks so a large
    upload is never held in memory, and the size cap is enforced as we go
    rather than after the fact.
    """
    suffix = os.path.splitext(audio_file.filename or "")[1].lower()
    if suffix and suffix not in ALLOWED_AUDIO_SUFFIXES:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported audio format '{suffix}'. Accepted: "
            + ", ".join(sorted(ALLOWED_AUDIO_SUFFIXES)),
        )
    # MediaRecorder blobs often arrive with no filename at all.
    suffix = suffix or ".webm"

    handle, path = tempfile.mkstemp(prefix="checkin_audio_", suffix=suffix)
    written = 0
    try:
        with os.fdopen(handle, "wb") as out:
            while chunk := audio_file.file.read(1024 * 1024):
                written += len(chunk)
                if written > MAX_AUDIO_BYTES:
                    raise HTTPException(
                        status_code=413,
                        detail=f"Audio exceeds the {MAX_AUDIO_BYTES // (1024 * 1024)}MB limit.",
                    )
                out.write(chunk)
        if written == 0:
            raise HTTPException(status_code=400, detail="Audio file is empty.")
    except BaseException:
        os.unlink(path)
        raise

    return path


@router.post("/checkin/audio")
def submit_checkin_audio(
    person_id: str = Form(...),
    audio_file: UploadFile = File(...),
    language: str | None = Form(default=None),
    db: Session = Depends(get_db),
):
    """
    Voice check-in from a client that can only send bytes, not a server path.

    Saves the upload to a temp file, then runs the same pipeline as the text
    route — Whisper for the transcript, wav2vec2 for voice stress against the
    same file. `language` is optional; omitting it lets Whisper auto-detect,
    which matters for a service used in more than one language.
    """
    try:
        person_uuid = uuid.UUID(person_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="person_id must be a UUID.")

    # Reject an unknown person before spending anything on transcription.
    _require_person(db, person_uuid)

    audio_path = _save_upload_to_temp(audio_file)
    try:
        try:
            transcript = transcribe_audio(audio_path, language=language)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Audio processing error: {str(e)}")

        if not transcript:
            raise HTTPException(
                status_code=400,
                detail="Could not make out any speech in that recording.",
            )

        result = run_checkin_pipeline(
            db,
            person_id=person_uuid,
            user_input_text=transcript,
            channel="voice",
            audio_path=audio_path,
        )
        # Hand the transcript back so the client can show the person their own
        # words. Without it a voice check-in appears in the conversation as an
        # anonymous "voice message" and they cannot tell what was heard.
        result["transcript"] = transcript
        return result
    finally:
        # The recording is personal data; it exists only for the length of
        # this request. Only the transcript is persisted.
        try:
            os.unlink(audio_path)
        except OSError as e:
            print(f"[WARN] Could not remove temp audio {audio_path}: {e}")
