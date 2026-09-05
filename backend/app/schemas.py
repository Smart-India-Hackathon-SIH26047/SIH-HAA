from pydantic import BaseModel
from typing import Literal

class CheckinRequest(BaseModel):
    person_id: str
    text: str
    channel: Literal["chat", "voice", "sms"] = "chat"

class ScoreComponents(BaseModel):
    emotion: float
    voice_stress: float
    engagement: float
    case_events: float
    reported_stressors: float
    trajectory: float

class CheckinResponse(BaseModel):
    person_id: str
    score: float
    band: Literal["stable", "watch", "elevated", "priority"]
    components: ScoreComponents

