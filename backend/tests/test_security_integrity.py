import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.config import settings
from app.models.entities import Facility, Feature, Report
from app.core.reliability_engine import assess_feature_reliability
from app.services.ai_service import AIService
from app.main import app


class MockReport:
    def __init__(self, status: str, hours_ago: float = 0.5, is_demo_data: bool = True, moderation_status: str = "APPROVED", ip_hash: str = "ip_1", source_type: str = "STUDENT_REPORT"):
        self.reported_status = status
        self.created_at = datetime.now(timezone.utc) - timedelta(hours=hours_ago)
        self.is_demo_data = is_demo_data
        self.moderation_status = moderation_status
        self.reporter_ip_hash = ip_hash
        self.source_type = source_type
        self.crowd_level = None
        self.laundry_status = None
        self.estimated_time = None
        self.note = None


# Isolated in-memory database setup for API tests
@pytest.fixture(scope="module")
def sec_client():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)

    db = TestingSession()
    # Seed one test facility with features and reports of different moderation states
    fac = Facility(
        id="fac_sec_1",
        name="Security Test Hall",
        building_or_area="ABB-1",
        facility_type="Study & Print",
        is_demo_data=True
    )
    feat1 = Feature(
        id="feat_sec_printer",
        facility_id="fac_sec_1",
        feature_type="printer",
        display_name="Secure Printer"
    )
    db.add(fac)
    db.add(feat1)
    db.commit()

    now = datetime.now(timezone.utc)
    # Add approved, rejected, and flagged reports
    rep_approved = Report(
        id="rep_app_1",
        facility_id="fac_sec_1",
        feature_id="feat_sec_printer",
        reported_status="WORKING",
        source_type="STUDENT_REPORT",
        moderation_status="APPROVED",
        is_demo_data=True,
        created_at=now - timedelta(hours=1),
        reporter_ip_hash="hash_1"
    )
    rep_rejected = Report(
        id="rep_rej_1",
        facility_id="fac_sec_1",
        feature_id="feat_sec_printer",
        reported_status="UNAVAILABLE",
        source_type="STUDENT_REPORT",
        moderation_status="REJECTED",
        is_demo_data=True,
        created_at=now - timedelta(minutes=30),
        reporter_ip_hash="hash_2"
    )
    rep_flagged = Report(
        id="rep_flg_1",
        facility_id="fac_sec_1",
        feature_id="feat_sec_printer",
        reported_status="UNAVAILABLE",
        source_type="STUDENT_REPORT",
        moderation_status="FLAGGED",
        is_demo_data=True,
        created_at=now - timedelta(minutes=15),
        reporter_ip_hash="hash_3"
    )
    db.add_all([rep_approved, rep_rejected, rep_flagged])
    db.commit()
    db.close()

    def override_get_db():
        session = TestingSession()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = override_get_db
    test_c = TestClient(app)
    yield test_c
    app.dependency_overrides.clear()


# ==============================================================================
# 1. ADMIN SECURITY TESTS
# ==============================================================================
def test_admin_endpoints_require_valid_secret(sec_client):
    """Admin endpoints reject unauthorized or missing keys with 401."""
    # Reset demo without key -> 401
    resp1 = sec_client.post("/api/admin/reset-demo")
    assert resp1.status_code == 401

    # Protected admin reports without key -> 401
    resp2 = sec_client.get("/api/admin/reports")
    assert resp2.status_code == 401

    # Wrong key -> 401
    resp3 = sec_client.get("/api/admin/reports", headers={"x-admin-key": "invalid-wrong-secret"})
    assert resp3.status_code == 401


def test_admin_fails_closed_in_production():
    """In production environment, admin key fails closed if default demo key or empty."""
    from app.api.routes import verify_admin_key
    from fastapi import HTTPException

    with patch.object(settings, "ENVIRONMENT", "production"):
        with patch.object(settings, "ADMIN_SECRET_KEY", "admin-demo-key-usable2026"):
            with pytest.raises(HTTPException) as exc_info:
                verify_admin_key(x_admin_key="admin-demo-key-usable2026")
            assert exc_info.value.status_code == 500
            assert "Admin functionality is disabled" in exc_info.value.detail


def test_admin_fails_closed_when_key_unconfigured_or_insecure():
    """Protected admin operations fail closed if ADMIN_SECRET_KEY is empty, whitespace, or insecure."""
    from app.api.routes import verify_admin_key
    from fastapi import HTTPException

    for bad_key in ["", "   ", "short", "secret", "admin"]:
        with patch.object(settings, "ADMIN_SECRET_KEY", bad_key):
            with pytest.raises(HTTPException) as exc_info:
                verify_admin_key(x_admin_key="any-user-supplied-key")
            assert exc_info.value.status_code in (401, 500)
            assert "Admin" in exc_info.value.detail


# ==============================================================================
# 2. DEMO VS LIVE EVIDENCE POLICY TESTS
# ==============================================================================
def test_live_evidence_mode_strictly_ignores_demo_data():
    """In live mode, demo records cannot influence real-world availability."""
    demo_reports = [
        MockReport("WORKING", hours_ago=0.2, is_demo_data=True),
        MockReport("WORKING", hours_ago=0.3, is_demo_data=True)
    ]
    # In live mode: zero live reports exist -> must return UNKNOWN with 0.0 confidence
    assessment = assess_feature_reliability(
        feature_id="feat_live_test",
        feature_type="drinking_water",
        display_name="RO Cooler",
        reports=demo_reports,
        evidence_mode="live"
    )
    assert assessment.status == "UNKNOWN"
    assert assessment.confidence_score == 0.0
    assert assessment.confidence_label == "Unknown"
    assert "Unknown does not mean unavailable" in assessment.explanation


def test_hybrid_mode_prioritizes_live_student_observations():
    """In hybrid mode, real live student reports override stale or mock demo evidence."""
    mixed_reports = [
        # Old demo report claiming working
        MockReport("WORKING", hours_ago=10.0, is_demo_data=True),
        # Fresh live report from student indicating unavailable
        MockReport("UNAVAILABLE", hours_ago=0.2, is_demo_data=False, ip_hash="live_student_ip")
    ]
    assessment = assess_feature_reliability(
        feature_id="feat_hybrid_test",
        feature_type="printer",
        display_name="Stationary Printer",
        reports=mixed_reports,
        evidence_mode="hybrid"
    )
    # Live report took precedence; status reflects student observation
    assert assessment.status == "LIKELY_UNAVAILABLE"
    assert assessment.is_demo_data is False


def test_recommendations_and_ranking_respect_evidence_mode():
    """rank_facilities_for_need dynamically adapts ranking and statuses across demo, live, and hybrid modes."""
    from app.core.recommendations import rank_facilities_for_need

    class MockFac:
        def __init__(self):
            self.id = "fac_mode_test"
            self.name = "Evidence Mode Hall"
            self.facility_type = "Study"
            self.building_or_area = "ABB-1"
            self.latitude = 28.6297
            self.longitude = 77.3721
            self.is_demo_data = True
            feat = Feature(id="feat_mode_w", facility_id="fac_mode_test", feature_type="drinking_water", display_name="Water")
            self.features = [feat]
            rep1 = MockReport("WORKING", hours_ago=0.5, is_demo_data=True)
            rep1.feature_id = "feat_mode_w"
            self.reports = [rep1]

    fac_instance = MockFac()

    # 1. Demo mode: uses demo report -> LIKELY_WORKING
    with patch.object(settings, "EVIDENCE_MODE", "demo"):
        res_demo = rank_facilities_for_need([fac_instance], "drinking_water")
        assert res_demo[0].target_feature_status == "LIKELY_WORKING"

    # 2. Live mode: excludes demo report -> UNKNOWN
    with patch.object(settings, "EVIDENCE_MODE", "live"):
        res_live = rank_facilities_for_need([fac_instance], "drinking_water")
        assert res_live[0].target_feature_status == "UNKNOWN"
        assert res_live[0].target_feature_confidence == 0.0

    # 3. Hybrid mode with live observation: live report takes precedence -> LIKELY_UNAVAILABLE
    with patch.object(settings, "EVIDENCE_MODE", "hybrid"):
        live_rep = MockReport("UNAVAILABLE", hours_ago=0.2, is_demo_data=False)
        live_rep.feature_id = "feat_mode_w"
        fac_instance.reports.append(live_rep)
        res_hybrid = rank_facilities_for_need([fac_instance], "drinking_water")
        assert res_hybrid[0].target_feature_status == "LIKELY_UNAVAILABLE"


# ==============================================================================
# 3. REPORT PRIVACY & MODERATION TESTS
# ==============================================================================
def test_public_facility_reports_excludes_rejected_and_flagged(sec_client):
    """Public report history must only show APPROVED reports; non-approved are private."""
    resp = sec_client.get("/api/facilities/fac_sec_1/reports")
    assert resp.status_code == 200
    reports = resp.json()

    # Only 1 report was approved; rejected and flagged must NOT be visible publicly
    assert len(reports) == 1
    assert reports[0]["id"] == "rep_app_1"
    assert reports[0]["moderation_status"] == "APPROVED"


def test_admin_reports_endpoint_allows_inspecting_moderation_queue(sec_client):
    """Admin endpoint can retrieve all reports including flagged and rejected."""
    test_key = "test-sec-admin-key-2026"
    with patch.object(settings, "ADMIN_SECRET_KEY", test_key):
        resp = sec_client.get(
            "/api/admin/reports",
            headers={"x-admin-key": test_key}
        )
        assert resp.status_code == 200
        reports = resp.json()
        assert len(reports) >= 3
        statuses = {r["moderation_status"] for r in reports}
        assert "APPROVED" in statuses
        assert "REJECTED" in statuses
        assert "FLAGGED" in statuses


def test_public_analytics_overview_moderation_privacy(sec_client):
    """Public analytics endpoint strictly excludes rejected, flagged, and pending reports."""
    resp = sec_client.get("/api/analytics/overview")
    assert resp.status_code == 200
    data = resp.json()

    # Verify only APPROVED reports appear in recent_reports
    recent_reports = data["recent_reports"]
    assert len(recent_reports) >= 1
    for r in recent_reports:
        assert r["moderation_status"] == "APPROVED"
        assert r["id"] != "rep_rej_1"
        assert r["id"] != "rep_flg_1"

    # Total reports counted in public analytics must only count APPROVED reports
    assert data["total_reports"] == 1


def test_live_evidence_mode_filters_public_api_endpoints(sec_client):
    """In live evidence mode, demo reports are excluded across public facility and analytics endpoints."""
    # Under live mode
    with patch.object(settings, "EVIDENCE_MODE", "live"):
        # Facility reports
        resp_reports = sec_client.get("/api/facilities/fac_sec_1/reports")
        assert resp_reports.status_code == 200
        assert resp_reports.json() == []  # All seeded reports in sec_client are demo data

        # Analytics overview
        resp_analytics = sec_client.get("/api/analytics/overview")
        assert resp_analytics.status_code == 200
        analytics_data = resp_analytics.json()
        assert analytics_data["total_reports"] == 0
        assert analytics_data["recent_reports"] == []

        # Facility detail
        resp_detail = sec_client.get("/api/facilities/fac_sec_1")
        assert resp_detail.status_code == 200
        detail_data = resp_detail.json()
        assert detail_data["recent_reports"] == []
        # Feature reliability under live mode must be UNKNOWN with 0.0 confidence
        assert detail_data["feature_assessments"][0]["status"] == "UNKNOWN"
        assert detail_data["feature_assessments"][0]["confidence_score"] == 0.0


def test_static_map_preview_geofence_and_caching(sec_client):
    """Static map proxy rejects out-of-bounds coordinates and caches valid preview tiles."""
    from app.services.maps_service import maps_service

    # 1. Reject coordinates outside JIIT Sector 62 campus boundary
    resp_oob = sec_client.get("/api/maps/static-preview?lat=40.7128&lon=-74.0060")
    assert resp_oob.status_code == 400
    assert "outside supported campus coverage area" in resp_oob.json()["detail"]

    # 2. Within campus bounds but no API key configured -> returns 404 preview unavailable
    with patch.object(maps_service, "api_key", ""):
        resp_nokey = sec_client.get("/api/maps/static-preview?lat=28.6297&lon=77.3721")
        assert resp_nokey.status_code == 404

    # 3. With API key and simulated fetch -> verifies LRU caching prevents upstream calls
    mock_png = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDRtestpngbytes"
    maps_service.clear_cache()
    with patch.object(maps_service, "api_key", "test-fake-key"):
        with patch("urllib.request.urlopen") as mock_url:
            mock_resp = MagicMock()
            mock_resp.status = 200
            mock_resp.read.return_value = mock_png
            mock_url.return_value.__enter__.return_value = mock_resp

            # First request: fetches and populates cache
            resp1 = sec_client.get("/api/maps/static-preview?lat=28.62970&lon=77.37210&zoom=17")
            assert resp1.status_code == 200
            assert resp1.content == mock_png
            assert mock_url.call_count == 1
            assert maps_service.get_cache_size() == 1

            # Second request with slightly normalized coords: hits in-memory cache directly!
            resp2 = sec_client.get("/api/maps/static-preview?lat=28.62970001&lon=77.37210002&zoom=17")
            assert resp2.status_code == 200
            assert resp2.content == mock_png
            # Call count MUST remain 1 because it hit the cache!
            assert mock_url.call_count == 1
    maps_service.clear_cache()


def test_public_report_submission_sanitizes_unverified_staff_claim(sec_client):
    """Public users cannot assert verified MAINTENANCE_STAFF identity without admin key."""
    payload = {
        "facility_id": "fac_sec_1",
        "feature_id": "feat_sec_printer",
        "reported_status": "WORKING",
        "source_type": "MAINTENANCE_STAFF",  # Unverified public user claiming maintenance staff
        "note": "Claiming maintenance staff access without credentials"
    }
    resp = sec_client.post("/api/reports", json=payload)
    assert resp.status_code == 201
    data = resp.json()
    # Server reclassifies to STUDENT_REPORT to prevent privilege impersonation
    assert data["source_type"] == "STUDENT_REPORT"


# ==============================================================================
# 4. NATURAL LANGUAGE NEGATIVE INTENT TESTS
# ==============================================================================
def test_natural_language_negative_phrase_not_interpreted_as_working():
    """Negative phrases like 'printer not working' must not be interpreted as positive WORKING."""
    svc = AIService()
    res1 = svc.categorize_text("printer not working")
    assert res1["feature_type"] == "printer"
    assert res1["suggested_status"] == "UNAVAILABLE"

    res2 = svc.categorize_text("water cooler is broken and down")
    assert res2["feature_type"] == "drinking_water"
    assert res2["suggested_status"] == "UNAVAILABLE"

    res3 = svc.categorize_text("lift out of order near ABB 1")
    assert res3["feature_type"] == "lift"
    assert res3["suggested_status"] == "UNAVAILABLE"
    assert res3["detected_area"] == "ABB 1"


def test_ai_validation_rejects_hallucinated_feature_types():
    """External model outputs with hallucinated feature types are validated safely."""
    svc = AIService()
    hallucinated = {
        "feature_type": "swimming_pool",  # Not in supported list
        "suggested_status": "SUPER_WORKING",  # Invalid status
        "detected_area": "MAIN_GATE"
    }
    validated = svc._validate_model_output(hallucinated, "test-ai")
    # Invalid feature and status filtered to None
    assert validated["feature_type"] is None
    assert validated["suggested_status"] is None
    assert validated["detected_area"] == "MAIN_GATE"


def test_hybrid_mode_public_endpoints_evidence_consistency():
    """
    In hybrid mode:
    - Features with live reports supersede demo data; demo reports for that feature are omitted.
    - Features without live reports retain demo baseline data.
    - Public report feeds, facility detail, feature assessments, and analytics tell a 100% consistent story.
    """
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)

    db = TestingSession()
    fac = Facility(
        id="fac_hyb_1",
        name="Hybrid Test Hall",
        building_or_area="ABB-1",
        facility_type="Study & Print",
        is_demo_data=True
    )
    feat_print = Feature(
        id="feat_hyb_print",
        facility_id="fac_hyb_1",
        feature_type="printer",
        display_name="Printer"
    )
    feat_water = Feature(
        id="feat_hyb_water",
        facility_id="fac_hyb_1",
        feature_type="drinking_water",
        display_name="Water Dispenser"
    )
    db.add_all([fac, feat_print, feat_water])
    db.commit()

    now = datetime.now(timezone.utc)
    # Printer: Old demo report claiming WORKING, but fresh LIVE report claiming UNAVAILABLE
    rep_demo_print = Report(
        id="rep_demo_print",
        facility_id="fac_hyb_1",
        feature_id="feat_hyb_print",
        reported_status="WORKING",
        source_type="STUDENT_REPORT",
        moderation_status="APPROVED",
        is_demo_data=True,
        created_at=now - timedelta(hours=5),
        reporter_ip_hash="h1"
    )
    rep_live_print = Report(
        id="rep_live_print",
        facility_id="fac_hyb_1",
        feature_id="feat_hyb_print",
        reported_status="UNAVAILABLE",
        source_type="STUDENT_REPORT",
        moderation_status="APPROVED",
        is_demo_data=False,
        created_at=now - timedelta(minutes=10),
        reporter_ip_hash="h2"
    )
    # Water: ONLY demo report claiming WORKING (no live reports exist)
    rep_demo_water = Report(
        id="rep_demo_water",
        facility_id="fac_hyb_1",
        feature_id="feat_hyb_water",
        reported_status="WORKING",
        source_type="STUDENT_REPORT",
        moderation_status="APPROVED",
        is_demo_data=True,
        created_at=now - timedelta(hours=2),
        reporter_ip_hash="h3"
    )
    # Flagged report that must NEVER appear in public responses
    rep_flagged = Report(
        id="rep_flg_leak",
        facility_id="fac_hyb_1",
        feature_id="feat_hyb_print",
        reported_status="WORKING",
        source_type="STUDENT_REPORT",
        moderation_status="FLAGGED",
        is_demo_data=False,
        created_at=now,
        reporter_ip_hash="h4"
    )
    db.add_all([rep_demo_print, rep_live_print, rep_demo_water, rep_flagged])
    db.commit()
    db.close()

    def override_db():
        session = TestingSession()
        try:
            yield session
        finally:
            session.close()

    orig_override = app.dependency_overrides.get(get_db)
    app.dependency_overrides[get_db] = override_db
    client = TestClient(app)

    try:
        with patch.object(settings, "EVIDENCE_MODE", "hybrid"):
            # 1. /api/facilities/{id}/reports
            resp_reports = client.get("/api/facilities/fac_hyb_1/reports")
            assert resp_reports.status_code == 200
            reports = resp_reports.json()
            report_ids = [r["id"] for r in reports]
            # Must include live printer report and demo water report
            assert "rep_live_print" in report_ids
            assert "rep_demo_water" in report_ids
            # Must EXCLUDE superseded demo printer report (preventing false corroboration)
            assert "rep_demo_print" not in report_ids
            # Must strictly EXCLUDE non-approved flagged report
            assert "rep_flg_leak" not in report_ids

            # 2. /api/facilities/{id}
            resp_detail = client.get("/api/facilities/fac_hyb_1")
            assert resp_detail.status_code == 200
            detail = resp_detail.json()
            detail_report_ids = [r["id"] for r in detail["recent_reports"]]
            assert "rep_live_print" in detail_report_ids
            assert "rep_demo_water" in detail_report_ids
            assert "rep_demo_print" not in detail_report_ids
            assert "rep_flg_leak" not in detail_report_ids

            # Check feature assessments in detail
            assessments = {a["feature_id"]: a for a in detail["feature_assessments"]}
            # Printer has live observation -> status is LIKELY_UNAVAILABLE, is_demo_data is False
            assert assessments["feat_hyb_print"]["status"] == "LIKELY_UNAVAILABLE"
            assert assessments["feat_hyb_print"]["is_demo_data"] is False
            # Water has no live observation -> retains baseline demo data
            assert assessments["feat_hyb_water"]["status"] == "LIKELY_WORKING"
            assert assessments["feat_hyb_water"]["is_demo_data"] is True

            # 3. /api/facilities/{id}/features
            resp_feats = client.get("/api/facilities/fac_hyb_1/features")
            assert resp_feats.status_code == 200
            feats = {f["feature_id"]: f for f in resp_feats.json()}
            assert feats["feat_hyb_print"]["status"] == "LIKELY_UNAVAILABLE"
            assert feats["feat_hyb_print"]["is_demo_data"] is False
            assert feats["feat_hyb_water"]["status"] == "LIKELY_WORKING"
            assert feats["feat_hyb_water"]["is_demo_data"] is True

            # 4. /api/analytics/overview
            resp_analytics = client.get("/api/analytics/overview")
            assert resp_analytics.status_code == 200
            analytics = resp_analytics.json()
            # 2 active reports under hybrid policy (rep_live_print + rep_demo_water)
            assert analytics["total_reports"] == 2
            analytics_report_ids = [r["id"] for r in analytics["recent_reports"]]
            assert "rep_live_print" in analytics_report_ids
            assert "rep_demo_water" in analytics_report_ids
            assert "rep_demo_print" not in analytics_report_ids
            assert "rep_flg_leak" not in analytics_report_ids
            assert analytics["likely_unavailable_features"] == 1  # Printer
            assert analytics["likely_working_features"] == 1      # Water
    finally:
        if orig_override:
            app.dependency_overrides[get_db] = orig_override
        else:
            app.dependency_overrides.pop(get_db, None)


# ==============================================================================
# 5. DEFENSIVE API & HEALTH PROBE PRIVACY TESTS
# ==============================================================================
def test_health_check_does_not_leak_internal_exception(sec_client):
    """When DB query raises an internal error, /health returns generic message without raw traceback."""
    with patch("app.api.routes.Facility") as mock_fac:
        # Simulate an internal DB engine crash
        mock_fac.query.side_effect = Exception("sqlite3.OperationalError: disk I/O error at /var/lib/secret_db_path")
        resp = sec_client.get("/api/health")
        assert resp.status_code in (200, 503)
        if resp.status_code == 503:
            detail = resp.json().get("detail", "")
            # Must NOT leak secret paths or raw exception internals
            assert "secret_db_path" not in detail
            assert "OperationalError" not in detail
            assert "failed or service unavailable" in detail


# ==============================================================================
# 6. WALKING ROUTE GEOFENCE & SUBMISSION RATE LIMIT TESTS
# ==============================================================================
def test_walking_route_rejects_out_of_bounds_and_protects_google_routes(sec_client):
    """Out-of-bounds coordinates return 400 Bad Request and never hit Google Routes API."""
    with patch("urllib.request.urlopen") as mock_url:
        # 1. Out-of-bounds origin
        resp1 = sec_client.get(
            "/api/maps/walking-route?origin_lat=40.7128&origin_lon=-74.0060&destination_lat=28.6297&destination_lon=77.3721"
        )
        assert resp1.status_code == 400
        assert "Origin coordinates outside supported campus coverage area" in resp1.json()["detail"]
        assert mock_url.call_count == 0

        # 2. Out-of-bounds destination
        resp2 = sec_client.get(
            "/api/maps/walking-route?origin_lat=28.6297&origin_lon=77.3721&destination_lat=40.7128&destination_lon=-74.0060"
        )
        assert resp2.status_code == 400
        assert "Destination coordinates outside supported campus coverage area" in resp2.json()["detail"]
        assert mock_url.call_count == 0

        # 3. Valid campus coordinates succeed (Haversine fallback without Google API)
        resp3 = sec_client.get(
            "/api/maps/walking-route?origin_lat=28.6297&origin_lon=77.3721&destination_lat=28.6304&destination_lon=77.3718"
        )
        assert resp3.status_code == 200
        data = resp3.json()
        assert data["status"] == "success"
        assert data["distance_meters"] > 0
        assert data["source"] in ("haversine_estimate", "google_routes_api")


def test_pending_report_does_not_affect_public_status_until_approved(sec_client):
    """New public report starts as PENDING, does not affect public status/feed, and activates on approval."""
    test_key = "test-sec-admin-key-2026"
    with patch.object(settings, "ADMIN_SECRET_KEY", test_key):
        # 1. Submit public report
        payload = {
            "facility_id": "fac_sec_1",
            "feature_id": "feat_sec_printer",
            "reported_status": "UNAVAILABLE",
            "source_type": "STUDENT_REPORT",
            "note": "Printer paper jammed and showing error 42"
        }
        post_resp = sec_client.post("/api/reports", json=payload)
        assert post_resp.status_code == 201
        created = post_resp.json()
        assert created["moderation_status"] == "PENDING"
        report_id = created["id"]

        # 2. Public reports feed must NOT include the pending report
        feed_resp = sec_client.get("/api/facilities/fac_sec_1/reports")
        assert feed_resp.status_code == 200
        feed_ids = [r["id"] for r in feed_resp.json()]
        assert report_id not in feed_ids

        # 3. Admin approves report
        mod_resp = sec_client.post(
            f"/api/admin/reports/{report_id}/moderate?action=APPROVED",
            headers={"x-admin-key": test_key}
        )
        assert mod_resp.status_code == 200

        # 4. Now that it is approved, it appears in public reports feed
        feed_resp2 = sec_client.get("/api/facilities/fac_sec_1/reports")
        assert feed_resp2.status_code == 200
        feed_ids2 = [r["id"] for r in feed_resp2.json()]
        assert report_id in feed_ids2


def test_submission_rate_limiting_and_duplicate_protection(sec_client):
    """Submissions exceeding rate limits or identical duplicates return 429 Too Many Requests."""
    payload = {
        "facility_id": "fac_sec_1",
        "feature_id": "feat_sec_printer",
        "reported_status": "WORKING",
        "source_type": "STUDENT_REPORT",
        "note": "Testing rate limit"
    }
    # First submit succeeds
    r1 = sec_client.post("/api/reports", json=payload)
    assert r1.status_code in (201, 429)

    # Immediate identical duplicate -> 429 Too Many Requests
    r2 = sec_client.post("/api/reports", json=payload)
    assert r2.status_code == 429
    assert "Please wait" in r2.json()["detail"]


def test_is_valid_admin_secret_helper_and_case_insensitivity():
    """Validates that is_valid_admin_secret rejects empty, short, and case-variant placeholder secrets."""
    from app.api.routes import is_valid_admin_secret

    # Must reject None, empty, whitespace, and < 8 chars
    assert is_valid_admin_secret(None) is False
    assert is_valid_admin_secret("") is False
    assert is_valid_admin_secret("   ") is False
    assert is_valid_admin_secret("short") is False
    assert is_valid_admin_secret("1234567") is False

    # Must reject placeholders case-insensitively
    insecure_placeholders = [
        "admin", "ADMIN", "Admin", "aDmIn",
        "password", "PASSWORD", "Password", "PaSsWoRd",
        "secret", "SECRET", "Secret",
        "admin-demo-key-usable2026", "ADMIN-DEMO-KEY-USABLE2026"
    ]
    for placeholder in insecure_placeholders:
        assert is_valid_admin_secret(placeholder) is False

    # Must accept valid secure secrets (>= 8 chars, not placeholder)
    assert is_valid_admin_secret("secure-admin-pass-2026") is True
    assert is_valid_admin_secret("production-key-xyz-77") is True


def test_weak_admin_secret_cannot_auto_approve_reports():
    """
    Submissions presenting a matching admin key when ADMIN_SECRET_KEY is weak or insecure
    cannot bypass moderation and MUST remain PENDING. Only a valid strong secret enables auto-approval.
    Uses an isolated in-memory engine and client to ensure rate limits do not interfere.
    """
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)

    db = TestingSession()
    fac = Facility(id="fac_iso_1", name="Isolated Hall", building_or_area="ABB-1", facility_type="Study", is_demo_data=True)
    db.add(fac)
    weak_keys = ["short", "secret", "SECRET", "admin", "ADMIN", "password", "PASSWORD", "admin-demo-key-usable2026", "ADMIN-DEMO-KEY-USABLE2026"]
    for i in range(len(weak_keys) + 2):
        feat = Feature(id=f"feat_iso_{i}", facility_id="fac_iso_1", feature_type="printer", display_name=f"Printer {i}")
        db.add(feat)
    db.commit()
    db.close()

    def override_db():
        s = TestingSession()
        try:
            yield s
        finally:
            s.close()

    orig_override = app.dependency_overrides.get(get_db)
    app.dependency_overrides[get_db] = override_db
    iso_client = TestClient(app)

    try:
        # 1. Weak/insecure secrets (including uppercase variants) must never enable auto-approval
        for i, weak_key in enumerate(weak_keys):
            with patch.object(settings, "ADMIN_SECRET_KEY", weak_key):
                payload = {
                    "facility_id": "fac_iso_1",
                    "feature_id": f"feat_iso_{i}",
                    "reported_status": "WORKING",
                    "source_type": "MAINTENANCE_STAFF",
                    "note": f"Weak key test run {i}"
                }
                # Patch IP hash so rate limiting / deduplication is isolated per test case
                with patch("hashlib.sha256") as mock_sha:
                    mock_hash = MagicMock()
                    mock_hash.hexdigest.return_value = f"hash_{i:04d}abcdef1234"
                    mock_sha.return_value = mock_hash

                    resp = iso_client.post(
                        "/api/reports",
                        json=payload,
                        headers={"x-admin-key": weak_key}
                    )
                    assert resp.status_code == 201, f"Expected 201 for weak key '{weak_key}', got {resp.status_code}: {resp.text}"
                    data = resp.json()
                    assert data["moderation_status"] == "PENDING"
                    assert data["source_type"] == "STUDENT_REPORT"

        # 2. Strong valid secret enables auto-approval and verified source type
        strong_key = "strong-admin-production-key-9988"
        with patch.object(settings, "ADMIN_SECRET_KEY", strong_key):
            payload_admin = {
                "facility_id": "fac_iso_1",
                "feature_id": f"feat_iso_{len(weak_keys)}",
                "reported_status": "WORKING",
                "source_type": "MAINTENANCE_STAFF",
                "note": "Verified maintenance staff report with secure secret"
            }
            with patch("hashlib.sha256") as mock_sha:
                mock_hash = MagicMock()
                mock_hash.hexdigest.return_value = "hash_strong9999abcdef"
                mock_sha.return_value = mock_hash

                resp_admin = iso_client.post(
                    "/api/reports",
                    json=payload_admin,
                    headers={"x-admin-key": strong_key}
                )
                assert resp_admin.status_code == 201
                data = resp_admin.json()
                assert data["moderation_status"] == "APPROVED"
                assert data["source_type"] == "MAINTENANCE_STAFF"
    finally:
        if orig_override:
            app.dependency_overrides[get_db] = orig_override
        else:
            app.dependency_overrides.pop(get_db, None)
