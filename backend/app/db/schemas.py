from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List, Dict, Any

class TestReportBase(BaseModel):
    projectName: str = Field(..., example="Project Pegasus")
    authors: Optional[str] = Field("", example="Sarah Connor, John Doe")
    storyTests: int = Field(0, ge=0)
    regressionTestsAutomated: int = Field(0, ge=0)
    regressionTestsManual: int = Field(0, ge=0)
    totalTestsByApplication: int = Field(0, ge=0)

    # Story Test Results
    storyPassed: int = Field(0, ge=0)
    storyFailed: int = Field(0, ge=0)
    storyUnexecuted: int = Field(0, ge=0)
    storyBlocked: int = Field(0, ge=0)
    storySkipped: int = Field(0, ge=0)
    storyCritical: int = Field(0, ge=0)
    storyNew: int = Field(0, ge=0)
    storyUnused: int = Field(0, ge=0)
    storyBugs: int = Field(0, ge=0)

    # Automation Test Results (AR)
    arPassed: int = Field(0, ge=0)
    arFailed: int = Field(0, ge=0)
    arUnexecuted: int = Field(0, ge=0)
    arBlocked: int = Field(0, ge=0)
    arSkipped: int = Field(0, ge=0)
    arCritical: int = Field(0, ge=0)
    arNew: int = Field(0, ge=0)
    arUnused: int = Field(0, ge=0)
    arBugs: int = Field(0, ge=0)

    # Manual Regression Test Results (MR)
    mrPassed: int = Field(0, ge=0)
    mrFailed: int = Field(0, ge=0)
    mrUnexecuted: int = Field(0, ge=0)
    mrBlocked: int = Field(0, ge=0)
    mrSkipped: int = Field(0, ge=0)
    mrCritical: int = Field(0, ge=0)
    mrNew: int = Field(0, ge=0)
    mrUnused: int = Field(0, ge=0)
    mrBugs: int = Field(0, ge=0)

class TestReportCreate(TestReportBase):
    pass

class TestReportInDB(TestReportBase):
    id: int
    createdAt: datetime

    class Config:
        from_attributes = True

class ForecastDataPoint(BaseModel):
    weekIndex: int  # 1 to 4 for forecasted weeks
    storyTests: float
    regressionTestsAutomated: float
    regressionTestsManual: float
    totalTestsByApplication: float
    storyBugs: float
    arBugs: float
    mrBugs: float
    totalBugs: float
    storyPassed: float
    arPassed: float
    mrPassed: float
    storyFailed: float
    arFailed: float
    mrFailed: float
    createdAt: datetime
    
    # Confidence metrics
    bugsErrorMargin: float
    bugsConfidence: float

class ModelMetrics(BaseModel):
    mae: float  # Mean Absolute Error
    r2: float   # R-squared
    dataPointsCount: int

class SHAPFeatureImpact(BaseModel):
    featureName: str
    featureValue: float
    shapValue: float
    description: str

class SHAPExplanation(BaseModel):
    targetMetric: str
    baseValue: float
    predictionValue: float
    features: List[SHAPFeatureImpact]

class ProjectForecastResponse(BaseModel):
    projectName: str
    historical: List[TestReportInDB]
    forecast: List[ForecastDataPoint]
    metrics: Dict[str, ModelMetrics]
    explanations: Dict[str, SHAPExplanation]
    modelType: str  # e.g., "Random Forest Regressor (Auto-regressive)" or "Baseline Trend"
    message: Optional[str] = None
    
    # Model metadata
    lastTrained: str
    trainingSamples: int
    forecastHorizon: int = 4

class CSVUploadResponse(BaseModel):
    status: str
    message: str
    rowsImported: int
    projectName: str

class RetrainResponse(BaseModel):
    status: str
    message: str
    projectName: str
    lastTrained: str
    trainingSamples: int
    metrics: Dict[str, ModelMetrics]
