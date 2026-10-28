# UsableNow — Reliability Scoring & Freshness Engine Methodology

This document details the mathematical models, safeguards, and algorithms powering the UsableNow status engine.

---

## 1. Freshness Decay Model

Physical facilities change state at different rates. A water dispenser or printer toner can deplete in a few hours, whereas a concrete wheelchair ramp rarely vanishes overnight.

The evidential weight of an observation decays exponentially with time:

$$\text{freshness\_weight} = 2^{-\frac{\Delta t}{t_{1/2}}}$$

Where:
- $\Delta t$ = Age of the report in hours: $\Delta t = \frac{\text{now} - \text{created\_at}}{3600}$
- $t_{1/2}$ = Configured half-life in hours for the specific facility feature type.

### Configured Half-Lives ($t_{1/2}$)
| Feature Category | Half-Life ($t_{1/2}$) | Rationale |
| :--- | :--- | :--- |
| **Drinking Water** | 6.0 Hours | Chillers, water cuts, and RO filters fluctuate throughout academic days. |
| **Printers** | 6.0 Hours | Paper jams, queue locks, and toner depletion occur during peak submission hours. |
| **Campus Wi-Fi** | 6.0 Hours | Access point density and channel interference fluctuate by lecture period. |
| **Charging Points** | 8.0 Hours | Power socket trips and circuit breakers. |
| **Study Spaces** | 12.0 Hours | Noise level and cubicle availability shift across mornings and nights. |
| **Accessible Washrooms**| 12.0 Hours | Cleaning schedules and lock functionality. |
| **Passenger Lifts** | 24.0 Hours | Mechanical elevator maintenance intervals. |
| **Step-Free Ramps** | 48.0 Hours | Architectural ramps and automatic sliding doors. |

---

## 2. Evidence Aggregation

For any feature, all active, moderated reports are gathered and decayed:

$$W_{\text{working}} = \sum_{r \in R_{\text{work}}} w_r$$

$$W_{\text{unavailable}} = \sum_{r \in R_{\text{unavail}}} w_r$$

$$W_{\text{uncertain}} = \sum_{r \in R_{\text{uncert}}} w_r$$

$$W_{\text{total}} = W_{\text{working}} + W_{\text{unavailable}} + W_{\text{uncertain}}$$

### Anti-Spam & Cluster Dampening
If successive reports are submitted within 10 minutes from the same client IP or identical state burst, their weight is dampened:

$$w_{\text{duplicate}} = w \times 0.2$$

This prevents a single user from clicking "Working" 10 times to artificially manufacture high consensus.

---

## 3. Decision Safeguards & State Transitions

### Safeguard A: Zero Reports
If $N_{\text{reports}} = 0$:
- **Status**: `UNKNOWN`
- **Confidence**: 0.0 (`Unknown`)
- **Reason**: `NO_REPORTS`
- **Epistemic Note**: *"Unknown does not mean unavailable."*

### Safeguard B: Decayed Evidence (Stale)
If $W_{\text{total}} < 0.30$:
- **Status**: `UNKNOWN`
- **Confidence**: $\le 25.0$ (`Low` or `Unknown`)
- **Reason**: `EVIDENCE_STALE_DECAYED`
- Old reports remain visible in the historical log, but cannot force a definitive active state.

### Safeguard C: Conflicting Reports
If $W_{\text{working}} \ge 0.35$ and $W_{\text{unavailable}} \ge 0.35$:
$$\text{Conflict Ratio} = \frac{\min(W_{\text{working}}, W_{\text{unavailable}})}{W_{\text{working}} + W_{\text{unavailable}}}$$
If $\text{Conflict Ratio} \ge 0.25$:
- **Status**: `CONFLICTING`
- **Confidence**: `Low`
- **Reason**: `CONTRADICTORY_EVIDENCE`
- Informs students that conflicting accounts exist and on-site checking is necessary.

### Safeguard D: Single-Report Confidence Ceiling
If only 1 distinct observation exists:
$$\text{Confidence Score} \le 60.0 \quad (\text{Medium})$$
A single uncorroborated report **never** receives `High` confidence. Multiple independent agreeing observations are strictly required to attain `High` confidence ($\ge 75\%$).

---

## 4. Multi-Feature Independence

A critical rule in UsableNow is that **a working feature never implies that other features of that facility are operational**.

For example, at `fac_09` (ABB-I Central Atrium):
- Drinking Water = `LIKELY_WORKING` (Confidence: High)
- Printer = `LIKELY_UNAVAILABLE` (Confidence: Medium)
- Wi-Fi = `UNKNOWN` (Uncertain packet drops reported)

Each feature maintains its own mathematical assessment, ensuring students needing printing are not misled because someone got a cup of cold water nearby.
