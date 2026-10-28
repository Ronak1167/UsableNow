import json
import logging
import math
import urllib.request
from collections import OrderedDict
from typing import Dict, Any, Optional
from app.config import settings

logger = logging.getLogger(__name__)

# JIIT Noida Sector 62 Campus Bounding Box (Encompasses all 17 seeded facilities: lat ~28.6288-28.6318, lon ~77.3712-77.3740)
CAMPUS_MIN_LAT = 28.6200
CAMPUS_MAX_LAT = 28.6400
CAMPUS_MIN_LON = 77.3600
CAMPUS_MAX_LON = 77.3850


def is_within_campus_bounds(lat: float, lon: float) -> bool:
    """Checks whether coordinates fall within the supported JIIT Noida Sector 62 campus coverage area."""
    return CAMPUS_MIN_LAT <= lat <= CAMPUS_MAX_LAT and CAMPUS_MIN_LON <= lon <= CAMPUS_MAX_LON


class GoogleMapsService:
    """
    Integrates with Google Maps Platform:
    - Google Routes API (New) for walking route duration & distance
    - Server-side static map proxy to protect API keys from client exposure
    - Bounded in-memory LRU cache to prevent billable API thrashing
    - Fallbacks gracefully to Haversine walking geometry if API key is unconfigured or network is unavailable
    """

    def __init__(self):
        self.api_key = settings.GOOGLE_MAPS_API_KEY
        self._image_cache: OrderedDict = OrderedDict()
        self._max_cache_size: int = 100

    def is_enabled(self) -> bool:
        return bool(self.api_key and self.api_key.strip())

    def clear_cache(self) -> None:
        """Clears the static map in-memory cache (useful for testing)."""
        self._image_cache.clear()

    def get_cache_size(self) -> int:
        """Returns the number of cached static map images."""
        return len(self._image_cache)

    def get_directions_url(self, dest_lat: float, dest_lon: float, origin_lat: Optional[float] = None, origin_lon: Optional[float] = None) -> str:
        """Constructs an official Google Maps directions URL for walking navigation (requires no API key)."""
        base = f"https://www.google.com/maps/dir/?api=1&destination={dest_lat:.6f},{dest_lon:.6f}&travelmode=walking"
        if origin_lat is not None and origin_lon is not None:
            base += f"&origin={origin_lat:.6f},{origin_lon:.6f}"
        return base

    def get_static_map_url(self, lat: float, lon: float) -> str:
        """
        Returns a protected backend proxy preview URL.
        Never returns or leaks the raw backend API key to clients.
        """
        if not self.is_enabled():
            return ""
        return f"/api/maps/static-preview?lat={lat:.6f}&lon={lon:.6f}"

    def fetch_static_map_image(self, lat: float, lon: float, zoom: int = 17, size: str = "600x260") -> Optional[bytes]:
        """
        Server-side fetch of static map image from Google Maps.
        Keeps backend GOOGLE_MAPS_API_KEY strictly on the server.
        Leverages a bounded LRU cache keyed by normalized coordinates and zoom.
        """
        if not self.is_enabled():
            return None

        # Normalized cache key (5 decimal places gives ~1m precision)
        cache_key = (round(lat, 5), round(lon, 5), zoom, size)
        if cache_key in self._image_cache:
            self._image_cache.move_to_end(cache_key)
            return self._image_cache[cache_key]

        try:
            url = (
                f"https://maps.googleapis.com/maps/api/staticmap?"
                f"center={lat:.6f},{lon:.6f}&zoom={zoom}&size={size}&scale=2&maptype=roadmap"
                f"&markers=color:0x0d9488%7Clabel:U%7C{lat:.6f},{lon:.6f}"
                f"&key={self.api_key}"
            )
            req = urllib.request.Request(url, headers={"User-Agent": "UsableNow-Backend/1.0"})
            with urllib.request.urlopen(req, timeout=4) as response:
                if response.status == 200:
                    img_bytes = response.read()
                    # Evict oldest entry if at capacity
                    if len(self._image_cache) >= self._max_cache_size:
                        self._image_cache.popitem(last=False)
                    self._image_cache[cache_key] = img_bytes
                    return img_bytes
        except Exception:
            # Avoid logging raw exception or URLs which might contain the key query param
            logger.warning("Failed to fetch static map preview from Google Maps Platform.")
        return None

    def compute_walking_route(
        self,
        origin_lat: float,
        origin_lon: float,
        dest_lat: float,
        dest_lon: float
    ) -> Dict[str, Any]:
        """
        Computes walking distance and duration between two coordinates.
        Attempts Google Routes API (New); falls back to Haversine physics model (1.3 m/s walking speed).
        """
        # If API key available, attempt Google Routes API (New)
        if self.is_enabled():
            try:
                routes_url = "https://routes.googleapis.com/directions/v2:computeRoutes"
                body = json.dumps({
                    "origin": {"location": {"latLng": {"latitude": origin_lat, "longitude": origin_lon}}},
                    "destination": {"location": {"latLng": {"latitude": dest_lat, "longitude": dest_lon}}},
                    "travelMode": "WALK"
                }).encode("utf-8")
                headers = {
                    "Content-Type": "application/json",
                    "X-Goog-Api-Key": self.api_key,
                    "X-Goog-FieldMask": "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline"
                }
                req = urllib.request.Request(routes_url, data=body, headers=headers)
                with urllib.request.urlopen(req, timeout=4) as response:
                    data = json.loads(response.read().decode("utf-8"))
                    routes = data.get("routes", [])
                    if routes:
                        primary_route = routes[0]
                        dist_m = primary_route.get("distanceMeters", 0)
                        dur_str = primary_route.get("duration", "0s")
                        dur_sec = int(dur_str.rstrip("s")) if dur_str.endswith("s") else int(float(dur_str))
                        dur_mins = max(1, round(dur_sec / 60))
                        polyline = primary_route.get("polyline", {}).get("encodedPolyline")
                        return {
                            "status": "success",
                            "source": "google_routes_api",
                            "distance_meters": dist_m,
                            "duration_seconds": dur_sec,
                            "duration_minutes": dur_mins,
                            "duration_formatted": f"~{dur_mins} min walk" if dur_mins > 1 else "< 1 min walk",
                            "polyline": polyline
                        }
            except Exception:
                logger.warning("Google Routes API walking calculation failed, falling back to Haversine.")

        # Deterministic Haversine Fallback
        R = 6371000
        phi1 = math.radians(origin_lat)
        phi2 = math.radians(dest_lat)
        delta_phi = math.radians(dest_lat - origin_lat)
        delta_lambda = math.radians(dest_lon - origin_lon)
        a = (math.sin(delta_phi / 2) ** 2 +
             math.cos(phi1) * math.cos(phi2) * (math.sin(delta_lambda / 2) ** 2))
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        dist_m = round(R * c, 1)

        # Average campus walking speed: 1.3 m/s (~78 meters per minute)
        dur_sec = round(dist_m / 1.3)
        dur_mins = max(1, round(dur_sec / 60))

        return {
            "status": "success",
            "source": "haversine_estimate",
            "distance_meters": dist_m,
            "duration_seconds": dur_sec,
            "duration_minutes": dur_mins,
            "duration_formatted": f"~{dur_mins} min walk" if dur_mins > 1 else "< 1 min walk",
            "polyline": None
        }


maps_service = GoogleMapsService()
