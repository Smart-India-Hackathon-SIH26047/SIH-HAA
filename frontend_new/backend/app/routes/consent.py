from fastapi import APIRouter
from pydantic import BaseModel
from app.business_logic import BusinessLogicEngine, ConsentType
from app.engine import engine
router = APIRouter()



class ConsentRequest(BaseModel):
    person_id: str
    consent_type: str
    granted: bool


@router.post("/consent")
def set_consent(payload: ConsentRequest):
    try:
        consent_type = ConsentType(payload.consent_type)
    except ValueError:
        valid = [c.value for c in ConsentType]
        return {"error": f"Invalid consent_type. Must be one of: {valid}"}

    record = engine.consent.set_consent(
        user_ref=payload.person_id,
        consent_type=consent_type,
        granted=payload.granted,
    )
    return {
        "person_id": record.user_ref,
        "consent_type": record.consent_type.value,
        "granted": record.granted,
        "changed_at": record.changed_at,
    }