import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';

// Pages
import { LandingPage } from './components/pages/LandingPage';
import { PortfolioPage } from './components/pages/PortfolioPage';
import { SettingsPage } from './components/pages/SettingsPage';
import { LeaderboardPage } from './components/pages/LeaderboardPage';

// Layouts
import { PlayerShell } from './components/layout/PlayerShell';
import { DevShell } from './components/layout/DevShell';

// Existing pages
import { ChartPage } from './components/chart/ChartPage';
import { AnalysisPage } from './components/analysis/AnalysisPage';

// Auth guards
import { RequireAuth, RequireDevAuth } from './components/auth/RequireAuth';

function AppInner() {
  const loadFromStorage = useAuthStore((s) => s.loadFromStorage);

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  return (
    <Routes>
      {/* Landing */}
      <Route path="/" element={<LandingPage />} />

      {/* Player routes */}
      <Route
        path="/play"
        element={
          <RequireAuth>
            <PlayerShell />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="chart" replace />} />
        <Route path="chart" element={<ChartPage />} />
        <Route path="analysis" element={<AnalysisPage />} />
        <Route path="portfolio" element={<PortfolioPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="leaderboard" element={<LeaderboardPage />} />
      </Route>

      {/* Dev routes */}
      <Route
        path="/dev"
        element={
          <RequireDevAuth>
            <DevShell />
          </RequireDevAuth>
        }
      >
        <Route index element={<Navigate to="chart" replace />} />
        <Route path="chart" element={<ChartPage />} />
        <Route path="analysis" element={<AnalysisPage />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppInner />
    </BrowserRouter>
  );
}
