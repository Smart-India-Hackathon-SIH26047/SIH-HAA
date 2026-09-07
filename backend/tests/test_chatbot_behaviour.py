"""
Chatbot filter fix + score-gated support offer.

Run: python -m tests.test_chatbot_behaviour    (from backend/)
"""

import os
import sys

os.environ.setdefault("GEMINI_API_KEY", "dummy-for-import")

from tests.support import Check, ChatbotStub, MlStub, fresh_db, http_client, make_person, make_score

# The real chatbot module for the filter tests (no network calls made).
from app.chatbot import (  # noqa: E402
    FALLBACK_RESPONSES,
    MAX_QUESTIONS_PER_REPLY,
    SUPPORT_OFFER_BANDS,
    build_support_offer,
    count_questions,
    is_crisis,
    passes_safety_filter,
    pick_fallback,
)

ml = MlStub().install()
chat = ChatbotStub().install()

from app.routes.checkin import router  # noqa: E402


def test_filter(check):
    print("\n[the '?' bug is gone]")
    previously_blocked = [
        "I hear you. Are you sleeping alright? And eating okay?",
        'That\'s a lot. When you say "what\'s the point?", what does that feel like?',
        "Thank you for telling me. What would help most right now? Even a small thing?",
        "That must be exhausting. Who's around you at the moment? Anyone you trust?",
        "Cricket? That sounds like a good break. Did you watch the whole match?",
    ]
    for reply in previously_blocked:
        check.that(f"kept: {reply[:44]}…", passes_safety_filter(reply))

    print("\n[genuine safety rules still bite]")
    for bad in [
        "You should file a case against him.",
        "It sounds like you have depression.",
        "Don't worry, everything will be okay.",
        "You will win, I'm sure of it.",
        "Try to take paracetamol for that.",
    ]:
        check.that(f"blocked: {bad[:40]}…", not passes_safety_filter(bad))

    print("\n[empty / missing model output is caught]")
    check.that("None is rejected", not passes_safety_filter(None))
    check.that("empty string is rejected", not passes_safety_filter(""))
    check.that("whitespace only is rejected", not passes_safety_filter("   \n "))

    print("\n[question counting ignores quoted speech]")
    check.equals(
        "quoted question not counted",
        count_questions('When you say "what\'s the point?", what do you mean?'),
        1,
    )
    check.equals("two real questions counted", count_questions("Sleeping ok? Eating ok?"), 2)
    check.that("guard is a style limit, not a safety one", MAX_QUESTIONS_PER_REPLY >= 2)
    check.that(
        "a chatty reply is no longer discarded",
        passes_safety_filter("Really? That's great. What happened next? Tell me!"),
    )

    print("\n[fallbacks are varied and push no helpline]")
    check.that("more than one fallback exists", len(FALLBACK_RESPONSES) > 1)
    for text in FALLBACK_RESPONSES:
        check.that(
            f"no helpline number in: {text[:34]}…",
            "1860" not in text and "Tele-MANAS" not in text,
        )
    check.that("hindi fallback used for hindi", pick_fallback("hi") not in FALLBACK_RESPONSES)


MUST_FIRE = [
    "I want to kill myself",
    "I am going to end my life tonight",
    "I have been thinking about suicide",
    "I am suicidal",
    "I want to die",
    "I've been cutting myself again",
    "I keep hurting myself",
    "there is no reason to live anymore",
    "he is going to kill me if I testify",
    "they will kill me",
    "he hits me every night",
    "I am being abused at home",
    "I'm in danger, please help",
    "I am not safe here",
    "मैं आत्महत्या करना चाहता हूँ",
    "मरना चाहता हूँ",
    "main khud ko nuksan pahunchana chahta hoon",
    # Group E
    "I'd be better off dead",
    "I don't want to live anymore",
    "I wish I was dead",
    "I just want to end it all",
    # Intent expressed with verbs other than "want". The original corpus only
    # ever tested "I want to die", which is how "im planning to die" reached
    # production without firing.
    "im planning to die",
    "I am planning to die",
    "I plan to die",
    "I'm going to die",
    "I am ready to die",
    "I hope to die soon",
    "gonna die tonight",
    "I need to die",
    "I've been thinking about dying",
    "I'm thinking of killing myself",
    "I don't want to be here anymore",
    "I don't want to wake up",
    "there is no point in living",
    "I can't go on",
    "I can't take it anymore",
    "I'm tired of living",
    "I am going to take my life",
    "I'd rather be dead",
    "I keep thinking about death",
    "मैं मरना चाहता हूँ",
    "मुझे मरने दो",
]

MUST_NOT_FIRE = [
    "My neighbour said the crops are in danger this season.",
    "It's not safe here during the monsoon, the road floods.",
    "I want to die my hair before the hearing",
    "The tiger is an endangered species in danger of extinction.",
    "My phone died. Sorry for the late reply.",
    "That film was about a suicide mission in the army.",
    "He hits the ball really well, great match yesterday.",
    "The lawyer said the deadline is not safe to assume.",
    "I had to cut myself a slice of cake, it was my birthday.",
    # Everyday sentences that contain a death word. The second tier must not
    # fire on these.
    "I'm dying to see my daughter again.",
    "That restaurant's biryani is to die for.",
    "My laptop battery died during the call.",
    "The noise finally died down around midnight.",
    "I have a deadline on Friday for the paperwork.",
    "I was half dead after walking all that way.",
]


def test_crisis_matching(check):
    print("\n[crisis: must fire]")
    missed = [t for t in MUST_FIRE if not is_crisis(t)]
    for t in missed:
        print(f"     MISSED: {t}")
    check.equals("every genuine crisis phrase fires", len(missed), 0)

    print("\n[crisis: must not fire]")
    false_alarms = [t for t in MUST_NOT_FIRE if is_crisis(t)]
    for t in false_alarms:
        print(f"     FALSE ALARM: {t}")
    check.equals("no false alarms on ordinary talk", len(false_alarms), 0)

    print("\n[crisis: the deliberate exception]")
    check.that(
        "'abused by the paperwork' still fires, by choice",
        is_crisis("I feel like I'm being abused by the paperwork honestly"),
    )

    print("\n[crisis: previously missed, now caught]")
    for phrase in ["I am suicidal", "I keep hurting myself", "I wish I was dead"]:
        check.that(f"catches {phrase!r}", is_crisis(phrase))

    check.that("empty input is safe", not is_crisis(""))
    check.that("None is safe", not is_crisis(None))


def test_support_offer_shape(check):
    print("\n[support offer shape]")
    offer = build_support_offer("en")
    check.equals("gated on the classifier's bands", SUPPORT_OFFER_BANDS, {"elevated", "priority"})
    check.that("dismissible", offer["dismissible"])
    check.that("offers, does not instruct", "only if you'd like" in offer["message"].lower())
    kinds = [o["type"] for o in offer["options"]]
    check.that("call option present", "call" in kinds)
    check.equals(
        "call uses the mandated Tele-MANAS number",
        next(o["number"] for o in offer["options"] if o["type"] == "call"),
        "1860-445-4435",
    )
    check.that(
        "SMS omitted while unconfigured rather than inventing a number",
        "sms" not in kinds,
    )
    check.that("hindi offer differs", build_support_offer("hi")["message"] != offer["message"])


def test_offer_gating(check):
    db = fresh_db()
    client = http_client(router, db)
    person = make_person(db, "JPR-0001")

    def check_in(text="It has been a hard week."):
        response = client.post(
            "/checkin", json={"person_id": str(person.id), "text": text, "channel": "chat"}
        )
        assert response.status_code == 200, response.text
        return response.json()

    print("\n[offer appears on the transition into elevated]")
    # Seed a prior stable score so the first real check-in is a transition.
    make_score(db, person, 12.0, "stable")
    ml.text_emotion = 95  # drive the score up into elevated/priority
    first = check_in()
    check.that("band is elevated or priority", first["band"] in SUPPORT_OFFER_BANDS, first["band"])
    check.that("offer present on entering the band", "support_offer" in first)

    print("\n[offer is not repeated for the rest of the conversation]")
    # Scoring runs per message, so the band bounces around within a single
    # conversation. The offer must not reappear on any of those bounces.
    follow_ups = [check_in(t) for t in ("Still much the same.", "Nothing has changed.", "Same again.")]
    check.that(
        "band did bounce, so this is a real test of the cooldown",
        len({r["band"] for r in follow_ups} | {first["band"]}) > 1,
        [first["band"], *[r["band"] for r in follow_ups]],
    )
    check.equals(
        "offered exactly once across the whole conversation",
        sum("support_offer" in r for r in [first, *follow_ups]),
        1,
    )

    print("\n[no offer for people who are not elevated]")
    calm = make_person(db, "JPR-0002")
    ml.text_emotion = 2
    calm_response = client.post(
        "/checkin", json={"person_id": str(calm.id), "text": "Today was fine.", "channel": "chat"}
    ).json()
    check.that("band below elevated", calm_response["band"] not in SUPPORT_OFFER_BANDS)
    check.that("no offer", "support_offer" not in calm_response)

    print("\n[crisis path is untouched and still wins]")
    chat.is_crisis = True
    ml.text_emotion = 95
    crisis = client.post(
        "/checkin",
        json={"person_id": str(person.id), "text": "anything", "channel": "chat"},
    ).json()
    check.equals("returns safety_flag", crisis["type"], "safety_flag")
    check.that("helplines present immediately", len(crisis["helplines"]) > 0)
    check.that("no support_offer on the crisis path", "support_offer" not in crisis)
    check.that("no score returned, so nothing gated it", "score" not in crisis)
    chat.is_crisis = False

    print("\n[crisis keywords fire regardless of score]")
    check.that("crisis detector is independent of band", is_crisis("I want to kill myself"))

    db.close()


def test_existence_check(check):
    db = fresh_db()
    client = http_client(router, db)
    person = make_person(db, "JPR-0001")
    from app.models import AccessLog

    print("\n[SELECT 1 existence check]")
    ml.text_emotion = 40
    before_logs = db.query(AccessLog).count()
    response = client.post(
        "/checkin", json={"person_id": str(person.id), "text": "Hello.", "channel": "chat"}
    )
    check.equals("check-in still works", response.status_code, 200)
    check.equals(
        "unknown person still 404s",
        client.post(
            "/checkin",
            json={
                "person_id": "00000000-0000-0000-0000-000000000000",
                "text": "hi",
                "channel": "chat",
            },
        ).status_code,
        404,
    )
    # The full-history read was dropped; the audit row it wrote was kept.
    # One row for the successful check-in; the 404 adds none, because a person
    # who does not exist has no record to log access against.
    check.equals(
        "one 'viewed' audit row per successful check-in, none for the 404",
        db.query(AccessLog).filter(AccessLog.accessed_by == "checkin_endpoint").count(),
        before_logs + 1,
    )
    check.equals("audit action is 'viewed'", db.query(AccessLog).first().action, "viewed")
    db.close()


def main():
    check = Check()
    test_filter(check)
    test_crisis_matching(check)
    test_support_offer_shape(check)
    test_offer_gating(check)
    test_existence_check(check)
    return check.report()


if __name__ == "__main__":
    sys.exit(main())
