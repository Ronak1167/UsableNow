# UsableNow — Open Doesn't Mean Usable

> **"Know before you go."**  
> An AI-assisted, need-aware facility usability platform for JIIT students and nearby hostel residents.  
> Built for the **Lumina '26 — Hack the Unseen** hackathon by team **404 Brain Not Found** (Pragya Ahlawat [Lead], Paras, Ronak Jain).

---

## 1. The Core Vision & Epistemic Principle

Traditional campus maps tell students where a facility exists and perhaps whether the building is scheduled to be open. They fail to answer the question that matters when running late between classes:

**"Which facility is most likely to meet my specific need right now, and how reliable is that information?"**

### The Invariant
> ### **UNKNOWN DOES NOT MEAN UNAVAILABLE.**
> Never present unverified, stale, or insufficiently supported information as a confirmed fact. Silence is treated honestly as unknown, not as confirmed malfunction or guaranteed availability.

---

## 2. Key Features

- **Need-Aware Intent Search**: Search by natural language (e.g., *"I need drinking water near ABB-1"*, *"Find a working printer"*) or quick-chips.
- **Exponential Freshness Decay**: Evidence weight decays via $w = 2^{-\Delta t / t_{1/2}}$. Fast-depleting consumables (water, toner) have a 6h half-life; physical ramps have a 48h half-life.
- **Explainable Confidence Engine**: Returns High, Medium, Low, or Unknown with numerical confidence scores and explicit reason codes.
- **Anti-Spam & Single-Report Ceiling**: A single isolated report is mathematically capped at Medium confidence ($\le 60\%$). Rapid bursts from the same IP are dampened.
- **Contradiction Detection**: Materially contradictory fresh reports trigger a prominent `CONFLICTING` status rather than guessing a winner.
- **Multi-Feature Independence**: A facility with working water does not falsely mark its printer as operational.
- **Provider-Independent AI with Local Fallback**: Uses Gemini or OpenAI when configured; seamlessly degrades to an instant deterministic regex/pattern fallback when no API keys are present.
- **Full Transparency & Admin Moderation**: Complete open math inspection, live report moderation queue, and one-click demo re-seed.

---

## 3. Technology Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, Lucide React, TanStack Query v5, React Router v7.
- **Backend**: Python 3.11+ / 3.14, FastAPI, Pydantic v2, SQLAlchemy 2.0, SQLite (default overnight zero-config).
- **Testing**: pytest (55 automated unit, regression, security, and integration test cases passing in ~1.2s across 5 test suites).
- **Deployment & Architecture**: Monorepo with separated frontend and backend services.

---

## 4. Quick Start & Reproducible Setup Commands

### Prerequisites
- Python 3.11+ or newer installed (`python --version`)
- Node.js **20.19+ or 22.12+** (required by Vite 8; use a supported LTS release) (`node --version`)

---

### Step A: Setup Backend

Open a terminal in the project root:

```bash
# 1. Create Python virtual environment
python -m venv venv

# 2. Activate virtual environment
# On Windows PowerShell:
.\venv\Scripts\Activate.ps1
# On Linux/macOS:
source venv/bin/activate

# 3. Install backend dependencies
pip install -r backend/requirements.txt

# 4. Copy environment configuration
cp .env.example backend/.env

# 5. Initialize & seed the demonstration database (17 campus facilities)
python -m app.seed.seed_data
# (or cd backend && python -m app.seed.seed_data)

# 6. Start the FastAPI backend server
cd backend
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

The backend is now live at:
- **API Root**: `http://127.0.0.1:8000/`
- **Interactive Swagger Docs**: `http://127.0.0.1:8000/docs`
- **Health Probe**: `http://127.0.0.1:8000/api/health`

---

### Step B: Setup Frontend

Open a second terminal in the project root:

```bash
# 1. Navigate to frontend
cd frontend

# 2. Install npm dependencies
npm install

# 3. Start Vite development server
npm run dev
```

The frontend application is now live at:
- **Web App**: `http://localhost:5173/`

---

### Step C: Run Automated Tests

To run the complete automated test suite (verifying all 55 reliability, API, laundry, Google Maps, and security integrity specifications):

```bash
# From workspace root
python -m pytest -q backend
```

Expected output: `55 passed in ~1.2s`

---

### Step D: Build for Production

```bash
cd frontend
npm run build
```

Expected output: `✓ built in ~5s` (dist folder generated with static assets).

---

## 5. Environment Variables Reference

| Variable | Default Value | Required? | Purpose |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | `sqlite:///./usablenow.db` | No | Connection string (PostgreSQL/Supabase ready; SQLite zero-config default). |
| `ENVIRONMENT` | `development` | No | Deployment mode (`development`, `demo`, `production`, `test`). In `production`, automatically sets evidence mode to `live`. |
| `EVIDENCE_MODE` | `demo` | No | Evidence filtering mode (`demo` = all seeded mock data, `live` = real student reports only, `hybrid` = live reports override demo per feature). |
| `CORS_ORIGINS` | `http://localhost:5173,...` | No | Allowed frontend origins (comma-separated or list). |
| `ADMIN_SECRET_KEY` | `""` (Set in `.env`) | Yes | Secret key for admin moderation and demo reset (`x-admin-key` header). Fails closed if missing or weak. |
| `GOOGLE_MAPS_API_KEY` | `""` | No | Backend-only Google Maps Platform API key (for Google Routes walking directions and static preview proxy). Never sent to browsers. |
| `VITE_API_URL` | `""` (defaults to `/api`) | No | Frontend: Optional backend API origin for split deployments (e.g., frontend on Vercel, backend on Render). |
| `VITE_GOOGLE_MAPS_API_KEY` | `""` | No | Frontend: Optional browser Maps API key (protected by HTTP referrer and API restrictions in Google Cloud Console). |
| `GEMINI_API_KEY` | `""` | No | Optional. If omitted, uses fast deterministic local regex fallback with zero external cost. |
| `OPENAI_API_KEY` | `""` | No | Optional. If omitted, uses fast deterministic local regex fallback with zero external cost. |
| `DEFAULT_HALF_LIFE_HOURS` | `6.0` | No | Default decay half-life in hours for rapid consumables (water, toner). |
| `PHYSICAL_HALF_LIFE_HOURS`| `48.0` | No | Decay half-life for architectural fixtures (ramps, elevators). |

---

## 6. Demonstration Seed Facilities (JIIT Campus Context)

The seed script (`backend/app/seed/seed_data.py`) generates 17 illustrative facilities covering every required interface state:
1. `fac_01`: **ABB-I Ground Floor RO Water Station** — 3 independent agreeing reports $\rightarrow$ `LIKELY_WORKING` (High confidence).
2. `fac_02`: **LRC Printing Hub** — Fresh unavailable report $\rightarrow$ `LIKELY_UNAVAILABLE` (Medium/High).
3. `fac_03`: **ABB-II West Wing Lift B** — Contradictory reports within 2 hours $\rightarrow$ `CONFLICTING`.
4. `fac_04`: **Aryabhatt Step-Free Ramp Entrance** — 48h physical half-life $\rightarrow$ `LIKELY_WORKING`.
5. `fac_05`: **Annexe II 3rd Floor Water Cooler** — Report is 38h old ($> 6\times$ half-life) $\rightarrow$ `UNKNOWN` (Stale decayed).
6. `fac_06`: **Shastri Hostel Ground Floor Accessible Restroom** $\rightarrow$ `LIKELY_WORKING` (High confidence).
7. `fac_07`: **Cafeteria Tech Lounge Power Hub** $\rightarrow$ `LIKELY_WORKING` (AC sockets active).
8. `fac_08`: **Tagore Hostel Silent Study Pods** — Zero reports logged $\rightarrow$ `UNKNOWN` ("Unknown does not mean unavailable").
9. `fac_09`: **ABB-I Central Atrium Multifunction Hub** — Multi-feature facility:
   - Water: `LIKELY_WORKING`
   - Printer: `LIKELY_UNAVAILABLE`
   - Wi-Fi: `UNKNOWN` (Only uncertain report logged)
10. `fac_10`: **Sarojini Hostel Outdoor Wi-Fi Canopy** — Single report working $\rightarrow$ `LIKELY_WORKING` (Capped at Medium confidence).
11. `fac_11`: **Sports Complex Mezzanine Water Station** — Only uncertain report $\rightarrow$ `UNKNOWN` (Low confidence).
12. `fac_12`: **Computer Centre Lab 3 Printer Station** $\rightarrow$ `LIKELY_WORKING`.
13. `fac_13`: **Lecture Hall Complex Step-Free East Ramp** $\rightarrow$ `LIKELY_UNAVAILABLE` (scaffolding block reported).
14. `fac_14`: **Central Library 2nd Floor Quiet Study Zone** $\rightarrow$ `LIKELY_WORKING`.
15. `fac_15`: **Shastri Hostel Block B Laundry Room** — Front-load washers with crowd level and cycle time tracking $\rightarrow$ `LIKELY_WORKING`.
16. `fac_16`: **Tagore Hostel Laundry Hub** — Machine out of order + heavy queue $\rightarrow$ `LIKELY_UNAVAILABLE` / `UNCERTAIN`.
17. `fac_17`: **Sarojini Hostel Laundry Corner** — Small laundry area with decayed report $\rightarrow$ `UNKNOWN`.

All seeded records are tagged with `is_demo_data: true`.

---

## 7. Project Monorepo Structure

```
UsableNow/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── config.py             # Settings, half-lives, CORS, thresholds, admin auth
│   │   ├── database.py           # SQLAlchemy engine & session factory
│   │   ├── main.py               # FastAPI entrypoint & lifespan
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   └── entities.py       # Facility, Feature, Report, ModerationLog
│   │   ├── schemas/
│   │   │   └── schemas.py        # Pydantic v2 request & response models
│   │   ├── core/
│   │   │   ├── reliability_engine.py  # Decay math, corroboration, safeguards
│   │   │   └── recommendations.py     # Ranking and plain-language rationale
│   │   ├── services/
│   │   │   ├── ai_service.py     # Provider-agnostic AI & local deterministic parser
│   │   │   └── maps_service.py   # Google Maps Platform proxy & Haversine fallback
│   │   ├── api/
│   │   │   └── routes.py         # REST endpoints (facilities, reports, search, admin, maps)
│   │   └── seed/
│   │       └── seed_data.py      # Idempotent 17-facility demo seed script
│   ├── tests/
│   │   ├── test_reliability_engine.py # Core algorithm tests (Decay, single-report ceiling, conflict)
│   │   ├── test_api.py                # Public workflow & moderation tests
│   │   ├── test_laundry.py            # Hostel laundry facility tests
│   │   ├── test_maps.py               # Google Maps routes, boundaries, & preview tests
│   │   └── test_security_integrity.py # Admin secret strength, fail-closed, moderation privacy
│   ├── pytest.ini
│   ├── requirements.txt
│   └── .env
├── frontend/
│   ├── public/
│   │   └── favicon.svg           # Custom location pin & checkmark logo
│   ├── src/
│   │   ├── api/
│   │   │   └── client.ts         # Typed API client with error handling
│   │   ├── components/
│   │   │   ├── ConfidenceBadge.tsx
│   │   │   ├── DemoDisclaimer.tsx
│   │   │   ├── FacilityCard.tsx
│   │   │   ├── FacilityDetailModal.tsx
│   │   │   ├── Footer.tsx
│   │   │   ├── FreshnessBadge.tsx
│   │   │   ├── Navbar.tsx
│   │   │   ├── ReportModal.tsx
│   │   │   └── StatusBadge.tsx
│   │   ├── pages/
│   │   │   ├── AdminPage.tsx
│   │   │   ├── DiscoveryPage.tsx
│   │   │   ├── LandingPage.tsx
│   │   │   └── MethodologyPage.tsx
│   │   ├── types/
│   │   │   └── index.ts          # Shared TypeScript domain types
│   │   ├── App.tsx               # Router & React Query Provider
│   │   ├── index.css             # Tailwind base & accessible focus styles
│   │   └── main.tsx
│   ├── package.json
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── tsconfig.json
│   └── vite.config.ts            # Vite config with backend proxy
├── docs/
│   ├── ARCHITECTURE.md           # System architecture diagrams
│   ├── SCORING_METHODOLOGY.md    # Mathematical proofs and half-lives
│   ├── API_REFERENCE.md          # REST API endpoints & schemas
│   └── DEMO_WALKTHROUGH.md       # 3-minute hackathon presentation script
├── .gitignore
├── .env.example
├── run_dev.bat                   # Windows double-click dev launcher
└── README.md
```

---

## 8. 3-Minute Hackathon Demo Guide

Follow [`docs/DEMO_WALKTHROUGH.md`](docs/DEMO_WALKTHROUGH.md) for the exact 180-second presentation script used by Team 404 Brain Not Found for the Lumina '26 judges.

---

## 9. Next Steps for Live JIIT Production Rollout

1. **Student Ambassador Audits**: Deploy on-site student QR stickers at water stations and printer labs to replace seeded demonstration data with live scans.
2. **PostgreSQL / Supabase Migration**: Switch `DATABASE_URL` in `.env` to a hosted Supabase PostgreSQL instance with zero code alterations.
3. **PWA Offline Support**: Enable service-worker caching so students can check the last verified status even in underground basements with poor cellular reception.
