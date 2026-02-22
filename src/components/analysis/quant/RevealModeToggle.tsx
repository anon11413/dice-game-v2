import { useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useAnalysisStore } from '../../../store/analysisStore';
import { getWorkerBridge } from '../../../bridge/useSimulation';

export function RevealModeToggle() {
  const location = useLocation();
  const isDevMode = location.pathname.startsWith('/dev');
  const revealEnabled = useAnalysisStore((s) => s.revealEnabled);
  const setRevealEnabled = useAnalysisStore((s) => s.setRevealEnabled);

  const toggle = useCallback(() => {
    if (!isDevMode) return;
    const next = !revealEnabled;
    setRevealEnabled(next);
    const bridge = getWorkerBridge();
    if (bridge) {
      bridge.send({ type: 'SET_ANALYSIS_MODE', mode: next ? 'reveal' : 'standard' });
    }
  }, [isDevMode, revealEnabled, setRevealEnabled]);

  if (!isDevMode) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-[#0d1117] rounded-lg border border-gray-800">
        <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
        </svg>
        <span className="text-xs text-gray-500 font-medium">Reveal Mode</span>
        <span className="text-[10px] text-gray-600 ml-1">Dev Mode Only</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-[#0d1117] rounded-lg border border-gray-800">
      <span className="text-xs text-gray-300 font-medium">Reveal Mode</span>
      <button
        onClick={toggle}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
          revealEnabled ? 'bg-purple-600' : 'bg-gray-700'
        }`}
        aria-label="Toggle reveal mode"
      >
        <span
          className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
            revealEnabled ? 'translate-x-[18px]' : 'translate-x-[3px]'
          }`}
        />
      </button>
      {revealEnabled && (
        <span className="text-[10px] text-purple-400 font-medium">ACTIVE</span>
      )}
    </div>
  );
}
