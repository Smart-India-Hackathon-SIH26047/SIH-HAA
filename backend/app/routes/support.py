"""
Support contact details, so clients never hardcode a helpline number.

The numbers live in the backend environment (see chatbot.py) and are the same
ones used by the score-gated support offer. Exposing them here means the
officer console and the check-in screen show one consistent set.
"""

from fastapi import APIRouter

from app.chatbot import (
    SUPPORT_CALL_NAME,
    SUPPORT_CALL_NUMBER,
    SUPPORT_SMS_NUMBER,
)

router = APIRouter()


@router.get("/support-contacts")
def read_support_contacts():
    """
    Configured support channels.

    `sms` is null unless SUPPORT_SMS_NUMBER is set. Clients must treat a null
    channel as unavailable and disable the action — never substitute another
    number. An unmonitored number shown to someone in distress is worse than
    no number at all.
    """
    return {
        "call": (
            {"name": SUPPORT_CALL_NAME, "number": SUPPORT_CALL_NUMBER}
            if SUPPORT_CALL_NUMBER
            else None
        ),
        "sms": (
            {"name": SUPPORT_CALL_NAME, "number": SUPPORT_SMS_NUMBER}
            if SUPPORT_SMS_NUMBER
            else None
        ),
    }
