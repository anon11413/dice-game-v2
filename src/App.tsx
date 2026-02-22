import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { ChartPage } from './components/chart/ChartPage';
import { AnalysisPage } from './components/analysis/AnalysisPage';
import { useSimulation } from './bridge/useSimulation';

function AppInner() {
  useSimulation();

  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Navigate to="/chart" replace />} />
        <Route path="/chart" element={<ChartPage />} />
        <Route path="/analysis" element={<AnalysisPage />} />
      </Routes>
    </AppShell>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppInner />
    </BrowserRouter>
  );
}
