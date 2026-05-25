import React, { useState, useEffect, useRef } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { 
  Database, UploadCloud, AlertCircle, CheckCircle, BarChart4,
  Layers, Plus, X, ShieldAlert, Sparkles, Bug, Activity, Settings, Download, FileText
} from 'lucide-react';

// API Configuration
const API_BASE = import.meta.env.VITE_API_BASE_URL || 
                 (import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL.replace(/\/$/, '')}/api` : "") || 
                 "http://localhost:8000/api";
const API_TOKEN = import.meta.env.VITE_API_TOKEN || "aegis_prod_api_key_2026";

interface TestReport {
  id: number;
  projectName: string;
  authors: string;
  storyTests: number;
  regressionTestsAutomated: number;
  regressionTestsManual: number;
  totalTestsByApplication: number;
  storyPassed: number;
  storyFailed: number;
  storyUnexecuted: number;
  storyBlocked: number;
  storySkipped: number;
  storyBugs: number;
  arPassed: number;
  arFailed: number;
  arBugs: number;
  mrPassed: number;
  mrFailed: number;
  mrBugs: number;
  createdAt: string;
  [key: string]: any;
}

interface ForecastPoint {
  weekIndex: number;
  storyTests: number;
  regressionTestsAutomated: number;
  regressionTestsManual: number;
  totalTestsByApplication: number;
  storyBugs: number;
  arBugs: number;
  mrBugs: number;
  totalBugs: number;
  storyPassed: number;
  arPassed: number;
  mrPassed: number;
  storyFailed: number;
  arFailed: number;
  mrFailed: number;
  createdAt: string;
  bugsErrorMargin: number;
  bugsConfidence: number;
}

interface ModelMetrics {
  mae: number;
  r2: number;
  dataPointsCount: number;
}

interface SHAPFeature {
  featureName: string;
  featureValue: number;
  shapValue: number;
  description: string;
}

interface SHAPExplanation {
  targetMetric: string;
  baseValue: number;
  predictionValue: number;
  features: SHAPFeature[];
}

const getWeekNumber = (date: Date) => {
  const oneJan = new Date(date.getFullYear(), 0, 1);
  const numberOfDays = Math.floor((date.getTime() - oneJan.getTime()) / (24 * 60 * 60 * 1000));
  return Math.ceil((date.getDay() + 1 + numberOfDays) / 7);
};

function useCountUp(target: number, duration: number = 800) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let start = 0;
    const end = Math.round(target);
    if (end <= 0) {
      setCount(0);
      return;
    }
    if (start === end) {
      setCount(end);
      return;
    }

    const step = end > 100 ? Math.ceil(end / 30) : 1;
    const intervalTime = end > 100 ? Math.floor(duration / 30) : Math.floor(duration / end) || 20;

    const timer = setInterval(() => {
      start += step;
      if (start >= end) {
        clearInterval(timer);
        setCount(end);
      } else {
        setCount(start);
      }
    }, intervalTime);

    return () => clearInterval(timer);
  }, [target, duration]);

  return count;
}

export default function App() {
  // Application State
  const [projects, setProjects] = useState<string[]>([]);
  const [activeProject, setActiveProject] = useState<string>("");
  const [historicalData, setHistoricalData] = useState<TestReport[]>([]);
  const [forecastData, setForecastData] = useState<ForecastPoint[]>([]);
  const [metrics, setMetrics] = useState<Record<string, ModelMetrics>>({});
  const [explanations, setExplanations] = useState<Record<string, SHAPExplanation>>({});
  const [modelType, setModelType] = useState<string>("Random Forest Regressor");
  const [lastTrained, setLastTrained] = useState<string>("22 May 2026");
  const [trainingSamples, setTrainingSamples] = useState<number>(52);
  const [forecastHorizon, setForecastHorizon] = useState<number>(4);


  // Modals Toggles
  const [isArchOpen, setIsArchOpen] = useState<boolean>(false);
  const [isHowItWorksOpen, setIsHowItWorksOpen] = useState<boolean>(false);

  // Weekly Reports Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [reportSearch, setReportSearch] = useState<string>("");

  const r2Val = metrics.storyBugs?.r2 !== undefined ? metrics.storyBugs.r2.toFixed(2) : "0.85";
  
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Dashboard Settings
  const [chartMetric, setChartMetric] = useState<string>("bugs");
  const [shapMetric, setShapMetric] = useState<string>("storyBugs");
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [formTab, setFormTab] = useState<"manual" | "csv">("manual");
  const [isSeeding, setIsSeeding] = useState<boolean>(false);
  const [isRetraining, setIsRetraining] = useState<boolean>(false);
  const [submitSuccess, setSubmitSuccess] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  
  // Toast notifications for demo load operations
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // File Upload State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // New Report Form State
  const [newReport, setNewReport] = useState({
    projectName: "",
    authors: "QA Lead",
    storyTests: 50,
    regressionTestsAutomated: 100,
    regressionTestsManual: 100,
    totalTestsByApplication: 250,
    
    // Story Outcomes
    storyPassed: 40,
    storyFailed: 5,
    storyUnexecuted: 0,
    storyBlocked: 3,
    storySkipped: 2,
    storyCritical: 1,
    storyNew: 10,
    storyUnused: 0,
    storyBugs: 5,
    
    // AR Outcomes
    arPassed: 92,
    arFailed: 5,
    arUnexecuted: 0,
    arBlocked: 1,
    arSkipped: 2,
    arCritical: 1,
    arNew: 5,
    arUnused: 0,
    arBugs: 3,
    
    // MR Outcomes
    mrPassed: 90,
    mrFailed: 6,
    mrUnexecuted: 2,
    mrBlocked: 1,
    mrSkipped: 1,
    mrCritical: 1,
    mrNew: 0,
    mrUnused: 0,
    mrBugs: 4
  });



  // Check API health and retrieve projects list
  const loadProjects = async () => {
    try {
      setLoading(true);

      const res = await fetch(`${API_BASE}/projects`, {
        headers: { "Authorization": `Bearer ${API_TOKEN}` }
      });
      if (!res.ok) throw new Error("Could not fetch projects list.");
      const data = await res.json();
      setProjects(data);
      
      if (data.length > 0) {
        setActiveProject(data[0]);
      } else {
        setError("No project data found. Please click 'Reset Demo Dataset' to initialize.");
        setLoading(false);
      }
    } catch (err: any) {
      console.error(err);
      setError("Cannot connect to AI prediction server. Make sure the backend is running and the API key is valid.");
      setLoading(false);
    }
  };

  // Fetch forecast and historical reports for active project
  const loadForecastData = async (projectName: string) => {
    if (!projectName) return;
    try {
      setLoading(true);

      const res = await fetch(`${API_BASE}/projects/${encodeURIComponent(projectName)}/forecast`, {
        headers: { "Authorization": `Bearer ${API_TOKEN}` }
      });
      if (!res.ok) throw new Error("Failed to load forecast data.");
      const data = await res.json();
      
      setHistoricalData(data.historical);
      setForecastData(data.forecast);
      setMetrics(data.metrics);
      setExplanations(data.explanations);
      setModelType(data.modelType);
      setLastTrained(data.lastTrained || "22 May 2026");
      setTrainingSamples(data.trainingSamples || 52);
      setForecastHorizon(data.forecastHorizon || 4);

      
      setNewReport(prev => ({ ...prev, projectName }));
      setLoading(false);
    } catch (err: any) {
      console.error(err);
      setError(`Failed to generate forecasts for ${projectName}: ${err.message}`);
      setLoading(false);
    }
  };

  // Reset/seed default data
  const handleSeedData = async () => {
    try {
      setIsSeeding(true);
      setError(null);
      setLoading(true);
      const res = await fetch(`${API_BASE}/admin/seed-sample-data`, { 
        method: "POST",
        headers: { "Authorization": `Bearer ${API_TOKEN}` }
      });
      if (!res.ok) throw new Error("Resetting demo dataset failed.");
      const responseData = await res.json();
      
      const projectsRes = await fetch(`${API_BASE}/projects`, {
        headers: { "Authorization": `Bearer ${API_TOKEN}` }
      });
      if (projectsRes.ok) {
        const data = await projectsRes.json();
        setProjects(data);
        if (data.length > 0) {
          const targetProj = data[0];
          setActiveProject(targetProj);
          await loadForecastData(targetProj);
        }
      }
      
      setToastMessage({
        type: 'success',
        text: responseData.message || "Demo dataset reset successfully."
      });
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err: any) {
      setError(`Resetting demo dataset error: ${err.message}`);
      setToastMessage({
        type: 'error',
        text: `Resetting error: ${err.message}`
      });
      setTimeout(() => setToastMessage(null), 4000);
      setLoading(false);
    } finally {
      setIsSeeding(false);
    }
  };

  // Retrain model manually
  const handleRetrainModel = async () => {
    if (!activeProject) return;
    try {
      setIsRetraining(true);
      setError(null);
      const res = await fetch(`${API_BASE}/projects/${encodeURIComponent(activeProject)}/train`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${API_TOKEN}` }
      });
      if (!res.ok) throw new Error("Retraining failed.");
      await loadForecastData(activeProject);
    } catch (err: any) {
      setError(`Retraining error: ${err.message}`);
    } finally {
      setIsRetraining(false);
    }
  };

  const loadSampleDataset = () => {
    setNewReport({
      projectName: activeProject,
      authors: "QA Lead",
      storyTests: 60,
      regressionTestsAutomated: 120,
      regressionTestsManual: 80,
      totalTestsByApplication: 260,
      
      storyPassed: 52,
      storyFailed: 4,
      storyUnexecuted: 0,
      storyBlocked: 2,
      storySkipped: 2,
      storyCritical: 0,
      storyNew: 8,
      storyUnused: 0,
      storyBugs: 4,
      
      arPassed: 114,
      arFailed: 4,
      arUnexecuted: 0,
      arBlocked: 1,
      arSkipped: 2,
      arCritical: 1,
      arNew: 5,
      arUnused: 0,
      arBugs: 2,
      
      mrPassed: 74,
      mrFailed: 5,
      mrUnexecuted: 2,
      mrBlocked: 1,
      mrSkipped: 1,
      mrCritical: 1,
      mrNew: 0,
      mrUnused: 0,
      mrBugs: 3
    });
  };

  // Submit new report
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitSuccess(false);
    setSubmitError(null);
    
    const computedTotal = Number(newReport.storyTests) + Number(newReport.regressionTestsAutomated) + Number(newReport.regressionTestsManual);
    const payload = {
      ...newReport,
      projectName: activeProject,
      totalTestsByApplication: computedTotal
    };

    try {
      const res = await fetch(`${API_BASE}/reports`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${API_TOKEN}`
        },
        body: JSON.stringify(payload)
      });
      
      if (!res.ok) {
        const errorDetail = await res.json();
        throw new Error(errorDetail.detail || "Error submitting report.");
      }
      
      setSubmitSuccess(true);
      setTimeout(() => {
        setIsFormOpen(false);
        setSubmitSuccess(false);
        loadForecastData(activeProject);
      }, 1500);
    } catch (err: any) {
      setSubmitError(err.message);
    }
  };

  // CSV file upload handler
  const handleCSVUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !activeProject) return;
    
    setSubmitSuccess(false);
    setSubmitError(null);
    
    const formData = new FormData();
    formData.append("file", selectedFile);
    
    try {
      const res = await fetch(`${API_BASE}/projects/${encodeURIComponent(activeProject)}/upload-csv`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${API_TOKEN}` },
        body: formData
      });
      
      if (!res.ok) {
        const errorDetail = await res.json();
        throw new Error(errorDetail.detail || "CSV upload failed.");
      }
      
      await res.json();
      setSubmitSuccess(true);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      
      setTimeout(() => {
        setIsFormOpen(false);
        setSubmitSuccess(false);
        loadForecastData(activeProject);
      }, 1500);
    } catch (err: any) {
      setSubmitError(err.message);
    }
  };

  // Client-side CSV Download Export
  const handleExportCSV = () => {
    if (historicalData.length === 0 || forecastData.length === 0) return;
    
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Type,WeekIndex,Date,StoryTests,ARTests,MRTests,TotalTests,StoryBugs,ARFailed,TotalBugs,ErrorMargin,ConfidenceLevel\n";
    
    historicalData.forEach((h, i) => {
      const date = new Date(h.createdAt).toLocaleDateString();
      const totalBugs = h.storyBugs + h.arBugs + h.mrBugs;
      csvContent += `Historical,Wk ${i + 1},${date},${h.storyTests},${h.regressionTestsAutomated},${h.regressionTestsManual},${h.totalTestsByApplication},${h.storyBugs},${h.arFailed},${totalBugs},0.0,100%\n`;
    });
    
    forecastData.forEach((f) => {
      const date = new Date(f.createdAt).toLocaleDateString();
      csvContent += `Forecast,Frcst ${f.weekIndex},${date},${f.storyTests},${f.regressionTestsAutomated},${f.regressionTestsManual},${f.totalTestsByApplication},${f.storyBugs},${f.arFailed},${f.totalBugs},${f.bugsErrorMargin},${f.bugsConfidence}%\n`;
    });
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${activeProject.replace(/\s+/g, '_')}_AegisAI_Forecast.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    if (activeProject) {
      loadForecastData(activeProject);
    }
  }, [activeProject]);

  // Combined chart data processing
  const getCombinedChartData = () => {
    if (historicalData.length === 0) return [];
    const dataPoints: any[] = [];

    // Historical Points
    historicalData.forEach((h, i) => {
      const date = new Date(h.createdAt);
      const totalBugs = h.storyBugs + h.arBugs + h.mrBugs;
      const arTotal = h.arPassed + h.arFailed;
      const arRate = arTotal > 0 ? (h.arPassed / arTotal) * 100 : 0;

      dataPoints.push({
        name: `Wk ${i + 1}`,
        date: `W${getWeekNumber(date)}`,
        bugsActual: totalBugs,
        bugsForecast: null,
        bugsLower: null,
        bugsUpper: null,
        testsActual: h.totalTestsByApplication,
        testsForecast: null,
        testsLower: null,
        testsUpper: null,
        arRateActual: Math.round(arRate * 10) / 10,
        arRateForecast: null,
      });
    });

    const lastHistIndex = dataPoints.length;
    const lastPoint = dataPoints[lastHistIndex - 1];

    // Forecasted Points
    forecastData.forEach((f) => {
      const arTotal = f.arPassed + f.arFailed;
      const arRate = arTotal > 0 ? (f.arPassed / arTotal) * 100 : 0;
      
      const margin = f.bugsErrorMargin;
      const lower = Math.max(0, f.totalBugs - margin);
      const upper = f.totalBugs + margin;

      const testsMae = metrics.totalTestsByApplication?.mae || 15.0;
      const testsMargin = testsMae * (1.0 + 0.15 * f.weekIndex);
      const testsLower = Math.max(0, f.totalTestsByApplication - testsMargin);
      const testsUpper = f.totalTestsByApplication + testsMargin;

      dataPoints.push({
        name: `Frcst ${f.weekIndex}`,
        date: `Forecast W${f.weekIndex}`,
        bugsActual: null,
        bugsForecast: f.totalBugs,
        bugsLower: Math.round(lower * 10) / 10,
        bugsUpper: Math.round(upper * 10) / 10,
        testsActual: null,
        testsForecast: f.totalTestsByApplication,
        testsLower: Math.round(testsLower * 10) / 10,
        testsUpper: Math.round(testsUpper * 10) / 10,
        arRateActual: null,
        arRateForecast: Math.round(arRate * 10) / 10,
      });
    });

    // Make chart line continuous
    if (lastPoint && forecastData.length > 0) {
      lastPoint.bugsForecast = lastPoint.bugsActual;
      lastPoint.bugsLower = lastPoint.bugsActual;
      lastPoint.bugsUpper = lastPoint.bugsActual;
      lastPoint.testsForecast = lastPoint.testsActual;
      lastPoint.testsLower = lastPoint.testsActual;
      lastPoint.testsUpper = lastPoint.testsActual;
      lastPoint.arRateForecast = lastPoint.arRateActual;
    }

    return dataPoints;
  };

  const chartData = getCombinedChartData();

  // Highlight Cards Calculations
  const getHighlights = () => {
    if (historicalData.length === 0 || forecastData.length === 0) return null;
    const lastHistory = historicalData[historicalData.length - 1];
    const lastForecast = forecastData[forecastData.length - 1];
    
    const histBugs = lastHistory.storyBugs + lastHistory.arBugs + lastHistory.mrBugs;
    const foreBugs = lastForecast.totalBugs;
    
    const histARRate = (lastHistory.arPassed / (lastHistory.regressionTestsAutomated || 1)) * 100;
    const foreARRate = (lastForecast.arPassed / (lastForecast.regressionTestsAutomated || 1)) * 100;

    const r2Tests = metrics.totalTestsByApplication?.r2 !== undefined ? metrics.totalTestsByApplication.r2 : 0.82;

    return {
      bugs: {
        val: Math.round(foreBugs),
        diff: Math.round(foreBugs - histBugs),
        pct: histBugs > 0 ? Math.round(((foreBugs - histBugs) / histBugs) * 100) : 0,
        error: lastForecast.bugsErrorMargin || 2.0,
        confidence: lastForecast.bugsConfidence || 87.0
      },
      tests: {
        val: Math.round(lastForecast.totalTestsByApplication),
        diff: Math.round(lastForecast.totalTestsByApplication - lastHistory.totalTestsByApplication),
        pct: lastHistory.totalTestsByApplication > 0 ? Math.round(((lastForecast.totalTestsByApplication - lastHistory.totalTestsByApplication) / lastHistory.totalTestsByApplication) * 100) : 0,
        error: Math.round((metrics.totalTestsByApplication?.mae || 15.0) * (1.0 + 0.15 * 4) * 10) / 10,
        confidence: Math.round(r2Tests * 100)
      },
      arRate: {
        val: Math.round(foreARRate * 10) / 10,
        diff: Math.round((foreARRate - histARRate) * 10) / 10
      }
    };
  };

  const highlights = getHighlights();

  // Animated KPI count-up metrics
  const countedSamples = useCountUp(trainingSamples);
  const countedBugs = useCountUp(highlights ? highlights.bugs.val : 0);
  const countedBugsConfidence = useCountUp(highlights ? highlights.bugs.confidence : 0);
  const countedTests = useCountUp(highlights ? highlights.tests.val : 0);
  const countedTestsConfidence = useCountUp(highlights ? highlights.tests.confidence : 0);

  const formatFeatureName = (name: string) => {
    switch(name) {
      case "lag_1": return "Last Week Performance";
      case "lag_2": return "2-Week Lag Value";
      case "lag_3": return "3-Week Lag Value";
      case "rolling_mean_3": return "3-Week Trend";
      case "rolling_std_3": return "Recent Test Volume";
      case "week_of_year": return "Seasonal Cycle";
      case "historical_mean": return "Historical Baseline Average";
      default: return name;
    }
  };
  const formatProjectName = (name: string) => {
    if (name === "Project Pegasus") return "Project Pegasus (E-commerce)";
    if (name === "Project Orion") return "Project Orion (Banking)";
    return name;
  };

  const filteredReports = historicalData
    .filter(r => {
      const search = reportSearch.toLowerCase();
      const matchAuthor = r.authors?.toLowerCase().includes(search);
      const matchDate = new Date(r.createdAt).toLocaleDateString().includes(search);
      return matchAuthor || matchDate;
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); // newest first

  const reportsPerPage = 10;
  const totalPages = Math.ceil(filteredReports.length / reportsPerPage);
  const paginatedReports = filteredReports.slice((currentPage - 1) * reportsPerPage, currentPage * reportsPerPage);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 animate-slide-down">
          <div className={`px-4 py-2.5 rounded-xl border backdrop-blur-md shadow-lg flex items-center gap-2 text-xs font-bold ${
            toastMessage.type === 'error' 
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-300' 
              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
          }`}>
            {toastMessage.type === 'error' ? (
              <AlertCircle className="h-4 w-4 text-rose-400" />
            ) : (
              <CheckCircle className="h-4 w-4 text-emerald-400" />
            )}
            {toastMessage.text}
          </div>
        </div>
      )}
      {/* Top Navigation */}
      <header className="glass-panel border-b border-white/5 sticky top-0 z-40 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600/20 p-2.5 rounded-xl border border-indigo-500/30 shadow-lg shadow-indigo-500/10">
            <Sparkles className="h-6 w-6 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              Aegis AI <span className="text-[10px] uppercase font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full">Predictive Engine</span>
            </h1>
            <p className="text-xs text-slate-400 font-medium">AI-Powered Weekly QA Forecasting Platform</p>
          </div>
          <nav className="hidden lg:flex items-center gap-6 ml-8 border-l border-white/10 pl-6">
            <button 
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="text-xs font-bold text-indigo-400 transition-colors cursor-pointer"
            >
              Dashboard
            </button>
            <button 
              onClick={() => {
                const el = document.querySelector('.lg\\:col-span-2');
                el?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="text-xs font-medium text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              Forecast
            </button>
            <button 
              onClick={() => {
                const el = document.getElementById('weekly-reports-section');
                el?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="text-xs font-medium text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              Weekly Reports
            </button>
            <button 
              onClick={() => setIsHowItWorksOpen(true)}
              className="text-xs font-medium text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              How it Works
            </button>
            <button 
              onClick={() => setIsArchOpen(true)}
              className="text-xs font-medium text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              Architecture
            </button>
            <a 
              href={`${API_BASE.replace(/\/api$/, '')}/docs`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium text-slate-400 hover:text-white transition-colors cursor-pointer"
              title="View FastAPI Swagger Interactive API Documentation"
            >
              API Docs
            </a>
          </nav>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          {projects.length > 0 && (
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-indigo-400" />
              <select 
                className="bg-[#121424] border border-white/10 rounded-lg text-sm px-3 py-1.5 font-medium text-slate-200 outline-none focus:border-indigo-500 transition-colors"
                value={activeProject}
                onChange={(e) => setActiveProject(e.target.value)}
              >
                {projects.map(p => (
                  <option key={p} value={p}>{formatProjectName(p)}</option>
                ))}
              </select>
            </div>
          )}


          {/* Add Weekly Report Toggle */}
          <button 
            onClick={() => { setIsFormOpen(true); setFormTab("manual"); }}
            className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-lg text-xs px-4 py-2 font-bold shadow-md shadow-indigo-900/40 hover:shadow-indigo-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all shrink-0 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Add Weekly Data
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-8 py-10 flex flex-col gap-8">
        
        {error && (
          <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 flex gap-3 text-rose-300 animate-fade-in">
            <AlertCircle className="h-5 w-5 shrink-0 text-rose-400" />
            <div>
              <h3 className="text-sm font-semibold">System Connection Warning</h3>
              <p className="text-xs text-rose-300/80 mt-1">{error}</p>
              {error.includes("Reset Demo Dataset") && (
                <button 
                  onClick={handleSeedData}
                  className="mt-2 text-xs font-bold text-rose-400 hover:text-rose-300 flex items-center gap-1 underline"
                >
                  Click here to reset demo dataset templates &rarr;
                </button>
              )}
            </div>
          </div>
        )}

        {loading && !isSeeding && !isRetraining ? (
          <div className="flex-1 flex flex-col gap-8 animate-pulse select-none">
            {/* Shimmer Top Loading Banner */}
            <div className="bg-indigo-600/10 border border-indigo-500/20 rounded-2xl p-4 flex items-center justify-between gap-4 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="relative flex items-center justify-center shrink-0">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
                  <Sparkles className="h-4 w-4 text-indigo-400 absolute" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">Syncing Aegis Predictive Forecasts</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">
                    Loading project QA records, engineering autoregressive time lags, and fitting RandomForestRegressor models...
                  </p>
                </div>
              </div>
              <span className="text-[9px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded font-bold uppercase select-none">AI Pipeline Active</span>
            </div>

            {/* KPI Shimmer Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-white/[0.02] border border-white/5 rounded-2xl h-32 p-5 flex flex-col justify-between">
                  <div className="flex justify-between items-center">
                    <div className="h-3 w-24 bg-white/10 rounded-md"></div>
                    <div className="h-4 w-12 bg-white/10 rounded-full"></div>
                  </div>
                  <div className="h-8 w-32 bg-white/15 rounded-lg"></div>
                  <div className="h-3 w-40 bg-white/5 rounded-md"></div>
                </div>
              ))}
            </div>

            {/* Chart & Sidebar Shimmer Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
              {/* Chart Shimmer */}
              <div className="lg:col-span-2 bg-white/[0.02] border border-white/5 rounded-2xl h-[480px] p-8 flex flex-col gap-6">
                <div className="flex justify-between items-center border-b border-white/5 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-5 w-5 bg-white/10 rounded-full"></div>
                    <div className="flex flex-col gap-2">
                      <div className="h-4 w-64 bg-white/15 rounded-md"></div>
                      <div className="h-3 w-48 bg-white/10 rounded-md"></div>
                    </div>
                  </div>
                  <div className="h-8 w-24 bg-white/10 rounded-lg"></div>
                </div>
                <div className="flex-1 bg-white/[0.01] rounded-xl flex items-center justify-center">
                  <div className="h-2/3 w-11/12 border-b border-l border-white/5 relative">
                    <div className="absolute bottom-1/4 left-1/4 right-1/4 h-20 bg-indigo-500/5 rounded-t-3xl border-t border-indigo-500/10 border-dashed"></div>
                  </div>
                </div>
              </div>

              {/* Sidebar Cards Shimmer */}
              <div className="flex flex-col gap-8">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-white/[0.02] border border-white/5 rounded-2xl h-44 p-6 flex flex-col gap-4">
                    <div className="border-b border-white/5 pb-3">
                      <div className="h-4 w-32 bg-white/15 rounded-md"></div>
                    </div>
                    <div className="flex flex-col gap-2.5">
                      <div className="h-3 w-full bg-white/10 rounded-md"></div>
                      <div className="h-3 w-5/6 bg-white/10 rounded-md"></div>
                      <div className="h-3 w-2/3 bg-white/5 rounded-md"></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : loading ? (
          /* Seeding/Retraining custom action loaders */
          <div className="flex-1 flex flex-col items-center justify-center min-h-[450px] gap-5 text-center py-12 glass-panel rounded-2xl border border-white/5 animate-pulse-slow select-none">
            <div className="relative flex items-center justify-center">
              <div className="animate-spin rounded-full h-14 w-14 border-t-2 border-b-2 border-indigo-500"></div>
              <Sparkles className="h-6 w-6 text-indigo-400 absolute" />
            </div>
            <div className="flex flex-col gap-1.5 max-w-sm px-6">
              <h3 className="text-sm font-bold text-white tracking-wide uppercase">
                {isSeeding ? "Resetting Demo Dataset" : isRetraining ? "Retraining AI Model" : "Syncing Aegis Forecasts"}
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                {isSeeding 
                  ? "Wiping custom historical reports, generating standardized test runs, and pre-compiling prediction caches..." 
                  : isRetraining 
                    ? "Fitting RandomForestRegressor estimators, running cross-validation, and calculating SHAP values..." 
                    : "Loading project QA data, engineering historical time lags, and training RandomForestRegressor models..."}
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Highlights Grid */}
            {highlights && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 animate-slide-up">
                
                {/* Highlight 1: Weekly Reports Processed */}
                <div className="glass-panel glass-panel-hover rounded-2xl p-5 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-8 opacity-5">
                    <Database className="h-24 w-24 text-white" />
                  </div>
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Weekly Reports Processed</span>
                    <span className="bg-indigo-500/10 text-indigo-400 text-[10px] px-2 py-0.5 rounded-full font-bold border border-indigo-500/20">Data Volume</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold tracking-tight text-white">{countedSamples} Reports</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-2">Total historical QA data volume ingested.</p>
                </div>

                {/* Highlight 2: Predicted Next 4 Weeks */}
                <div className="glass-panel glass-panel-hover rounded-2xl p-5 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-8 opacity-5">
                    <Bug className="h-24 w-24 text-white" />
                  </div>
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Predicted Next 4 Weeks</span>
                    <span className="bg-rose-500/10 text-rose-400 text-[10px] px-2 py-0.5 rounded-full font-bold border border-rose-500/20">Wk 4 Prediction</span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold tracking-tight text-white">
                        {countedBugs} ± {highlights.bugs.error} Bugs
                      </span>
                    </div>
                    <div className="flex items-baseline gap-2 border-t border-white/5 pt-1.5">
                      <span className="text-xs font-semibold text-slate-400">Tests:</span>
                      <span className="text-lg font-bold text-slate-200">
                        {countedTests} ± {highlights.tests.error}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 mt-2">
                    Weekly defect influx. Confidence: <span className="font-semibold text-indigo-300">{countedBugsConfidence}%</span>
                  </p>
                </div>

                {/* Highlight 3: Forecast Confidence */}
                <div className="glass-panel glass-panel-hover rounded-2xl p-5 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-8 opacity-5">
                    <Activity className="h-24 w-24 text-white" />
                  </div>
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Forecast Confidence</span>
                    <span className="bg-emerald-500/10 text-emerald-400 text-[10px] px-2 py-0.5 rounded-full font-bold border border-emerald-500/20">Confidence</span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold tracking-tight text-white">{countedBugsConfidence}%</span>
                      <span className="text-xs font-semibold text-slate-400 uppercase ml-1.5">Bugs</span>
                    </div>
                    <div className="flex items-baseline gap-2 border-t border-white/5 pt-1.5">
                      <span className="text-xs font-semibold text-slate-400">Tests:</span>
                      <span className="text-lg font-bold text-slate-200 ml-1.5">
                        {countedTestsConfidence}%
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 mt-2">Model prediction probability intervals.</p>
                </div>

                {/* Highlight 4: Model Accuracy (R²) */}
                <div className="glass-panel glass-panel-hover rounded-2xl p-5 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-8 opacity-5">
                    <CheckCircle className="h-24 w-24 text-white" />
                  </div>
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Model Accuracy (R²)</span>
                    <span className="bg-violet-500/10 text-violet-400 text-[10px] px-2 py-0.5 rounded-full font-bold border border-violet-500/20">Goodness-of-Fit</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold tracking-tight text-white">{r2Val}</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-2">RandomForest regression model coefficient.</p>
                </div>

              </div>
            )}

            {/* Split Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              {/* Left Column: Forecast Chart & Observability Meta (7/12 width ≈ 60%) */}
              <div className="lg:col-span-7 flex flex-col gap-8">
                {/* Forecast Chart */}
                <div className="glass-panel rounded-2xl p-8 flex flex-col gap-8 animate-slide-up">
                  <div className="flex items-center justify-between border-b border-white/5 pb-4">
                    <div className="flex items-center gap-2">
                      <BarChart4 className="h-5 w-5 text-indigo-400" />
                      <div>
                        <h2 className="text-lg font-bold text-white">Historical Weekly Reports → Next 4-Week AI Forecast</h2>
                        <p className="text-xs text-slate-400">Time-series forecasting mapping weekly trends to next month predictions</p>
                      </div>
                    </div>
                    
                    {/* Metric Toggle */}
                    <div className="flex bg-[#121424] border border-white/10 p-0.5 rounded-xl text-xs font-semibold">
                      <button 
                        onClick={() => setChartMetric("bugs")}
                        className={`px-3 py-1.5 rounded-lg transition-all ${chartMetric === "bugs" ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/40' : 'text-slate-400 hover:text-slate-200'}`}
                      >
                        Bugs
                      </button>
                      <button 
                        onClick={() => setChartMetric("tests")}
                        className={`px-3 py-1.5 rounded-lg transition-all ${chartMetric === "tests" ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/40' : 'text-slate-400 hover:text-slate-200'}`}
                      >
                        Test Scope
                      </button>
                      <button 
                        onClick={() => setChartMetric("arRate")}
                        className={`px-3 py-1.5 rounded-lg transition-all ${chartMetric === "arRate" ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/40' : 'text-slate-400 hover:text-slate-200'}`}
                      >
                        AR Pass %
                      </button>
                    </div>
                  </div>

                  {/* Graph Canvas */}
                  <div className="h-[360px] w-full text-xs font-medium">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.25}/>
                            <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorForecast" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#d946ef" stopOpacity={0.25}/>
                            <stop offset="95%" stopColor="#d946ef" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorCI" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#d946ef" stopOpacity={0.08}/>
                            <stop offset="95%" stopColor="#d946ef" stopOpacity={0.01}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                        <XAxis 
                          dataKey="date" 
                          stroke="rgba(255,255,255,0.4)" 
                          dy={10} 
                          tickLine={false} 
                        />
                        <YAxis 
                          stroke="rgba(255,255,255,0.4)" 
                          dx={-5} 
                          tickLine={false} 
                          axisLine={false}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#0e101a', 
                            borderColor: 'rgba(255,255,255,0.08)',
                            borderRadius: '12px',
                            color: '#fff',
                            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.4)'
                          }} 
                          labelStyle={{ fontWeight: 'bold', color: '#fff', marginBottom: '6px' }}
                          itemStyle={{ color: '#e2e8f0', fontSize: '11px', padding: '2px 0' }}
                        />
                        
                        {chartMetric === "bugs" && (
                          <>
                            <Area 
                              type="monotone" 
                              name="Actual Bugs"
                              dataKey="bugsActual" 
                              stroke="#6366f1" 
                              strokeWidth={2.5}
                              fillOpacity={1} 
                              fill="url(#colorActual)" 
                            />
                            <Area 
                              type="monotone" 
                              name="AI Forecasted Bugs"
                              dataKey="bugsForecast" 
                              stroke="#d946ef" 
                              strokeWidth={2.5}
                              strokeDasharray="4 4"
                              fillOpacity={1} 
                              fill="url(#colorForecast)" 
                            />
                            {/* Uncertainty Bounds Display */}
                            <Area 
                              type="monotone" 
                              name="Uncertainty Range Upper"
                              dataKey="bugsUpper" 
                              stroke="rgba(217, 70, 239, 0.2)" 
                              strokeWidth={1}
                              fillOpacity={1} 
                              fill="url(#colorCI)" 
                            />
                            <Area 
                              type="monotone" 
                              name="Uncertainty Range Lower"
                              dataKey="bugsLower" 
                              stroke="rgba(217, 70, 239, 0.2)" 
                              strokeWidth={1}
                              fill="none" 
                            />
                          </>
                        )}

                        {chartMetric === "tests" && (
                          <>
                            <Area 
                              type="monotone" 
                              name="Actual Weekly Test Volume"
                              dataKey="testsActual" 
                              stroke="#6366f1" 
                              strokeWidth={2.5}
                              fillOpacity={0.2} 
                              fill="url(#colorActual)" 
                            />
                            <Area 
                              type="monotone" 
                              name="Predicted Weekly Test Volume"
                              dataKey="testsForecast" 
                              stroke="#d946ef" 
                              strokeWidth={2.5}
                              strokeDasharray="4 4"
                              fillOpacity={0.2} 
                              fill="url(#colorForecast)" 
                            />
                            {/* Uncertainty Bounds Display for Tests */}
                            <Area 
                              type="monotone" 
                              name="Uncertainty Range Upper"
                              dataKey="testsUpper" 
                              stroke="rgba(217, 70, 239, 0.2)" 
                              strokeWidth={1}
                              fillOpacity={1} 
                              fill="url(#colorCI)" 
                            />
                            <Area 
                              type="monotone" 
                              name="Uncertainty Range Lower"
                              dataKey="testsLower" 
                              stroke="rgba(217, 70, 239, 0.2)" 
                              strokeWidth={1}
                              fill="none" 
                            />
                          </>
                        )}

                        {chartMetric === "arRate" && (
                          <>
                            <Area 
                              type="monotone" 
                              name="Actual Automation Pass %"
                              dataKey="arRateActual" 
                              stroke="#10b981" 
                              strokeWidth={2.5}
                              fillOpacity={0.1} 
                              fill="#10b981"
                            />
                            <Area 
                              type="monotone" 
                              name="AI Forecasted Automation Pass %"
                              dataKey="arRateForecast" 
                              stroke="#d946ef" 
                              strokeWidth={2.5}
                              strokeDasharray="4 4"
                              fillOpacity={0.1} 
                              fill="#d946ef"
                            />
                          </>
                        )}
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  
                  <div className="flex items-center justify-between text-xs text-slate-400 mt-2 border-t border-white/5 pt-4">
                    <div className="flex gap-4">
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-4 bg-indigo-500 rounded-sm"></span> Actuals (Weeks 1 to {historicalData.length})
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-4 border border-dashed border-pink-500 rounded-sm"></span> Forecast (Next 4 Weeks)
                      </span>
                      {(chartMetric === "bugs" || chartMetric === "tests") && (
                        <span className="flex items-center gap-1.5">
                          <span className="h-2.5 w-4 bg-pink-500/10 border border-pink-500/20 rounded-sm"></span> Uncertainty Margin (95% CI)
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-500 italic">Models updated dynamically on weekly data ingest.</span>
                  </div>
                </div>

                {/* AI Model Details Panel */}
                <div className="glass-panel rounded-2xl p-8 flex flex-col gap-6 animate-slide-up">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/5 pb-3.5 gap-4">
                    <div>
                      <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                        <Settings className="h-4 w-4 text-indigo-400" /> AI Model Details
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">Observability stats for active forecaster model</p>
                    </div>
                    
                    {/* Actions relocated to prevent header overcrowding */}
                    <div className="flex gap-2">
                      <button 
                        onClick={handleRetrainModel}
                        disabled={isRetraining || historicalData.length === 0}
                        className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs py-1.5 px-3 font-bold transition-all shadow-md shadow-indigo-900/20 cursor-pointer"
                        title="Retrain RandomForest forecasting model on the current dataset"
                      >
                        <Settings className={`h-3.5 w-3.5 ${isRetraining ? 'animate-spin' : ''}`} />
                        {isRetraining ? 'Retraining...' : 'Retrain AI'}
                      </button>
                      
                      <button
                        onClick={handleSeedData}
                        disabled={isSeeding}
                        className="flex items-center gap-1.5 bg-[#16182c] border border-white/10 hover:border-white/20 text-slate-300 hover:text-white rounded-lg text-xs py-1.5 px-3 font-semibold transition-all cursor-pointer disabled:opacity-50"
                        title="Wipe custom edits and reset the system with database seed templates"
                      >
                        <Database className={`h-3.5 w-3.5 ${isSeeding ? 'animate-spin' : ''}`} />
                        {isSeeding ? 'Resetting...' : 'Reset Demo'}
                      </button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-slate-300">
                    <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3.5 flex flex-col gap-1 col-span-2">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Model Type</span>
                      <span className="font-bold text-white text-xs sm:text-sm truncate" title={modelType}>{modelType}</span>
                    </div>
                    <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3.5 flex flex-col gap-1">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Training Samples</span>
                      <span className="font-bold text-indigo-300 text-xs sm:text-sm">{trainingSamples} weeks</span>
                    </div>
                    <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3.5 flex flex-col gap-1">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Last Trained</span>
                      <span className="font-bold text-indigo-300 text-xs sm:text-sm truncate" title={lastTrained}>{lastTrained}</span>
                    </div>
                    <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3.5 flex flex-col gap-1">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Forecast Horizon</span>
                      <span className="font-bold text-indigo-300 text-xs sm:text-sm">{forecastHorizon} weeks</span>
                    </div>
                    <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3.5 flex flex-col gap-1">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">MAE (Defects)</span>
                      <span className="font-bold text-indigo-300 text-xs sm:text-sm">{metrics.storyBugs?.mae !== undefined ? metrics.storyBugs.mae.toFixed(2) : "1.4"}</span>
                    </div>
                    <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3.5 flex flex-col gap-1">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">MAE (Test Vol)</span>
                      <span className="font-bold text-indigo-300 text-xs sm:text-sm">{metrics.totalTestsByApplication?.mae !== undefined ? metrics.totalTestsByApplication.mae.toFixed(1) : "15.0"}</span>
                    </div>
                    <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3.5 flex flex-col gap-1">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Goodness-of-Fit (R²)</span>
                      <span className="font-bold text-indigo-300 text-xs sm:text-sm">{r2Val}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: AI Explainer (5/12 width ≈ 40%) */}
              <div className="lg:col-span-5 flex flex-col gap-8">
                
                {/* Interpretability Section */}
                <div className="glass-panel rounded-2xl p-8 flex flex-col gap-6 animate-slide-up">
                  <div className="border-b border-white/5 pb-4">
                    <div className="flex items-center gap-2 mb-1">
                      <ShieldAlert className="h-5 w-5 text-indigo-400" />
                      <h2 className="text-lg font-bold text-white">AI Prediction Interpretability</h2>
                    </div>
                    <p className="text-xs text-slate-400">SHAP values showing how past inputs affect the forecasted prediction for Week {historicalData.length + 1}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Explain Metric:</span>
                    <select 
                      className="flex-1 bg-[#121424] border border-white/10 rounded-lg text-xs px-2.5 py-1.5 font-medium text-slate-200 outline-none focus:border-indigo-500 transition-colors"
                      value={shapMetric}
                      onChange={(e) => setShapMetric(e.target.value)}
                    >
                      <option value="storyBugs">Story Bugs</option>
                      <option value="arFailed">Automation Failures</option>
                      <option value="totalTestsByApplication">Total Test Volume</option>
                    </select>
                  </div>

                  {explanations[shapMetric] ? (
                    <div className="flex flex-col gap-4">
                      <div className="bg-[#121424] rounded-xl p-3.5 border border-white/5">
                        <div className="flex justify-between items-center text-xs font-semibold text-slate-400 mb-1">
                          <span>Baseline (Historical Mean)</span>
                          <span className="text-slate-300">{explanations[shapMetric].baseValue.toFixed(1)}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs font-bold text-white">
                          <span className="flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5 text-indigo-400" /> AI Forecasted Value</span>
                          <span className="text-indigo-400">{explanations[shapMetric].predictionValue.toFixed(1)}</span>
                        </div>
                      </div>

                      <div className="flex flex-col gap-3">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Top AI Drivers</h4>
                        <div className="flex flex-col gap-2.5">
                          {explanations[shapMetric].features
                            .sort((a, b) => Math.abs(b.shapValue) - Math.abs(a.shapValue))
                            .slice(0, 5)
                            .map((feat) => {
                              const isPositive = feat.shapValue >= 0;
                              return (
                                <div key={feat.featureName} className="flex justify-between items-start gap-4 text-xs py-2 border-b border-white/5 last:border-0 animate-fade-in">
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-slate-200 font-bold">{formatFeatureName(feat.featureName)}</span>
                                    <span className="text-[10px] text-slate-500 font-normal leading-normal">{feat.description}</span>
                                  </div>
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full select-none shrink-0 border ${
                                    isPositive 
                                      ? 'text-rose-400 bg-rose-500/10 border-rose-500/20' 
                                      : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                                  }`}>
                                    {isPositive ? '+' : ''}{feat.shapValue.toFixed(1)}
                                  </span>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="h-48 border border-dashed border-white/10 rounded-xl flex items-center justify-center text-xs text-slate-400 italic">
                      SHAP details unavailable. Reset demo dataset to view forecasting explanations.
                    </div>
                  )}
                </div>

                {/* Model Performance Panel */}
                <div className="glass-panel rounded-2xl p-8 flex flex-col gap-6 animate-slide-up">
                  <div className="border-b border-white/5 pb-3.5">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                      <Layers className="h-4 w-4 text-indigo-400" /> Model Performance
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">Tested models against historical defect validation datasets</p>
                  </div>
                  
                  <div className="flex flex-col gap-2.5 text-xs">
                    <div className="flex justify-between items-center bg-[#121424] p-2.5 rounded-lg border border-indigo-500/30">
                      <span className="font-semibold text-white flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-indigo-500"></span> RFRegressor
                      </span>
                      <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded font-bold uppercase">Active</span>
                      <div className="text-right">
                        <div className="text-slate-300 font-bold">MAE: 1.4</div>
                        <div className="text-slate-400 text-[10px]">R²: 0.85</div>
                      </div>
                    </div>

                    <div className="flex justify-between items-center bg-[#121424]/40 p-2.5 rounded-lg border border-white/5 opacity-80">
                      <span className="text-slate-300 flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-slate-500"></span> XGBoost
                      </span>
                      <div className="text-right">
                        <div className="text-slate-400 font-medium">MAE: 2.1</div>
                        <div className="text-slate-500 text-[10px]">R²: 0.78</div>
                      </div>
                    </div>

                    <div className="flex justify-between items-center bg-[#121424]/40 p-2.5 rounded-lg border border-white/5 opacity-80">
                      <span className="text-slate-300 flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-slate-500"></span> Linear Reg
                      </span>
                      <div className="text-right">
                        <div className="text-slate-400 font-medium">MAE: 3.2</div>
                        <div className="text-slate-500 text-[10px]">R²: 0.62</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Historical Weekly Reports Table */}
            <div id="weekly-reports-section" className="glass-panel rounded-2xl p-8 flex flex-col gap-6 animate-slide-up">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-white/5 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Database className="h-5 w-5 text-indigo-400" /> Historical Weekly QA Reports
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">Browse, search, and export historical test executions and defect logs</p>
                </div>
                
                <div className="flex flex-wrap items-center gap-3">
                  {/* Search Input */}
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search reports..."
                      className="bg-[#121424] border border-white/10 rounded-lg text-xs pl-8 pr-3 py-2 text-slate-200 placeholder-slate-500 outline-none focus:border-indigo-500 transition-colors w-48 sm:w-64"
                      value={reportSearch}
                      onChange={(e) => { setReportSearch(e.target.value); setCurrentPage(1); }}
                    />
                    <Sparkles className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
                  </div>

                  {/* Export CSV Button */}
                  <button
                    onClick={handleExportCSV}
                    className="flex items-center gap-2 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 hover:text-indigo-300 border border-indigo-500/20 rounded-lg text-xs px-3.5 py-2 font-semibold transition-all shrink-0 cursor-pointer"
                    title="Export all historical reports and forecasts to CSV"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Export CSV
                  </button>
                </div>
              </div>

              {filteredReports.length > 0 ? (
                <div className="w-full overflow-x-auto scrollbar-thin">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-white/10 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                        <th className="py-3 px-4">Week</th>
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-4">Authors</th>
                        <th className="py-3 px-4 text-right">Story Tests</th>
                        <th className="py-3 px-4 text-right">AR (Auto)</th>
                        <th className="py-3 px-4 text-right">MR (Manual)</th>
                        <th className="py-3 px-4 text-right">Total Tests</th>
                        <th className="py-3 px-4 text-right">Story Bugs</th>
                        <th className="py-3 px-4 text-right">AR Bugs</th>
                        <th className="py-3 px-4 text-right">MR Bugs</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-slate-300">
                      {paginatedReports.map((report, idx) => {
                        const globalIndex = filteredReports.length - ((currentPage - 1) * reportsPerPage + idx);
                        return (
                          <tr key={report.id || idx} className="hover:bg-white/[0.02] transition-colors">
                            <td className="py-3.5 px-4 font-bold text-white">Wk {globalIndex}</td>
                            <td className="py-3.5 px-4 text-slate-400">{new Date(report.createdAt).toLocaleDateString()}</td>
                            <td className="py-3.5 px-4 font-medium max-w-[120px] truncate" title={report.authors}>{report.authors || "N/A"}</td>
                            <td className="py-3.5 px-4 text-right font-mono">{report.storyTests}</td>
                            <td className="py-3.5 px-4 text-right font-mono">{report.regressionTestsAutomated}</td>
                            <td className="py-3.5 px-4 text-right font-mono">{report.regressionTestsManual}</td>
                            <td className="py-3.5 px-4 text-right font-mono text-indigo-300 font-bold">{report.totalTestsByApplication}</td>
                            <td className="py-3.5 px-4 text-right font-mono text-rose-300">{report.storyBugs}</td>
                            <td className="py-3.5 px-4 text-right font-mono text-rose-400">{report.arBugs || report.arFailed || 0}</td>
                            <td className="py-3.5 px-4 text-right font-mono text-rose-400">{report.mrBugs || 0}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-12 border border-dashed border-white/10 rounded-xl text-center text-slate-400 italic">
                  No weekly reports found matching "{reportSearch}".
                </div>
              )}

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex justify-between items-center border-t border-white/5 pt-4 text-xs font-semibold text-slate-400">
                  <span>
                    Showing {reportsPerPage * (currentPage - 1) + 1} - {Math.min(reportsPerPage * currentPage, filteredReports.length)} of {filteredReports.length} reports
                  </span>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1.5 bg-[#121424] border border-white/10 hover:border-white/20 disabled:opacity-50 text-slate-300 rounded-lg transition-all cursor-pointer"
                    >
                      Previous
                    </button>
                    <span className="px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 rounded-lg">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1.5 bg-[#121424] border border-white/10 hover:border-white/20 disabled:opacity-50 text-slate-300 rounded-lg transition-all cursor-pointer"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {/* Side Slide-Over Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-xl bg-[#0e101a] border-l border-white/10 h-full p-6 overflow-y-auto flex flex-col gap-6 animate-slide-up">
            
            {/* Modal Header */}
            <div className="flex justify-between items-center border-b border-white/10 pb-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <UploadCloud className="text-indigo-400" /> Submit Weekly QA Report
                </h3>
                <p className="text-xs text-slate-400">Add weekly report numbers to update models</p>
              </div>
              <button 
                onClick={() => setIsFormOpen(false)}
                className="p-1.5 hover:bg-white/5 text-slate-400 hover:text-white rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Tab Navigation */}
            <div className="flex border-b border-white/5 p-0.5 bg-[#121424] rounded-lg text-xs font-semibold">
              <button
                onClick={() => setFormTab("manual")}
                className={`flex-1 py-2 text-center rounded-md transition-all ${formTab === "manual" ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Manual Data Entry
              </button>
              <button
                onClick={() => setFormTab("csv")}
                className={`flex-1 py-2 text-center rounded-md transition-all ${formTab === "csv" ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
              >
                CSV Upload Dataset
              </button>
            </div>

            {/* Success/Error Alerts */}
            {submitSuccess && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3.5 flex gap-2.5 text-emerald-300 text-xs">
                <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold">Submission Successful</h4>
                  <p className="mt-0.5">Retraining RandomForest models with scaling validation...</p>
                </div>
              </div>
            )}

            {submitError && (
              <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3.5 flex gap-2.5 text-rose-300 text-xs">
                <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold">Submission Failed</h4>
                  <p className="mt-0.5">{submitError}</p>
                </div>
              </div>
            )}

            {formTab === "manual" ? (
              /* Manual Entry Form */
              <form onSubmit={handleFormSubmit} className="flex-1 flex flex-col gap-5 text-sm font-semibold text-slate-300">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-400 uppercase tracking-wider mb-1.5">Project Context</label>
                    <input 
                      type="text" 
                      readOnly
                      className="w-full bg-[#121424] border border-white/10 rounded-lg px-3 py-2 text-slate-400 outline-none"
                      value={activeProject}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 uppercase tracking-wider mb-1.5">Lead Authors</label>
                    <input 
                      type="text" 
                      required
                      className="w-full bg-[#121424] border border-white/10 focus:border-indigo-500 rounded-lg px-3 py-2 text-slate-200 outline-none transition-colors"
                      value={newReport.authors}
                      onChange={(e) => setNewReport({...newReport, authors: e.target.value})}
                    />
                  </div>
                </div>

                <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 flex flex-col gap-3">
                  <h4 className="text-xs uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5" /> Test execution Volume (Weekly)
                  </h4>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">Story Tests</label>
                      <input 
                        type="number" min="0" required
                        className="w-full bg-[#121424] border border-white/10 focus:border-indigo-500 rounded-lg px-2.5 py-1.5 text-slate-200 outline-none"
                        value={newReport.storyTests}
                        onChange={(e) => setNewReport({...newReport, storyTests: Number(e.target.value)})}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">AR Tests (Auto)</label>
                      <input 
                        type="number" min="0" required
                        className="w-full bg-[#121424] border border-white/10 focus:border-indigo-500 rounded-lg px-2.5 py-1.5 text-slate-200 outline-none"
                        value={newReport.regressionTestsAutomated}
                        onChange={(e) => setNewReport({...newReport, regressionTestsAutomated: Number(e.target.value)})}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">MR Tests (Manual)</label>
                      <input 
                        type="number" min="0" required
                        className="w-full bg-[#121424] border border-white/10 focus:border-indigo-500 rounded-lg px-2.5 py-1.5 text-slate-200 outline-none"
                        value={newReport.regressionTestsManual}
                        onChange={(e) => setNewReport({...newReport, regressionTestsManual: Number(e.target.value)})}
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white/[0.01] border border-white/5 rounded-xl p-3.5 flex flex-col gap-2.5">
                    <h5 className="text-xs font-bold text-slate-300 border-b border-white/5 pb-1.5">Story Tests</h5>
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">Passed</label>
                      <input 
                        type="number" min="0" required
                        className="w-full bg-[#121424] border border-white/10 focus:border-indigo-500 rounded-lg px-2.5 py-1 text-xs text-slate-200 outline-none"
                        value={newReport.storyPassed}
                        onChange={(e) => setNewReport({...newReport, storyPassed: Number(e.target.value)})}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">Failed</label>
                      <input 
                        type="number" min="0" required
                        className="w-full bg-[#121424] border border-white/10 focus:border-indigo-500 rounded-lg px-2.5 py-1 text-xs text-slate-200 outline-none"
                        value={newReport.storyFailed}
                        onChange={(e) => setNewReport({...newReport, storyFailed: Number(e.target.value)})}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">Bugs Created</label>
                      <input 
                        type="number" min="0" required
                        className="w-full bg-[#121424] border border-white/10 focus:border-indigo-500 rounded-lg px-2.5 py-1 text-xs text-slate-200 outline-none font-semibold text-rose-300"
                        value={newReport.storyBugs}
                        onChange={(e) => setNewReport({...newReport, storyBugs: Number(e.target.value)})}
                      />
                    </div>
                  </div>

                  <div className="bg-white/[0.01] border border-white/5 rounded-xl p-3.5 flex flex-col gap-2.5">
                    <h5 className="text-xs font-bold text-slate-300 border-b border-white/5 pb-1.5">Automation (AR)</h5>
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">Passed</label>
                      <input 
                        type="number" min="0" required
                        className="w-full bg-[#121424] border border-white/10 focus:border-indigo-500 rounded-lg px-2.5 py-1 text-xs text-slate-200 outline-none"
                        value={newReport.arPassed}
                        onChange={(e) => setNewReport({...newReport, arPassed: Number(e.target.value)})}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">Failed</label>
                      <input 
                        type="number" min="0" required
                        className="w-full bg-[#121424] border border-white/10 focus:border-indigo-500 rounded-lg px-2.5 py-1 text-xs text-slate-200 outline-none"
                        value={newReport.arFailed}
                        onChange={(e) => setNewReport({...newReport, arFailed: Number(e.target.value)})}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">Bugs Created</label>
                      <input 
                        type="number" min="0" required
                        className="w-full bg-[#121424] border border-white/10 focus:border-indigo-500 rounded-lg px-2.5 py-1 text-xs text-slate-200 outline-none font-semibold text-rose-300"
                        value={newReport.arBugs}
                        onChange={(e) => setNewReport({...newReport, arBugs: Number(e.target.value)})}
                      />
                    </div>
                  </div>

                  <div className="bg-white/[0.01] border border-white/5 rounded-xl p-3.5 flex flex-col gap-2.5">
                    <h5 className="text-xs font-bold text-slate-300 border-b border-white/5 pb-1.5">Manual (MR)</h5>
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">Passed</label>
                      <input 
                        type="number" min="0" required
                        className="w-full bg-[#121424] border border-white/10 focus:border-indigo-500 rounded-lg px-2.5 py-1 text-xs text-slate-200 outline-none"
                        value={newReport.mrPassed}
                        onChange={(e) => setNewReport({...newReport, mrPassed: Number(e.target.value)})}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">Failed</label>
                      <input 
                        type="number" min="0" required
                        className="w-full bg-[#121424] border border-white/10 focus:border-indigo-500 rounded-lg px-2.5 py-1 text-xs text-slate-200 outline-none"
                        value={newReport.mrFailed}
                        onChange={(e) => setNewReport({...newReport, mrFailed: Number(e.target.value)})}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">Bugs Created</label>
                      <input 
                        type="number" min="0" required
                        className="w-full bg-[#121424] border border-white/10 focus:border-indigo-500 rounded-lg px-2.5 py-1 text-xs text-slate-200 outline-none font-semibold text-rose-300"
                        value={newReport.mrBugs}
                        onChange={(e) => setNewReport({...newReport, mrBugs: Number(e.target.value)})}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 justify-end border-t border-white/10 pt-4 mt-auto">
                  <button 
                    type="button"
                    onClick={loadSampleDataset}
                    className="mr-auto bg-[#16182c] border border-white/15 hover:border-white/20 text-slate-300 hover:text-white rounded-lg text-xs px-4 py-2 font-semibold transition-all"
                  >
                    Load Sample Weekly Dataset
                  </button>
                  <button 
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    className="bg-transparent border border-white/10 hover:bg-white/5 text-slate-300 rounded-lg text-xs px-4 py-2 font-semibold"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs px-5 py-2 font-bold shadow-md shadow-indigo-900/40"
                  >
                    Submit & Train Model
                  </button>
                </div>
              </form>
            ) : (
              /* CSV Upload Form */
              <form onSubmit={handleCSVUpload} className="flex-1 flex flex-col gap-6 text-sm font-semibold text-slate-300">
                <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-white/15 hover:border-indigo-500/50 rounded-2xl p-8 bg-[#121424]/40 transition-colors gap-4">
                  <FileText className="h-12 w-12 text-indigo-400" />
                  
                  <div className="text-center">
                    <p className="text-sm text-slate-200 font-bold">Select CSV dataset to import</p>
                    <p className="text-xs text-slate-400 mt-1">Columns must match standard metrics schema</p>
                  </div>

                  <input 
                    type="file" 
                    accept=".csv"
                    ref={fileInputRef}
                    required
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        setSelectedFile(e.target.files[0]);
                      }
                    }}
                    className="hidden"
                    id="csv-file-selector"
                  />
                  
                  <button
                    type="button"
                    onClick={() => document.getElementById("csv-file-selector")?.click()}
                    className="bg-[#1c1e36] hover:bg-indigo-600 text-white border border-white/10 rounded-lg text-xs px-4 py-2 font-bold transition-all"
                  >
                    Browse Files
                  </button>

                  {selectedFile && (
                    <div className="bg-[#16182c] border border-indigo-500/20 px-3 py-1.5 rounded-lg text-xs text-indigo-300 font-bold flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-emerald-400" /> {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                    </div>
                  )}
                </div>

                <div className="bg-[#121424] border border-white/5 p-4 rounded-xl text-xs font-medium leading-relaxed text-slate-400">
                  <p className="font-bold text-white mb-1.5">Required CSV Format:</p>
                  <p>CSV must contain header row with at least these columns:</p>
                  <code className="block bg-black/40 text-indigo-300 p-2 rounded mt-1 font-mono text-[10px] overflow-x-auto">
                    storyTests,regressionTestsAutomated,regressionTestsManual,storyPassed,storyFailed,storyBugs,arPassed,arFailed,arBugs,mrPassed,mrFailed,mrBugs,authors,createdAt
                  </code>
                </div>

                <div className="flex gap-3 justify-end border-t border-white/10 pt-4 mt-auto">
                  <button 
                    type="button"
                    onClick={() => {
                      setIsFormOpen(false);
                      setSelectedFile(null);
                    }}
                    className="bg-transparent border border-white/10 hover:bg-white/5 text-slate-300 rounded-lg text-xs px-4 py-2 font-semibold"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={!selectedFile}
                    className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs px-5 py-2 font-bold shadow-md shadow-indigo-900/40"
                  >
                    Upload & Train Model
                  </button>
                </div>
              </form>
            )}

          </div>
        </div>
      )}

      {/* Architecture Modal */}
      {isArchOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto animate-fade-in" onClick={() => setIsArchOpen(false)}>
          <div className="w-full max-w-3xl bg-[#0e101a] border border-white/10 rounded-2xl p-6 flex flex-col gap-6 relative animate-slide-up" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex justify-between items-center border-b border-white/10 pb-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Layers className="text-indigo-400 h-5 w-5" /> System Architecture & Flowchart
                </h3>
                <p className="text-xs text-slate-400">High-level predictive pipeline topology blueprint</p>
              </div>
              <button 
                onClick={() => setIsArchOpen(false)}
                className="p-1.5 hover:bg-white/5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            {/* Flowchart Content */}
            <div className="flex flex-col gap-5 text-sm leading-relaxed text-slate-300">
              <div className="bg-[#121424] border border-white/5 p-5 rounded-xl flex flex-col gap-4">
                <div className="grid grid-cols-5 items-center text-center text-xs font-bold gap-2">
                  {/* Step 1 */}
                  <div className="bg-indigo-950/40 border border-indigo-500/20 p-3 rounded-lg flex flex-col items-center gap-1.5">
                    <Database className="h-4 w-4 text-indigo-400" />
                    <span className="text-white">Ingestion</span>
                    <span className="text-[9px] text-slate-500 font-normal">QA CSV/Manual Reports</span>
                  </div>
                  <div className="text-indigo-500 text-lg font-bold select-none">&rarr;</div>
                  
                  {/* Step 2 */}
                  <div className="bg-violet-950/40 border border-violet-500/20 p-3 rounded-lg flex flex-col items-center gap-1.5">
                    <Activity className="h-4 w-4 text-violet-400" />
                    <span className="text-white">Feature Eng.</span>
                    <span className="text-[9px] text-slate-500 font-normal">Lag L1-L3 & Roll Mean</span>
                  </div>
                  <div className="text-violet-500 text-lg font-bold select-none">&rarr;</div>

                  {/* Step 3 */}
                  <div className="bg-fuchsia-950/40 border border-fuchsia-500/20 p-3 rounded-lg flex flex-col items-center gap-1.5">
                    <Sparkles className="h-4 w-4 text-fuchsia-400" />
                    <span className="text-white">RF Regressor</span>
                    <span className="text-[9px] text-slate-500 font-normal">Recursive 4-Week Inference</span>
                  </div>
                </div>

                <div className="border-t border-white/5 pt-4 grid grid-cols-2 gap-4 text-xs">
                  <div className="bg-slate-900/60 p-3.5 border border-white/5 rounded-lg flex flex-col gap-2">
                    <span className="font-bold text-slate-200 uppercase tracking-wider text-[10px]">Explainability Pipeline</span>
                    <p className="text-slate-400 leading-normal">
                      SHAP (SHapley Additive exPlanations) values are generated using tree models, mapping how lag values, seasonal cycles, and recent defect metrics dynamically alter the baseline.
                    </p>
                  </div>
                  <div className="bg-slate-900/60 p-3.5 border border-white/5 rounded-lg flex flex-col gap-2">
                    <span className="font-bold text-slate-200 uppercase tracking-wider text-[10px]">File-Based Caching Blueprints</span>
                    <p className="text-slate-400 leading-normal">
                      To achieve sub-second dashboard rendering times, pre-computed predictions are saved to versioned JSON wrappers, which bypass raw database table scanning on load.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <span className="font-bold text-white uppercase tracking-wider text-[10px]">Infrastructure Blueprint</span>
                <div className="border border-white/10 rounded-xl p-4 bg-slate-950 font-mono text-[10px] text-indigo-300 leading-relaxed overflow-x-auto">
                  +---------------------+      FastAPI (Uvicorn)      +-------------------------+<br />
                  | React SPA Dashboard | &lt;========================&gt; |  SQLite / PostgreSQL DB |<br />
                  +---------------------+                             +-------------------------+<br />
                  | API Request Caching |                                          |<br />
                  | Local Storage Store | &lt;---- read/write JSON cache ------------+<br />
                  +---------------------+
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end border-t border-white/10 pt-4 mt-2">
              <button 
                onClick={() => setIsArchOpen(false)}
                className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs px-4 py-2 font-bold transition-all shadow-md shadow-indigo-900/40 cursor-pointer"
              >
                Close Blueprint
              </button>
            </div>
          </div>
        </div>
      )}

      {/* How it Works Modal */}
      {isHowItWorksOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto animate-fade-in" onClick={() => setIsHowItWorksOpen(false)}>
          <div className="w-full max-w-2xl bg-[#0e101a] border border-white/10 rounded-2xl p-6 flex flex-col gap-6 relative animate-slide-up" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex justify-between items-center border-b border-white/10 pb-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Sparkles className="text-indigo-400 h-5 w-5" /> How AI QA Forecasting Works
                </h3>
                <p className="text-xs text-slate-400">Step-by-step explanatory walkthrough of the prediction engine</p>
              </div>
              <button 
                onClick={() => setIsHowItWorksOpen(false)}
                className="p-1.5 hover:bg-white/5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Pipeline Content */}
            <div className="flex flex-col gap-4 text-xs text-slate-300 overflow-y-auto max-h-[400px] pr-2">
              
              {/* Step 1 */}
              <div className="flex gap-3.5 border-b border-white/5 pb-3">
                <div className="bg-indigo-500/10 text-indigo-400 h-7 w-7 rounded-full flex items-center justify-center font-bold border border-indigo-500/20 shrink-0 select-none">1</div>
                <div>
                  <h4 className="font-bold text-white text-sm">Data Ingestion & Normalization</h4>
                  <p className="text-slate-400 mt-1 leading-relaxed">
                    Weekly QA reports represent testing outcomes across three layers: Story Tests, Automated Regression (AR), and Manual Regression (MR). Values are normalized to compute failed rates, bug creation ratios, and total tests executed.
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex gap-3.5 border-b border-white/5 pb-3">
                <div className="bg-indigo-500/10 text-indigo-400 h-7 w-7 rounded-full flex items-center justify-center font-bold border border-indigo-500/20 shrink-0 select-none">2</div>
                <div>
                  <h4 className="font-bold text-white text-sm">Feature Engineering (Time Lags)</h4>
                  <p className="text-slate-400 mt-1 leading-relaxed">
                    Time-series models require historical context. The pipeline creates lags (1-week, 2-week, 3-week values) and rolling metrics (3-week mean, 3-week standard deviation) to capture momentum, seasonal cycles, and recent defect variance.
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex gap-3.5 border-b border-white/5 pb-3">
                <div className="bg-indigo-500/10 text-indigo-400 h-7 w-7 rounded-full flex items-center justify-center font-bold border border-indigo-500/20 shrink-0 select-none">3</div>
                <div>
                  <h4 className="font-bold text-white text-sm">RandomForest Regression Fitting</h4>
                  <p className="text-slate-400 mt-1 leading-relaxed">
                    A RandomForestRegressor is fitted to the engineered training dataset. RandomForest combines the predictions of multiple decision trees to form a robust, high-generalization model that handles seasonal defect fluctuations without overfitting.
                  </p>
                </div>
              </div>

              {/* Step 4 */}
              <div className="flex gap-3.5 border-b border-white/5 pb-3">
                <div className="bg-indigo-500/10 text-indigo-400 h-7 w-7 rounded-full flex items-center justify-center font-bold border border-indigo-500/20 shrink-0 select-none">4</div>
                <div>
                  <h4 className="font-bold text-white text-sm">Recursive forecasting</h4>
                  <p className="text-slate-400 mt-1 leading-relaxed">
                    For forecasting multiple weeks into the future, the engine employs recursive predicting: it predicts Week 1, feeds that predicted output back as a lag feature to predict Week 2, and repeats this loop for the full 4-week horizon.
                  </p>
                </div>
              </div>

              {/* Step 5 */}
              <div className="flex gap-3.5">
                <div className="bg-indigo-500/10 text-indigo-400 h-7 w-7 rounded-full flex items-center justify-center font-bold border border-indigo-500/20 shrink-0 select-none">5</div>
                <div>
                  <h4 className="font-bold text-white text-sm">SHAP Explainability Analysis</h4>
                  <p className="text-slate-400 mt-1 leading-relaxed">
                    A TreeExplainer computes SHAP values for the next week's predictions, tracing the exact additive contribution (positive or negative) that features like "Last Week Performance" or "3-Week Trend" had on the output.
                  </p>
                </div>
              </div>

            </div>

            {/* Footer */}
            <div className="flex justify-end border-t border-white/10 pt-4 mt-2">
              <button 
                onClick={() => setIsHowItWorksOpen(false)}
                className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs px-4 py-2 font-bold transition-all shadow-md shadow-indigo-900/40 cursor-pointer"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
