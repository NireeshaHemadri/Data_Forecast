import os
# Force SQLite database usage for testing to avoid contaminating production DB
os.environ["USE_SQLITE"] = "true"

import pytest
import pytest_asyncio
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from httpx import AsyncClient, ASGITransport
import sys

# Add parent directory to path so app can be imported
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.main import app
from app.config import settings
from app.ml.forecaster import preprocess_dataset, engineer_features, train_and_evaluate, make_predictions
from app.db.models import TestReport

# API key for auth headers
HEADERS = {"Authorization": f"Bearer {settings.API_KEY}"}

@pytest_asyncio.fixture(autouse=True)
async def setup_db():
    from app.db.session import init_db
    await init_db()

def test_preprocessing_pipeline():
    """Test explicit preprocessing pipeline in forecaster.py (imputation, outlier clipping, scaling)."""
    # Create test dataframe with missing values and outliers
    data = []
    base_date = datetime.now()
    
    # Target columns to test
    TARGET_COLUMNS = [
        "storyTests", "regressionTestsAutomated", "regressionTestsManual",
        "storyPassed", "storyFailed", "storyBlocked", "storySkipped", "storyBugs",
        "arPassed", "arFailed", "arBlocked", "arSkipped", "arBugs",
        "mrPassed", "mrFailed", "mrBlocked", "mrSkipped", "mrBugs"
    ]
    
    for i in range(12):
        row = {col: 10.0 for col in TARGET_COLUMNS}
        row["projectName"] = "TestProject"
        row["createdAt"] = base_date + timedelta(weeks=i)
        data.append(row)
        
    df = pd.DataFrame(data)
    
    # Introduce NaN
    df.loc[5, "storyBugs"] = np.nan
    # Introduce outlier (100 times normal value)
    df.loc[8, "storyBugs"] = 1000.0
    
    df_clean, stats = preprocess_dataset(df)
    
    # Check that imputation filled the NaN
    assert not df_clean["storyBugs"].isna().any()
    assert stats["imputed_missing_values"] == 1
    
    # Check that outlier clipping bounded the extreme outlier
    assert df_clean.loc[8, "storyBugs"] < 1000.0
    assert "storyBugs" in stats["clipped_outliers"]
    assert stats["clipped_outliers"]["storyBugs"] == 1


def test_feature_engineering_and_training():
    """Test feature engineering, lag creation, and model training."""
    data = []
    base_date = datetime.now()
    
    for i in range(15):
        row = {
            "storyBugs": float(10 + i % 3),
            "createdAt": base_date + timedelta(weeks=i)
        }
        data.append(row)
        
    df = pd.DataFrame(data)
    X, y = engineer_features(df, "storyBugs")
    
    # Check features are created
    assert "lag_1" in X.columns
    assert "lag_2" in X.columns
    assert "lag_3" in X.columns
    assert "rolling_mean_3" in X.columns
    assert "rolling_std_3" in X.columns
    assert "week_of_year" in X.columns
    
    # Check that length is reduced by 3 (lags)
    assert len(X) == len(df) - 3
    
    # Train model
    model, mae, r2 = train_and_evaluate(X, y)
    assert model is not None
    assert isinstance(mae, float)
    assert isinstance(r2, float)


@pytest.mark.asyncio
async def test_retrain_endpoint():
    """Test manual model retraining endpoint POST /api/projects/{project_name}/train."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Seed first
        await ac.post("/api/admin/seed-sample-data", headers=HEADERS)
        
        # Test training endpoint
        response = await ac.post("/api/projects/Project Pegasus/train", headers=HEADERS)
        
    assert response.status_code == 200
    res_data = response.json()
    assert res_data["status"] == "success"
    assert res_data["projectName"] == "Project Pegasus"
    assert "lastTrained" in res_data
    assert res_data["trainingSamples"] >= 10
    assert "metrics" in res_data
    assert "storyBugs" in res_data["metrics"]
    assert "mae" in res_data["metrics"]["storyBugs"]
    assert "r2" in res_data["metrics"]["storyBugs"]


@pytest.mark.asyncio
async def test_retrain_endpoint_unauthorized():
    """Test manual model retraining endpoint fails with 401 without auth headers."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.post("/api/projects/Project Pegasus/train")
    assert response.status_code == 401
