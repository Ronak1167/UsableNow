import math
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from app.core.reliability_engine import FeatureAssessment, assess_feature_reliability


class FacilityRecommendation(BaseModel):
    facility_id: str
    name: str
    facility_type: str
    building_or_area: str
    distance_meters: Optional[float] = None
    target_feature_id: Optional[str] = None
    target_feature_name: Optional[str] = None
    target_feature_status: str  # LIKELY_WORKING, LIKELY_UNAVAILABLE, CONFLICTING, UNKNOWN, NO_MATCH
    target_feature_confidence: float = 0.0
    target_feature_confidence_label: str = "Unknown"
    target_feature_freshness: str = "No Evidence"
    rank_score: float
    recommendation_reason: str
    all_feature_assessments: List[FeatureAssessment] = []
    is_demo_data: bool = True


def calculate_haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Computes genuine distance in meters between two coordinates."""
    R = 6371000  # radius of earth in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (math.sin(delta_phi / 2) ** 2 +
         math.cos(phi1) * math.cos(phi2) * (math.sin(delta_lambda / 2) ** 2))
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return round(R * c, 1)


def rank_facilities_for_need(
    facilities: List[Any],
    target_feature_type: Optional[str] = None,
    user_lat: Optional[float] = None,
    user_lon: Optional[float] = None,
    current_time: Optional[Any] = None
) -> List[FacilityRecommendation]:
    """
    Ranks facilities deterministically according to:
    1. Feature match (must offer target feature if requested)
    2. Usability state (LIKELY_WORKING > UNKNOWN > CONFLICTING > LIKELY_UNAVAILABLE)
    3. Evidence confidence and freshness
    4. Proximity (ONLY if valid coordinates are provided; never fabricated)
    """
    results: List[FacilityRecommendation] = []

    for fac in facilities:
        # Assess all features of this facility
        assessments: List[FeatureAssessment] = []
        matching_assessment: Optional[FeatureAssessment] = None

        for feat in fac.features:
            feat_reports = [r for r in fac.reports if r.feature_id == feat.id and getattr(r, "moderation_status", "APPROVED") == "APPROVED"]
            assessment = assess_feature_reliability(
                feature_id=feat.id,
                feature_type=feat.feature_type,
                display_name=feat.display_name,
                reports=feat_reports,
                current_time=current_time
            )
            assessments.append(assessment)

            if target_feature_type and (
                feat.feature_type.lower() == target_feature_type.lower() or
                target_feature_type.lower() in feat.feature_type.lower()
            ):
                matching_assessment = assessment

        # If user searched for a specific feature and this facility doesn't have it, skip or rank lowest
        if target_feature_type and not matching_assessment:
            continue

        # Target feature details
        if matching_assessment:
            target_feat_id = matching_assessment.feature_id
            target_feat_name = matching_assessment.display_name
            target_status = matching_assessment.status
            target_conf = matching_assessment.confidence_score
            target_conf_lbl = matching_assessment.confidence_label
            target_fresh = matching_assessment.freshness
        else:
            # General facility search without specific target feature
            target_feat_id = None
            target_feat_name = "Overall"
            # Summarize best feature or default
            target_status = "UNKNOWN"
            target_conf = 0.0
            target_conf_lbl = "Unknown"
            target_fresh = "No Evidence"
            if assessments:
                # pick highest confidence or first
                working_feats = [a for a in assessments if a.status == "LIKELY_WORKING"]
                if working_feats:
                    best = max(working_feats, key=lambda a: a.confidence_score)
                    target_status = best.status
                    target_conf = best.confidence_score
                    target_conf_lbl = best.confidence_label
                    target_fresh = best.freshness
                    target_feat_name = best.display_name

        # Distance calculation if both user and facility coordinates exist
        dist_meters = None
        if user_lat is not None and user_lon is not None and fac.latitude is not None and fac.longitude is not None:
            dist_meters = calculate_haversine_distance(user_lat, user_lon, fac.latitude, fac.longitude)

        # Base scoring:
        # LIKELY_WORKING gets 1000 base
        # UNKNOWN gets 300 base (so it is visible and never completely hidden, but LIKELY_WORKING always beats it)
        # CONFLICTING gets 150 base
        # LIKELY_UNAVAILABLE gets 50 base
        if target_status == "LIKELY_WORKING":
            base_score = 1000.0 + (target_conf * 3.0)
        elif target_status == "UNKNOWN":
            base_score = 300.0 + (target_conf * 1.0)
        elif target_status == "CONFLICTING":
            base_score = 150.0 + (target_conf * 0.5)
        elif target_status == "LIKELY_UNAVAILABLE":
            base_score = 50.0 + (target_conf * 0.2)
        else:
            base_score = 100.0

        # Freshness modifier
        if target_fresh == "Fresh":
            base_score += 50.0
        elif target_fresh == "Stale":
            base_score -= 20.0

        # Proximity modifier: ONLY adjust within status tier so closer UNKNOWN does NOT outrank LIKELY_WORKING
        if dist_meters is not None:
            # Small bonus up to 40 points for being very close (e.g. < 500m)
            dist_bonus = max(0.0, 40.0 - (dist_meters / 25.0))
            base_score += dist_bonus

        # Formulate human-readable recommendation reason
        if target_status == "LIKELY_WORKING":
            if target_conf_lbl == "High":
                reason = f"Top match: {target_feat_name} confirmed working with high confidence from multiple independent recent observations."
            elif target_conf_lbl == "Medium":
                reason = f"Recommended: {target_feat_name} recently reported working ({target_fresh.lower()} evidence)."
            else:
                reason = f"{target_feat_name} reported working, though evidence is limited."
        elif target_status == "UNKNOWN":
            reason = f"Facility offers {target_feat_name}, but current status is unconfirmed ({target_fresh.lower()} reports). Unknown does not mean unavailable."
        elif target_status == "CONFLICTING":
            reason = f"Caution: Recent reports for {target_feat_name} are contradictory. Check details or consider an alternative."
        elif target_status == "LIKELY_UNAVAILABLE":
            reason = f"Not currently recommended: {target_feat_name} was recently reported out of service or unavailable."
        else:
            reason = f"Matches campus area: {fac.building_or_area}."

        if dist_meters is not None:
            reason += f" (~{int(dist_meters)}m away)"

        rec = FacilityRecommendation(
            facility_id=fac.id,
            name=fac.name,
            facility_type=fac.facility_type,
            building_or_area=fac.building_or_area,
            distance_meters=dist_meters,
            target_feature_id=target_feat_id,
            target_feature_name=target_feat_name,
            target_feature_status=target_status,
            target_feature_confidence=target_conf,
            target_feature_confidence_label=target_conf_lbl,
            target_feature_freshness=target_fresh,
            rank_score=round(base_score, 2),
            recommendation_reason=reason,
            all_feature_assessments=assessments,
            is_demo_data=fac.is_demo_data
        )
        results.append(rec)

    # Sort descending by rank_score
    results.sort(key=lambda r: r.rank_score, reverse=True)
    return results
