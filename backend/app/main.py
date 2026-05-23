import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.config import settings
from app.db.session import init_db, get_db
from app.db.seeder import seed_all
from app.api.router import router as api_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup actions
    print("Initializing Database tables...")
    await init_db()
    
    # Auto-seed database if empty
    print("Auto-seeding default project data...")
    async for db in get_db():
        try:
            await seed_all(db)
        except Exception as e:
            print(f"Failed to auto-seed database: {e}")
        break  # Only run once on startup
        
    yield
    # Shutdown actions (if any)
    print("Shutting down API service...")

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="AI-powered test metric prediction API with ML forecasting and SHAP explanations.",
    version="1.0.0",
    lifespan=lifespan
)

# CORS configurations
origins = [o.strip() for o in settings.ALLOWED_ORIGINS.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API Router
app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/")
async def root():
    return {
        "status": "online",
        "project": settings.PROJECT_NAME,
        "docs_url": "/docs",
        "api_url": f"{settings.API_V1_STR}"
    }

if __name__ == "__main__":
    import os
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=True)
