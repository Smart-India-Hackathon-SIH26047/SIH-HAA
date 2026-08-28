from fastapi import APIRouter

router = APIRouter()

@router.post("/checkin")
def submit_checkin():
    # fake response for now — real logic comes later
    return {
        "score": 0.5,
        "band": "stable",
        "components": {
            "emotion": 0.5,
            "engagement": 0.5,
            "case_events": 0.5,
            "trajectory": 0.5
        }
    }