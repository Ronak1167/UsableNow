# UsableNow — 3-Minute Hackathon Demonstration Script
**Hackathon**: Lumina '26 — Hack the Unseen  
**Team**: 404 Brain Not Found (Pragya Ahlawat, Paras, Ronak Jain)

---

## Demo Script Flow (~180 Seconds)

### Step 1: The Problem Hook (0:00 - 0:25)
- **Speaker Action**: Open the UsableNow Landing Page (`http://localhost:5173`).
- **Talking Point**:
  > *"Every campus map tells you where a facility is and maybe if the building is open. But have you ever walked 10 minutes across campus to print your assignment, only to find the printer out of toner, or walked to a water cooler only to find a dry drip?*
  > *At Lumina '26, our team—404 Brain Not Found—built **UsableNow: Open Doesn't Mean Usable**."*

### Step 2: Need-Based Discovery & Real-World Natural Language (0:25 - 0:55)
- **Speaker Action**: Click "Find a Facility" to enter the Discovery Dashboard (`/discover`).
- **Speaker Action**: Type: `"I need drinking water near ABB-1"` into the search bar.
- **Talking Point**:
  > *"Students don't search by coordinates; they search by urgent need. Our interpretation layer instantly maps the query to our 'drinking_water' feature category and prioritizes ABB-1 facilities."*
- **Speaker Action**: Click the **"Working Printer"** quick-select chip.
- **Showcase**: Notice that LRC Printing Hub shows **"Likely Unavailable"** (red badge, paper jam reported), whereas Computer Centre Lab 3 shows **"Likely Working"** (green badge).

### Step 3: Inspecting Deep Reliability Evidence & Math (0:55 - 1:25)
- **Speaker Action**: Click **"Evidence & Timeline"** on the **ABB-I Central Atrium Multifunction Hub** (`fac_09`).
- **Talking Point**:
  > *"Look at this multi-feature facility. The cold water dispenser is **Likely Working**, but the printer is **Likely Unavailable**, and Wi-Fi is **Unknown**. We NEVER assume all features work just because one works."*
- **Speaker Action**: Expand the **"Inspect Math & Weight Breakdown"** drawer.
- **Talking Point**:
  > *"Every status is explainable. We use exponential half-life decay: `w = 2^(-age / half_life)`. Water and printer toner have a 6-hour half-life, while step-free access has 48 hours."*

### Step 4: The Core Principle: UNKNOWN != UNAVAILABLE (1:25 - 1:50)
- **Speaker Action**: Filter by status: **"Unknown"** or look at **Annexe II 3rd Floor Water Cooler** (`fac_05`).
- **Talking Point**:
  > *"Here is the most important insight of our product: **UNKNOWN DOES NOT MEAN UNAVAILABLE.** The report for this cooler is 38 hours old. Its weight has decayed below our active threshold. Traditional apps assume silence means working; naive bots assume silence means broken. UsableNow tells the student the truth: current usability is unknown, so don't risk it without checking."*

### Step 5: Live Report Submission & Dynamic Cache Invalidation (1:50 - 2:20)
- **Speaker Action**: Click **"Report Status"** on Tagore Hostel Study Pods (`fac_08`, which currently has zero reports and Unknown status).
- **Speaker Action**: Submit: Status = `WORKING`, Note: *"Quiet desks available with good lighting"*, Source = `Student Report`.
- **Talking Point**:
  > *"When a student submits a new observation, the server validates it, captures a UTC timestamp, prevents spam bursts, and TanStack Query immediately re-evaluates the facility in real time. Notice that a single report only gives Medium confidence—because no single user can unilaterally claim High community confidence."*

### Step 6: Transparency & Admin Moderation (2:20 - 2:50)
- **Speaker Action**: Click **"Admin"** in the top navigation bar (`/admin`).
- **Talking Point**:
  > *"Our Admin dashboard provides full transparency over active vs decayed states, a live moderation queue to inspect unverified user declarations, and a one-click button to reset demonstration states for testing."*

### Step 7: Conclusion & Vision (2:50 - 3:00)
- **Talking Point**:
  > *"UsableNow transforms campus accessibility from passive maps into an active, evidence-grounded utility network. Know before you go. Thank you!"*
