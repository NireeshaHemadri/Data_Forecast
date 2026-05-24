import io
import pandas as pd
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func

from app.config import settings
from app.db.session import get_db
from app.db.models import TestReport
from app.db.schemas import (
    TestReportCreate, TestReportInDB, ProjectForecastResponse,
    CSVUploadResponse, RetrainResponse
)
from app.db.seeder import seed_all
from app.ml.forecaster import make_predictions

router = APIRouter()
security = HTTPBearer()

async def get_api_key(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    """Validate Bearer API key for secured endpoints."""
    if credentials.credentials != settings.API_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing API authorization token."
        )
    return credentials.credentials

@router.get("/projects", response_model=List[str])
async def get_projects(
    db: AsyncSession = Depends(get_db),
    api_key: str = Depends(get_api_key)
):
    """Fetch unique project names from the database."""
    try:
        result = await db.execute(select(TestReport.projectName).distinct())
        projects = [row[0] for row in result.all()]
        return projects
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}"
        )

@router.get("/projects/{project_name}/reports", response_model=List[TestReportInDB])
async def get_project_reports(
    project_name: str, 
    db: AsyncSession = Depends(get_db),
    api_key: str = Depends(get_api_key)
):
    """Fetch historical test reports for a specific project sorted by creation date."""
    try:
        result = await db.execute(
            select(TestReport)
            .filter(TestReport.projectName == project_name)
            .order_by(TestReport.createdAt.asc())
        )
        reports = result.scalars().all()
        return reports
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}"
        )

@router.post("/reports", response_model=TestReportInDB, status_code=status.HTTP_201_CREATED)
async def create_test_report(
    report_in: TestReportCreate, 
    db: AsyncSession = Depends(get_db),
    api_key: str = Depends(get_api_key)
):
    """Submit a new weekly test report and trigger model updates."""
    try:
        # Calculate total tests dynamically to verify consistency
        computed_total = report_in.storyTests + report_in.regressionTestsAutomated + report_in.regressionTestsManual
        total_tests = max(report_in.totalTestsByApplication, computed_total)
        
        db_report = TestReport(
            projectName=report_in.projectName,
            authors=report_in.authors,
            storyTests=report_in.storyTests,
            regressionTestsAutomated=report_in.regressionTestsAutomated,
            regressionTestsManual=report_in.regressionTestsManual,
            totalTestsByApplication=total_tests,
            
            # Story Results
            storyPassed=report_in.storyPassed,
            storyFailed=report_in.storyFailed,
            storyUnexecuted=report_in.storyUnexecuted,
            storyBlocked=report_in.storyBlocked,
            storySkipped=report_in.storySkipped,
            storyCritical=report_in.storyCritical,
            storyNew=report_in.storyNew,
            storyUnused=report_in.storyUnused,
            storyBugs=report_in.storyBugs,
            
            # AR Results
            arPassed=report_in.arPassed,
            arFailed=report_in.arFailed,
            arUnexecuted=report_in.arUnexecuted,
            arBlocked=report_in.arBlocked,
            arSkipped=report_in.arSkipped,
            arCritical=report_in.arCritical,
            arNew=report_in.arNew,
            arUnused=report_in.arUnused,
            arBugs=report_in.arBugs,
            
            # MR Results
            mrPassed=report_in.mrPassed,
            mrFailed=report_in.mrFailed,
            mrUnexecuted=report_in.mrUnexecuted,
            mrBlocked=report_in.mrBlocked,
            mrSkipped=report_in.mrSkipped,
            mrCritical=report_in.mrCritical,
            mrNew=report_in.mrNew,
            mrUnused=report_in.mrUnused,
            mrBugs=report_in.mrBugs
        )
        
        db.add(db_report)
        await db.commit()
        await db.refresh(db_report)
        return db_report
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error saving report: {str(e)}"
        )

@router.get("/projects/{project_name}/forecast", response_model=ProjectForecastResponse)
async def get_project_forecast(
    project_name: str, 
    db: AsyncSession = Depends(get_db),
    api_key: str = Depends(get_api_key)
):
    """
    Fetch 4-week forecast metrics for a specific project.
    Uses run_in_threadpool to run ML model training non-blockingly.
    """
    try:
        # Retrieve all historical records sorted by createdAt
        result = await db.execute(
            select(TestReport)
            .filter(TestReport.projectName == project_name)
            .order_by(TestReport.createdAt.asc())
        )
        reports = result.scalars().all()
        
        if not reports:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No historical reports found for project '{project_name}'"
            )
            
        # Run ML engine training/forecasting inside threadpool to prevent event loop blocking
        forecast_payload = await run_in_threadpool(make_predictions, reports)
        return forecast_payload
    except HTTPException as he:
        raise he
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating forecast model: {str(e)}"
        )

@router.post("/projects/{project_name}/train", response_model=RetrainResponse)
async def retrain_project_model(
    project_name: str,
    db: AsyncSession = Depends(get_db),
    api_key: str = Depends(get_api_key)
):
    """Manually trigger model retraining and output performance stats."""
    try:
        result = await db.execute(
            select(TestReport)
            .filter(TestReport.projectName == project_name)
            .order_by(TestReport.createdAt.asc())
        )
        reports = result.scalars().all()
        
        if not reports:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No historical reports found for project '{project_name}'"
            )
            
        forecast_payload = await run_in_threadpool(make_predictions, reports)
        
        return {
            "status": "success",
            "message": "Model retrained successfully.",
            "projectName": project_name,
            "lastTrained": forecast_payload["lastTrained"],
            "trainingSamples": forecast_payload["trainingSamples"],
            "metrics": forecast_payload["metrics"]
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retraining model: {str(e)}"
        )

@router.post("/projects/{project_name}/upload-csv", response_model=CSVUploadResponse)
async def upload_csv_file(
    project_name: str, 
    file: UploadFile = File(...), 
    db: AsyncSession = Depends(get_db),
    api_key: str = Depends(get_api_key)
):
    """Ingest weekly reports from a CSV file."""
    try:
        contents = await file.read()
        df = pd.read_csv(io.BytesIO(contents))
        
        required_cols = ["storyTests", "regressionTestsAutomated", "regressionTestsManual", "storyPassed", "storyFailed", "storyBugs"]
        for c in required_cols:
            if c not in df.columns:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Missing required CSV column: {c}"
                )
                
        imported_count = 0
        for _, row in df.iterrows():
            authors = str(row.get("authors", "CSV Import"))
            story_tests = int(row.get("storyTests", 0))
            reg_auto = int(row.get("regressionTestsAutomated", 0))
            reg_manual = int(row.get("regressionTestsManual", 0))
            total_tests = int(row.get("totalTestsByApplication", story_tests + reg_auto + reg_manual))
            
            created_at = row.get("createdAt", None)
            parsed_created_at = pd.to_datetime(created_at).to_pydatetime() if pd.notna(created_at) else func.now()
            
            db_report = TestReport(
                projectName=project_name,
                authors=authors,
                storyTests=story_tests,
                regressionTestsAutomated=reg_auto,
                regressionTestsManual=reg_manual,
                totalTestsByApplication=total_tests,
                
                # Story
                storyPassed=int(row.get("storyPassed", 0)),
                storyFailed=int(row.get("storyFailed", 0)),
                storyUnexecuted=int(row.get("storyUnexecuted", 0)),
                storyBlocked=int(row.get("storyBlocked", 0)),
                storySkipped=int(row.get("storySkipped", 0)),
                storyCritical=int(row.get("storyCritical", 0)),
                storyNew=int(row.get("storyNew", 0)),
                storyUnused=int(row.get("storyUnused", 0)),
                storyBugs=int(row.get("storyBugs", 0)),
                
                # AR
                arPassed=int(row.get("arPassed", 0)),
                arFailed=int(row.get("arFailed", 0)),
                arUnexecuted=int(row.get("arUnexecuted", 0)),
                arBlocked=int(row.get("arBlocked", 0)),
                arSkipped=int(row.get("arSkipped", 0)),
                arCritical=int(row.get("arCritical", 0)),
                arNew=int(row.get("arNew", 0)),
                arUnused=int(row.get("arUnused", 0)),
                arBugs=int(row.get("arBugs", 0)),
                
                # MR
                mrPassed=int(row.get("mrPassed", 0)),
                mrFailed=int(row.get("mrFailed", 0)),
                mrUnexecuted=int(row.get("mrUnexecuted", 0)),
                mrBlocked=int(row.get("mrBlocked", 0)),
                mrSkipped=int(row.get("mrSkipped", 0)),
                mrCritical=int(row.get("mrCritical", 0)),
                mrNew=int(row.get("mrNew", 0)),
                mrUnused=int(row.get("mrUnused", 0)),
                mrBugs=int(row.get("mrBugs", 0)),
                
                createdAt=parsed_created_at
            )
            db.add(db_report)
            imported_count += 1
            
        await db.commit()
        return {
            "status": "success",
            "message": f"Successfully imported {imported_count} weekly reports.",
            "rowsImported": imported_count,
            "projectName": project_name
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"CSV processing failed: {str(e)}"
        )

@router.post("/upload-csv", response_model=CSVUploadResponse)
async def upload_csv_global(
    project_name: Optional[str] = None,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    api_key: str = Depends(get_api_key)
):
    """Global endpoint to upload a CSV dataset."""
    actual_project = project_name or "Project Pegasus"
    return await upload_csv_file(project_name=actual_project, file=file, db=db, api_key=api_key)

@router.post("/admin/seed-sample-data", status_code=status.HTTP_200_OK)
async def trigger_seeding(
    db: AsyncSession = Depends(get_db),
    api_key: str = Depends(get_api_key)
):
    """Manually trigger data seeding for Project Pegasus and Project Orion."""
    try:
        from app.db.models import TestReport
        from sqlalchemy.future import select
        # Check if project data exists before seeding
        result = await db.execute(select(TestReport).filter(TestReport.projectName == "Project Pegasus"))
        existing = result.scalars().first()
        
        await seed_all(db)
        
        if existing:
            return {"status": "success", "message": "Demo dataset already loaded"}
        else:
            return {"status": "success", "message": "Fresh demo dataset loaded"}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error seeding database: {str(e)}"
        )

# Deprecated/compatibility endpoints to prevent sudden breakages
@router.post("/seed", status_code=status.HTTP_200_OK, include_in_schema=False)
async def deprecated_seed(db: AsyncSession = Depends(get_db)):
    try:
        await seed_all(db)
        return {"status": "success", "message": "Database seed completed successfully (deprecated endpoint)."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/reports/{project_name}", response_model=List[TestReportInDB], include_in_schema=False)
async def deprecated_get_reports(project_name: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(TestReport).filter(TestReport.projectName == project_name).order_by(TestReport.createdAt.asc()))
    return result.scalars().all()

@router.get("/forecast/{project_name}", response_model=ProjectForecastResponse, include_in_schema=False)
async def deprecated_forecast(project_name: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(TestReport).filter(TestReport.projectName == project_name).order_by(TestReport.createdAt.asc()))
    reports = result.scalars().all()
    if not reports:
        raise HTTPException(status_code=404, detail="Not Found")
    return await run_in_threadpool(make_predictions, reports)
