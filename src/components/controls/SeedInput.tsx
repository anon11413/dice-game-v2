import { useSimulationStore } from '../../store/simulationStore';

export function SeedInput() {
  const { seed, setSeed, status } = useSimulationStore();

  return (
    <div className="flex items-center gap-1">
      <label className="text-xs text-gray-400">Seed:</label>
      <input
        type="number"
        value={seed}
        onChange={(e) => setSeed(Number(e.target.value))}
        disabled={status !== 'idle'}
        className="w-20 px-2 py-1 text-xs font-mono bg-gray-800 border border-gray-700 rounded text-gray-200 disabled:opacity-40"
      />
    </div>
  );
}
