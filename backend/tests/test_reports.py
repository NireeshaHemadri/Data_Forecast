import os
# Force SQLite database usage for testing to avoid contaminating production DB
os.environ["USE_SQLITE"] = "true"

import pytest
import pytest_asyncio
import io
import pandas as pd
from httpx import AsyncClient, ASGITransport
import sys
from sqlalchemy.future import select

# Add parent directory to path so app can be imported
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.main import app
from app.config import settings
from app.db.session import get_db
from app.db.models import TestReport

# API key for auth headers
HEADERS = {"Authorization": f"Bearer {settings.API_KEY}"}

@pytest_asyncio.fixture(autouse=True)
async def setup_db():
    from app.db.session import init_db
    await init_db()

@pytest.mark.asyncio
async def test_api_authentication_enforcement():
    """Verify that all main routes are secured with Bearer token authentication."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Get projects
        r1 = await ac.get("/api/projects")
        assert r1.status_code == 401
        
        # Get reports
        r2 = await ac.get("/api/projects/Project Pegasus/reports")
        assert r2.status_code == 401
        
        # Get forecast
        r3 = await ac.get("/api/projects/Project Pegasus/forecast")
        assert r3.status_code == 401
        
        # Post report
        r4 = await ac.post("/api/reports", json={})
        assert r4.status_code == 401
        
        # Post CSV upload
        r5 = await ac.post("/api/projects/Project Pegasus/upload-csv")
        assert r5.status_code == 401
        
        # Admin seed
        r6 = await ac.post("/api/admin/seed-sample-data")
        assert r6.status_code == 401


@pytest.mark.asyncio
async def test_authenticated_calls_succeed():
    """Verify that authenticated requests succeed with correct header."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Seed
        seed_r = await ac.post("/api/admin/seed-sample-data", headers=HEADERS)
        assert seed_r.status_code == 200
        
        # Get projects
        r1 = await ac.get("/api/projects", headers=HEADERS)
        assert r1.status_code == 200
        assert "Project Pegasus" in r1.json()


@pytest.mark.asyncio
async def test_csv_upload_endpoint():
    """Test CSV ingestion via POST /api/projects/{project_name}/upload-csv."""
    # Build a minimal CSV
    csv_data = (
        "storyTests,regressionTestsAutomated,regressionTestsManual,storyPassed,storyFailed,storyBugs,createdAt\n"
        "10,20,30,8,2,1,2026-05-01T00:00:00\n"
        "12,22,32,9,3,2,2026-05-08T00:00:00\n"
    )
    
    file_payload = {"file": ("test_reports.csv", io.BytesIO(csv_data.encode("utf-8")), "text/csv")}
    
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Seed first
        await ac.post("/api/admin/seed-sample-data", headers=HEADERS)
        
        # Upload
        response = await ac.post(
            "/api/projects/Project CSV Upload/upload-csv", 
            files=file_payload,
            headers=HEADERS
        )
        
    assert response.status_code == 200
    res_data = response.json()
    assert res_data["status"] == "success"
    assert res_data["rowsImported"] == 2
    assert res_data["projectName"] == "Project CSV Upload"


@pytest.mark.asyncio
async def test_csv_upload_validation_fails():
    """Verify CSV validation errors when columns are missing."""
    invalid_csv = (
        "storyTests,regressionTestsAutomated\n"
        "10,20\n"
    )
    file_payload = {"file": ("invalid.csv", io.BytesIO(invalid_csv.encode("utf-8")), "text/csv")}
    
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.post(
            "/api/projects/Project CSV Fail/upload-csv", 
            files=file_payload,
            headers=HEADERS
        )
        
    assert response.status_code == 400
    assert "Missing required CSV column" in response.json()["detail"]
