import { Outlet, NavLink } from 'react-router-dom';
import { useSimulationStore } from '../../store/simulationStore';
import { SimControls } from '../controls/SimControls';
import { useSimulation } from '../../bridge/useSimulation';

const tabs = [
  { path: '/dev/chart', label: 'Chart' },
  { path: '/dev/analysis', label: 'Analysis' },
];

export function DevShell() {
  // Initialize the web worker simulation for dev mode
  useSimulation();

  const tickCount = useSimulationStore((s) => s.tickCount);
  const tickRate = 390;
  const day = Math.floor(tickCount / tickRate) + 1;
  const tickInDay = tickCount % tickRate;

  return (
    <div className="flex flex-col h-[100dvh] bg-[#0a0e17] text-gray-100 overflow-hidden">
      {/* Header */}
      <header className="bg-[#0d1117] border-b border-gray-800 px-3 py-2 flex items-center justify-between gap-2 flex-shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-white whitespace-nowrap">
            Dice<span className="text-blue-400">Stock</span>
            <span className="text-xs text-yellow-500 ml-2">DEV</span>
          </h1>
          <span className="text-sm text-gray-400 hidden sm:block">
            Day {day} | Tick {tickInDay}/{tickRate}
          </span>
        </div>

        <SimControls />

        <span className="text-sm text-gray-500 hidden sm:block tabular-nums">
          Total: {tickCount}
        </span>
      </header>

      {/* Tab Bar */}
      <nav className="bg-[#0d1117] border-b border-gray-800 flex flex-shrink-0">
        {tabs.map((tab) => (
          <NavLink
            key={tab.path}
            to={tab.path}
            className={({ isActive }) =>
              `px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
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
      <main className="flex-1 overflow-auto p-2">
        <Outlet />
      </main>
    </div>
  );
}
