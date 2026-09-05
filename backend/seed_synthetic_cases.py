"""
Generates realistic synthetic case timelines for demo purposes.

Each "case" is a fictional person with:
- a registration profile
- a sequence of case events (hearings, delays, threats, compensation)
- a sequence of check-ins with text that reflects rising/falling distress
  in response to those events
- computed scores via the real business_logic engine (not faked)

Run with: python seed_synthetic_cases.py

This does NOT wipe existing data -- it only adds new people, checkins,
scores, and case_events. Safe to run alongside real test data.
"""

import random
from datetime import date, timedelta

from app.database import SessionLocal
from app.data_access import create_person, create_checkin, create_case_event
from app.business_logic import BusinessLogicEngine, CaseSupportInputs, ConsentType

db = SessionLocal()
engine = BusinessLogicEngine()

DISTRICTS = [
    ("Jaipur", "Rajasthan"),
    ("Jodhpur", "Rajasthan"),
    ("Lucknow", "Uttar Pradesh"),
    ("Patna", "Bihar"),
    ("Bhopal", "Madhya Pradesh"),
]

LANGUAGES = ["hi", "en", "mr", "bn"]

CASE_PHASES = ["investigation", "trial", "rehabilitation", "compensation"]

CASE_TEMPLATES = [
    {
        "phase_start": "investigation",
        "timeline": [
            (0, None, "The police visited and took my statement. It was okay.", (30, 20, 10, 20, 10)),
            (7, "hearing_scheduled", "I heard the first hearing date has been set.", (35, 25, 15, 30, 15)),
            (14, None, "Waiting is hard but I am managing.", (40, 30, 20, 35, 20)),
            (21, "hearing_delayed", "The hearing got postponed again. I am tired.", (60, 45, 40, 65, 35)),
            (28, "threat_reported", "Someone from their family came near our house yesterday.", (75, 60, 55, 80, 70)),
            (35, None, "I am scared to go outside now.", (78, 65, 60, 80, 72)),
        ],
    },
    {
        "phase_start": "trial",
        "timeline": [
            (0, None, "The trial has started. I am nervous but ready.", (55, 40, 30, 50, 25)),
            (10, "hearing_scheduled", "Next hearing is set for next month.", (45, 35, 25, 40, 20)),
            (20, None, "The lawyer explained things clearly. I feel a bit better.", (30, 20, 15, 25, 10)),
            (30, None, "Things are calmer this week.", (20, 15, 10, 20, 5)),
        ],
    },
    {
        "phase_start": "investigation",
        "timeline": [
            (0, None, "Everything is fine for now.", (15, 10, 5, 15, 5)),
            (10, None, "Still managing okay.", (18, 12, 8, 18, 8)),
            (20, "threat_reported", "They threatened my brother today. I don't know what to do.", (90, 80, 70, 85, 90)),
        ],
    },
    {
        "phase_start": "rehabilitation",
        "timeline": [
            (0, None, "Waiting for the compensation to come through.", (50, 35, 30, 45, 30)),
            (15, None, "Still no update on the payment.", (55, 40, 35, 50, 32)),
            (30, "compensation_released", "The compensation amount was released today.", (25, 15, 10, 20, 10)),
            (37, None, "Feeling more settled now that this part is done.", (18, 10, 8, 15, 8)),
        ],
    },
    {
        "phase_start": "trial",
        "timeline": [
            (0, None, "The hearings are ongoing. I try to stay hopeful.", (40, 30, 20, 40, 20)),
            (14, None, "Tired.", (55, 45, 45, 50, 30)),
            (28, None, "Same.", (60, 50, 55, 55, 35)),
        ],
    },
]

PSEUDONYM_PREFIX = "CASE"


def build_case(index: int, template: dict, start_date: date):
    district, state = random.choice(DISTRICTS)
    language = random.choice(LANGUAGES)
    pseudonym = f"{PSEUDONYM_PREFIX}-{index:03d}"

    person = create_person(
        db,
        pseudonym=pseudonym,
        language=language,
        case_phase=template["phase_start"],
        district=district,
        state=state,
    )

    engine.consent.set_consent(str(person.id), ConsentType.ESSENTIAL_SERVICE, True)
    engine.consent.set_consent(str(person.id), ConsentType.CASE_SUPPORT_MONITORING, True)
    engine.consent.set_consent(str(person.id), ConsentType.SAFETY_ANALYSIS, True)

    last_result = None
    for day_offset, event_type, text, ml_inputs in template["timeline"]:
        event_date = start_date + timedelta(days=day_offset)

        if event_type:
            create_case_event(db, person_id=person.id, event_type=event_type, event_date=event_date)

        checkin = create_checkin(
            db,
            person_id=person.id,
            channel=random.choice(["chat", "voice", "sms"]),
            raw_text=text,
        )

        expressed, voice, engagement, case_pressure, stressors = ml_inputs
        inputs = CaseSupportInputs(
            expressed_distress=expressed,
            voice_stress=voice,
            engagement_change=engagement,
            case_event_pressure=case_pressure,
            reported_external_stressors=stressors,
            trajectory=0,
            check_in_text=text,
        )

        result = engine.submit_case_score(
            db=db,
            person_id=person.id,
            checkin_id=checkin.id,
            user_ref=str(person.id),
            inputs=inputs,
        )
        last_result = result

    band = getattr(last_result, "band", None)
    band_label = band.value if band else "safety_flagged"
    print(f"{pseudonym:12} {district:10} {template['phase_start']:14} final_band={band_label}")


def main():
    start_date = date.today() - timedelta(days=45)
    for i, template in enumerate(CASE_TEMPLATES, start=1):
        build_case(i, template, start_date)
    db.close()
    print("\nDone. Synthetic cases created.")


if __name__ == "__main__":
    main()