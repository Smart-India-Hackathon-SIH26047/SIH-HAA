import uuid
from datetime import datetime
from sqlalchemy import (
    Column, String, Boolean, DateTime, Date, Integer, Float,
    ForeignKey, CheckConstraint, Index
)
from sqlalchemy.dialects.postgresql import UUID
from .database import Base


class Person(Base):
    __tablename__ = "people"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pseudonym = Column(String, unique=True, nullable=False)
    language = Column(String, nullable=False)
    registered_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    case_phase = Column(String, nullable=False)
    district = Column(String, nullable=False)
    state = Column(String, nullable=False)
    consent_given = Column(Boolean, default=False, nullable=False)
    consent_at = Column(DateTime, nullable=True)

    __table_args__ = (
        CheckConstraint(
            "case_phase IN ('investigation', 'trial', 'rehabilitation', 'compensation')",
            name="check_case_phase_valid"
        ),
    )


class Officer(Base):
    __tablename__ = "officers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    role = Column(String, nullable=False)
    district = Column(String, nullable=False)

    __table_args__ = (
        CheckConstraint(
            "role IN ('counsellor', 'district_officer', 'admin')",
            name="check_role_valid"
        ),
    )


class CheckIn(Base):
    __tablename__ = "checkins"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    person_id = Column(UUID(as_uuid=True), ForeignKey("people.id"), nullable=False)
    channel = Column(String, nullable=False)
    raw_text = Column(String, nullable=False)
    ai_response = Column(String, nullable=True)
    is_crisis = Column(Boolean, default=False, nullable=False)
    language = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    response_time_sec = Column(Integer, nullable=True)

    __table_args__ = (
        CheckConstraint(
            "channel IN ('chat', 'voice', 'sms')",
            name="check_channel_valid"
        ),
    )


class Score(Base):
    __tablename__ = "scores"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    person_id = Column(UUID(as_uuid=True), ForeignKey("people.id"), nullable=False)
    checkin_id = Column(UUID(as_uuid=True), ForeignKey("checkins.id"), nullable=True)
    value = Column(Float, nullable=False)
    band = Column(String, nullable=False)
    component_emotion = Column(Float, nullable=True)
    component_voice_stress = Column(Float, nullable=True)
    component_engagement = Column(Float, nullable=True)
    component_case_events = Column(Float, nullable=True)
    component_reported_stressors = Column(Float, nullable=True)
    component_trajectory = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        CheckConstraint(
            "band IN ('stable', 'watch', 'elevated', 'priority')",
            name="check_band_valid"
        ),
        Index("ix_scores_band", "band"),
        Index("ix_scores_person_id", "person_id"),
    )


class CaseEvent(Base):
    __tablename__ = "case_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    person_id = Column(UUID(as_uuid=True), ForeignKey("people.id"), nullable=False)
    event_type = Column(String, nullable=False)
    event_date = Column(Date, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        CheckConstraint(
            "event_type IN ('hearing_scheduled', 'hearing_delayed', "
            "'threat_reported', 'compensation_released')",
            name="check_event_type_valid"
        ),
    )


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    score_id = Column(UUID(as_uuid=True), ForeignKey("scores.id"), nullable=False)
    severity = Column(String, nullable=False)
    status = Column(String, nullable=False, default="open")
    assigned_to = Column(String, nullable=True)
    acknowledged_at = Column(DateTime, nullable=True)
    officer_decision = Column(String, nullable=True)
    officer_reason = Column(String, nullable=True)

    __table_args__ = (
        CheckConstraint(
            "severity IN ('low', 'medium', 'high', 'critical')",
            name="check_severity_valid"
        ),
        CheckConstraint(
            "status IN ('open', 'acknowledged', 'resolved')",
            name="check_status_valid"
        ),
        CheckConstraint(
            "officer_decision IN ('agree', 'disagree') OR officer_decision IS NULL",
            name="check_officer_decision_valid"
        ),
    )


class AccessLog(Base):
    __tablename__ = "access_log"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    person_id = Column(UUID(as_uuid=True), ForeignKey("people.id"), nullable=False)
    accessed_by = Column(String, nullable=False)
    action = Column(String, nullable=False)
    accessed_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        CheckConstraint(
            "action IN ('viewed', 'exported', 'edited')",
            name="check_action_valid"
        ),
    )