"""
Helper functions for computing non-ML score components.
"""

from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.models import CheckIn, Score, CaseEvent
import uuid


def calculate_engagement_change(
    db: Session,
    person_id: uuid.UUID,
    window_days: int = 30
) -> float:
    """
    Engagement change: compare current check-in behavior to person's baseline.
    
    Factors:
    - Missed check-ins (expected vs actual)
    - Reply delay (time between checkins)
    - Answer length (words in response)
    
    Returns: 0-100 score (higher = worse engagement)
    """
    now = datetime.utcnow()
    cutoff = now - timedelta(days=window_days)
    
    recent_checkins = db.query(CheckIn).filter(
        CheckIn.person_id == person_id,
        CheckIn.created_at >= cutoff
    ).order_by(CheckIn.created_at).all()
    
    if len(recent_checkins) < 2:
        return 25  # Not enough data, neutral score
    
    # Calculate delays between consecutive checkins (in hours)
    delays = []
    for i in range(1, len(recent_checkins)):
        delta = (recent_checkins[i].created_at - recent_checkins[i-1].created_at).total_seconds() / 3600
        delays.append(delta)
    
    avg_delay = sum(delays) / len(delays) if delays else 24
    
    # Calculate average answer length
    avg_length = sum(len(c.raw_text.split()) for c in recent_checkins) / len(recent_checkins)
    
    # Simple formula: longer delays + shorter responses = higher concern
    delay_score = min(100, (avg_delay / 24) * 100)  # Normalize to 24-hour baseline
    length_score = max(0, (100 - (avg_length / 50) * 100))  # Normalize to 50 words baseline
    
    engagement_change = (delay_score * 0.6 + length_score * 0.4)
    return round(max(0, min(100, engagement_change)), 2)


def calculate_case_event_pressure(
    db: Session,
    person_id: uuid.UUID,
    window_days: int = 90
) -> float:
    """
    Case-event pressure: assess impact of recent case events.
    
    High-impact events (threat_reported, hearing_delayed): +40 points
    Medium-impact events (hearing_scheduled): +20 points
    Positive events (compensation_released): -20 points
    
    Returns: 0-100 score
    """
    now = datetime.utcnow()
    cutoff = now - timedelta(days=window_days)
    
    recent_events = db.query(CaseEvent).filter(
        CaseEvent.person_id == person_id,
        CaseEvent.created_at >= cutoff
    ).all()
    
    if not recent_events:
        return 30  # No events, baseline concern
    
    pressure_score = 30  # Baseline
    
    for event in recent_events:
        if event.event_type in ["threat_reported", "hearing_delayed"]:
            pressure_score += 40
        elif event.event_type == "hearing_scheduled":
            pressure_score += 20
        elif event.event_type == "compensation_released":
            pressure_score -= 20
    
    return round(max(0, min(100, pressure_score)), 2)


def calculate_trajectory(
    db: Session,
    person_id: uuid.UUID,
    num_recent_scores: int = 5
) -> float:
    """
    Trajectory: assess deterioration/improvement trend.
    
    Positive trajectory (score rising) = higher concern
    Negative trajectory (score falling) = lower concern
    
    Returns: 0-100 score
    """
    recent_scores = db.query(Score).filter(
        Score.person_id == person_id
    ).order_by(Score.created_at.desc()).limit(num_recent_scores).all()
    
    if len(recent_scores) < 2:
        return 50  # Not enough history, neutral
    
    recent_scores.reverse()  # Chronological order
    
    # Calculate rate of change
    deltas = []
    for i in range(1, len(recent_scores)):
        delta = recent_scores[i].value - recent_scores[i-1].value
        deltas.append(delta)
    
    avg_delta = sum(deltas) / len(deltas) if deltas else 0
    
    # Positive delta (rising) = higher trajectory concern
    trajectory = min(100, max(0, 50 + (avg_delta * 2)))
    return round(trajectory, 2)


def extract_reported_stressors(text: str) -> float:
    """
    Extract reported_external_stressors from user text.
    
    Look for keywords indicating:
    - Threat/intimidation
    - Boycott/social ostracism
    - Financial hardship
    - Other external pressure
    
    Returns: 0-100 score
    """
    stressor_keywords = {
        "threat": 80,
        "threatened": 80,
        "danger": 75,
        "afraid": 60,
        "scared": 60,
        "boycott": 70,
        "alone": 50,
        "isolated": 60,
        "money": 40,
        "financial": 50,
        "hardship": 60,
        "pressure": 50,
        "family": 30,  # Context-dependent, lower weight
    }
    
    text_lower = text.lower()
    found_stressors = []
    
    for keyword, weight in stressor_keywords.items():
        if keyword in text_lower:
            found_stressors.append(weight)
    
    if not found_stressors:
        return 10  # No reported stressors detected
    
    # Average the weights of found stressors
    avg_stressor = sum(found_stressors) / len(found_stressors)
    return round(max(0, min(100, avg_stressor)), 2)