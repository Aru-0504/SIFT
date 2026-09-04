from pydantic import AliasChoices, Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    database_url: str = Field(
        default="sqlite:///./sift_dev.db",
        validation_alias=AliasChoices("DATABASE_URL", "database_url"),
    )
    jwt_secret: str = Field(
        default="change-me",
        validation_alias=AliasChoices("JWT_SECRET", "jwt_secret"),
    )
    app_env: str = Field(
        default="development",
        validation_alias=AliasChoices("APP_ENV", "app_env"),
    )
    market_data_mode: str = Field(
        default="live",
        validation_alias=AliasChoices("MARKET_DATA_MODE", "market_data_mode"),
    )
    quote_cache_ttl_seconds: int = 45
    demo_seed_symbols: str = "RELIANCE.NS,TCS.NS,HDFCBANK.NS,AAPL,NVDA"
    cors_origins: str = Field(
        default="http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174",
        validation_alias=AliasChoices("CORS_ORIGINS", "cors_origins"),
    )
    supabase_jwt_secret: str | None = Field(
        default=None,
        validation_alias=AliasChoices("SUPABASE_JWT_SECRET", "supabase_jwt_secret"),
    )

    @model_validator(mode="after")
    def normalize_blank_values(self):
        self.database_url = self.database_url.strip() or "sqlite:///./sift_dev.db"
        self.jwt_secret = self.jwt_secret.strip() or "change-me"
        self.app_env = self.app_env.strip() or "development"
        self.market_data_mode = self.market_data_mode.strip().lower() or "live"
        self.cors_origins = self.cors_origins.strip() or "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174"
        if self.supabase_jwt_secret is not None:
            self.supabase_jwt_secret = self.supabase_jwt_secret.strip() or None
        return self


settings = Settings()


def get_cors_origins() -> list[str]:
    raw = (settings.cors_origins or "").strip()
    if not raw:
        return []
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


def get_jwt_secret() -> str:
    if settings.supabase_jwt_secret and settings.supabase_jwt_secret.strip():
        return settings.supabase_jwt_secret.strip()
    return settings.jwt_secret.strip() or "change-me"
