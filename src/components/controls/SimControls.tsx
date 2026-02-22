import { useSimulation } from '../../bridge/useSimulation';
import { useSimulationStore } from '../../store/simulationStore';
import { SeedInput } from './SeedInput';

export function SimControls() {
  const { start, pause, resume, step, setSpeed } = useSimulation();
  const { status, ticksPerSecond, seed } = useSimulationStore();

  const handlePlayPause = () => {
    if (status === 'idle') {
      start(seed);
    } else if (status === 'running') {
      pause();
    } else {
      resume();
    }
  };

  return (
    <div className="flex items-center gap-3">
      <SeedInput />

      <button
        onClick={handlePlayPause}
        className="px-3 py-1 text-sm font-medium rounded bg-blue-600 hover:bg-blue-500 text-white transition-colors"
      >
        {status === 'running' ? 'Pause' : status === 'paused' ? 'Resume' : 'Start'}
      </button>

      <button
        onClick={() => step(1)}
        disabled={status === 'running'}
        className="px-3 py-1 text-sm font-medium rounded bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors disabled:opacity-40"
      >
        Step
      </button>

      <button
        onClick={() => step(13)}
        disabled={status === 'running'}
        className="px-3 py-1 text-sm font-medium rounded bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors disabled:opacity-40"
        title="Step 13 ticks (1 hour)"
      >
        +1H
      </button>

      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-400">Speed:</label>
        <input
          type="range"
          min="1"
          max="100"
          value={ticksPerSecond}
          onChange={(e) => setSpeed(Number(e.target.value))}
          className="w-20 h-1 accent-blue-500"
        />
        <span className="text-xs text-gray-400 font-mono w-8">{ticksPerSecond}</span>
      </div>
    </div>
  );
}
