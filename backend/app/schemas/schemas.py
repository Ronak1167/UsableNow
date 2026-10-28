from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, HttpUrl, field_validator, model_validator


class FeatureBase(BaseModel):
    feature_type: str
    display_name: str
    description: Optional[str] = None


class FeatureResponse(FeatureBase):
    id: str
    facility_id: str
    created_at: datetime

    class Config:
        from_attributes = True


class ReportBase(BaseModel):
    facility_id: str
    feature_id: str
    reported_status: str  # WORKING, UNAVAILABLE, UNCERTAIN
    source_type: str = "STUDENT_REPORT"  # STUDENT_REPORT, MAINTENANCE_STAFF, ON_SITE_OBSERVATION
    note: Optional[str] = Field(None, max_length=500)
    evidence_url: Optional[str] = Field(None, max_length=500)
    is_anonymous: bool = False
    crowd_level: Optional[str] = Field(None, max_length=50)  # Low, Medium, High
    laundry_status: Optional[str] = Field(None, max_length=50)  # Ready, Delayed, Not ready, Collected
    estimated_time: Optional[str] = Field(None, max_length=100)  # User-reported collection or ready-by time

    @field_validator("crowd_level")
    def validate_crowd(cls, v: Optional[str]) -> Optional[str]:
        if v is None or not v.strip():
            return None
        valid = ["LOW", "MEDIUM", "HIGH"]
        v_upper = v.strip().upper()
        if v_upper not in valid:
            raise ValueError(f"crowd_level must be one of {valid}")
        return v_upper.capitalize()

    @field_validator("laundry_status")
    def validate_laundry_status(cls, v: Optional[str]) -> Optional[str]:
        if v is None or not v.strip():
            return None
        valid = ["READY", "DELAYED", "NOT READY", "NOT_READY", "COLLECTED"]
        v_clean = v.strip().upper().replace("_", " ")
        if v_clean not in ["READY", "DELAYED", "NOT READY", "COLLECTED"]:
            raise ValueError("laundry_status must be Ready, Delayed, Not ready, or Collected")
        if v_clean == "NOT READY":
            return "Not ready"
        return v_clean.capitalize()

    @field_validator("reported_status")
    def validate_status(cls, v: str) -> str:
        valid = ["WORKING", "UNAVAILABLE", "UNCERTAIN"]
        v_upper = v.upper()
        if v_upper not in valid:
            raise ValueError(f"reported_status must be one of {valid}")
        return v_upper

    @field_validator("source_type")
    def validate_source(cls, v: str) -> str:
        valid = ["STUDENT_REPORT", "MAINTENANCE_STAFF", "ON_SITE_OBSERVATION"]
        v_upper = v.upper()
        if v_upper not in valid:
            raise ValueError(f"source_type must be one of {valid}")
        return v_upper

    @model_validator(mode="after")
    def validate_contradictions(self) -> 'ReportBase':
        # "Collected" signifies clothes pickup, not that a washer/dryer is operational or free.
        if getattr(self, "laundry_status", None) == "Collected" and getattr(self, "reported_status", None) == "WORKING" and not getattr(self, "crowd_level", None):
            raise ValueError(
                "Collecting laundry confirms clothes pickup, not that machines are currently working or vacant. "
                "Please indicate condition as UNCERTAIN or provide observed crowd level."
            )
        return self


class ReportCreate(ReportBase):
    pass


class ReportResponse(ReportBase):
    id: str
    moderation_status: str
    is_demo_data: bool
    created_at: datetime

    class Config:
        from_attributes = True


class FeatureAssessmentResponse(BaseModel):
    feature_id: str
    feature_type: str
    display_name: str
    status: str  # LIKELY_WORKING, LIKELY_UNAVAILABLE, CONFLICTING, UNKNOWN
    freshness: str  # Fresh, Stale, Expired, No Evidence
    confidence_score: float
    confidence_label: str  # High, Medium, Low, Unknown
    reason_code: str
    explanation: str
    supporting_reports_count: int
    conflicting_reports_count: int
    total_reports_count: int
    last_reported_at: Optional[datetime] = None
    last_confirmed_working_at: Optional[datetime] = None
    is_demo_data: bool
    evidence_breakdown: Dict[str, Any]
    summary_text: Optional[str] = None
    summary_source: Optional[str] = None


class FacilityBase(BaseModel):
    name: str
    description: Optional[str] = None
    facility_type: str
    building_or_area: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    opening_hours: Optional[str] = None
    is_demo_data: bool = True
    static_map_url: Optional[str] = None
    directions_url: Optional[str] = None


class FacilityResponse(FacilityBase):
    id: str
    created_at: datetime
    updated_at: datetime
    features: List[FeatureResponse] = []

    class Config:
        from_attributes = True


class FacilityCardResponse(FacilityResponse):
    primary_status: str = "UNKNOWN"
    primary_feature_name: Optional[str] = None
    confidence_label: str = "Unknown"
    confidence_score: float = 0.0
    freshness: str = "No Evidence"
    distance_meters: Optional[float] = None
    recommendation_reason: Optional[str] = None
    feature_assessments: List[FeatureAssessmentResponse] = []


class FacilityDetailResponse(FacilityResponse):
    feature_assessments: List[FeatureAssessmentResponse] = []
    recent_reports: List[ReportResponse] = []
    alternatives: List[FacilityCardResponse] = []


class NaturalLanguageParseResponse(BaseModel):
    query: str
    detected_feature_type: Optional[str] = None
    suggested_status: Optional[str] = None
    detected_area: Optional[str] = None
    source: str


class AnalyticsOverview(BaseModel):
    total_facilities: int
    total_features: int
    total_reports: int
    likely_working_features: int
    likely_unavailable_features: int
    conflicting_features: int
    unknown_features: int
    fresh_features: int
    stale_features: int
    demo_data_notice: str
    recent_reports: List[ReportResponse]


class MapsConfigResponse(BaseModel):
    google_maps_enabled: bool
    campus_name: str = "JIIT Noida Sector 62 Campus"
    campus_center: Dict[str, float] = {"latitude": 28.62970, "longitude": 77.37210}


class WalkingRouteResponse(BaseModel):
    status: str
    source: str
    distance_meters: float
    duration_seconds: int
    duration_minutes: int
    duration_formatted: str
    polyline: Optional[str] = None
