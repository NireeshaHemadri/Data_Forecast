from sqlalchemy import Column, Integer, String, DateTime, func
from app.db.session import Base

class TestReport(Base):
    __tablename__ = "test_reports"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    projectName = Column(String, nullable=False, index=True)
    authors = Column(String, default="", nullable=True)
    storyTests = Column(Integer, nullable=False, default=0)
    regressionTestsAutomated = Column(Integer, nullable=False, default=0)
    regressionTestsManual = Column(Integer, nullable=False, default=0)
    totalTestsByApplication = Column(Integer, nullable=False, default=0)

    # Story Test Results
    storyPassed = Column(Integer, nullable=False, default=0)
    storyFailed = Column(Integer, nullable=False, default=0)
    storyUnexecuted = Column(Integer, nullable=False, default=0)
    storyBlocked = Column(Integer, nullable=False, default=0)
    storySkipped = Column(Integer, nullable=False, default=0)
    storyCritical = Column(Integer, nullable=False, default=0)
    storyNew = Column(Integer, nullable=False, default=0)
    storyUnused = Column(Integer, nullable=False, default=0)
    storyBugs = Column(Integer, nullable=False, default=0)

    # Automation Test Results (AR)
    arPassed = Column(Integer, nullable=False, default=0)
    arFailed = Column(Integer, nullable=False, default=0)
    arUnexecuted = Column(Integer, nullable=False, default=0)
    arBlocked = Column(Integer, nullable=False, default=0)
    arSkipped = Column(Integer, nullable=False, default=0)
    arCritical = Column(Integer, nullable=False, default=0)
    arNew = Column(Integer, nullable=False, default=0)
    arUnused = Column(Integer, nullable=False, default=0)
    arBugs = Column(Integer, nullable=False, default=0)

    # Manual Regression Test Results (MR)
    mrPassed = Column(Integer, nullable=False, default=0)
    mrFailed = Column(Integer, nullable=False, default=0)
    mrUnexecuted = Column(Integer, nullable=False, default=0)
    mrBlocked = Column(Integer, nullable=False, default=0)
    mrSkipped = Column(Integer, nullable=False, default=0)
    mrCritical = Column(Integer, nullable=False, default=0)
    mrNew = Column(Integer, nullable=False, default=0)
    mrUnused = Column(Integer, nullable=False, default=0)
    mrBugs = Column(Integer, nullable=False, default=0)

    createdAt = Column(DateTime(timezone=True), default=func.now(), nullable=False)
