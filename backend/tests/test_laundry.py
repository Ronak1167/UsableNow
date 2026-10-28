"""
Tests for laundry facility feature category (standalone module).
Verifies that laundry_machines and laundry_crowd feature types
integrate correctly with the existing reliability engine, API, and report submission.

NOTE: This module uses its OWN in-memory engine and app override so it can run
cleanly either alone or alongside the other test modules.
"""
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from datetime import datetime, timezone, timedelta

from app.database import Base, get_db
from app.config import settings
from app.models.entities import Facility, Feature, Report
from app.api.routes import router as api_router


# Build a minimal isolated FastAPI app for this test module
def make_isolated_app(db_override):
    test_app = FastAPI()
    test_app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
    test_app.include_router(api_router, prefix="/api")
    test_app.dependency_overrides[get_db] = db_override
    return test_app


# Isolated in-memory SQLite engine for laundry tests
LAUNDRY_TEST_DB_URL = "sqlite:///:memory:"
laundry_engine = create_engine(
    LAUNDRY_TEST_DB_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
LaundrySession = sessionmaker(autocommit=False, autoflush=False, bind=laundry_engine)


def laundry_get_db():
    db = LaundrySession()
    try:
        yield db
    finally:
        db.close()


laundry_app = make_isolated_app(laundry_get_db)
client = TestClient(laundry_app)


@pytest.fixture(autouse=True)
def setup_laundry_db():
    """Create fresh schema and seed test data before each test, teardown after."""
    Base.metadata.create_all(bind=laundry_engine)
    db = LaundrySession()
    now = datetime.now(timezone.utc)

    fac = Facility(
        id="fac_laundry_test",
        name="Test Hostel Laundry Room",
        description="Laundry test facility with washers and dryers",
        facility_type="Campus Laundry",
        building_or_area="Test Hostel",
        opening_hours="6:00 AM - 11:00 PM",
        is_demo_data=True,
        created_at=now,
        updated_at=now
    )
    db.add(fac)

    feat_machines = Feature(
        id="feat_laundry_machines",
        facility_id="fac_laundry_test",
        feature_type="laundry_machines",
        display_name="Front-Load Washers & Dryers",
        description="6 washers + 4 dryers",
        created_at=now
    )
    feat_crowd = Feature(
        id="feat_laundry_crowd",
        facility_id="fac_laundry_test",
        feature_type="laundry_crowd",
        display_name="Crowd Level",
        description="Current busyness level",
        created_at=now
    )
    db.add(feat_machines)
    db.add(feat_crowd)

    # Two fresh independent working reports for machines → LIKELY_WORKING
    rep1 = Report(
        id="rep_laundry_1",
        facility_id="fac_laundry_test",
        feature_id="feat_laundry_machines",
        reported_status="WORKING",
        source_type="STUDENT_REPORT",
        note="3 washers free, all dryers working",
        is_demo_data=True,
        moderation_status="APPROVED",
        created_at=now - timedelta(hours=0.5),
        reporter_ip_hash="ip_laundry_1"
    )
    rep2 = Report(
        id="rep_laundry_2",
        facility_id="fac_laundry_test",
        feature_id="feat_laundry_machines",
        reported_status="WORKING",
        source_type="ON_SITE_OBSERVATION",
        note="Machines all functional",
        is_demo_data=True,
        moderation_status="APPROVED",
        created_at=now - timedelta(hours=1.0),
        reporter_ip_hash="ip_laundry_2"
    )
    # Single UNCERTAIN report for crowd (medium crowd)
    rep3 = Report(
        id="rep_laundry_3",
        facility_id="fac_laundry_test",
        feature_id="feat_laundry_crowd",
        reported_status="UNCERTAIN",
        source_type="STUDENT_REPORT",
        note="Medium crowd, about 4 people waiting",
        is_demo_data=True,
        moderation_status="APPROVED",
        created_at=now - timedelta(hours=0.3),
        reporter_ip_hash="ip_laundry_3"
    )
    db.add_all([rep1, rep2, rep3])
    db.commit()
    db.close()

    yield

    Base.metadata.drop_all(bind=laundry_engine)


# ── LAUNDRY TESTS ────────────────────────────────────────────────────────────

def test_L1_laundry_facility_retrievable():
    """Laundry facility must be retrievable with correct facility_type."""
    resp = client.get("/api/facilities/fac_laundry_test")
    assert resp.status_code == 200
    data = resp.json()
    assert data["facility_type"] == "Campus Laundry"
    assert data["opening_hours"] == "6:00 AM - 11:00 PM"
    assert len(data["features"]) == 2


def test_L2_laundry_machines_assessed_as_likely_working():
    """With 2 fresh independent working reports, machines should be LIKELY_WORKING."""
    resp = client.get("/api/facilities/fac_laundry_test")
    assert resp.status_code == 200
    data = resp.json()
    assessments = {a["feature_type"]: a for a in data["feature_assessments"]}
    assert "laundry_machines" in assessments
    assert assessments["laundry_machines"]["status"] == "LIKELY_WORKING"
    assert assessments["laundry_machines"]["confidence_label"] in ["Medium", "High"]
    assert assessments["laundry_machines"]["total_reports_count"] == 2


def test_L3_laundry_crowd_returns_unknown_for_uncertain_reports():
    """Crowd with only an UNCERTAIN report → UNKNOWN (not unavailable)."""
    resp = client.get("/api/facilities/fac_laundry_test")
    assert resp.status_code == 200
    data = resp.json()
    assessments = {a["feature_type"]: a for a in data["feature_assessments"]}
    assert "laundry_crowd" in assessments
    # CRITICAL: single UNCERTAIN report → UNKNOWN, not UNAVAILABLE
    assert assessments["laundry_crowd"]["status"] == "UNKNOWN"
    assert assessments["laundry_crowd"]["total_reports_count"] >= 1


def test_L4_laundry_machine_report_submission():
    """Valid laundry machine report must be accepted and persisted."""
    payload = {
        "facility_id": "fac_laundry_test",
        "feature_id": "feat_laundry_machines",
        "reported_status": "WORKING",
        "source_type": "STUDENT_REPORT",
        "note": "2 washers free, dryers working fine",
        "is_anonymous": False
    }
    resp = client.post("/api/reports", json=payload)
    assert resp.status_code == 201
    created = resp.json()
    assert created["reported_status"] == "WORKING"
    assert created["is_demo_data"] is False  # Live report, not demo
    assert created["feature_id"] == "feat_laundry_machines"


def test_L5_laundry_crowd_report_submission_high_crowd():
    """Crowd 'UNAVAILABLE' (= high crowd) report must be accepted."""
    payload = {
        "facility_id": "fac_laundry_test",
        "feature_id": "feat_laundry_crowd",
        "reported_status": "UNAVAILABLE",
        "source_type": "STUDENT_REPORT",
        "note": "High crowd — 8+ people waiting, all machines occupied",
        "is_anonymous": False
    }
    resp = client.post("/api/reports", json=payload)
    assert resp.status_code == 201
    created = resp.json()
    assert created["feature_id"] == "feat_laundry_crowd"
    assert created["reported_status"] == "UNAVAILABLE"


def test_L6_laundry_machines_recommendations_returned():
    """Recommendations endpoint must work for laundry_machines feature type."""
    resp = client.get("/api/recommendations?feature_type=laundry_machines")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) >= 1


def test_L7_laundry_search_query_detects_laundry():
    """Natural language search 'laundry room' should detect laundry_machines feature type."""
    resp = client.get("/api/search?q=where+is+the+laundry+room")
    assert resp.status_code == 200
    data = resp.json()
    assert data["parsed_intent"]["detected_feature_type"] in ["laundry_machines", "laundry_crowd"]


def test_L8_laundry_facility_type_filter():
    """Filtering /api/facilities by facility_type=Campus Laundry should include laundry facility."""
    resp = client.get("/api/facilities?facility_type=Campus+Laundry")
    assert resp.status_code == 200
    data = resp.json()
    ids = [f["id"] for f in data]
    assert "fac_laundry_test" in ids


def test_L9_no_crowd_reports_shows_unknown_not_unavailable():
    """With absolutely no crowd reports, crowd status must be UNKNOWN, never UNAVAILABLE."""
    db = LaundrySession()
    now = datetime.now(timezone.utc)
    fac2 = Facility(
        id="fac_laundry_noevidence",
        name="Test No-Evidence Laundry",
        description="Laundry with zero reports",
        facility_type="Campus Laundry",
        building_or_area="Ghost Hostel",
        is_demo_data=True,
        created_at=now,
        updated_at=now
    )
    db.add(fac2)
    feat2 = Feature(
        id="feat_laundry_crowd_empty",
        facility_id="fac_laundry_noevidence",
        feature_type="laundry_crowd",
        display_name="Crowd Level",
        created_at=now
    )
    db.add(feat2)
    db.commit()
    db.close()

    resp = client.get("/api/facilities/fac_laundry_noevidence")
    assert resp.status_code == 200
    data = resp.json()
    assessments = {a["feature_type"]: a for a in data["feature_assessments"]}
    # THE CORE PRINCIPLE: Unknown does not mean unavailable
    assert assessments["laundry_crowd"]["status"] == "UNKNOWN"
    assert assessments["laundry_crowd"]["confidence_label"] == "Unknown"
    assert assessments["laundry_crowd"]["total_reports_count"] == 0


def test_L10_laundry_structured_fields_validated_and_persisted():
    """Verify crowd_level, laundry_status, and estimated_time are validated and persisted."""
    payload = {
        "facility_id": "fac_laundry_test",
        "feature_id": "feat_laundry_machines",
        "reported_status": "WORKING",
        "source_type": "STUDENT_REPORT",
        "note": "Washers are free and running smoothly",
        "crowd_level": "Low",
        "laundry_status": "Ready",
        "estimated_time": "Ready now (pickup ~35 min)",
        "is_anonymous": False
    }
    orig_key = settings.ADMIN_SECRET_KEY
    settings.ADMIN_SECRET_KEY = "test-sec-key-laundry"
    try:
        resp = client.post("/api/reports", json=payload, headers={"x-admin-key": "test-sec-key-laundry"})
        assert resp.status_code == 201
        created = resp.json()
        assert created["crowd_level"] == "Low"
        assert created["laundry_status"] == "Ready"
        assert created["estimated_time"] == "Ready now (pickup ~35 min)"

        # Verify retrieval
        rep_resp = client.get("/api/facilities/fac_laundry_test/reports")
        assert rep_resp.status_code == 200
        reports = rep_resp.json()
        saved = next((r for r in reports if r["id"] == created["id"]), None)
        assert saved is not None
        assert saved["crowd_level"] == "Low"
        assert saved["laundry_status"] == "Ready"
        assert saved["estimated_time"] == "Ready now (pickup ~35 min)"
    finally:
        settings.ADMIN_SECRET_KEY = orig_key


def test_L11_invalid_laundry_fields_rejected():
    """Verify invalid crowd_level and laundry_status values fail validation."""
    # Invalid crowd_level
    bad_crowd = {
        "facility_id": "fac_laundry_test",
        "feature_id": "feat_laundry_machines",
        "reported_status": "WORKING",
        "source_type": "STUDENT_REPORT",
        "crowd_level": "MASSIVE_OVERFLOW"
    }
    resp1 = client.post("/api/reports", json=bad_crowd)
    assert resp1.status_code in [400, 422]

    # Invalid laundry_status
    bad_status = {
        "facility_id": "fac_laundry_test",
        "feature_id": "feat_laundry_machines",
        "reported_status": "WORKING",
        "source_type": "STUDENT_REPORT",
        "laundry_status": "EXPLODED"
    }
    resp2 = client.post("/api/reports", json=bad_status)
    assert resp2.status_code in [400, 422]


def test_L12_contradictory_collected_status_rejected_or_guarded():
    """Verify that submitting 'Collected' with reported_status='WORKING' without crowd observation is rejected."""
    contradictory_payload = {
        "facility_id": "fac_laundry_test",
        "feature_id": "feat_laundry_machines",
        "reported_status": "WORKING",
        "source_type": "STUDENT_REPORT",
        "laundry_status": "Collected",
        # No crowd_level provided!
    }
    resp = client.post("/api/reports", json=contradictory_payload)
    assert resp.status_code in [400, 422]
    # But when reported_status is UNCERTAIN, it is accepted!
    valid_collected = {
        "facility_id": "fac_laundry_test",
        "feature_id": "feat_laundry_machines",
        "reported_status": "UNCERTAIN",
        "source_type": "STUDENT_REPORT",
        "laundry_status": "Collected",
        "note": "Picked up my dry cleaning batch"
    }
    resp_ok = client.post("/api/reports", json=valid_collected)
    assert resp_ok.status_code == 201
