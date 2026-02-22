import { lazy, Suspense, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAnalysisStore } from '../../store/analysisStore';
import { getWorkerBridge } from '../../bridge/useSimulation';

const DashboardTab = lazy(() => import('./tabs/DashboardTab').then(m => ({ default: m.DashboardTab })));
const OverviewTab = lazy(() => import('./tabs/OverviewTab').then(m => ({ default: m.OverviewTab })));
const TechnicalTab = lazy(() => import('./tabs/TechnicalTab').then(m => ({ default: m.TechnicalTab })));
const QuantLabTab = lazy(() => import('./tabs/QuantLabTab').then(m => ({ default: m.QuantLabTab })));

const TABS = [
  { key: 'dashboard' as const, label: 'Dashboard' },
  { key: 'overview' as const, label: 'Overview' },
  { key: 'technical' as const, label: 'Technical' },
  { key: 'quant' as const, label: 'Quant Lab' },
];

function TabSpinner() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
    </div>
  );
}

export function AnalysisPage() {
  const activeTab = useAnalysisStore((s) => s.activeTab);
  const setActiveTab = useAnalysisStore((s) => s.setActiveTab);
  const location = useLocation();
  const isDevMode = location.pathname.startsWith('/dev');

  // Enable analysis mode in worker when this page mounts (dev mode only)
  useEffect(() => {
    if (!isDevMode) return;
    const bridge = getWorkerBridge();
    if (bridge) {
      bridge.send({ type: 'SET_ANALYSIS_MODE', mode: 'standard' });
    }
    return () => {
      const b = getWorkerBridge();
      if (b) {
        b.send({ type: 'SET_ANALYSIS_MODE', mode: 'off' });
      }
    };
  }, [isDevMode]);

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex items-center gap-1 px-2 sm:px-4 py-1.5 bg-[#0d1117] border-b border-gray-800 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md whitespace-nowrap transition-colors ${
              activeTab === tab.key
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <Suspense fallback={<TabSpinner />}>
          {activeTab === 'dashboard' && <DashboardTab />}
          {activeTab === 'overview' && <OverviewTab />}
          {activeTab === 'technical' && <TechnicalTab />}
          {activeTab === 'quant' && <QuantLabTab />}
        </Suspense>
      </div>
    </div>
  );
}
