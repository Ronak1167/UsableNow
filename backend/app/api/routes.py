import hashlib
import secrets
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, Header, Request, status, Response
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.database import get_db
from app.config import settings
from app.models.entities import Facility, Feature, Report, ModerationLog
from app.schemas.schemas import (
    FacilityResponse, FacilityCardResponse, FacilityDetailResponse,
    FeatureResponse, FeatureAssessmentResponse,
    ReportCreate, ReportResponse,
    NaturalLanguageParseResponse, AnalyticsOverview,
    MapsConfigResponse, WalkingRouteResponse
)
from app.core.reliability_engine import assess_feature_reliability
from app.core.recommendations import rank_facilities_for_need, FacilityRecommendation
from app.services.ai_service import ai_service
from app.services.maps_service import maps_service, is_within_campus_bounds
from app.seed.seed_data import seed_database

logger = logging.getLogger(__name__)
router = APIRouter()


def filter_reports_by_evidence_policy(
    reports: List[Report],
    evidence_mode: Optional[str] = None
) -> List[Report]:
    """
    Applies explicit evidence selection and precedence policy across public report feeds:
    - Strictly filters for moderation_status == 'APPROVED'; non-approved reports are confidential.
    - In 'live' mode: excludes all demo reports (is_demo_data == False only).
    - In 'demo' mode: returns all approved reports.
    - In 'hybrid' mode: for each feature, if any approved live reports exist,
      they supersede demo reports for that feature. Demo reports for features that already
      have live observations are excluded so they do not present demo data as corroborating
      current live state. If a feature has no live reports, its approved demo baseline reports
      are preserved.
    """
    mode = (evidence_mode or getattr(settings, "EVIDENCE_MODE", "demo") or "demo").lower()
    approved = [r for r in reports if getattr(r, "moderation_status", "APPROVED") == "APPROVED"]

    if mode == "live":
        return [r for r in approved if not getattr(r, "is_demo_data", False)]
    elif mode == "hybrid":
        features_with_live = {
            r.feature_id for r in approved
            if r.feature_id and not getattr(r, "is_demo_data", False)
        }
        filtered: List[Report] = []
        for r in approved:
            if r.feature_id in features_with_live:
                if not getattr(r, "is_demo_data", False):
                    filtered.append(r)
            else:
                filtered.append(r)
        return filtered
    else:  # demo mode
        return approved


def is_valid_admin_secret(configured_key: Optional[str]) -> bool:
    """Checks whether the configured admin secret meets security standards."""
    key = (configured_key or "").strip()
    return bool(
        key
        and len(key) >= 8
        and key.lower() not in ("admin-demo-key-usable2026", "secret", "admin", "password")
    )


def verify_admin_key(x_admin_key: Optional[str] = Header(None)):
    configured_key = (settings.ADMIN_SECRET_KEY or "").strip()
    env = getattr(settings, "ENVIRONMENT", "development").lower()

    # Fail closed if ADMIN_SECRET_KEY is missing or insecure across all protected admin operations
    if not is_valid_admin_secret(configured_key):
        logger.error("Protected admin operation failed closed: ADMIN_SECRET_KEY is missing or insecurely configured.")
        if env in ("production", "prod"):
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Admin functionality is disabled: secure ADMIN_SECRET_KEY is not configured on this server."
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Admin access is disabled: ADMIN_SECRET_KEY must be configured in environment."
            )

    if not x_admin_key or not secrets.compare_digest(x_admin_key, configured_key):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing admin credentials. Unauthorized."
        )
    return True


@router.get("/health", tags=["Health"])
def health_check(db: Session = Depends(get_db)):
    """Application readiness and database connectivity health probe."""
    try:
        facility_count = db.query(Facility).count()
        ai_provider = "deterministic_local_fallback"
        if settings.GEMINI_API_KEY:
            ai_provider = "gemini"
        elif settings.OPENAI_API_KEY:
            ai_provider = "openai"

        return {
            "status": "healthy",
            "database": "connected",
            "facilities_count": facility_count,
            "version": settings.VERSION,
            "ai_mode": ai_provider,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    except Exception as e:
        logger.error("Health probe failure", exc_info=True)
        # Avoid leaking raw internal exception strings to public callers
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connectivity probe failed or service unavailable."
        )


@router.get("/features", response_model=List[FeatureResponse], tags=["Features"])
def list_features(
    feature_type: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Lists available features across the campus."""
    query = db.query(Feature)
    if feature_type:
        query = query.filter(Feature.feature_type == feature_type)
    return query.all()


@router.get("/facilities", response_model=List[FacilityCardResponse], tags=["Facilities"])
def list_facilities(
    feature_type: Optional[str] = None,
    building: Optional[str] = None,
    facility_type: Optional[str] = None,
    status_filter: Optional[str] = None,
    freshness_filter: Optional[str] = None,
    user_lat: Optional[float] = None,
    user_lon: Optional[float] = None,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    """
    Lists facilities with calculated feature-level reliability assessments.
    Supports filtering by target feature, building, status, and freshness.
    """
    facilities = db.query(Facility).all()
    recommendations = rank_facilities_for_need(
        facilities=facilities,
        target_feature_type=feature_type,
        user_lat=user_lat,
        user_lon=user_lon
    )

    cards: List[FacilityCardResponse] = []
    for rec in recommendations:
        fac = next((f for f in facilities if f.id == rec.facility_id), None)
        if not fac:
            continue

        if building and building.lower() not in fac.building_or_area.lower():
            continue
        if facility_type and facility_type.lower() not in fac.facility_type.lower():
            continue
        if status_filter and rec.target_feature_status.upper() != status_filter.upper():
            continue
        if freshness_filter and rec.target_feature_freshness.lower() != freshness_filter.lower():
            continue

        assessments_resp = [
            FeatureAssessmentResponse(
                feature_id=a.feature_id,
                feature_type=a.feature_type,
                display_name=a.display_name,
                status=a.status,
                freshness=a.freshness,
                confidence_score=a.confidence_score,
                confidence_label=a.confidence_label,
                reason_code=a.reason_code,
                explanation=a.explanation,
                supporting_reports_count=a.supporting_reports_count,
                conflicting_reports_count=a.conflicting_reports_count,
                total_reports_count=a.total_reports_count,
                last_reported_at=a.last_reported_at,
                last_confirmed_working_at=a.last_confirmed_working_at,
                is_demo_data=a.is_demo_data,
                evidence_breakdown=a.evidence_breakdown
            )
            for a in rec.all_feature_assessments
        ]

        card = FacilityCardResponse(
            id=fac.id,
            name=fac.name,
            description=fac.description,
            facility_type=fac.facility_type,
            building_or_area=fac.building_or_area,
            latitude=fac.latitude,
            longitude=fac.longitude,
            static_map_url=maps_service.get_static_map_url(fac.latitude, fac.longitude) if fac.latitude is not None and fac.longitude is not None else None,
            directions_url=maps_service.get_directions_url(fac.latitude, fac.longitude, origin_lat=user_lat, origin_lon=user_lon) if fac.latitude is not None and fac.longitude is not None else None,
            opening_hours=fac.opening_hours,
            is_demo_data=fac.is_demo_data,
            created_at=fac.created_at,
            updated_at=fac.updated_at,
            features=[FeatureResponse.from_orm(f) for f in fac.features],
            primary_status=rec.target_feature_status,
            primary_feature_name=rec.target_feature_name,
            confidence_label=rec.target_feature_confidence_label,
            confidence_score=rec.target_feature_confidence,
            freshness=rec.target_feature_freshness,
            distance_meters=rec.distance_meters,
            recommendation_reason=rec.recommendation_reason,
            feature_assessments=assessments_resp
        )
        cards.append(card)

    return cards[offset: offset + limit]


@router.get("/facilities/{facility_id}", response_model=FacilityDetailResponse, tags=["Facilities"])
def get_facility_detail(
    facility_id: str,
    db: Session = Depends(get_db)
):
    """
    Returns full details for a facility, including independent feature assessments,
    evidence-grounded natural-language summaries, chronological reports, and alternatives.
    """
    evidence_mode = (getattr(settings, "EVIDENCE_MODE", "demo") or "demo").lower()
    fac = db.query(Facility).filter(Facility.id == facility_id).first()
    if not fac:
        raise HTTPException(status_code=404, detail="Facility not found")

    # Assess each feature individually
    feature_assessments: List[FeatureAssessmentResponse] = []
    for feat in fac.features:
        feat_reports = [r for r in fac.reports if r.feature_id == feat.id]
        active_feat_reports = filter_reports_by_evidence_policy(feat_reports, evidence_mode)
        assessment = assess_feature_reliability(
            feature_id=feat.id,
            feature_type=feat.feature_type,
            display_name=feat.display_name,
            reports=active_feat_reports,
            evidence_mode=evidence_mode
        )

        # Generate evidence-grounded summary using only active policy-compliant reports
        recent_dicts = [
            {"reported_status": r.reported_status, "note": r.note, "created_at": r.created_at.isoformat()}
            for r in sorted(active_feat_reports, key=lambda x: x.created_at, reverse=True)[:5]
        ]
        sum_data = ai_service.generate_summary(
            facility_name=fac.name,
            feature_name=feat.display_name,
            status=assessment.status,
            confidence_label=assessment.confidence_label,
            confidence_score=assessment.confidence_score,
            reports_summary=recent_dicts,
            freshness=assessment.freshness
        )

        resp_assessment = FeatureAssessmentResponse(
            feature_id=assessment.feature_id,
            feature_type=assessment.feature_type,
            display_name=assessment.display_name,
            status=assessment.status,
            freshness=assessment.freshness,
            confidence_score=assessment.confidence_score,
            confidence_label=assessment.confidence_label,
            reason_code=assessment.reason_code,
            explanation=assessment.explanation,
            supporting_reports_count=assessment.supporting_reports_count,
            conflicting_reports_count=assessment.conflicting_reports_count,
            total_reports_count=assessment.total_reports_count,
            last_reported_at=assessment.last_reported_at,
            last_confirmed_working_at=assessment.last_confirmed_working_at,
            is_demo_data=assessment.is_demo_data,
            evidence_breakdown=assessment.evidence_breakdown,
            summary_text=sum_data["summary"],
            summary_source=sum_data["source"]
        )
        feature_assessments.append(resp_assessment)

    # Chronological reports for this facility (moderation policy & evidence mode consistent)
    active_chron = filter_reports_by_evidence_policy(fac.reports, evidence_mode)
    chron_reports = sorted(active_chron, key=lambda r: r.created_at, reverse=True)[:20]

    # Find alternatives matching similar features
    primary_feat_type = fac.features[0].feature_type if fac.features else None
    alternatives: List[FacilityCardResponse] = []
    if primary_feat_type:
        all_facs = db.query(Facility).filter(Facility.id != facility_id).all()
        ranked_alts = rank_facilities_for_need(all_facs, target_feature_type=primary_feat_type)[:3]
        for alt in ranked_alts:
            alt_fac = next((f for f in all_facs if f.id == alt.facility_id), None)
            if alt_fac:
                alts_assessments = [
                    FeatureAssessmentResponse(
                        feature_id=a.feature_id,
                        feature_type=a.feature_type,
                        display_name=a.display_name,
                        status=a.status,
                        freshness=a.freshness,
                        confidence_score=a.confidence_score,
                        confidence_label=a.confidence_label,
                        reason_code=a.reason_code,
                        explanation=a.explanation,
                        supporting_reports_count=a.supporting_reports_count,
                        conflicting_reports_count=a.conflicting_reports_count,
                        total_reports_count=a.total_reports_count,
                        last_reported_at=a.last_reported_at,
                        last_confirmed_working_at=a.last_confirmed_working_at,
                        is_demo_data=a.is_demo_data,
                        evidence_breakdown=a.evidence_breakdown
                    ) for a in alt.all_feature_assessments
                ]
                alternatives.append(
                    FacilityCardResponse(
                        id=alt_fac.id,
                        name=alt_fac.name,
                        description=alt_fac.description,
                        facility_type=alt_fac.facility_type,
                        building_or_area=alt_fac.building_or_area,
                        latitude=alt_fac.latitude,
                        longitude=alt_fac.longitude,
                        static_map_url=maps_service.get_static_map_url(alt_fac.latitude, alt_fac.longitude) if alt_fac.latitude is not None and alt_fac.longitude is not None else None,
                        directions_url=maps_service.get_directions_url(alt_fac.latitude, alt_fac.longitude) if alt_fac.latitude is not None and alt_fac.longitude is not None else None,
                        opening_hours=alt_fac.opening_hours,
                        is_demo_data=alt_fac.is_demo_data,
                        created_at=alt_fac.created_at,
                        updated_at=alt_fac.updated_at,
                        features=[FeatureResponse.from_orm(f) for f in alt_fac.features],
                        primary_status=alt.target_feature_status,
                        primary_feature_name=alt.target_feature_name,
                        confidence_label=alt.target_feature_confidence_label,
                        confidence_score=alt.target_feature_confidence,
                        freshness=alt.target_feature_freshness,
                        recommendation_reason=alt.recommendation_reason,
                        feature_assessments=alts_assessments
                    )
                )

    return FacilityDetailResponse(
        id=fac.id,
        name=fac.name,
        description=fac.description,
        facility_type=fac.facility_type,
        building_or_area=fac.building_or_area,
        latitude=fac.latitude,
        longitude=fac.longitude,
        static_map_url=maps_service.get_static_map_url(fac.latitude, fac.longitude) if fac.latitude is not None and fac.longitude is not None else None,
        directions_url=maps_service.get_directions_url(fac.latitude, fac.longitude) if fac.latitude is not None and fac.longitude is not None else None,
        opening_hours=fac.opening_hours,
        is_demo_data=fac.is_demo_data,
        created_at=fac.created_at,
        updated_at=fac.updated_at,
        features=[FeatureResponse.from_orm(f) for f in fac.features],
        feature_assessments=feature_assessments,
        recent_reports=[ReportResponse.from_orm(r) for r in chron_reports],
        alternatives=alternatives
    )


@router.get("/facilities/{facility_id}/features", response_model=List[FeatureAssessmentResponse], tags=["Facilities"])
def get_facility_features(
    facility_id: str,
    db: Session = Depends(get_db)
):
    """Returns all features of a facility with calculated reliability assessments."""
    evidence_mode = (getattr(settings, "EVIDENCE_MODE", "demo") or "demo").lower()
    fac = db.query(Facility).filter(Facility.id == facility_id).first()
    if not fac:
        raise HTTPException(status_code=404, detail="Facility not found")

    assessments: List[FeatureAssessmentResponse] = []
    for feat in fac.features:
        feat_reports = [r for r in fac.reports if r.feature_id == feat.id]
        active_feat_reports = filter_reports_by_evidence_policy(feat_reports, evidence_mode)
        a = assess_feature_reliability(
            feature_id=feat.id,
            feature_type=feat.feature_type,
            display_name=feat.display_name,
            reports=active_feat_reports,
            evidence_mode=evidence_mode
        )
        assessments.append(
            FeatureAssessmentResponse(
                feature_id=a.feature_id,
                feature_type=a.feature_type,
                display_name=a.display_name,
                status=a.status,
                freshness=a.freshness,
                confidence_score=a.confidence_score,
                confidence_label=a.confidence_label,
                reason_code=a.reason_code,
                explanation=a.explanation,
                supporting_reports_count=a.supporting_reports_count,
                conflicting_reports_count=a.conflicting_reports_count,
                total_reports_count=a.total_reports_count,
                last_reported_at=a.last_reported_at,
                last_confirmed_working_at=a.last_confirmed_working_at,
                is_demo_data=a.is_demo_data,
                evidence_breakdown=a.evidence_breakdown
            )
        )
    return assessments


@router.get("/facilities/{facility_id}/reports", response_model=List[ReportResponse], tags=["Reports"])
def get_facility_reports(
    facility_id: str,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    """
    Returns public chronological approved reports for a facility.
    Rejected, flagged, and pending reports are strictly excluded from public responses.
    In hybrid mode, demo reports are excluded for features that have live reports to prevent
    presenting demo data as corroborating live observations.
    """
    evidence_mode = (getattr(settings, "EVIDENCE_MODE", "demo") or "demo").lower()
    raw_reports = (
        db.query(Report)
        .filter(Report.facility_id == facility_id)
        .all()
    )
    active_reports = filter_reports_by_evidence_policy(raw_reports, evidence_mode)
    sorted_reports = sorted(active_reports, key=lambda r: r.created_at, reverse=True)
    return sorted_reports[offset: offset + limit]


@router.get("/search", tags=["Search"])
def search_facilities(
    q: str = Query(..., min_length=1, description="Natural language or keyword query"),
    db: Session = Depends(get_db)
):
    """
    Parses natural language queries (e.g., 'I need drinking water near ABB-1')
    maps them to feature categories, and ranks matching facilities.
    """
    parsed = ai_service.categorize_text(q)
    target_feature = parsed.get("feature_type")
    detected_area = parsed.get("detected_area")

    facilities = db.query(Facility).all()
    if detected_area:
        # Pre-filter or prioritize facilities matching area
        area_matched = [f for f in facilities if detected_area.lower() in f.building_or_area.lower() or detected_area.lower() in f.name.lower()]
        if area_matched:
            facilities = area_matched

    recommendations = rank_facilities_for_need(
        facilities=facilities,
        target_feature_type=target_feature
    )

    cards: List[FacilityCardResponse] = []
    for rec in recommendations:
        fac = next((f for f in facilities if f.id == rec.facility_id), None)
        if not fac:
            continue
        assessments_resp = [
            FeatureAssessmentResponse(
                feature_id=a.feature_id,
                feature_type=a.feature_type,
                display_name=a.display_name,
                status=a.status,
                freshness=a.freshness,
                confidence_score=a.confidence_score,
                confidence_label=a.confidence_label,
                reason_code=a.reason_code,
                explanation=a.explanation,
                supporting_reports_count=a.supporting_reports_count,
                conflicting_reports_count=a.conflicting_reports_count,
                total_reports_count=a.total_reports_count,
                last_reported_at=a.last_reported_at,
                last_confirmed_working_at=a.last_confirmed_working_at,
                is_demo_data=a.is_demo_data,
                evidence_breakdown=a.evidence_breakdown
            )
            for a in rec.all_feature_assessments
        ]

        cards.append(
            FacilityCardResponse(
                id=fac.id,
                name=fac.name,
                description=fac.description,
                facility_type=fac.facility_type,
                building_or_area=fac.building_or_area,
                latitude=fac.latitude,
                longitude=fac.longitude,
                opening_hours=fac.opening_hours,
                is_demo_data=fac.is_demo_data,
                created_at=fac.created_at,
                updated_at=fac.updated_at,
                features=[FeatureResponse.from_orm(f) for f in fac.features],
                primary_status=rec.target_feature_status,
                primary_feature_name=rec.target_feature_name,
                confidence_label=rec.target_feature_confidence_label,
                confidence_score=rec.target_feature_confidence,
                freshness=rec.target_feature_freshness,
                recommendation_reason=rec.recommendation_reason,
                feature_assessments=assessments_resp
            )
        )

    return {
        "query": q,
        "parsed_intent": NaturalLanguageParseResponse(
            query=q,
            detected_feature_type=target_feature,
            suggested_status=parsed.get("suggested_status"),
            detected_area=detected_area,
            source=parsed.get("source", "Deterministic local fallback")
        ),
        "results_count": len(cards),
        "results": cards
    }


@router.get("/recommendations", tags=["Recommendations"])
def get_recommendations(
    feature_type: str = Query(..., description="Target feature type (e.g. drinking_water, printer)"),
    user_lat: Optional[float] = None,
    user_lon: Optional[float] = None,
    limit: int = 10,
    db: Session = Depends(get_db)
):
    """Returns top recommended facilities for a specific user need with transparent ranking rationale."""
    facilities = db.query(Facility).all()
    ranked = rank_facilities_for_need(
        facilities=facilities,
        target_feature_type=feature_type,
        user_lat=user_lat,
        user_lon=user_lon
    )
    return ranked[:limit]


@router.post("/reports", response_model=ReportResponse, status_code=status.HTTP_201_CREATED, tags=["Reports"])
def submit_report(
    report_in: ReportCreate,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Submits a new status observation report.
    Validates facility and feature existence, prevents duplicate flood,
    persists with server-side UTC timestamp, and flags unverified source claims.
    """
    # 1. Validate facility exists
    facility = db.query(Facility).filter(Facility.id == report_in.facility_id).first()
    if not facility:
        raise HTTPException(status_code=400, detail="Invalid facility_id: Facility does not exist.")

    # 2. Validate feature exists and belongs to facility
    feature = db.query(Feature).filter(Feature.id == report_in.feature_id, Feature.facility_id == facility.id).first()
    if not feature:
        raise HTTPException(status_code=400, detail="Invalid feature_id: Feature does not belong to the specified facility.")

    # 3. Hash client IP for rate limiting / deduplication protection
    client_ip = request.client.host if request.client else "unknown"
    ip_hash = hashlib.sha256(client_ip.encode()).hexdigest()[:16]

    now = datetime.now(timezone.utc)

    # Rate limiting: max 5 report submissions per minute per IP to protect server from flooding
    # while accommodating shared campus Wi-Fi environments
    recent_submissions_count = (
        db.query(Report)
        .filter(
            Report.reporter_ip_hash == ip_hash,
            Report.created_at >= now - timedelta(minutes=1)
        )
        .count()
    )
    if recent_submissions_count >= 5:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Submission rate limit exceeded. Please wait a minute before submitting additional observations."
        )

    # Check for identical report within 30 seconds (anti-spam / double-click protection)
    recent_dup = (
        db.query(Report)
        .filter(
            Report.facility_id == report_in.facility_id,
            Report.feature_id == report_in.feature_id,
            Report.reported_status == report_in.reported_status,
            Report.reporter_ip_hash == ip_hash
        )
        .order_by(desc(Report.created_at))
        .first()
    )
    if recent_dup:
        time_diff = (now - (recent_dup.created_at.replace(tzinfo=timezone.utc) if recent_dup.created_at.tzinfo is None else recent_dup.created_at)).total_seconds()
        if time_diff < 30.0:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="A duplicate report was submitted a few moments ago. Please wait before reporting again."
            )

    # Prevent untrusted public client submissions from asserting verified staff/official identity without admin key
    admin_header = request.headers.get("x-admin-key")
    configured_admin_key = (settings.ADMIN_SECRET_KEY or "").strip()
    is_admin = bool(
        admin_header
        and is_valid_admin_secret(configured_admin_key)
        and secrets.compare_digest(admin_header, configured_admin_key)
    )

    effective_source = report_in.source_type
    if effective_source in ("MAINTENANCE_STAFF", "STAFF", "IOT_SENSOR", "OFFICIAL_NOTICE"):
        if not is_admin:
            # Reclassify client claim to student report
            effective_source = "STUDENT_REPORT"

    # Public student reports are held as PENDING until verified by moderation.
    # Admin-authenticated submissions are approved immediately.
    initial_moderation_status = "APPROVED" if is_admin else "PENDING"

    new_report = Report(
        facility_id=report_in.facility_id,
        feature_id=report_in.feature_id,
        reported_status=report_in.reported_status,
        source_type=effective_source,
        note=report_in.note.strip() if report_in.note else None,
        evidence_url=report_in.evidence_url.strip() if report_in.evidence_url else None,
        is_anonymous=report_in.is_anonymous,
        crowd_level=report_in.crowd_level,
        laundry_status=report_in.laundry_status,
        estimated_time=report_in.estimated_time.strip() if report_in.estimated_time else None,
        moderation_status=initial_moderation_status,
        is_demo_data=False,  # Live submitted report
        created_at=now,
        reporter_ip_hash=ip_hash
    )

    db.add(new_report)
    facility.updated_at = now
    db.commit()
    db.refresh(new_report)

    return new_report


@router.get("/analytics/overview", response_model=AnalyticsOverview, tags=["Analytics"])
def get_analytics_overview(db: Session = Depends(get_db)):
    """
    Returns transparency analytics: counts of facilities, features, reports,
    and real-time breakdown of features by calculated status and freshness.
    Strictly filters for approved reports and applies the evidence-mode policy consistently
    with the reliability engine.
    """
    evidence_mode = (getattr(settings, "EVIDENCE_MODE", "demo") or "demo").lower()
    facilities = db.query(Facility).all()
    all_raw_reports = db.query(Report).all()
    reports = filter_reports_by_evidence_policy(all_raw_reports, evidence_mode)
    features = db.query(Feature).all()

    working = 0
    unavailable = 0
    conflicting = 0
    unknown = 0
    fresh = 0
    stale = 0

    for feat in features:
        feat_reports = [r for r in reports if r.feature_id == feat.id]
        assessment = assess_feature_reliability(
            feature_id=feat.id,
            feature_type=feat.feature_type,
            display_name=feat.display_name,
            reports=feat_reports,
            evidence_mode=evidence_mode
        )
        if assessment.status == "LIKELY_WORKING":
            working += 1
        elif assessment.status == "LIKELY_UNAVAILABLE":
            unavailable += 1
        elif assessment.status == "CONFLICTING":
            conflicting += 1
        else:
            unknown += 1

        if assessment.freshness == "Fresh":
            fresh += 1
        else:
            stale += 1

    # Public recent reports feed
    recent_reports = sorted(reports, key=lambda r: r.created_at, reverse=True)[:10]

    return AnalyticsOverview(
        total_facilities=len(facilities),
        total_features=len(features),
        total_reports=len(reports),
        likely_working_features=working,
        likely_unavailable_features=unavailable,
        conflicting_features=conflicting,
        unknown_features=unknown,
        fresh_features=fresh,
        stale_features=stale,
        demo_data_notice="All facilities seeded for Lumina '26 Hackathon demo are clearly tagged as demonstration data.",
        recent_reports=[ReportResponse.from_orm(r) for r in recent_reports]
    )


# Admin Endpoints (Protected by ADMIN_SECRET_KEY Header)
@router.get("/admin/reports", response_model=List[ReportResponse], tags=["Admin"])
def get_all_reports_for_moderation(
    status_filter: Optional[str] = Query(None, pattern="^(APPROVED|REJECTED|FLAGGED|PENDING)$"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    admin_auth: bool = Depends(verify_admin_key),
    db: Session = Depends(get_db)
):
    """
    Protected admin endpoint to inspect all reports including rejected, flagged, and pending.
    Never exposed to unauthenticated public callers.
    """
    query = db.query(Report)
    if status_filter:
        query = query.filter(Report.moderation_status == status_filter)
    return query.order_by(desc(Report.created_at)).offset(offset).limit(limit).all()


@router.post("/admin/reset-demo", tags=["Admin"])
def reset_demo_database(
    admin_auth: bool = Depends(verify_admin_key),
    db: Session = Depends(get_db)
):
    """Protected admin endpoint to re-seed demo data."""
    res = seed_database(db, force_reset=True)
    return {
        "message": "Demonstration database successfully reset and seeded.",
        "details": res
    }


@router.post("/admin/reports/{report_id}/moderate", tags=["Admin"])
def moderate_report(
    report_id: str,
    action: str = Query(..., pattern="^(APPROVED|REJECTED|FLAGGED)$"),
    reason: Optional[str] = None,
    admin_auth: bool = Depends(verify_admin_key),
    db: Session = Depends(get_db)
):
    """Protected admin endpoint to moderate reports."""
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    report.moderation_status = action
    log = ModerationLog(
        report_id=report_id,
        action=action,
        reason=reason,
        created_at=datetime.now(timezone.utc)
    )
    db.add(log)
    db.commit()
    return {"message": f"Report {report_id} status updated to {action}."}


# ---------------------------------------------------------
# Google Maps Platform Endpoints
# ---------------------------------------------------------

@router.get("/maps/config", response_model=MapsConfigResponse, tags=["Maps"])
def get_maps_config():
    """Returns Google Maps integration status and campus reference coordinates."""
    return MapsConfigResponse(
        google_maps_enabled=maps_service.is_enabled(),
        campus_name="JIIT Noida Sector 62 Campus",
        campus_center={"latitude": 28.62970, "longitude": 77.37210}
    )


@router.get("/maps/walking-route", response_model=WalkingRouteResponse, tags=["Maps"])
def get_walking_route(
    origin_lat: float = Query(..., ge=-90.0, le=90.0),
    origin_lon: float = Query(..., ge=-180.0, le=180.0),
    destination_lat: float = Query(..., ge=-90.0, le=90.0),
    destination_lon: float = Query(..., ge=-180.0, le=180.0)
):
    """
    Calculates walking distance and duration between two coordinates on campus.
    Uses Google Routes API (New) with automatic Haversine walking fallback.
    Validates that both origin and destination are within JIIT Sector 62 campus coverage area.
    """
    if not is_within_campus_bounds(origin_lat, origin_lon):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Origin coordinates outside supported campus coverage area."
        )
    if not is_within_campus_bounds(destination_lat, destination_lon):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Destination coordinates outside supported campus coverage area."
        )

    res = maps_service.compute_walking_route(
        origin_lat=origin_lat,
        origin_lon=origin_lon,
        dest_lat=destination_lat,
        dest_lon=destination_lon
    )
    return WalkingRouteResponse(**res)


@router.get("/maps/static-preview", tags=["Maps"])
def get_static_map_preview(
    lat: float = Query(..., ge=-90.0, le=90.0),
    lon: float = Query(..., ge=-180.0, le=180.0),
    zoom: int = Query(17, ge=1, le=21)
):
    """
    Secure backend proxy for Google Static Maps preview images.
    Keeps the server-side API key strictly confidential and protects it from client exposure.
    Enforces JIIT Sector 62 campus boundary checks and bounded image caching.
    """
    if not is_within_campus_bounds(lat, lon):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Coordinates outside supported campus coverage area."
        )

    img_bytes = maps_service.fetch_static_map_image(lat=lat, lon=lon, zoom=zoom)
    if not img_bytes:
        raise HTTPException(status_code=404, detail="Map preview unavailable.")
    return Response(
        content=img_bytes,
        media_type="image/png",
        headers={"Cache-Control": "public, max-age=86400"}
    )

