import math
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from app.config import settings

# Half-lives in hours per feature type
FEATURE_HALF_LIVES: Dict[str, float] = {
    "step_free_access": 48.0,
    "lift": 24.0,
    "accessible_washroom": 12.0,
    "study_space": 12.0,
    "charging_point": 8.0,
    "drinking_water": 6.0,
    "printer": 6.0,
    "wifi": 6.0,
    # Laundry: crowd/readiness changes quickly — 2h half-life for crowd, 4h for machine status
    "laundry_crowd": 2.0,
    "laundry_machines": 4.0,
}
DEFAULT_HALF_LIFE = 6.0


class FeatureAssessment(BaseModel):
    feature_id: str
    feature_type: str
    display_name: str
    status: str  # LIKELY_WORKING, LIKELY_UNAVAILABLE, CONFLICTING, UNKNOWN
    freshness: str  # Fresh, Stale, Expired, No Evidence
    confidence_score: float = Field(ge=0.0, le=100.0)
    confidence_label: str  # High, Medium, Low, Unknown
    reason_code: str
    explanation: str
    supporting_reports_count: int = 0
    conflicting_reports_count: int = 0
    total_reports_count: int = 0
    last_reported_at: Optional[datetime] = None
    last_confirmed_working_at: Optional[datetime] = None
    is_demo_data: bool = True
    evidence_breakdown: Dict[str, Any] = Field(default_factory=dict)


def compute_freshness_weight(report_time: datetime, current_time: datetime, half_life_hours: float) -> float:
    """
    Computes exponential decay weight:
    weight = 2 ^ (-age_hours / half_life_hours)
    """
    if report_time.tzinfo is None:
        report_time = report_time.replace(tzinfo=timezone.utc)
    if current_time.tzinfo is None:
        current_time = current_time.replace(tzinfo=timezone.utc)

    age_seconds = max(0.0, (current_time - report_time).total_seconds())
    age_hours = age_seconds / 3600.0
    weight = 2.0 ** (-age_hours / half_life_hours)
    return round(weight, 4)


def assess_feature_reliability(
    feature_id: str,
    feature_type: str,
    display_name: str,
    reports: List[Any],
    current_time: Optional[datetime] = None,
    half_life_override: Optional[float] = None,
    evidence_mode: Optional[str] = None
) -> FeatureAssessment:
    """
    Evaluates feature reliability deterministically using decay, evidence aggregation,
    safeguards against single-source overconfidence, and conflict detection.
    """
    now = current_time or datetime.now(timezone.utc)
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)

    half_life = half_life_override or FEATURE_HALF_LIVES.get(feature_type, DEFAULT_HALF_LIFE)

    # Filter only approved reports (moderation)
    active_reports = [r for r in reports if getattr(r, "moderation_status", "APPROVED") == "APPROVED"]

    # Explicit Evidence Selection Policy
    mode = (evidence_mode or getattr(settings, "EVIDENCE_MODE", "demo")).lower()
    if mode == "live":
        # In live deployment mode, mock demo records CANNOT influence real availability
        active_reports = [r for r in active_reports if not getattr(r, "is_demo_data", False)]
    elif mode == "hybrid":
        # In hybrid mode, live student observations take absolute precedence over demo data
        live_reports = [r for r in active_reports if not getattr(r, "is_demo_data", False)]
        if live_reports:
            active_reports = live_reports

    # Check for empty report set
    if not active_reports:
        is_live = (mode == "live")
        return FeatureAssessment(
            feature_id=feature_id,
            feature_type=feature_type,
            display_name=display_name,
            status="UNKNOWN",
            freshness="No Evidence",
            confidence_score=0.0,
            confidence_label="Unknown",
            reason_code="NO_REPORTS",
            explanation="No live student observations recorded yet. Remember: Unknown does not mean unavailable." if is_live else "No reports have been submitted for this feature yet. Remember: Unknown does not mean unavailable.",
            supporting_reports_count=0,
            conflicting_reports_count=0,
            total_reports_count=0,
            last_reported_at=None,
            last_confirmed_working_at=None,
            is_demo_data=not is_live,
            evidence_breakdown={
                "working_weight": 0.0,
                "unavailable_weight": 0.0,
                "uncertain_weight": 0.0,
                "total_effective_weight": 0.0,
                "half_life_hours": half_life
            }
        )

    # Sort reports chronologically descending (newest first)
    sorted_reports = sorted(
        active_reports,
        key=lambda r: r.created_at.replace(tzinfo=timezone.utc) if r.created_at.tzinfo is None else r.created_at,
        reverse=True
    )

    last_reported_at = sorted_reports[0].created_at
    last_confirmed_working = None
    for r in sorted_reports:
        if r.reported_status == "WORKING":
            last_confirmed_working = r.created_at
            break

    is_demo = any(getattr(r, "is_demo_data", True) for r in active_reports)

    # Deduplication and clustering:
    # Rapid successive reports from same IP or within 10 minutes with identical status have damped weight
    w_work = 0.0
    w_unavail = 0.0
    w_uncert = 0.0

    count_work = 0
    count_unavail = 0
    count_uncert = 0

    seen_clusters = []  # tuples of (status, timestamp, ip_hash)

    for r in sorted_reports:
        r_time = r.created_at.replace(tzinfo=timezone.utc) if r.created_at.tzinfo is None else r.created_at
        decay = compute_freshness_weight(r_time, now, half_life)

        # Base source weight: Unauthenticated source is always 1.0 (no artificial boost for selecting "Maintenance Staff")
        base_source_weight = 1.0

        # Cluster / spam check
        ip = getattr(r, "reporter_ip_hash", None)
        is_duplicate = False
        for (c_status, c_time, c_ip) in seen_clusters:
            time_diff = abs((r_time - c_time).total_seconds())
            if c_status == r.reported_status and time_diff < 600:  # within 10 mins
                if ip and c_ip and ip == c_ip:
                    is_duplicate = True
                    break
                elif not ip:
                    # duplicate rapid burst
                    is_duplicate = True
                    break

        if is_duplicate:
            effective_weight = decay * base_source_weight * 0.2  # heavily dampened
        else:
            effective_weight = decay * base_source_weight
            seen_clusters.append((r.reported_status, r_time, ip))

        # Safeguard: Do not silently interpret 'Collected' as proof that a machine is available
        rep_laundry_status = getattr(r, "laundry_status", None)
        if rep_laundry_status == "Collected" and r.reported_status == "WORKING" and not getattr(r, "crowd_level", None):
            w_uncert += effective_weight
            count_uncert += 1
            continue

        if r.reported_status == "WORKING":
            w_work += effective_weight
            count_work += 1
        elif r.reported_status == "UNAVAILABLE":
            w_unavail += effective_weight
            count_unavail += 1
        elif r.reported_status == "UNCERTAIN":
            w_uncert += effective_weight
            count_uncert += 1

    total_weight = w_work + w_unavail + w_uncert
    most_recent_age_hours = max(0.0, (now - (last_reported_at.replace(tzinfo=timezone.utc) if last_reported_at.tzinfo is None else last_reported_at)).total_seconds() / 3600.0)

    # Freshness category of newest report
    if most_recent_age_hours <= half_life:
        freshness_label = "Fresh"
    elif most_recent_age_hours <= half_life * 3.0:
        freshness_label = "Stale"
    else:
        freshness_label = "Expired"

    breakdown = {
        "working_weight": round(w_work, 3),
        "unavailable_weight": round(w_unavail, 3),
        "uncertain_weight": round(w_uncert, 3),
        "total_effective_weight": round(total_weight, 3),
        "half_life_hours": half_life,
        "unique_report_clusters": len(seen_clusters),
        "most_recent_age_hours": round(most_recent_age_hours, 1)
    }

    # SAFEGUARD 1: Stale / decayed evidence threshold
    # If all reports are very old, effective weight drops below threshold
    if total_weight < 0.30:
        return FeatureAssessment(
            feature_id=feature_id,
            feature_type=feature_type,
            display_name=display_name,
            status="UNKNOWN",
            freshness=freshness_label,
            confidence_score=round(min(25.0, total_weight * 50.0), 1),
            confidence_label="Low" if total_weight > 0.1 else "Unknown",
            reason_code="EVIDENCE_STALE_DECAYED",
            explanation=f"Existing evidence is stale ({most_recent_age_hours:.1f} hours old, {freshness_label.lower()}) and has decayed below the active decision threshold. Current usability is unknown.",
            supporting_reports_count=count_work,
            conflicting_reports_count=count_unavail,
            total_reports_count=len(active_reports),
            last_reported_at=last_reported_at,
            last_confirmed_working_at=last_confirmed_working,
            is_demo_data=is_demo,
            evidence_breakdown=breakdown
        )

    # SAFEGUARD 2: Only UNCERTAIN reports
    if w_work < 0.2 and w_unavail < 0.2 and w_uncert >= 0.3:
        return FeatureAssessment(
            feature_id=feature_id,
            feature_type=feature_type,
            display_name=display_name,
            status="UNKNOWN",
            freshness=freshness_label,
            confidence_score=20.0,
            confidence_label="Low",
            reason_code="ONLY_UNCERTAIN_REPORTS",
            explanation="Recent observations reported uncertain condition (e.g. low water pressure, intermittent printer jam, or unconfirmed state). Not definitive.",
            supporting_reports_count=0,
            conflicting_reports_count=0,
            total_reports_count=len(active_reports),
            last_reported_at=last_reported_at,
            last_confirmed_working_at=last_confirmed_working,
            is_demo_data=is_demo,
            evidence_breakdown=breakdown
        )

    # SAFEGUARD 3: Conflicting fresh reports
    # Both working and unavailable have significant active weight
    if w_work >= 0.35 and w_unavail >= 0.35:
        conflict_ratio = min(w_work, w_unavail) / (w_work + w_unavail)
        if conflict_ratio >= 0.25:
            conf_score = max(20.0, min(50.0, round(50.0 - conflict_ratio * 30.0, 1)))
            return FeatureAssessment(
                feature_id=feature_id,
                feature_type=feature_type,
                display_name=display_name,
                status="CONFLICTING",
                freshness=freshness_label,
                confidence_score=conf_score,
                confidence_label="Low",
                reason_code="CONTRADICTORY_EVIDENCE",
                explanation=f"Contradictory fresh reports detected ({count_work} working vs {count_unavail} unavailable). Needs on-site verification before planning around it.",
                supporting_reports_count=count_work,
                conflicting_reports_count=count_unavail,
                total_reports_count=len(active_reports),
                last_reported_at=last_reported_at,
                last_confirmed_working_at=last_confirmed_working,
                is_demo_data=is_demo,
                evidence_breakdown=breakdown
            )

    # WORKING DOMINANT
    if w_work >= 0.50 and w_work > w_unavail * 1.5:
        # Calculate confidence
        # Safeguard: Single report CANNOT exceed 60.0 (Medium)
        independent_clusters = len([c for c in seen_clusters if c[0] == "WORKING"])
        base_score = min(85.0, (w_work / 2.0) * 75.0)
        
        # Corroboration boost for multiple independent clusters
        if independent_clusters >= 2:
            corroboration_bonus = min(20.0, (independent_clusters - 1) * 8.0)
        else:
            corroboration_bonus = 0.0

        # Uncertainty / conflict penalty
        penalty = (w_unavail * 25.0 + w_uncert * 15.0) / max(0.1, total_weight)
        calculated_score = max(15.0, min(98.0, base_score + corroboration_bonus - penalty))

        if independent_clusters <= 1:
            # Ceiling for single unsupported report
            calculated_score = min(60.0, calculated_score)
            conf_label = "Medium" if calculated_score >= 45.0 else "Low"
            reason_code = "SINGLE_FRESH_REPORT_WORKING"
            explanation = f"Single recent report indicates working condition ({most_recent_age_hours:.1f}h ago). Awaiting additional corroboration."
        else:
            conf_label = "High" if calculated_score >= 75.0 else ("Medium" if calculated_score >= 45.0 else "Low")
            reason_code = "MULTIPLE_FRESH_AGREEING_REPORTS"
            explanation = f"Supported by {independent_clusters} independent fresh reports confirming operational status."

        return FeatureAssessment(
            feature_id=feature_id,
            feature_type=feature_type,
            display_name=display_name,
            status="LIKELY_WORKING",
            freshness=freshness_label,
            confidence_score=round(calculated_score, 1),
            confidence_label=conf_label,
            reason_code=reason_code,
            explanation=explanation,
            supporting_reports_count=count_work,
            conflicting_reports_count=count_unavail,
            total_reports_count=len(active_reports),
            last_reported_at=last_reported_at,
            last_confirmed_working_at=last_confirmed_working,
            is_demo_data=is_demo,
            evidence_breakdown=breakdown
        )

    # UNAVAILABLE DOMINANT
    if w_unavail >= 0.50 and w_unavail > w_work * 1.5:
        independent_clusters = len([c for c in seen_clusters if c[0] == "UNAVAILABLE"])
        base_score = min(85.0, (w_unavail / 2.0) * 75.0)

        if independent_clusters >= 2:
            corroboration_bonus = min(20.0, (independent_clusters - 1) * 8.0)
        else:
            corroboration_bonus = 0.0

        penalty = (w_work * 25.0 + w_uncert * 15.0) / max(0.1, total_weight)
        calculated_score = max(15.0, min(98.0, base_score + corroboration_bonus - penalty))

        if independent_clusters <= 1:
            calculated_score = min(65.0, calculated_score)
            conf_label = "Medium" if calculated_score >= 45.0 else "Low"
            reason_code = "FRESH_UNAVAILABLE_REPORT"
            explanation = f"Recent report ({most_recent_age_hours:.1f}h ago) indicated feature is out of order or depleted."
        else:
            conf_label = "High" if calculated_score >= 75.0 else ("Medium" if calculated_score >= 45.0 else "Low")
            reason_code = "MULTIPLE_UNAVAILABLE_REPORTS"
            explanation = f"Confirmed unavailable by {independent_clusters} recent reports."

        return FeatureAssessment(
            feature_id=feature_id,
            feature_type=feature_type,
            display_name=display_name,
            status="LIKELY_UNAVAILABLE",
            freshness=freshness_label,
            confidence_score=round(calculated_score, 1),
            confidence_label=conf_label,
            reason_code=reason_code,
            explanation=explanation,
            supporting_reports_count=count_unavail,
            conflicting_reports_count=count_work,
            total_reports_count=len(active_reports),
            last_reported_at=last_reported_at,
            last_confirmed_working_at=last_confirmed_working,
            is_demo_data=is_demo,
            evidence_breakdown=breakdown
        )

    # Inconclusive / insufficient margin
    return FeatureAssessment(
        feature_id=feature_id,
        feature_type=feature_type,
        display_name=display_name,
        status="UNKNOWN",
        freshness=freshness_label,
        confidence_score=30.0,
        confidence_label="Low",
        reason_code="INSUFFICIENT_EVIDENCE",
        explanation="Evidence margin is too narrow or inconclusive to establish a confirmed working or unavailable state.",
        supporting_reports_count=count_work,
        conflicting_reports_count=count_unavail,
        total_reports_count=len(active_reports),
        last_reported_at=last_reported_at,
        last_confirmed_working_at=last_confirmed_working,
        is_demo_data=is_demo,
        evidence_breakdown=breakdown
    )
