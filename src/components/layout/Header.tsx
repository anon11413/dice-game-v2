import { SimControls } from '../controls/SimControls';
import { useSimulationStore } from '../../store/simulationStore';

export function Header() {
  const tickCount = useSimulationStore((s) => s.tickCount);
  const day = Math.floor(tickCount / 390) + 1;
  const tickInDay = tickCount % 390;

  return (
    <header className="flex items-center justify-between px-4 py-2 bg-[#0d1117] border-b border-gray-800">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-bold text-white tracking-tight">DiceStock</h1>
        <span className="text-xs text-gray-500 font-mono">
          Day {day} | Tick {tickInDay}/{390}
        </span>
      </div>

      <SimControls />

      <div className="text-xs text-gray-500 font-mono tabular-nums">
        Total: {tickCount.toLocaleString()}
      </div>
    </header>
  );
}
