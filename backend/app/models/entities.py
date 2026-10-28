import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


def utc_now():
    return datetime.now(timezone.utc)


def generate_uuid():
    return str(uuid.uuid4())


class Facility(Base):
    __tablename__ = "facilities"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    facility_type = Column(String(100), nullable=False, index=True)
    building_or_area = Column(String(150), nullable=False, index=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    opening_hours = Column(String(100), nullable=True)
    is_demo_data = Column(Boolean, default=True, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    features = relationship("Feature", back_populates="facility", cascade="all, delete-orphan", lazy="joined")
    reports = relationship("Report", back_populates="facility", cascade="all, delete-orphan")


class Feature(Base):
    __tablename__ = "features"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    facility_id = Column(String(64), ForeignKey("facilities.id", ondelete="CASCADE"), nullable=False, index=True)
    feature_type = Column(String(100), nullable=False, index=True)
    display_name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    facility = relationship("Facility", back_populates="features")
    reports = relationship("Report", back_populates="feature", cascade="all, delete-orphan")


class Report(Base):
    __tablename__ = "reports"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    facility_id = Column(String(64), ForeignKey("facilities.id", ondelete="CASCADE"), nullable=False, index=True)
    feature_id = Column(String(64), ForeignKey("features.id", ondelete="CASCADE"), nullable=False, index=True)
    reported_status = Column(String(50), nullable=False, index=True)  # WORKING, UNAVAILABLE, UNCERTAIN
    source_type = Column(String(50), nullable=False, default="STUDENT_REPORT")  # STUDENT_REPORT, MAINTENANCE_STAFF, ON_SITE_OBSERVATION
    note = Column(Text, nullable=True)
    evidence_url = Column(String(500), nullable=True)
    is_anonymous = Column(Boolean, default=False, nullable=False)
    crowd_level = Column(String(50), nullable=True)  # Low, Medium, High
    laundry_status = Column(String(50), nullable=True)  # Ready, Delayed, Not ready, Collected
    estimated_time = Column(String(100), nullable=True)  # e.g., Estimated ready by 4:30 PM
    moderation_status = Column(String(50), default="APPROVED", nullable=False, index=True)  # APPROVED, PENDING, REJECTED, FLAGGED
    is_demo_data = Column(Boolean, default=True, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False, index=True)
    reporter_ip_hash = Column(String(64), nullable=True)

    facility = relationship("Facility", back_populates="reports")
    feature = relationship("Feature", back_populates="reports")


class ModerationLog(Base):
    __tablename__ = "moderation_logs"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    report_id = Column(String(64), ForeignKey("reports.id", ondelete="CASCADE"), nullable=False, index=True)
    action = Column(String(50), nullable=False)  # APPROVED, REJECTED, FLAGGED
    reason = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
