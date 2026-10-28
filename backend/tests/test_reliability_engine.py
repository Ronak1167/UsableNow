import pytest
from datetime import datetime, timezone, timedelta
from app.core.reliability_engine import (
    assess_feature_reliability,
    compute_freshness_weight,
    FeatureAssessment
)


class MockReport:
    def __init__(self, status: str, hours_ago: float, ip_hash: str = "ip_1", moderation_status: str = "APPROVED", is_demo_data: bool = True):
        self.reported_status = status
        now = datetime.now(timezone.utc)
        self.created_at = now - timedelta(hours=hours_ago)
        self.reporter_ip_hash = ip_hash
        self.moderation_status = moderation_status
        self.is_demo_data = is_demo_data


def test_1_fresh_working_report_likely_working():
    now = datetime.now(timezone.utc)
    # 2 fresh agreeing reports from different IPs within 1 hour
    reports = [
        MockReport("WORKING", hours_ago=0.5, ip_hash="user_a"),
        MockReport("WORKING", hours_ago=1.0, ip_hash="user_b")
    ]
    assessment = assess_feature_reliability("feat_1", "drinking_water", "Water Cooler", reports, current_time=now)
    assert assessment.status == "LIKELY_WORKING"
    assert assessment.confidence_label in ["Medium", "High"]
    assert assessment.confidence_score >= 50.0


def test_2_fresh_unavailable_report_handled():
    now = datetime.now(timezone.utc)
    reports = [
        MockReport("UNAVAILABLE", hours_ago=0.5, ip_hash="user_a"),
        MockReport("UNAVAILABLE", hours_ago=0.8, ip_hash="user_b")
    ]
    assessment = assess_feature_reliability("feat_2", "printer", "LRC Printer", reports, current_time=now)
    assert assessment.status == "LIKELY_UNAVAILABLE"
    assert assessment.reason_code in ["FRESH_UNAVAILABLE_REPORT", "MULTIPLE_UNAVAILABLE_REPORTS"]


def test_3_no_reports_produces_unknown():
    now = datetime.now(timezone.utc)
    assessment = assess_feature_reliability("feat_3", "study_space", "Study Pods", [], current_time=now)
    assert assessment.status == "UNKNOWN"
    assert assessment.confidence_label == "Unknown"
    assert assessment.confidence_score == 0.0
    assert assessment.reason_code == "NO_REPORTS"
    assert "Unknown does not mean unavailable" in assessment.explanation


def test_4_only_stale_reports_produce_unknown():
    now = datetime.now(timezone.utc)
    # Half life for drinking water is 6.0 hours. Report 40 hours ago -> heavily decayed
    reports = [MockReport("WORKING", hours_ago=40.0, ip_hash="user_old")]
    assessment = assess_feature_reliability("feat_4", "drinking_water", "Old Fountain", reports, current_time=now)
    assert assessment.status == "UNKNOWN"
    assert assessment.reason_code == "EVIDENCE_STALE_DECAYED"
    assert "decayed below" in assessment.explanation


def test_5_fresh_contradictory_reports_produce_conflicting():
    now = datetime.now(timezone.utc)
    # Contradictory reports submitted within last 1 hour
    reports = [
        MockReport("WORKING", hours_ago=0.6, ip_hash="user_a"),
        MockReport("UNAVAILABLE", hours_ago=0.4, ip_hash="user_b")
    ]
    assessment = assess_feature_reliability("feat_5", "lift", "West Lift", reports, current_time=now)
    assert assessment.status == "CONFLICTING"
    assert assessment.reason_code == "CONTRADICTORY_EVIDENCE"


def test_6_multiple_independent_consistent_reports_increase_confidence():
    now = datetime.now(timezone.utc)
    single_report = [MockReport("WORKING", hours_ago=0.5, ip_hash="user_1")]
    triple_reports = [
        MockReport("WORKING", hours_ago=0.5, ip_hash="user_1"),
        MockReport("WORKING", hours_ago=0.7, ip_hash="user_2"),
        MockReport("WORKING", hours_ago=0.9, ip_hash="user_3")
    ]
    res_single = assess_feature_reliability("feat_6", "printer", "Printer Hub", single_report, current_time=now)
    res_triple = assess_feature_reliability("feat_6", "printer", "Printer Hub", triple_reports, current_time=now)
    
    assert res_triple.confidence_score > res_single.confidence_score
    assert res_triple.confidence_label == "High"


def test_7_duplicate_reports_do_not_create_artificial_corroboration():
    now = datetime.now(timezone.utc)
    # Same IP within 5 minutes submitting repeated reports
    duplicate_burst = [
        MockReport("WORKING", hours_ago=0.1, ip_hash="spammer"),
        MockReport("WORKING", hours_ago=0.12, ip_hash="spammer"),
        MockReport("WORKING", hours_ago=0.14, ip_hash="spammer")
    ]
    assessment = assess_feature_reliability("feat_7", "wifi", "Campus Wi-Fi", duplicate_burst, current_time=now)
    # Should not get High confidence because distinct clusters == 1
    assert assessment.confidence_label != "High"
    assert assessment.confidence_score <= 60.0


def test_8_uncertain_reports_do_not_establish_definitive_status():
    now = datetime.now(timezone.utc)
    reports = [MockReport("UNCERTAIN", hours_ago=1.0, ip_hash="user_a")]
    assessment = assess_feature_reliability("feat_8", "drinking_water", "Tap", reports, current_time=now)
    assert assessment.status == "UNKNOWN"
    assert assessment.reason_code == "ONLY_UNCERTAIN_REPORTS"


def test_9_one_unsupported_report_cannot_produce_high_confidence():
    now = datetime.now(timezone.utc)
    reports = [MockReport("WORKING", hours_ago=0.1, ip_hash="lone_user")]
    assessment = assess_feature_reliability("feat_9", "charging_point", "Socket 4", reports, current_time=now)
    assert assessment.confidence_label in ["Medium", "Low"]
    assert assessment.confidence_score <= 60.0
