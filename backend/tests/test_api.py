import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from datetime import datetime, timezone, timedelta

from app.database import Base, get_db
from app.config import settings
from app.main import app
from app.models.entities import Facility, Feature, Report
from app.services.ai_service import AIService


from sqlalchemy.pool import StaticPool

# In-memory SQLite for isolated test runs with StaticPool
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(autouse=True)
def setup_test_db():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    # Populate a multi-feature test facility
    now = datetime.now(timezone.utc)
    fac = Facility(
        id="fac_test_multi",
        name="Test Multi-Feature Hall",
        description="Testing facility with multiple features",
        facility_type="Campus Building",
        building_or_area="Test Wing",
        is_demo_data=True,
        created_at=now,
        updated_at=now
    )
    db.add(fac)

    feat_water = Feature(
        id="feat_water_1",
        facility_id="fac_test_multi",
        feature_type="drinking_water",
        display_name="RO Tap",
        created_at=now
    )
    feat_printer = Feature(
        id="feat_printer_1",
        facility_id="fac_test_multi",
        feature_type="printer",
        display_name="Heavy Printer",
        created_at=now
    )
    db.add(feat_water)
    db.add(feat_printer)

    # Water has 2 working reports -> LIKELY_WORKING
    rep1 = Report(
        id="rep_1",
        facility_id="fac_test_multi",
        feature_id="feat_water_1",
        reported_status="WORKING",
        source_type="STUDENT_REPORT",
        note="Working great",
        is_demo_data=True,
        created_at=now - timedelta(hours=0.5),
        reporter_ip_hash="ip_1"
    )
    rep2 = Report(
        id="rep_2",
        facility_id="fac_test_multi",
        feature_id="feat_water_1",
        reported_status="WORKING",
        source_type="STUDENT_REPORT",
        note="Fresh chilled water",
        is_demo_data=True,
        created_at=now - timedelta(hours=1.0),
        reporter_ip_hash="ip_2"
    )

    # Printer has 1 unavailable report -> LIKELY_UNAVAILABLE
    rep3 = Report(
        id="rep_3",
        facility_id="fac_test_multi",
        feature_id="feat_printer_1",
        reported_status="UNAVAILABLE",
        source_type="STUDENT_REPORT",
        note="Out of paper and jammed",
        is_demo_data=True,
        created_at=now - timedelta(hours=0.4),
        reporter_ip_hash="ip_3"
    )

    db.add_all([rep1, rep2, rep3])
    db.commit()
    db.close()

    yield

    Base.metadata.drop_all(bind=engine)


client = TestClient(app)


def test_10_working_feature_does_not_make_all_features_working():
    """Verify feature independence: Water is working but Printer is unavailable in the same facility."""
    response = client.get("/api/facilities/fac_test_multi")
    assert response.status_code == 200
    data = response.json()
    assessments = {a["feature_type"]: a["status"] for a in data["feature_assessments"]}
    assert assessments["drinking_water"] == "LIKELY_WORKING"
    assert assessments["printer"] == "LIKELY_UNAVAILABLE"


def test_11_demo_data_remains_visibly_labelled():
    """Verify demo_data flag is preserved in responses."""
    response = client.get("/api/facilities/fac_test_multi")
    assert response.status_code == 200
    data = response.json()
    assert data["is_demo_data"] is True
    for a in data["feature_assessments"]:
        assert a["is_demo_data"] is True


def test_12_valid_report_can_be_submitted_and_retrieved():
    """Verify report submission and immediate persistence."""
    payload = {
        "facility_id": "fac_test_multi",
        "feature_id": "feat_water_1",
        "reported_status": "WORKING",
        "source_type": "ON_SITE_OBSERVATION",
        "note": "Checked in person. Working perfectly.",
        "is_anonymous": False
    }
    response = client.post("/api/reports", json=payload)
    assert response.status_code == 201
    created = response.json()
    assert created["id"] is not None
    assert created["reported_status"] == "WORKING"
    assert created["is_demo_data"] is False  # Live report
    assert created["moderation_status"] == "PENDING"  # Starts in PENDING queue

    # While PENDING, it must NOT appear in public facility reports
    rep_resp = client.get("/api/facilities/fac_test_multi/reports")
    assert rep_resp.status_code == 200
    reports = rep_resp.json()
    assert not any(r["id"] == created["id"] for r in reports)

    # Approve via admin moderation
    test_key = "test-explicit-admin-secret-2026"
    orig_key = settings.ADMIN_SECRET_KEY
    settings.ADMIN_SECRET_KEY = test_key
    try:
        mod_resp = client.post(
            f"/api/admin/reports/{created['id']}/moderate?action=APPROVED",
            headers={"x-admin-key": test_key}
        )
        assert mod_resp.status_code == 200

        # Once APPROVED, report becomes visible in public facility reports
        rep_resp_approved = client.get("/api/facilities/fac_test_multi/reports")
        assert rep_resp_approved.status_code == 200
        approved_reports = rep_resp_approved.json()
        assert any(r["id"] == created["id"] for r in approved_reports)
    finally:
        settings.ADMIN_SECRET_KEY = orig_key


def test_13_invalid_submissions_are_rejected():
    """Verify invalid payloads return HTTP 400 or 422."""
    # Bad status
    bad_payload = {
        "facility_id": "fac_test_multi",
        "feature_id": "feat_water_1",
        "reported_status": "SUPER_WORKING",
        "source_type": "STUDENT_REPORT"
    }
    resp = client.post("/api/reports", json=bad_payload)
    assert resp.status_code in [400, 422]

    # Non-existent facility
    bad_fac = {
        "facility_id": "fac_non_existent",
        "feature_id": "feat_water_1",
        "reported_status": "WORKING",
        "source_type": "STUDENT_REPORT"
    }
    resp2 = client.post("/api/reports", json=bad_fac)
    assert resp2.status_code == 400


def test_14_ai_unavailability_does_not_break_system():
    """Verify deterministic fallback works seamlessly without an API key."""
    service = AIService()
    service.gemini_api_key = ""
    service.openai_api_key = ""

    parsed = service.categorize_text("I need drinking water near ABB-1")
    assert parsed["feature_type"] == "drinking_water"
    assert "deterministic" in parsed["source"].lower()

    # API search endpoint continues to work flawlessly
    resp = client.get("/api/search?q=I+need+drinking+water")
    assert resp.status_code == 200
    data = resp.json()
    assert data["parsed_intent"]["detected_feature_type"] == "drinking_water"


def test_15_empty_database_handled_gracefully():
    """Verify empty database returns clean empty lists without 500 error."""
    # Drop all tables and recreate empty
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    resp = client.get("/api/facilities")
    assert resp.status_code == 200
    assert resp.json() == []

    resp2 = client.get("/api/analytics/overview")
    assert resp2.status_code == 200
    assert resp2.json()["total_facilities"] == 0


def test_16_recommendation_ranking_respects_evidence_and_match():
    """Verify likely working facilities rank above unavailable facilities for the same need."""
    resp = client.get("/api/recommendations?feature_type=drinking_water")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 1
    assert data[0]["target_feature_status"] == "LIKELY_WORKING"
    assert "Top match" in data[0]["recommendation_reason"] or "Recommended" in data[0]["recommendation_reason"]


def test_17_admin_secrets_and_protected_endpoints():
    """Verify admin endpoints reject unauthorized requests without exposing secrets."""
    test_secret = "test-explicit-admin-secret-2026"
    orig_key = settings.ADMIN_SECRET_KEY
    settings.ADMIN_SECRET_KEY = test_secret
    try:
        resp = client.post("/api/admin/reset-demo")
        assert resp.status_code == 401

        resp_auth = client.post("/api/admin/reset-demo", headers={"x-admin-key": test_secret})
        assert resp_auth.status_code == 200
    finally:
        settings.ADMIN_SECRET_KEY = orig_key
