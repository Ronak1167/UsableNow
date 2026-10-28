import os
import re
import httpx
from typing import Dict, Any, List, Optional
from app.config import settings

# Supported feature types in UsableNow
SUPPORTED_FEATURE_TYPES = [
    "drinking_water",
    "printer",
    "lift",
    "step_free_access",
    "accessible_washroom",
    "charging_point",
    "study_space",
    "wifi",
    "laundry_machines",
    "laundry_crowd",
]

FEATURE_KEYWORDS = {
    "drinking_water": ["water", "drinking", "cooler", "purifier", "ro", "thirst", "bottle", "refill", "tap", "dispenser"],
    "printer": ["print", "printer", "printing", "photocopy", "xerox", "scanner", "paper", "toner", "cartridge", "jam"],
    "lift": ["lift", "elevator", "escalator", "floors", "vertical"],
    "step_free_access": ["ramp", "wheelchair", "step-free", "accessible entrance", "barrier-free", "crutches", "mobility", "accessibility", "accessible", "step free"],
    "accessible_washroom": ["washroom", "restroom", "toilet", "bathroom", "accessible toilet", "grab bar", "disabled washroom"],
    "charging_point": ["charging", "socket", "plug", "power", "outlet", "charger", "laptop charging", "charging point"],
    "study_space": ["study", "silent", "library", "reading", "desk", "cubicle", "quiet", "study space", "study spaces"],
    "wifi": ["wifi", "wi-fi", "internet", "network", "hotspot", "signal", "connection", "campus wi-fi", "campus wifi"],
    "laundry_machines": ["laundry", "washing machine", "washer", "dryer", "laundromat", "wash", "spin", "clothes", "laundry room"],
    "laundry_crowd": ["laundry crowd", "laundry busy", "washing crowd", "laundry queue", "how busy", "laundry wait", "laundry line"],
}

STATUS_KEYWORDS = {
    "WORKING": ["working", "operational", "works", "fine", "good", "refilled", "fast", "repaired", "functional", "active", "chilled", "full"],
    "UNAVAILABLE": ["broken", "down", "out of order", "empty", "jammed", "offline", "not working", "locked", "depleted", "damaged", "dry", "no water", "no paper"],
    "UNCERTAIN": ["slow", "intermittent", "maybe", "not sure", "unclear", "low pressure", "half working", "glitchy", "partial"]
}


class AIService:
    """
    Provider-independent AI service with deterministic local fallback.
    Never fabricates facts, timestamps, or statuses.
    """

    def __init__(self):
        self.gemini_api_key = settings.GEMINI_API_KEY or os.environ.get("GEMINI_API_KEY", "")
        self.openai_api_key = settings.OPENAI_API_KEY or os.environ.get("OPENAI_API_KEY", "")

    def is_ai_enabled(self) -> bool:
        return bool(self.gemini_api_key or self.openai_api_key)

    def categorize_text(self, text: str) -> Dict[str, Any]:
        """
        Extracts matched feature_type, suggested_status, and detected_area.
        Uses external LLM if configured; otherwise deterministic regex/pattern fallback.
        """
        if not text or not text.strip():
            return {
                "feature_type": None,
                "suggested_status": None,
                "detected_area": None,
                "source": "Local deterministic fallback (empty input)"
            }

        # If LLM key is configured, call external API with validation and fallback
        if self.gemini_api_key:
            try:
                result = self._categorize_with_gemini(text)
                if result:
                    return result
            except Exception:
                pass  # Graceful fallback to deterministic local parser

        if self.openai_api_key:
            try:
                result = self._categorize_with_openai(text)
                if result:
                    return result
            except Exception:
                pass  # Graceful fallback to deterministic local parser

        return self._categorize_deterministic(text)

    def _validate_model_output(self, parsed: Any, source_name: str) -> Optional[Dict[str, Any]]:
        """Validates external model output against supported schema; fails safely."""
        if not isinstance(parsed, dict):
            return None
        feat = parsed.get("feature_type")
        if feat and feat not in SUPPORTED_FEATURE_TYPES:
            feat = None
        status = parsed.get("suggested_status")
        if status and status not in ("WORKING", "UNAVAILABLE", "UNCERTAIN"):
            status = None
        area = parsed.get("detected_area")
        if area and not isinstance(area, str):
            area = str(area)
        if not feat and not status and not area:
            return None
        return {
            "feature_type": feat,
            "suggested_status": status,
            "detected_area": area,
            "source": source_name
        }

    def _categorize_deterministic(self, text: str) -> Dict[str, Any]:
        lower = text.lower()
        matched_feature = None
        best_score = 0

        for ftype, keywords in FEATURE_KEYWORDS.items():
            score = sum(1 for kw in keywords if re.search(r'\b' + re.escape(kw) + r'\b', lower))
            if score > best_score:
                best_score = score
                matched_feature = ftype

        # Check negative phrases FIRST to prevent false positive (e.g. "printer not working" matching "working")
        negative_patterns = [
            r"\bnot\s+working\b",
            r"\bdoesn't\s+work\b",
            r"\bdoes\s+not\s+work\b",
            r"\bout\s+of\s+order\b",
            r"\bbroken\b",
            r"\bdown\b",
            r"\bjammed\b",
            r"\boffline\b",
            r"\bempty\b",
            r"\blocked\b",
            r"\bno\s+water\b",
            r"\bno\s+paper\b",
            r"\bnot\s+ready\b",
            r"\bfailed\b"
        ]
        suggested_status = None
        if any(re.search(p, lower) for p in negative_patterns):
            suggested_status = "UNAVAILABLE"
        else:
            for status, keywords in STATUS_KEYWORDS.items():
                if any(re.search(r'\b' + re.escape(kw) + r'\b', lower) for kw in keywords):
                    suggested_status = status
                    break

        # Area detection
        detected_area = None
        area_patterns = ["abb-i", "abb-ii", "abb 1", "abb 2", "lrc", "library", "shastri", "tagore", "annexe", "hostel", "cafeteria", "sarojini", "sports"]
        for pat in area_patterns:
            if pat in lower:
                detected_area = pat.upper()
                break

        return {
            "feature_type": matched_feature,
            "suggested_status": suggested_status,
            "detected_area": detected_area,
            "source": "Local deterministic fallback"
        }

    def _categorize_with_gemini(self, text: str) -> Optional[Dict[str, Any]]:
        # Structured classification using Gemini REST API
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={self.gemini_api_key}"
        prompt = (
            f"You are a campus facility assistant. Extract JSON strictly with keys 'feature_type', 'suggested_status', 'detected_area' from: '{text}'.\n"
            f"Allowed feature_type: {SUPPORTED_FEATURE_TYPES} or null.\n"
            f"Allowed suggested_status: 'WORKING', 'UNAVAILABLE', 'UNCERTAIN', or null."
        )
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.1, "responseMimeType": "application/json"}
        }
        with httpx.Client(timeout=4.0) as client:
            resp = client.post(url, json=payload)
            if resp.status_code == 200:
                import json
                data = resp.json()
                raw_json = data["candidates"][0]["content"]["parts"][0]["text"]
                parsed = json.loads(raw_json)
                return self._validate_model_output(parsed, "AI-generated (Gemini 1.5)")
        return None

    def _categorize_with_openai(self, text: str) -> Optional[Dict[str, Any]]:
        # Structured classification using OpenAI Chat Completions API
        url = "https://api.openai.com/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.openai_api_key}",
            "Content-Type": "application/json"
        }
        prompt = (
            f"You are a campus facility assistant. Extract JSON strictly with keys 'feature_type', 'suggested_status', 'detected_area' from: '{text}'.\n"
            f"Allowed feature_type: {SUPPORTED_FEATURE_TYPES} or null.\n"
            f"Allowed suggested_status: 'WORKING', 'UNAVAILABLE', 'UNCERTAIN', or null."
        )
        payload = {
            "model": "gpt-4o-mini",
            "messages": [
                {"role": "system", "content": "You extract structured facility attributes in valid JSON format only."},
                {"role": "user", "content": prompt}
            ],
            "temperature": 0.1,
            "response_format": {"type": "json_object"}
        }
        with httpx.Client(timeout=4.0) as client:
            resp = client.post(url, headers=headers, json=payload)
            if resp.status_code == 200:
                import json
                data = resp.json()
                content = data["choices"][0]["message"]["content"]
                parsed = json.loads(content)
                return self._validate_model_output(parsed, "AI-generated (OpenAI GPT-4o-mini)")
        return None

    def generate_summary(
        self,
        facility_name: str,
        feature_name: str,
        status: str,
        confidence_label: str,
        confidence_score: float,
        reports_summary: List[Dict[str, Any]],
        freshness: str
    ) -> Dict[str, str]:
        """
        Generates factual evidence-grounded natural-language summary.
        Never fabricates observations.
        """
        # Deterministic generation
        total_reports = len(reports_summary)
        if total_reports == 0:
            summary = (
                f"No verified or student reports have been logged for {feature_name} at {facility_name}. "
                "Per core UsableNow principles: Unknown does not mean unavailable. An on-site observation would help confirm current usability."
            )
            return {"summary": summary, "source": "Local summary (deterministic fallback)"}

        working_count = sum(1 for r in reports_summary if r.get("reported_status") == "WORKING")
        unavail_count = sum(1 for r in reports_summary if r.get("reported_status") == "UNAVAILABLE")
        uncertain_count = sum(1 for r in reports_summary if r.get("reported_status") == "UNCERTAIN")

        notes = [r.get("note") for r in reports_summary if r.get("note")]
        recent_note_snip = f" Note recorded: '{notes[0]}'." if notes else ""

        if status == "LIKELY_WORKING":
            summary = (
                f"{feature_name} at {facility_name} is currently assessed as LIKELY WORKING with {confidence_label} confidence ({confidence_score}%). "
                f"Supported by {working_count} recent report(s) with {freshness.lower()} evidence.{recent_note_snip}"
            )
        elif status == "LIKELY_UNAVAILABLE":
            summary = (
                f"{feature_name} at {facility_name} is currently flagged as LIKELY UNAVAILABLE with {confidence_label} confidence ({confidence_score}%). "
                f"Recent report indicated out of service or depleted state.{recent_note_snip}"
            )
        elif status == "CONFLICTING":
            summary = (
                f"Status for {feature_name} at {facility_name} is CONFLICTING. "
                f"Received contradictory observations ({working_count} working vs {unavail_count} unavailable). "
                "We recommend checking an alternative facility or confirming on site before relying on it."
            )
        else:
            summary = (
                f"{feature_name} at {facility_name} currently has an UNKNOWN status ({freshness.lower()} evidence). "
                f"Total logged reports: {total_reports} ({uncertain_count} uncertain). Unknown does not mean unavailable."
            )

        return {"summary": summary, "source": "Local summary (deterministic fallback)"}


ai_service = AIService()
