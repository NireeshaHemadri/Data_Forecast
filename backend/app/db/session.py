import sys
import socket
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base

from app.config import settings

# Determine if we need to fall back to SQLite
database_url = settings.DATABASE_URL
is_sqlite = settings.USE_SQLITE

# Try to connect to PostgreSQL if not explicitly using SQLite
if not is_sqlite:
    try:
        port = int(settings.POSTGRES_PORT)
        # Attempt a quick connection check to the PostgreSQL host/port
        with socket.create_connection((settings.POSTGRES_HOST, port), timeout=1.0):
            pass
    except (OSError, ValueError) as e:
        print(f"PostgreSQL is not reachable at {settings.POSTGRES_HOST}:{settings.POSTGRES_PORT} ({e}). Falling back to SQLite.", file=sys.stderr)
        settings.USE_SQLITE = True
        database_url = "sqlite+aiosqlite:///./test_prediction.db"
        is_sqlite = True

print(f"Connecting to database: {database_url.split('@')[-1] if '@' in database_url else database_url}")

# Create async engine
connect_args = {"check_same_thread": False} if is_sqlite else {}
engine = create_async_engine(
    database_url,
    echo=False,
    connect_args=connect_args
)

# Create async session factory
async_session = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False
)

Base = declarative_base()

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency for getting database sessions in FastAPI endpoints."""
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()

async def init_db() -> None:
    """Initialize database tables."""
    # Import models here to ensure they are registered with Base
    from app.db.models import TestReport
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("Database tables initialized successfully.")
