"""
Conversational AI layer for the MoSJE Distress Monitoring Chatbot.

Flow: crisis check (no LLM) -> LLM call (if safe) -> output safety filter.
"""

import os
import random
import re
from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()
client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])

SYSTEM_PROMPT = """
You are a supportive check-in companion for someone who may be going
through a difficult time related to a legal case. You are NOT a
counsellor, doctor, or lawyer, and you must say so clearly if asked.

Your job is to be good company and to listen well. Talk with the person
about whatever they bring up — their day, their family, work, the weather,
cricket, what they ate, how they slept. Ordinary conversation IS the work
here. A person who feels heard about small things will tell you about the
big ones.

How to talk:
- Follow their lead. If they change the subject, go with them.
- Respond to what they actually said, not to a template. Vary how you
  open and close; do not begin every reply the same way.
- Usually ask one question, and never more than two. Sometimes the right
  reply is no question at all — just acknowledgement.
- Keep it brief and conversational. A few sentences. No clinical language.
- It is fine to be warm, light, or even a little funny when the moment
  suits it. You do not have to treat every message as a crisis.

About offering help — read this carefully:
- Do NOT bring up helplines, counsellors or support services in ordinary
  conversation. Offering help unprompted, over and over, makes a person
  feel like a case file instead of a person, and they stop talking.
- Mention a resource ONLY when one of these is true:
    (a) the person asks for help or asks where to get it, or
    (b) they describe distress that is clearly sustained and serious and
        they have not already been offered support in this conversation.
- If neither applies, just keep talking with them.

Hard rules, never break these:
- Never give legal advice, predict outcomes, or suggest legal action
  ("file a case", "sue them", "counter-case"). If legal questions come
  up, gently suggest they speak with a legal aid officer.
- Never diagnose or label a mental health condition (no "you have
  depression/anxiety/PTSD" or similar).
- Never promise outcomes ("everything will be okay", "you will win",
  "justice will come").
- Never give medical or financial advice.
- If you mention a mental health helpline, you must always cite it as
  exactly this: Tele-MANAS, 1860-445-4435. Never use any other number
  or name for a mental health helpline, even if you believe a
  different number is correct — always use this exact one.
- If the person writes in Hindi, respond in Hindi. If English, respond
  in English.
"""

HELPLINES = [
    {"name": "Tele-MANAS", "number": "1860-445-4435"},
    {"name": "Emergency", "number": "112"},
]

# Overridable so a blown free-tier quota on one model can be worked around
# without a code change.
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-3.6-flash")

# Crisis detection.
#
# These are matched on word boundaries rather than as bare substrings. The
# previous substring matching both over- and under-fired: "in danger" matched
# "the crops are in danger", "want to die" matched "want to die my hair", while
# "suicide" did NOT match "I am suicidal" and "hurt myself" did not match
# "hurting myself".
#
# This check runs before any LLM call and before any scoring, and must stay
# that way — it is the fast path, and nothing downstream may delay it.
#
# When in doubt, prefer firing. A false positive shows someone a helpline they
# did not need; a false negative misses someone who did.
CRISIS_PATTERNS = [
    # --- Direct self-harm / suicide intent -------------------------------
    r"\bkill(?:ing)?\s+myself\b",
    r"\btak(?:e|ing)\s+my\s+(?:own\s+)?life\b",
    r"\bend(?:ing)?\s+my\s+life\b",
    # Intent expressed with any verb, not just "want". Missing these is what
    # let "im planning to die" through: the old list only had "want to die".
    # "to" is optional so "wanna die" and "gonna die" are caught too.
    r"\b(?:want(?:ed|s)?|wanna|plan(?:s|ned|ning)?|going|gonna|ready|hop(?:e|es|ing)"
    r"|wish(?:es|ing)?|intend(?:s|ing)?|prepar(?:ed|ing)|need(?:s|ed)?|about)"
    r"\s+(?:to\s+)?die\b(?!\s+(?:my|the|his|her|your|their)\b)",
    r"\bthink(?:ing)?\s+(?:of|about)\s+(?:dying|death|killing\s+myself|ending\s+it|suicide)\b",
    r"\bdo\s?n[o']?t\s+want\s+to\s+(?:be\s+(?:here|alive)|live|exist|wake\s+up)\b",
    r"\bno\s+point\s+(?:in\s+)?(?:living|going\s+on)\b",
    r"\bcan'?t\s+(?:go\s+on|take\s+it\s+any\s?more|do\s+this\s+any\s?more)\b",
    r"\btired\s+of\s+living\b",
    # "suicidal" too, but not "suicide mission/bomber/squad".
    # "suicide note" is deliberately left firing.
    r"\bsuicid(?:e|al)\b(?!\s+(?:mission|bomber|bombing|squad|attack))",
    # ...but not "want to die my hair".
    r"\bwant(?:ed|s)?\s+to\s+die\b(?!\s+(?:my|the|his|her|your|their)\b)",
    r"\bself[\s-]?harm(?:ing|ed)?\b",
    r"\bhurt(?:ing)?\s+myself\b",
    # ...but not "cut myself a slice of cake".
    r"\bcut(?:ting)?\s+myself\b(?!\s+(?:a|an|some|another)\b)",
    r"\bno\s+reason\s+to\s+live\b",
    # Group E: intent phrased without the word "suicide" or "kill".
    r"\bbetter\s+off\s+dead\b",
    r"\bdo\s?n[o']?t\s+want\s+to\s+live\b",
    r"\bwish\s+i\s+(?:was|were)\s+dead\b",
    r"\bend\s+it\s+all\b",

    # --- Threat from another person --------------------------------------
    # Anchored on an explicit "me", so "he hits the ball well" does not fire.
    r"\b(?:he|she|they)\s*(?:'s|'re|\s+is|\s+are|\s+will|\s+would)?\s*(?:going\s+to\s+)?kill\s+me\b",
    r"\b(?:he|she|they)\s+(?:hits?|hit|beats?|beat|attacked?)\s+me\b",

    # --- Danger to self, anchored to the speaker -------------------------
    # KNOWN AND ACCEPTED false positive: "I feel like I'm being abused by the
    # paperwork" still fires. Separating that from a real disclosure needs
    # semantics, not a regex, and over-firing is the right way to be wrong here.
    r"\bi(?:'m|\s+am)\s+being\s+abused\b",
    r"\bbeing\s+abused\s+by\s+(?:him|her|them|my)\b",
    r"\b(?:i(?:'m|\s+am)|we(?:'re|\s+are)|my\s+life\s+is)\s+in\s+danger\b",
    r"\bi(?:'m|\s+am)\s+not\s+safe\b",
    r"\bi\s+do\s?n[o']?t\s+feel\s+safe\b",

    # --- Hindi and romanised Hindi ---------------------------------------
    r"आत्महत्या",
    r"खुदकुशी",
    r"खुद\s*को\s*नुकसान",
    r"मरना\s*चाह",
    r"जान\s*देन",
    r"\bkhud\s*ko\s*nuksan\b",
    r"\bkhudkushi\b",
    r"\bmarna\s*chaht[ai]\b",
    r"\bjaan\s*se\s*marne\b",
    r"\bjaan\s*dene\b",
]

_CRISIS_REGEXES = [re.compile(pattern, re.IGNORECASE) for pattern in CRISIS_PATTERNS]


# --- Second tier: first person + a word about dying ------------------------
#
# The explicit list above will always have gaps — "im planning to die" slipped
# through it because only "want to die" was ever written down. Enumerating
# every verb someone might use is a losing game, so this is a safety net:
# if the person is talking about THEMSELVES and about DYING, treat it as a
# crisis, whatever the sentence shape.
#
# Everyday phrases that merely contain a death word are removed first, so
# "my phone died" and "dying to see you" stay quiet.

_BENIGN = [
    r"\b(?:die|dye|dying|dyeing)\s+(?:my|the|his|her|your|their)\s+hair\b",
    r"\bdying\s+to\s+\w+",            # "dying to see you"
    r"\bto\s+die\s+for\b",            # "the food is to die for"
    r"\bdead\s+(?:battery|batteries|phone|end|serious|weight|tired|centre|center)\b",
    r"\b(?:phone|battery|laptop|car|engine|signal|line|wifi)\s+(?:has\s+)?died\b",
    r"\bdied\s+down\b",
    r"\bdrop\s+dead\b",
    r"\bhalf\s+dead\b",
    r"\bsuicid(?:e|al)\s+(?:mission|bomber|bombing|squad|attack)\b",
    r"\bdead\s?line",
]
_BENIGN_REGEXES = [re.compile(p, re.IGNORECASE) for p in _BENIGN]

# "my" is deliberately NOT a first-person marker here: "my phone died" is
# about the phone, not the speaker.
_FIRST_PERSON = re.compile(r"\b(?:i|i'm|im|i've|ive|i'd|i'll|myself|me)\b", re.IGNORECASE)
_DEATH_TERM = re.compile(r"\b(?:die|dies|dying|died|dead|death|suicide|suicidal)\b", re.IGNORECASE)

# Devanagari has no case and no apostrophes, so these are matched as-is.
_HINDI_FIRST_PERSON = re.compile(r"(मैं|मुझे|मुझको|मेरी जान|अपने आप)")
_HINDI_DEATH = re.compile(r"(मरना|मरने|मरूँ|मरूं|मौत|आत्महत्या|खुदकुशी|जान\s*दे)")


def _strip_benign(text: str) -> str:
    scrubbed = text
    for regex in _BENIGN_REGEXES:
        scrubbed = regex.sub(" ", scrubbed)
    return scrubbed


def is_crisis(text: str) -> bool:
    """
    True when the message needs the immediate safety response.

    Runs before any LLM call and before scoring, and must stay that way.
    Prefers firing: a false positive shows someone a helpline they did not
    need, a false negative misses someone who did.
    """
    if not text:
        return False

    # Normalise curly apostrophes so "I’m" matches the same as "I'm".
    normalised = text.replace("’", "'").replace("ʼ", "'")

    if any(regex.search(normalised) for regex in _CRISIS_REGEXES):
        return True

    scrubbed = _strip_benign(normalised)

    if _FIRST_PERSON.search(scrubbed) and _DEATH_TERM.search(scrubbed):
        return True
    if _HINDI_FIRST_PERSON.search(scrubbed) and _HINDI_DEATH.search(scrubbed):
        return True

    return False


BANNED_PATTERNS = [
    r"\bfile a case\b", r"\bsue (him|her|them)\b", r"\bcounter[- ]case\b",
    r"\byou have (depression|anxiety|ptsd|bipolar|trauma disorder)\b",
    r"\byou('re| are) (depressed|anxious|traumatized)\b",
    r"\beverything will be okay\b", r"\byou will win\b", r"\bjustice will come\b",
    r"\btake (ibuprofen|paracetamol|medication)\b",
    r"\binvest in\b", r"\bstock market\b",
]

def passes_safety_filter(text: str) -> bool:
    """
    Hard safety rules ONLY. Failing this discards the model's reply, so the
    bar is "this reply would be harmful", not "this reply is untidy".

    This deliberately no longer counts question marks. That rule was intended
    to enforce "ask at most one question", but counting '?' is a poor proxy —
    it also fired on quoted speech ("when you say \"what's the point?\"") and
    on ordinary friendly replies ("Cricket? Did you watch the match?"). Roughly
    half of reasonable replies tripped it, and each one was replaced by the
    same canned helpline message, which is what made the bot feel scripted.
    Question count is a style concern and is handled in the prompt instead.
    """
    if text is None or not text.strip():
        return False
    lowered = text.lower()
    return not any(re.search(pattern, lowered) for pattern in BANNED_PATTERNS)


# Interrogation guard: not a safety rule, so it does NOT discard the reply.
# It is only used to log that the prompt may need tightening.
MAX_QUESTIONS_PER_REPLY = 3


def count_questions(text: str) -> int:
    """
    Question marks outside quoted text. The model often quotes the person
    back to them, and those quoted questions are not the bot interrogating.
    """
    unquoted = re.sub(r'"[^"]*"|“[^”]*”', "", text or "")
    return unquoted.count("?")


# Used when the model returns nothing usable. Varied, so a run of failures
# does not produce the same sentence over and over — and deliberately free of
# helpline pushes, which belong to the crisis path and the score-gated offer.
FALLBACK_RESPONSES = [
    "Thank you for telling me that. Could you say a bit more?",
    "I'm listening. What's been on your mind today?",
    "That sounds like a lot to sit with. What has it been like for you?",
    "I hear you. Tell me more whenever you're ready.",
]

FALLBACK_RESPONSES_HI = [
    "बताने के लिए शुक्रिया। थोड़ा और बताएँगे?",
    "मैं सुन रहा हूँ। आज आपके मन में क्या चल रहा है?",
    "यह सब सँभालना आसान नहीं होगा। आपके लिए यह कैसा रहा?",
    "मैं समझ रहा हूँ। जब मन हो, और बताइएगा।",
]

# Kept as a name for backwards compatibility with anything importing it.
FALLBACK_RESPONSE = FALLBACK_RESPONSES[0]


def pick_fallback(language: str = "en") -> str:
    pool = FALLBACK_RESPONSES_HI if language == "hi" else FALLBACK_RESPONSES
    return random.choice(pool)


# Used when the model returned nothing at all — an outage or a spent quota.
# Deliberately plain: it does not pretend to have understood, and it does not
# imply the person said something they did not.
UNAVAILABLE_MESSAGE = {
    "en": "I can't reply properly just now — something on my side isn't working. "
          "What you wrote has still been saved, and you can keep writing if you'd like.",
    "hi": "मैं अभी ठीक से जवाब नहीं दे पा रहा — मेरी तरफ़ कुछ गड़बड़ है। "
          "आपने जो लिखा वह सुरक्षित है, और आप चाहें तो लिखते रह सकते हैं।",
}


def pick_unavailable_message(language: str = "en") -> str:
    return UNAVAILABLE_MESSAGE.get(language, UNAVAILABLE_MESSAGE["en"])


def detect_language(text: str) -> str:
    for char in text:
        if "\u0900" <= char <= "\u097F":
            return "hi"
    return "en"


import time

def call_gemini(history: list[dict], user_input: str) -> str:
    """Sends the conversation to Gemini and returns the reply text."""
    contents = []
    for turn in history:
        contents.append(
            types.Content(role=turn["role"], parts=[types.Part(text=p) for p in turn["parts"]])
        )
    contents.append(types.Content(role="user", parts=[types.Part(text=user_input)]))

    max_retries = 3
    for attempt in range(max_retries):
        try:
            response = client.models.generate_content(
                model=GEMINI_MODEL,
                contents=contents,
                config=types.GenerateContentConfig(
                    system_instruction=SYSTEM_PROMPT,
                    max_output_tokens=1200,
                ),
            )
            return response.text
        except Exception as e:
            # A blown quota will not clear in three seconds, and every retry
            # spends another request against it. Fail straight through to the
            # caller's fallback instead of burning quota and 6s of the
            # person's time.
            if _is_quota_error(e):
                print(f"[ERROR] Gemini quota exhausted, not retrying: {e}")
                raise
            if attempt < max_retries - 1:
                print(f"(Gemini busy, retrying in 3 seconds... attempt {attempt + 1})")
                time.sleep(3)
            else:
                raise


def _is_quota_error(error: Exception) -> bool:
    text = str(error)
    return "RESOURCE_EXHAUSTED" in text or "429" in text


# --- Score-gated support offer -------------------------------------------
#
# Separate from, and subordinate to, the crisis path. The crisis keyword check
# fires instantly and returns before any of this runs; this offer only ever
# attaches to an ordinary scored reply, for someone whose distress has risen
# into the elevated band but who has not tripped a crisis keyword.
#
# It is an OFFER. It never replaces the conversation and never blocks it.

# The mandated mental-health line (see SYSTEM_PROMPT's hard rules).
SUPPORT_CALL_NUMBER = os.environ.get("SUPPORT_CALL_NUMBER", "1860-445-4435")
SUPPORT_CALL_NAME = os.environ.get("SUPPORT_CALL_NAME", "Tele-MANAS")

# No default: a support number that does not answer is worse than no number,
# so the SMS option is omitted entirely until a real one is configured.
SUPPORT_SMS_NUMBER = os.environ.get("SUPPORT_SMS_NUMBER", "")

# Bands that warrant the offer. These come from business_logic's classifier —
# do not re-derive them from a raw score threshold here.
SUPPORT_OFFER_BANDS = {"elevated", "priority"}

# How long after an offer-band score we stay quiet. Covers a whole
# conversation, so someone whose band bounces in and out of "elevated" over a
# few messages is offered support once, not once per bounce.
SUPPORT_OFFER_COOLDOWN_HOURS = int(os.environ.get("SUPPORT_OFFER_COOLDOWN_HOURS", "12"))

_OFFER_TEXT = {
    "en": "Whenever you want it, there are people you can talk to about this. "
          "Only if you'd like to — we can also keep talking here.",
    "hi": "जब भी आप चाहें, इस बारे में बात करने के लिए लोग मौजूद हैं। "
          "यह पूरी तरह आपकी मर्ज़ी है — हम यहाँ भी बात करते रह सकते हैं।",
}

_OPTION_LABELS = {
    "en": {"call": "Talk to someone", "sms": "Get support by SMS", "dismiss": "Not right now"},
    "hi": {"call": "किसी से बात करें", "sms": "SMS पर सहायता लें", "dismiss": "अभी नहीं"},
}


def build_support_offer(language: str = "en") -> dict:
    """
    The optional talk/SMS offer shown when someone enters the elevated band.

    Returned as structured data rather than prose so the client can render it
    as two dismissible buttons. Nothing here is phrased as an instruction.
    """
    lang = "hi" if language == "hi" else "en"
    labels = _OPTION_LABELS[lang]

    options = [
        {
            "type": "call",
            "label": labels["call"],
            "name": SUPPORT_CALL_NAME,
            "number": SUPPORT_CALL_NUMBER,
        }
    ]

    if SUPPORT_SMS_NUMBER:
        options.append(
            {
                "type": "sms",
                "label": labels["sms"],
                "name": SUPPORT_CALL_NAME,
                "number": SUPPORT_SMS_NUMBER,
            }
        )
    else:
        print(
            "[WARN] SUPPORT_SMS_NUMBER is not set, so the SMS support option is "
            "being omitted. Set it to a real, monitored number to enable it."
        )

    return {
        "reason": "elevated_distress",
        "dismissible": True,
        "message": _OFFER_TEXT[lang],
        "dismiss_label": labels["dismiss"],
        "options": options,
    }


def generate_reply(person_id: str, user_input: str, conversation_history: list[dict]) -> dict:
    language = detect_language(user_input)

    # Crisis path — unchanged, and still first. Nothing below can delay it.
    if is_crisis(user_input):
        return {
            "type": "safety_flag",
            "message": "[SAFETY_FLAG: IMMEDIATE_CONTACT_REQUIRED]",
            "is_crisis": True,
            "helplines": HELPLINES,
            "language": language,
        }

    trimmed_history = _trim_history(conversation_history, limit=10)
    ai_available = True

    try:
        reply_text = call_gemini(trimmed_history, user_input)
    except Exception as e:
        # Gemini being down must not take the check-in down with it: the
        # scoring pipeline still needs to run on what the person said.
        print(f"[ERROR] Gemini call failed: {e}")
        reply_text = None
        ai_available = False

    # `response.text` is None when the model returns no candidate — a blocked
    # response, or a thinking-heavy turn that spent the whole output budget.
    if not passes_safety_filter(reply_text):
        if reply_text and reply_text.strip():
            print("[INFO] Reply failed the safety filter; using a fallback.")
            reply_text = pick_fallback(language)
        else:
            # Nothing came back at all. A warm, generic line here reads as if
            # the bot understood and chose that response — answering "how are
            # you?" with "thank you for telling me that" is worse than saying
            # plainly that it cannot reply right now.
            ai_available = False
            reply_text = pick_unavailable_message(language)
    elif count_questions(reply_text) > MAX_QUESTIONS_PER_REPLY:
        # Not unsafe, so the reply stands. Logged so the prompt can be tuned.
        print(f"[INFO] Reply asked {count_questions(reply_text)} questions.")

    return {
        "type": "response",
        "message": reply_text,
        "is_crisis": False,
        "language": language,
        # False when the reply is a stand-in rather than a real answer, so the
        # client can say so instead of passing it off as conversation.
        "ai_available": ai_available,
    }


def _trim_history(conversation_history: list[dict], limit: int = 10) -> list[dict]:
    """
    Keep the last `limit` turns, but never start on a model turn.

    Slicing raw turns can leave the history beginning with a model reply,
    which is not a valid conversation opening for the API. Crisis check-ins
    also store no ai_response, so consecutive user turns are possible.
    """
    trimmed = (conversation_history or [])[-limit:]
    while trimmed and trimmed[0].get("role") != "user":
        trimmed = trimmed[1:]
    return trimmed


if __name__ == "__main__":
    history = []
    print("Chatbot ready. Type 'quit' to exit.\n")
    while True:
        user_input = input("You: ")
        if user_input.lower() == "quit":
            break
        result = generate_reply(person_id="test-person", user_input=user_input, conversation_history=history)
        print("Bot:", result)
        if not result["is_crisis"]:
            history.append({"role": "user", "parts": [user_input]})
            history.append({"role": "model", "parts": [result["message"]]})