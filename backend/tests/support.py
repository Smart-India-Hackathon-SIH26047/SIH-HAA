"""
Test support: runs the real models and data-access code against an in-memory
SQLite database, so these tests need no Postgres and touch no real data.

The models use the Postgres-specific UUID column type, so it is compiled down
to CHAR(36) for SQLite. Everything else — constraints, joins, relationships —
is exercised exactly as written.

Import this module BEFORE anything that imports app.database.
"""

import os

os.environ.setdefault("DATABASE_URL", "sqlite://")

import uuid as _uuid  # noqa: E402

from sqlalchemy.dialects.postgresql import UUID  # noqa: E402
from sqlalchemy.ext.compiler import compiles  # noqa: E402


@compiles(UUID, "sqlite")
def _compile_uuid_sqlite(type_, compiler, **kw):  # noqa: ARG001
    return "CHAR(36)"


# The routes pass officer/person ids around as strings and compare them
# against UUID columns. psycopg2 casts those for us on Postgres; SQLite does
# not, so coerce them here to keep the harness faithful to production.
_original_bind_processor = UUID.bind_processor


def _coercing_bind_processor(self, dialect):
    inner = _original_bind_processor(self, dialect)

    def process(value):
        if isinstance(value, str):
            value = _uuid.UUID(value)  # invalid ids raise, as Postgres would
        return inner(value) if inner else value

    return process


UUID.bind_processor = _coercing_bind_processor


from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

import app.database as database  # noqa: E402
from app.database import Base  # noqa: E402
from app.models import Alert, CaseEvent, CheckIn, Officer, Person, Score  # noqa: E402,F401

# TestClient serves requests on a worker thread, and an in-memory SQLite
# connection is thread-bound by default. StaticPool keeps every thread on the
# one connection so the database does not vanish between setup and request.
engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)

# Point the app's module-level handles at the test engine too, so anything
# reaching for them directly gets the same database.
database.engine = engine
database.SessionLocal = SessionLocal


def fresh_db():
    """Drop and recreate every table, returning a clean session."""
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    return SessionLocal()


def make_person(db, pseudonym, district="Jaipur", state="Rajasthan", case_phase="trial"):
    person = Person(
        pseudonym=pseudonym,
        language="hi",
        case_phase=case_phase,
        district=district,
        state=state,
    )
    db.add(person)
    db.commit()
    db.refresh(person)
    return person


def make_officer(db, name, role, district="Jaipur"):
    officer = Officer(name=name, role=role, district=district)
    db.add(officer)
    db.commit()
    db.refresh(officer)
    return officer


def make_score(db, person, value, band, created_at=None):
    score = Score(person_id=person.id, value=value, band=band)
    if created_at is not None:
        score.created_at = created_at
    db.add(score)
    db.commit()
    db.refresh(score)
    return score


def make_alert(db, score, severity="high", status="open", assigned_to=None):
    alert = Alert(
        score_id=score.id,
        severity=severity,
        status=status,
        assigned_to=assigned_to,
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)
    return alert


class MlStub:
    """
    Stand-in for app.ml_services. Records every call so a test can assert what
    the pipeline fed the models, and lets each test choose the return values.

    Needed because torch/transformers/whisper/librosa are not installed in the
    test environment, and because loading three real models per test run would
    make these tests unusable. business_logic, engine and helpers stay REAL, so
    the scoring math is genuinely exercised.
    """

    def __init__(self):
        self.transcribe_calls = []
        self.voice_stress_calls = []
        self.text_emotion_calls = []
        self.transcript = "I have not been sleeping much lately."
        self.voice_stress = 82
        self.text_emotion = 64
        self.transcribe_error = None

    def install(self):
        import sys
        import types as _types

        ml = _types.ModuleType("app.ml_services")

        def transcribe_audio(audio_path, language="en"):
            self.transcribe_calls.append({"path": audio_path, "language": language})
            if self.transcribe_error:
                raise self.transcribe_error
            return self.transcript

        def predict_voice_stress(audio_path):
            self.voice_stress_calls.append(audio_path)
            return self.voice_stress

        def predict_text_emotion(text):
            self.text_emotion_calls.append(text)
            return self.text_emotion

        ml.transcribe_audio = transcribe_audio
        ml.predict_voice_stress = predict_voice_stress
        ml.predict_text_emotion = predict_text_emotion
        ml.load_all_models = lambda: None
        sys.modules["app.ml_services"] = ml
        return self


class ChatbotStub:
    """
    Stand-in for app.chatbot, which builds a genai client at import time and
    therefore needs GEMINI_API_KEY just to be imported.
    """

    def __init__(self):
        self.calls = []
        self.message = "That sounds hard. What has the last week been like?"
        self.is_crisis = False
        self.language = "en"
        self.helplines = [{"name": "Tele-MANAS", "number": "1860-445-4435"}]

    def install(self):
        """
        Replace ONLY generate_reply, the function that calls Gemini.

        Everything else in the module — the system prompt, the safety filter,
        the crisis keywords, the support-offer builder — is carried over from
        the real module so tests exercise the genuine article.
        """
        import sys
        import types as _types

        # The real module builds a genai client at import time.
        os.environ.setdefault("GEMINI_API_KEY", "dummy-for-import")
        import app.chatbot as real_chatbot

        def generate_reply(person_id, user_input, conversation_history=None):
            self.calls.append({"person_id": person_id, "user_input": user_input})
            return {
                "message": self.message,
                "is_crisis": self.is_crisis,
                "language": self.language,
                "helplines": self.helplines,
            }

        chatbot = _types.ModuleType("app.chatbot")
        chatbot.__dict__.update(real_chatbot.__dict__)
        chatbot.generate_reply = generate_reply
        sys.modules["app.chatbot"] = chatbot
        return self


def http_client(router, db):
    """
    A TestClient over a minimal app containing just `router`, with get_db
    overridden to the test session.

    Deliberately not app.main: importing that loads IndicBERT, wav2vec2 and
    Whisper at module scope, which these tests do not need.
    """
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    from app.database import get_db

    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_db] = lambda: db
    return TestClient(app)


class Check:
    """Tiny assertion counter so each script can report pass/fail plainly."""

    def __init__(self):
        self.passed = 0
        self.failed = 0

    def that(self, label, condition, detail=""):
        if condition:
            self.passed += 1
            print(f"  PASS  {label}")
        else:
            self.failed += 1
            print(f"  FAIL  {label}{f' -- {detail}' if detail else ''}")

    def equals(self, label, actual, expected):
        self.that(label, actual == expected, f"got {actual!r}, expected {expected!r}")

    def report(self):
        print(f"\n{self.passed} passed, {self.failed} failed")
        return 1 if self.failed else 0
