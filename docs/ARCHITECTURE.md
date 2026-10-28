# UsableNow — System Architecture & Design Specification

## 1. System Overview
**UsableNow** is an AI-assisted, need-aware facility usability platform engineered for students and hostel residents at Jaypee Institute of Information Technology (JIIT) and nearby student residences.

Traditional campus maps only answer:
1. *Where is a facility located?*
2. *Is the building currently scheduled to be open?*

UsableNow solves the actual usability gap:
**"Which facility is most likely to meet my specific need right now, and how reliable is that information?"**

### Core Epistemic Invariant
> **UNKNOWN DOES NOT MEAN UNAVAILABLE.**
> Absence of recent evidence must never be conflated with confirmed malfunction. If evidence decays below threshold or no observations exist, the facility state is strictly flagged as `UNKNOWN` rather than fabricated certainty.

---

## 2. High-Level Architecture Diagram

```
+-----------------------------------------------------------------------------------+
|                                  USER / CLIENT                                    |
|               (React 19 + TypeScript + Vite + Tailwind CSS + Lucide)               |
|                                                                                   |
|  [ Landing Page ]    [ Discovery Dashboard ]    [ Details Modal ]   [ Admin QA ]   |
|         |                      |                       |                 |        |
|         +----------------------+-----------------------+-----------------+        |
|                                        |                                          |
|                                [ TanStack Query ]                                 |
+----------------------------------------+------------------------------------------+
                                         | HTTP / JSON REST
                                         v
+-----------------------------------------------------------------------------------+
|                              BACKEND SERVICE (FastAPI)                             |
|                                                                                   |
|  +---------------------------+   +------------------------+   +----------------+  |
|  |       API Routers         |   |      AI Service        |   | Admin Service  |  |
|  | (/facilities, /search,    |   | (Gemini / OpenAI with  |   | (Moderation,   |  |
|  |  /reports, /recommend)    |   |  local fallback)       |   |  Demo Reseed)  |  |
|  +-------------+-------------+   +-----------+------------+   +--------+-------+  |
|                |                             |                         |          |
|                v                             v                         v          |
|  +-----------------------------------------------------------------------------+  |
|  |                 DETERMINISTIC RELIABILITY & EVIDENCE ENGINE                 |  |
|  |  - Exponential Freshness Decay: w = 2^(-age / half_life)                    |  |
|  |  - Cluster & Duplicate Dampening                                            |  |
|  |  - Single-Report Confidence Ceiling (<= 60%)                                |  |
|  |  - Contradiction Detection (conflict_ratio >= 0.25 -> CONFLICTING)          |  |
|  |  - Recommendation Scoring & Explainable Rationale Generation                |  |
|  +-----------------------------------------------------------------------------+  |
|                                        |                                          |
|                                [ SQLAlchemy ORM ]                                 |
+----------------------------------------+------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|                                DATABASE STORAGE                                   |
|               SQLite (Default zero-config) / PostgreSQL-Supabase Ready             |
|                                                                                   |
|    [ Facilities Table ]   [ Features Table ]   [ Reports Table ]   [ Audit Log ]  |
+-----------------------------------------------------------------------------------+
```

---

## 3. Component Breakdown

### Frontend (SPA)
- **Framework**: React 19 with Vite and TypeScript.
- **Styling**: Tailwind CSS with custom palette (Deep Navy background/text, Emerald/Teal for operational states, Amber for uncertain/decayed states, Rose for unavailable).
- **Icons**: Lucide React.
- **Data Caching**: `@tanstack/react-query` with instant cache invalidation upon report submission.
- **Accessibility**: High-contrast ratios, semantic tags, visible focus outlines, and dual status signalling (text labels beside icons).

### Backend (REST API)
- **Framework**: FastAPI (Python 3.11+ / 3.14).
- **Data Modeling**: Pydantic v2 schemas with comprehensive field validation.
- **ORM & DB**: SQLAlchemy 2.0 with connection pooling. Default SQLite database (`usablenow.db`) requiring no external dependencies.
- **Rate-Limiting & Anti-Spam**: In-memory IP-hash duplicate cluster suppression.

### AI Interpretation Layer
- **Provider-Independent**: Configurable for Gemini or OpenAI.
- **Deterministic Fallback**: Instant local regex and pattern classification engine if no API keys are present.
- **Transparency**: Every response discloses whether the summary was AI-generated or generated via the local fallback.
