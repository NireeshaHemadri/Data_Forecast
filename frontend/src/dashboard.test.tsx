import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import App from './App';

// Mock Recharts since it does not render well in jsdom/headless testing environments
vi.mock('recharts', () => {
  return {
    ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
    AreaChart: ({ children }: any) => <div data-testid="area-chart">{children}</div>,
    Area: () => <div data-testid="area" />,
    XAxis: () => <div data-testid="xaxis" />,
    YAxis: () => <div data-testid="yaxis" />,
    CartesianGrid: () => <div data-testid="cartesian-grid" />,
    Tooltip: () => <div data-testid="tooltip" />,
  };
});

describe('Dashboard Component Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test('renders dashboard titles, metrics, and handles loaded mock forecast data', async () => {
    const mockProjects = ['Project Pegasus', 'Project Orion'];
    const mockForecastResponse = {
      projectName: 'Project Pegasus',
      historical: [
        {
          id: 1,
          projectName: 'Project Pegasus',
          authors: 'QA Team',
          storyTests: 50,
          regressionTestsAutomated: 100,
          regressionTestsManual: 100,
          totalTestsByApplication: 250,
          storyPassed: 40,
          storyFailed: 5,
          storyUnexecuted: 0,
          storyBlocked: 3,
          storySkipped: 2,
          storyBugs: 5,
          arPassed: 92,
          arFailed: 5,
          arBugs: 3,
          mrPassed: 90,
          mrFailed: 6,
          mrBugs: 4,
          createdAt: '2026-05-01T00:00:00'
        }
      ],
      forecast: [
        {
          weekIndex: 1,
          storyTests: 50,
          regressionTestsAutomated: 100,
          regressionTestsManual: 100,
          totalTestsByApplication: 250,
          storyBugs: 5,
          arBugs: 3,
          mrBugs: 4,
          totalBugs: 12,
          storyPassed: 42,
          arPassed: 93,
          mrPassed: 91,
          storyFailed: 4,
          arFailed: 4,
          mrFailed: 5,
          createdAt: '2026-05-08T00:00:00',
          bugsErrorMargin: 2.0,
          bugsConfidence: 87.0
        }
      ],
      metrics: {
        storyBugs: { mae: 1.2, r2: 0.87, dataPointsCount: 52 },
        arFailed: { mae: 1.5, r2: 0.8, dataPointsCount: 52 }
      },
      explanations: {
        storyBugs: {
          targetMetric: 'storyBugs',
          baseValue: 5.0,
          predictionValue: 5.0,
          features: [
            { featureName: 'lag_1', featureValue: 5.0, shapValue: 0.0, description: 'Previous week lag description' }
          ]
        }
      },
      modelType: 'Random Forest Regressor (Auto-regressive)',
      lastTrained: '22 May 2026 17:30',
      trainingSamples: 52,
      forecastHorizon: 4
    };

    // Mock fetch globally
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith('/projects')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockProjects),
        });
      }
      if (url.includes('/forecast')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockForecastResponse),
        });
      }
      return Promise.reject(new Error('Unknown url: ' + url));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    // Verify initial layout title and headers
    expect(screen.getByText(/Aegis AI/i)).toBeDefined();
    
    // Wait for the components to populate and loading state to end
    await waitFor(() => {
      expect(screen.getByText('Predicted Next 4 Weeks')).toBeDefined();
    }, { timeout: 5000 });

    // Verify project selector options populated
    expect(screen.getByText('Project Pegasus')).toBeDefined();
    
    // Chart title renamed to "Historical Weekly Reports → Next 4-Week AI Forecast"
    expect(screen.getByText('Historical Weekly Reports → Next 4-Week AI Forecast')).toBeDefined();

    // Check confidence display: 12 ± 2 bugs (the totalBugs is 12, error margin is 2.0)
    expect(screen.getByText(/12 ± 2/i)).toBeDefined();
    
    // Use custom matcher for Confidence: 87% since it spans multiple HTML tags
    expect(screen.getByText((_content, node) => {
      const hasText = (node: Element) => node.textContent === 'Weekly defect influx. Confidence: 87%';
      const nodeHasText = hasText(node as Element);
      const childrenDontHaveText = Array.from(node?.children || []).every(child => !hasText(child));
      return nodeHasText && childrenDontHaveText;
    })).toBeDefined();

    // Check Model Metadata section (Random Forest Regressor, 52 weeks, Last trained, Horizon)
    expect(screen.getByText(/Random Forest Regressor/i)).toBeDefined();
    expect(screen.getByText(/52 weekly samples/i)).toBeDefined();
    expect(screen.getByText(/22 May 2026 17:30/i)).toBeDefined();
    expect(screen.getAllByText(/4 weeks/i).length).toBeGreaterThanOrEqual(1);

    // Check export button is present
    expect(screen.getByText(/Export Forecast Report/i)).toBeDefined();
  });
});
