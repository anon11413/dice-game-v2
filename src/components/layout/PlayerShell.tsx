import { useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useMarketStore } from '../../store/marketStore';
import { getServerBridge } from '../../bridge/ServerBridge';

const BASE_PRICE = 100;

const tabs = [
  { path: '/play/chart', label: 'Chart' },
  { path: '/play/analysis', label: 'Analysis' },
  { path: '/play/portfolio', label: 'Portfolio' },
  { path: '/play/settings', label: 'Settings' },
  { path: '/play/leaderboard', label: 'Leaderboard' },
  { path: '/play/research', label: 'Research' },
];

export function PlayerShell() {
  const { user, isGuest, token, logout } = useAuthStore();
  const price = useMarketStore((s) => s.price);
  const priceB = Math.max(0.01, 2 * BASE_PRICE - price);
  const navigate = useNavigate();

  // Connect to server on mount
  useEffect(() => {
    const bridge = getServerBridge();
    bridge.connect(token);

    return () => {
      bridge.disconnect();
    };
  }, [token]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-[#0a0e17] text-gray-100 overflow-hidden">
      {/* Header */}
      <header className="bg-[#0d1117] border-b border-gray-800 px-3 py-2 flex items-center justify-between gap-2 flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-lg font-bold text-white whitespace-nowrap">
            Dice<span className="text-blue-400">Stock</span>
          </h1>
          <div className="hidden sm:flex items-center gap-3 text-sm">
            <span className="text-gray-400">A:</span>
            <span className="text-white font-medium tabular-nums">${price.toFixed(2)}</span>
            <span className="text-gray-400">B:</span>
            <span className="text-white font-medium tabular-nums">${priceB.toFixed(2)}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400 hidden sm:block">
            {isGuest ? 'Guest' : user?.username}
          </span>
          <button
            onClick={handleLogout}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors px-2 py-1"
          >
            {isGuest ? 'Exit' : 'Logout'}
          </button>
        </div>
      </header>

      {/* Tab Bar */}
      <nav className="bg-[#0d1117] border-b border-gray-800 flex overflow-x-auto flex-shrink-0 scrollbar-none">
        {tabs.map((tab) => (
          <NavLink
            key={tab.path}
            to={tab.path}
            className={({ isActive }) =>
              `px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors min-h-[44px] flex items-center ${
                isActive
                  ? 'text-blue-400 border-blue-400'
                  : 'text-gray-400 border-transparent hover:text-gray-200'
              }`
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
