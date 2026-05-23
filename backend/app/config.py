import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "AI-Powered Test Prediction Platform"
    API_V1_STR: str = "/api"
    
    # Database configuration
    POSTGRES_USER: str = os.getenv("POSTGRES_USER", "postgres")
    POSTGRES_PASSWORD: str = os.getenv("POSTGRES_PASSWORD", "postgrespassword")
    POSTGRES_HOST: str = os.getenv("POSTGRES_HOST", "localhost")
    POSTGRES_PORT: str = os.getenv("POSTGRES_PORT", "5432")
    POSTGRES_DB: str = os.getenv("POSTGRES_DB", "test_prediction_db")
    
    # Authentication Security
    API_KEY: str = os.getenv("API_KEY", "aegis_prod_api_key_2026")
    
    # Allowed CORS Origins
    ALLOWED_ORIGINS: str = os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173,http://127.0.0.1:3000"
    )
    
    # Use SQLite as fallback if PostgreSQL is not available
    USE_SQLITE: bool = os.getenv("USE_SQLITE", "false").lower() == "true"
    
    @property
    def DATABASE_URL(self) -> str:
        env_url = os.getenv("DATABASE_URL")
        if env_url:
            # SQLAlchemy asyncpg requires 'postgresql+asyncpg://' driver prefix
            if env_url.startswith("postgres://"):
                return env_url.replace("postgres://", "postgresql+asyncpg://", 1)
            elif env_url.startswith("postgresql://"):
                return env_url.replace("postgresql://", "postgresql+asyncpg://", 1)
            return env_url
            
        if self.USE_SQLITE:
            return "sqlite+aiosqlite:///./test_prediction.db"
        return f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

    @property
    def SYNC_DATABASE_URL(self) -> str:
        env_url = os.getenv("DATABASE_URL")
        if env_url:
            # Sync session requires 'postgresql://' instead of legacy 'postgres://'
            if env_url.startswith("postgres://"):
                return env_url.replace("postgres://", "postgresql://", 1)
            return env_url
            
        if self.USE_SQLITE:
            return "sqlite:///./test_prediction.db"
        return f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

    class Config:
        case_sensitive = True

settings = Settings()
