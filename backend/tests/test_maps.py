import pytest
from datetime import datetime, timezone
from fastapi import FastAPI
from fastapi.testclient import TestClient
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.config import settings
from app.models.entities import Facility, Feature
from app.api.routes import router as api_router
from app.services.maps_service import maps_service

# Isolated test DB
test_engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


def make_isolated_app():
    test_app = FastAPI()
    test_app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
    test_app.include_router(api_router, prefix="/api")
    test_app.dependency_overrides[get_db] = override_get_db
    return test_app


isolated_app = make_isolated_app()
client = TestClient(isolated_app)


@pytest.fixture(autouse=True)
def setup_maps_test_db():
    Base.metadata.create_all(bind=test_engine)
    db = TestingSessionLocal()
    now = datetime.now(timezone.utc)
    fac = Facility(
        id="fac_map_test",
        name="Map Test Facility",
        description="Testing facility with coordinates",
        facility_type="Drinking Water",
        building_or_area="ABB-I Ground Floor",
        latitude=28.62970,
        longitude=77.37210,
        is_demo_data=True,
        created_at=now,
        updated_at=now
    )
    feat = Feature(
        id="feat_map_water",
        facility_id="fac_map_test",
        feature_type="drinking_water",
        display_name="RO Water Dispenser",
        created_at=now
    )
    db.add(fac)
    db.add(feat)
    db.commit()
    db.close()
    yield
    Base.metadata.drop_all(bind=test_engine)


def test_maps_config_endpoint_is_safe():
    response = client.get("/api/maps/config")
    assert response.status_code == 200
    data = response.json()
    assert "google_maps_enabled" in data
    assert data["google_maps_enabled"] is True
    assert "campus_center" in data
    assert data["campus_center"]["latitude"] == 28.6297
    assert data["campus_center"]["longitude"] == 77.3721
    assert "JIIT" in data["campus_name"]
    # Critical security check: Never disclose secret key or key fragment in config
    assert "key" not in data
    assert "api_key" not in data
    assert "secret" not in data
    if settings.GOOGLE_MAPS_API_KEY:
        assert settings.GOOGLE_MAPS_API_KEY not in response.text


def test_maps_walking_route_endpoint():
    response = client.get(
        "/api/maps/walking-route",
        params={
            "origin_lat": 28.62970,
            "origin_lon": 77.37210,
            "destination_lat": 28.63110,
            "destination_lon": 77.37330,
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["distance_meters"] > 0
    assert data["duration_seconds"] > 0
    assert "min walk" in data["duration_formatted"]
    assert data["source"] in ("google_routes_api", "haversine_estimate")
    if settings.GOOGLE_MAPS_API_KEY:
        assert settings.GOOGLE_MAPS_API_KEY not in response.text


def test_facility_coordinates_and_map_urls_key_non_disclosure():
    response = client.get("/api/facilities/fac_map_test")
    assert response.status_code == 200
    data = response.json()
    assert data["latitude"] is not None
    assert data["longitude"] is not None
    assert abs(data["latitude"] - 28.6297) < 0.001
    assert abs(data["longitude"] - 77.3721) < 0.001
    # Secure proxy URL: static_map_url must NOT contain raw Google API keys
    assert data["static_map_url"] is not None
    assert data["static_map_url"].startswith("/api/maps/static-preview")
    assert "key=" not in data["static_map_url"]
    assert data["directions_url"] is not None
    assert "google.com/maps/dir" in data["directions_url"]
    if settings.GOOGLE_MAPS_API_KEY:
        assert settings.GOOGLE_MAPS_API_KEY not in response.text


def test_haversine_fallback_when_api_key_empty(monkeypatch):
    monkeypatch.setattr(maps_service, "api_key", "")
    route = maps_service.compute_walking_route(28.62970, 77.37210, 28.63110, 77.37330)
    assert route["status"] == "success"
    assert route["source"] == "haversine_estimate"
    assert route["distance_meters"] > 0
    assert route["duration_seconds"] > 0
    assert route["duration_minutes"] >= 1


def test_static_preview_proxy_non_disclosure(monkeypatch):
    # Mock successful image return
    fake_png = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR"
    monkeypatch.setattr(maps_service, "fetch_static_map_image", lambda lat, lon, zoom: fake_png)
    response = client.get("/api/maps/static-preview?lat=28.6297&lon=77.3721")
    assert response.status_code == 200
    assert response.headers["content-type"] == "image/png"
    assert response.content == fake_png
    if settings.GOOGLE_MAPS_API_KEY:
        assert settings.GOOGLE_MAPS_API_KEY not in response.text
