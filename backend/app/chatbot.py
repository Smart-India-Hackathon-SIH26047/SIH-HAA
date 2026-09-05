"""
Conversational AI layer for the MoSJE Distress Monitoring Chatbot.

Flow: crisis check (no LLM) -> LLM call (if safe) -> output safety filter.
"""

import os
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

Every response you give must:
1. Validate their feeling in one sentence.
2. Ask exactly ONE gentle, open-ended question.
3. Suggest ONE relevant resource (a counsellor, helpline, or legal aid officer) if it fits naturally.
4. Close gently in one sentence.

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
- Ask at most ONE question per reply.
- Keep responses brief — a few sentences, conversational, no clinical
  language.
- If the person writes in Hindi, respond in Hindi. If English, respond
  in English.
"""

HELPLINES = [
    {"name": "Tele-MANAS", "number": "1860-445-4435"},
    {"name": "Emergency", "number": "112"},
]

CRISIS_KEYWORDS = [
    "kill myself", "end my life", "suicide", "want to die", "self harm",
    "self-harm", "hurt myself", "cutting myself", "no reason to live",
    "he is going to kill me", "she is going to kill me", "they will kill me",
    "being abused", "he hits me", "she hits me", "in danger", "not safe here",
    "आत्महत्या", "खुद को नुकसान", "मरना चाहता", "मरना चाहती",
    "khud ko nuksan", "marna chahta", "marna chahti", "jaan se marne",
]

def is_crisis(text: str) -> bool:
    lowered = text.lower()
    return any(keyword in lowered for keyword in CRISIS_KEYWORDS)


BANNED_PATTERNS = [
    r"\bfile a case\b", r"\bsue (him|her|them)\b", r"\bcounter[- ]case\b",
    r"\byou have (depression|anxiety|ptsd|bipolar|trauma disorder)\b",
    r"\byou('re| are) (depressed|anxious|traumatized)\b",
    r"\beverything will be okay\b", r"\byou will win\b", r"\bjustice will come\b",
    r"\btake (ibuprofen|paracetamol|medication)\b",
    r"\binvest in\b", r"\bstock market\b",
]

def passes_safety_filter(text: str) -> bool:
    lowered = text.lower()
    for pattern in BANNED_PATTERNS:
        if re.search(pattern, lowered):
            return False
    if lowered.count("?") > 1:
        return False
    return True


FALLBACK_RESPONSE = (
    "That sounds like a lot to carry. Could you tell me a little more "
    "about how you're feeling right now? A counsellor at Tele-MANAS "
    "(1860-445-4435) is also available if you'd like to talk it through."
)


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
                model="gemini-3.6-flash",
                contents=contents,
                config=types.GenerateContentConfig(
                    system_instruction=SYSTEM_PROMPT,
                    max_output_tokens=1200,
                ),
            )
            return response.text
        except Exception as e:
            if attempt < max_retries - 1:
                print(f"(Gemini busy, retrying in 3 seconds... attempt {attempt + 1})")
                time.sleep(3)
            else:
                raise


def generate_reply(person_id: str, user_input: str, conversation_history: list[dict]) -> dict:
    language = detect_language(user_input)

    if is_crisis(user_input):
        return {
            "type": "safety_flag",
            "message": "[SAFETY_FLAG: IMMEDIATE_CONTACT_REQUIRED]",
            "is_crisis": True,
            "helplines": HELPLINES,
            "language": language,
        }

    trimmed_history = conversation_history[-10:]
    reply_text = call_gemini(trimmed_history, user_input)

    if not passes_safety_filter(reply_text):
        reply_text = FALLBACK_RESPONSE

    return {
        "type": "response",
        "message": reply_text,
        "is_crisis": False,
        "language": language,
    }


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