"""
Gap 3 — POST /checkin/audio runs uploaded audio through the real pipeline.

ml_services and chatbot are stubbed (no torch installed, and chatbot needs a
Gemini key at import). business_logic, engine and helpers are REAL, so the
scoring engine genuinely runs and we can prove voice stress reaches it.

Run: python -m tests.test_checkin_audio    (from backend/)
"""

import glob
import os
import sys
import tempfile

from tests.support import Check, ChatbotStub, MlStub, fresh_db, http_client, make_person

ml = MlStub().install()
chat = ChatbotStub().install()

from app.routes.checkin import router  # noqa: E402  (must follow the stubs)


def temp_audio_count():
    return len(glob.glob(os.path.join(tempfile.gettempdir(), "checkin_audio_*")))


def main():
    check = Check()
    db = fresh_db()
    client = http_client(router, db)
    person = make_person(db, "JPR-0001")

    audio = b"\x1aE\xdf\xa3fake-webm-bytes" * 64

    def post_audio(filename="clip.webm", data=None, person_id=None, **extra):
        return client.post(
            "/checkin/audio",
            data={"person_id": person_id or str(person.id), **extra},
            files={"audio_file": (filename, data if data is not None else audio, "audio/webm")},
        )

    print("\n[happy path]")
    before = temp_audio_count()
    response = post_audio()
    check.equals("200 OK", response.status_code, 200)
    body = response.json()
    check.equals("returns a score, not a safety flag", body["type"], "score")
    check.equals("person echoed back", body["person_id"], str(person.id))
    check.that("chatbot reply included", bool(body["next_message"]))
    check.that("band assigned", body["band"] in {"stable", "watch", "elevated", "priority"})

    print("\n[the actual point: voice stress is real now]")
    check.equals("wav2vec2 was called once", len(ml.voice_stress_calls), 1)
    check.that(
        "it was called with the uploaded audio file, not the transcript",
        ml.voice_stress_calls[0].endswith(".webm")
        and "checkin_audio_" in ml.voice_stress_calls[0],
        ml.voice_stress_calls[0],
    )
    check.that(
        "voice_stress reached the scoring engine as non-zero",
        body["components"]["voice_stress"] > 0,
        body["components"],
    )
    check.equals(
        "whisper got the same file",
        ml.transcribe_calls[0]["path"],
        ml.voice_stress_calls[0],
    )
    check.equals(
        "transcript, not raw bytes, went to the chatbot",
        chat.calls[-1]["user_input"],
        ml.transcript,
    )
    check.equals("language auto-detects when not supplied", ml.transcribe_calls[0]["language"], None)

    print("\n[temp file hygiene]")
    check.equals("temp audio deleted after the request", temp_audio_count(), before)

    print("\n[persistence]")
    from app.models import CheckIn

    stored = db.query(CheckIn).order_by(CheckIn.created_at.desc()).first()
    check.equals("stored on the voice channel", stored.channel, "voice")
    check.equals("stored the transcript", stored.raw_text, ml.transcript)
    check.that("stored the chatbot reply", bool(stored.ai_response))

    print("\n[explicit language]")
    ml.transcribe_calls.clear()
    post_audio(**{"language": "hi"})
    check.equals("language passed through", ml.transcribe_calls[0]["language"], "hi")

    print("\n[rejections]")
    check.equals("non-UUID person_id -> 422", post_audio(person_id="not-a-uuid").status_code, 422)
    check.equals(
        "unknown person -> 404",
        post_audio(person_id="00000000-0000-0000-0000-000000000000").status_code,
        404,
    )
    check.equals("unsupported format -> 415", post_audio(filename="notes.txt").status_code, 415)
    check.equals("empty upload -> 400", post_audio(data=b"").status_code, 400)

    before_reject = temp_audio_count()
    oversized = post_audio(data=b"0" * (26 * 1024 * 1024))
    check.equals("oversized upload -> 413", oversized.status_code, 413)
    check.equals("oversized upload leaves no temp file", temp_audio_count(), before_reject)

    print("\n[unknown person is rejected before any transcription]")
    ml.transcribe_calls.clear()
    post_audio(person_id="00000000-0000-0000-0000-000000000000")
    check.equals("whisper never ran", len(ml.transcribe_calls), 0)

    print("\n[silence and failure]")
    ml.transcript = ""
    check.equals("no speech detected -> 400", post_audio().status_code, 400)
    check.equals("no temp file left behind", temp_audio_count(), before)
    ml.transcript = "I have not been sleeping much lately."

    ml.transcribe_error = RuntimeError("ffmpeg not found")
    failed = post_audio()
    check.equals("transcription crash -> 500", failed.status_code, 500)
    check.equals("still no temp file left behind", temp_audio_count(), before)
    ml.transcribe_error = None

    print("\n[crisis path skips ML scoring]")
    chat.is_crisis = True
    ml.voice_stress_calls.clear()
    crisis = post_audio().json()
    check.equals("returns safety_flag", crisis["type"], "safety_flag")
    check.that("helplines included", len(crisis["helplines"]) > 0)
    check.equals("voice stress model skipped on crisis", len(ml.voice_stress_calls), 0)
    crisis_row = db.query(CheckIn).order_by(CheckIn.created_at.desc()).first()
    check.that("crisis check-in still stored", crisis_row.is_crisis)
    chat.is_crisis = False

    print("\n[regression: text /checkin unchanged]")
    text_response = client.post(
        "/checkin", json={"person_id": str(person.id), "text": "Feeling alright.", "channel": "chat"}
    )
    check.equals("text check-in still 200", text_response.status_code, 200)
    check.equals(
        "text path leaves voice_stress at 0",
        text_response.json()["components"]["voice_stress"],
        0,
    )
    check.equals(
        "text path never calls the voice model",
        len(ml.voice_stress_calls),
        0,
    )

    db.close()
    return check.report()


if __name__ == "__main__":
    sys.exit(main())
