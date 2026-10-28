from typing import List, Union
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "UsableNow"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api"
    DATABASE_URL: str = "sqlite:///./usablenow.db"
    
    # CORS
    CORS_ORIGINS: Union[List[str], str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]
    
    # Environment & Deployment Mode
    ENVIRONMENT: str = "development"  # "development", "demo", "production", "test"
    EVIDENCE_MODE: str = "demo"        # "demo" (all evidence), "live" (strictly real-world student reports), "hybrid"

    # Security / Admin (Fail closed: no hardcoded default key; must be set in environment)
    ADMIN_SECRET_KEY: str = ""
    
    # Optional AI Keys (provider agnostic with local fallback)
    GEMINI_API_KEY: str = ""
    OPENAI_API_KEY: str = ""

    # Google Maps Platform Integration
    GOOGLE_MAPS_API_KEY: str = ""
    
    # Reliability Engine Tunables
    DEFAULT_HALF_LIFE_HOURS: float = 6.0
    PHYSICAL_HALF_LIFE_HOURS: float = 48.0
    HIGH_CONFIDENCE_THRESHOLD: float = 75.0
    MEDIUM_CONFIDENCE_THRESHOLD: float = 45.0
    CONFLICT_RATIO_THRESHOLD: float = 0.30
    MIN_EVIDENCE_FOR_DEFINITIVE: float = 0.60
    
    @field_validator("CORS_ORIGINS", mode="before")
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):
            return [i.strip() for i in v.split(",") if i.strip()]
        return v

    def model_post_init(self, __context: object) -> None:
        env = (self.ENVIRONMENT or "").strip().lower()
        # In production deployments, default evidence mode safely to "live" to prevent demo data leakage
        if env in ("production", "prod") and self.EVIDENCE_MODE == "demo":
            self.EVIDENCE_MODE = "live"

    model_config = SettingsConfigDict(
        env_file=("backend/.env", ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()
