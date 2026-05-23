import os
# Force SQLite database usage for testing to avoid contaminating production DB
os.environ["USE_SQLITE"] = "true"

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
import sys

# Add parent directory to path so app can be imported
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.main import app
from app.config import settings

@pytest_asyncio.fixture(autouse=True)
async def setup_db():
    from app.db.session import init_db
    await init_db()

@pytest.mark.asyncio
async def test_root():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/")
    assert response.status_code == 200
    assert response.json()["status"] == "online"

@pytest.mark.asyncio
async def test_seed_and_get_projects():
    headers = {"Authorization": f"Bearer {settings.API_KEY}"}
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Trigger seeding
        seed_response = await ac.post("/api/seed")
        print("SEED RESPONSE TEXT:", seed_response.status_code, seed_response.text)
        assert seed_response.status_code == 200
        
        # Get projects
        proj_response = await ac.get("/api/projects", headers=headers)
        assert proj_response.status_code == 200
        projects = proj_response.json()
        assert "Project Pegasus" in projects
        assert "Project Orion" in projects

@pytest.mark.asyncio
async def test_get_project_reports():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/api/reports/Project Pegasus")
    assert response.status_code == 200
    reports = response.json()
    assert len(reports) > 0
    assert reports[0]["projectName"] == "Project Pegasus"

@pytest.mark.asyncio
async def test_get_forecast():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/api/forecast/Project Pegasus")
    print("FORECAST RESPONSE TEXT:", response.status_code, response.text)
    assert response.status_code == 200
    forecast_data = response.json()
    assert forecast_data["projectName"] == "Project Pegasus"
    assert "forecast" in forecast_data
    assert len(forecast_data["forecast"]) == 4
    assert "explanations" in forecast_data
    assert "storyBugs" in forecast_data["explanations"]

@pytest.mark.asyncio
async def test_create_report():
    report_payload = {
        "projectName": "Project Test-Run",
        "authors": "Test Suite",
        "storyTests": 10,
        "regressionTestsAutomated": 20,
        "regressionTestsManual": 30,
        "totalTestsByApplication": 60,
        
        "storyPassed": 8,
        "storyFailed": 1,
        "storyUnexecuted": 0,
        "storyBlocked": 1,
        "storySkipped": 0,
        "storyCritical": 0,
        "storyNew": 2,
        "storyUnused": 0,
        "storyBugs": 1,
        
        "arPassed": 18,
        "arFailed": 2,
        "arUnexecuted": 0,
        "arBlocked": 0,
        "arSkipped": 0,
        "arCritical": 0,
        "arNew": 1,
        "arUnused": 0,
        "arBugs": 2,
        
        "mrPassed": 25,
        "mrFailed": 3,
        "mrUnexecuted": 2,
        "mrBlocked": 0,
        "mrSkipped": 0,
        "mrCritical": 0,
        "mrNew": 0,
        "mrUnused": 0,
        "mrBugs": 3
    }
    
    headers = {"Authorization": f"Bearer {settings.API_KEY}"}
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.post("/api/reports", json=report_payload, headers=headers)
    assert response.status_code == 201
    created_report = response.json()
    assert created_report["projectName"] == "Project Test-Run"
    assert created_report["storyTests"] == 10
