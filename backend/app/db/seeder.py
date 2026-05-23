import random
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.db.models import TestReport

async def seed_project_data(db: AsyncSession, project_name: str, weeks: int = 52) -> int:
    """
    Seeds a project with historical weekly test reports.
    Returns the number of records created.
    """
    # Check if we already have records for this project
    result = await db.execute(select(TestReport).filter(TestReport.projectName == project_name))
    existing = result.scalars().all()
    if existing:
        print(f"Project '{project_name}' already has {len(existing)} records. Skipping seed.")
        return 0

    print(f"Seeding {weeks} weeks of data for '{project_name}'...")
    
    start_date = datetime.now() - timedelta(weeks=weeks)
    
    # Establish base profiles
    if project_name == "Project Pegasus":
        # Enterprise project profile: transitioning manual to automation
        base_story_tests = 50
        base_reg_manual = 200
        base_reg_auto = 80
        bugs_factor = 1.0
    else:
        # Startup project profile: rapid sprint cycles, high story churn
        base_story_tests = 90
        base_reg_manual = 60
        base_reg_auto = 40
        bugs_factor = 1.4

    reports = []
    
    for w in range(weeks):
        week_date = start_date + timedelta(weeks=w)
        
        # Apply trends over time
        if project_name == "Project Pegasus":
            # Growth in automation, decrease in manual, slight growth in stories
            story_tests = int(base_story_tests + w * 0.4 + random.randint(-10, 10))
            reg_manual = max(30, int(base_reg_manual - w * 2.8 + random.randint(-15, 15)))
            reg_auto = int(base_reg_auto + w * 3.5 + random.randint(-10, 10))
        else:
            # Volatile story tests (sprints), moderate manual and slow auto growth
            sprint_cycle = math_sin_wave(w, period=4)  # cyclical sprint
            story_tests = int(base_story_tests + sprint_cycle * 25 + random.randint(-15, 15))
            reg_manual = int(base_reg_manual + w * 0.3 + random.randint(-5, 5))
            reg_auto = int(base_reg_auto + w * 0.8 + random.randint(-5, 5))
            
        story_tests = max(5, story_tests)
        reg_manual = max(5, reg_manual)
        reg_auto = max(5, reg_auto)
        
        total_tests = story_tests + reg_manual + reg_auto
        
        # Outcomes: Story Tests
        # Cyclical or seasonal quality spikes (bugs peak occasionally)
        bug_wave = math_sin_wave(w, period=8) if project_name == "Project Pegasus" else math_sin_wave(w, period=4)
        bug_chance = max(0.02, 0.08 + bug_wave * 0.05 + (random.random() - 0.5) * 0.04)
        
        story_bugs = int(story_tests * bug_chance * bugs_factor)
        story_failed = story_bugs  # simplify failed matches bug count or close to it
        story_blocked = int(story_tests * 0.02 + random.randint(0, 2))
        story_skipped = int(story_tests * 0.03 + random.randint(0, 3))
        story_passed = max(0, story_tests - (story_failed + story_blocked + story_skipped))
        story_unexecuted = 0
        story_critical = int(story_bugs * 0.2)
        story_new = int(story_tests * 0.15)
        story_unused = 0
        
        # Outcomes: Automation Regression Tests (AR)
        # AR pass rate starts lower and improves with script maturity
        ar_pass_rate = 0.85 + (w / weeks) * 0.11 + (random.random() * 0.03)  # climbs to 96-99%
        ar_pass_rate = min(0.99, ar_pass_rate)
        
        ar_passed = int(reg_auto * ar_pass_rate)
        ar_failed = reg_auto - ar_passed
        ar_bugs = int(ar_failed * 0.7)
        ar_unexecuted = 0
        ar_blocked = int(reg_auto * 0.01)
        ar_skipped = int(reg_auto * 0.02)
        ar_critical = int(ar_bugs * 0.25)
        ar_new = int(reg_auto * 0.05)
        ar_unused = 0
        
        # Outcomes: Manual Regression Tests (MR)
        # MR pass rate is generally higher but constant
        mr_pass_rate = 0.92 + (random.random() * 0.05)
        mr_passed = int(reg_manual * mr_pass_rate)
        mr_failed = reg_manual - mr_passed
        mr_bugs = int(mr_failed * 0.6)
        mr_unexecuted = int(reg_manual * 0.03)
        mr_blocked = int(reg_manual * 0.02)
        mr_skipped = int(reg_manual * 0.01)
        mr_critical = int(mr_bugs * 0.1)
        mr_new = int(reg_manual * 0.04)
        mr_unused = 0

        # Adjust totals to make sure we match
        report = TestReport(
            projectName=project_name,
            authors="QA Team Pegasus" if project_name == "Project Pegasus" else "Agile QA Orion",
            storyTests=story_tests,
            regressionTestsAutomated=reg_auto,
            regressionTestsManual=reg_manual,
            totalTestsByApplication=total_tests,
            
            # Story Results
            storyPassed=story_passed,
            storyFailed=story_failed,
            storyUnexecuted=story_unexecuted,
            storyBlocked=story_blocked,
            storySkipped=story_skipped,
            storyCritical=story_critical,
            storyNew=story_new,
            storyUnused=story_unused,
            storyBugs=story_bugs,
            
            # AR Results
            arPassed=ar_passed,
            arFailed=ar_failed,
            arUnexecuted=ar_unexecuted,
            arBlocked=ar_blocked,
            arSkipped=ar_skipped,
            arCritical=ar_critical,
            arNew=ar_new,
            arUnused=ar_unused,
            arBugs=ar_bugs,
            
            # MR Results
            mrPassed=mr_passed,
            mrFailed=mr_failed,
            mrUnexecuted=mr_unexecuted,
            mrBlocked=mr_blocked,
            mrSkipped=mr_skipped,
            mrCritical=mr_critical,
            mrNew=mr_new,
            mrUnused=mr_unused,
            mrBugs=mr_bugs,
            
            createdAt=week_date
        )
        reports.append(report)
        
    db.add_all(reports)
    await db.commit()
    print(f"Successfully seeded {weeks} reports for {project_name}.")
    return weeks

def math_sin_wave(week_index: int, period: int = 4) -> float:
    """Helper to generate a sinusoidal wave for trend modeling."""
    import math
    return math.sin(2 * math.pi * week_index / period)

async def seed_all(db: AsyncSession) -> None:
    """Seeds default projects."""
    total_seeded = 0
    total_seeded += await seed_project_data(db, "Project Pegasus", weeks=52)
    total_seeded += await seed_project_data(db, "Project Orion", weeks=52)
    if total_seeded > 0:
        print(f"Total seeded database records: {total_seeded}")
    else:
        print("Database already seeded.")
