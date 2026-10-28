# UsableNow — REST API Reference

The UsableNow backend provides a documented, type-safe REST API built on FastAPI and OpenAPI 3.1.

Interactive Swagger UI documentation is available locally at:
`http://127.0.0.1:8000/docs`

---

## Endpoints Summary

### 1. Health Probe
- **`GET /api/health`**
- Verifies database connectivity and application status.
- Response:
  ```json
  {
    "status": "healthy",
    "database": "connected",
    "facilities_count": 17,
    "version": "1.0.0",
    "ai_mode": "deterministic_local_fallback"
  }
  ```

### 2. Facilities
- **`GET /api/facilities`**
  - Query parameters:
    - `feature_type` (e.g. `drinking_water`, `printer`, `laundry`)
    - `building` (e.g. `ABB-I`, `LRC`, `Hostel Block B`)
    - `status_filter` (`LIKELY_WORKING`, `LIKELY_UNAVAILABLE`, `CONFLICTING`, `UNKNOWN`)
    - `freshness_filter` (`fresh`, `stale`)
    - `evidence_mode` (`demo`, `live`, `hybrid`)
    - `limit`, `offset`
- **`GET /api/facilities/{facility_id}`**
  - Returns facility information, independent feature assessments, chronological reports, and nearby alternatives.
  - Query parameters:
    - `evidence_mode` (`demo`, `live`, `hybrid`)
- **`GET /api/facilities/{facility_id}/features`**
  - Returns feature reliability assessments for a specific facility.
  - Query parameters:
    - `evidence_mode` (`demo`, `live`, `hybrid`)
- **`GET /api/facilities/{facility_id}/reports`**
  - Returns chronological public reports for the facility (strictly excludes unmoderated `PENDING`, `FLAGGED`, or `REJECTED` reports).
  - Query parameters:
    - `evidence_mode` (`demo`, `live`, `hybrid`)

### 3. Search & Recommendations
- **`GET /api/search?q={query}`**
  - Natural language parsing and facility ranking with fallback keyword matching.
- **`GET /api/recommendations?feature_type={type}`**
  - Ranks best facilities matching a specific need with plain-language rationale and distance metrics.

### 4. Reporting
- **`POST /api/reports`**
  - Submits a student status observation report.
  - Request Body:
    ```json
    {
      "facility_id": "fac_01",
      "feature_id": "feat_01_water",
      "reported_status": "WORKING",
      "source_type": "STUDENT_REPORT",
      "note": "Water is cold and flowing normally.",
      "is_anonymous": false
    }
    ```
  - **Moderation Policy**: Standard student submissions are recorded with `moderation_status="PENDING"` until approved by an administrator via the moderation workflow. Only authenticated admin requests with an environment-configured `x-admin-key` can auto-approve reports at submission time.
  - **Anti-Spam**: Rate-limited and deduplicated via salted IP hash; rapid identical reports receive HTTP 429.

### 5. Analytics & Admin
- **`GET /api/analytics/overview`**
  - Returns aggregate counts of facilities, features, statuses, freshness states, and approved recent reports.
  - Query parameters:
    - `evidence_mode` (`demo`, `live`, `hybrid`)
- **`GET /api/admin/reports`**
  - Protected header: `x-admin-key: <ADMIN_SECRET_KEY>`
  - Returns full report history including `PENDING`, `APPROVED`, `FLAGGED`, and `REJECTED` reports.
- **`POST /api/admin/reset-demo`**
  - Protected header: `x-admin-key: <ADMIN_SECRET_KEY>`
  - Reseeds demonstration facilities and resets database state.
- **`POST /api/admin/reports/{report_id}/moderate?action={APPROVED|REJECTED|FLAGGED}`**
  - Protected header: `x-admin-key: <ADMIN_SECRET_KEY>`
  - Moderates public student observations.

### 6. Google Maps Platform & Campus Routing
- **`GET /api/maps/config`**
  - Returns safe configuration metadata (status, campus center coordinates, bounds). Never leaks API keys or secrets.
- **`GET /api/maps/walking-route`**
  - Query parameters: `origin_lat`, `origin_lon`, `destination_lat`, `destination_lon`.
  - Computes pedestrian walking distance and estimated transit time across campus.
  - Geofenced: strictly enforces JIIT Sector 62 campus coverage bounding box (`28.6200-28.6400` N, `77.3600-77.3850` E). Out-of-area requests return HTTP 400.
  - Resilient: Automatically falls back to deterministic Haversine distance if Google Routes API is unreachable or keys are omitted.
- **`GET /api/maps/static-preview`**
  - Query parameters: `lat`, `lon`, `zoom`.
  - Backend proxy for static campus map tiles with bounding-box validation and LRU memory caching.
