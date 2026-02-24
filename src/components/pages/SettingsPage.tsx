import { useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { usePlayerStore } from '../../store/playerStore';

const API_BASE = import.meta.env.PROD ? '' : 'http://localhost:3001';

function downloadCsv(endpoint: string, token?: string | null) {
  const url = `${API_BASE}/api${endpoint}`;
  if (token) {
    // For authenticated endpoints, fetch with token then trigger download
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => {
        if (!res.ok) throw new Error('Export failed');
        return res.blob();
      })
      .then((blob) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        const disposition = endpoint.replace(/[/?=]/g, '-');
        a.download = `dicestock${disposition}-${Date.now()}.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
      })
      .catch((err) => console.error('Export failed:', err));
  } else {
    // Public endpoints — direct navigation
    window.open(url, '_blank');
  }
}

export function SettingsPage() {
  const { user, isGuest, logout, token } = useAuthStore();
  const { resetAccount } = usePlayerStore();
  const [showConfirm, setShowConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [showResetSim, setShowResetSim] = useState(false);
  const [resetSimPin, setResetSimPin] = useState('');
  const [resetSimMsg, setResetSimMsg] = useState('');

  const handleReset = async () => {
    setResetting(true);
    try {
      await resetAccount();
    } catch (err) {
      console.error('Reset failed:', err);
    }
    setResetting(false);
    setShowConfirm(false);
  };

  const handleResetSim = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/reset-sim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: resetSimPin }),
      });
      const data = await res.json();
      if (res.ok) {
        setResetSimMsg('Simulation reset! Server restarting...');
      } else {
        setResetSimMsg(data.error || 'Reset failed');
      }
    } catch {
      setResetSimMsg('Connection lost — server is restarting');
    }
  };

  return (
    <div className="p-2 sm:p-4 max-w-lg mx-auto space-y-4">
      <div className="bg-[#0d1117] border border-gray-800 rounded-xl p-4">
        <h2 className="text-lg font-bold text-white mb-4">Account</h2>

        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-gray-400">Username</span>
            <span className="text-white font-medium">
              {isGuest ? 'Guest' : user?.username}
            </span>
          </div>

          {!isGuest && user?.createdAt && (
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Member since</span>
              <span className="text-gray-300">
                {new Date(user.createdAt).toLocaleDateString()}
              </span>
            </div>
          )}

          <div className="flex justify-between items-center">
            <span className="text-gray-400">Account type</span>
            <span className={`text-sm px-2 py-0.5 rounded ${
              isGuest ? 'bg-yellow-900/50 text-yellow-400' : 'bg-green-900/50 text-green-400'
            }`}>
              {isGuest ? 'Guest (no persistence)' : 'Registered'}
            </span>
          </div>
        </div>
      </div>

      {/* Data Export */}
      <div className="bg-[#0d1117] border border-gray-800 rounded-xl p-4">
        <h2 className="text-lg font-bold text-white mb-2">Data Export</h2>
        <p className="text-gray-400 text-sm mb-4">
          Download simulation data as CSV files for analysis.
        </p>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => downloadCsv('/export/candles?resolution=1')}
            className="bg-[#161b22] hover:bg-[#1c2333] border border-gray-700 text-gray-300 font-medium py-2.5 rounded-lg transition-colors text-sm min-h-[44px]"
          >
            Tick Candles
          </button>
          <button
            onClick={() => downloadCsv('/export/candles?resolution=13')}
            className="bg-[#161b22] hover:bg-[#1c2333] border border-gray-700 text-gray-300 font-medium py-2.5 rounded-lg transition-colors text-sm min-h-[44px]"
          >
            13-Tick Candles
          </button>
          <button
            onClick={() => downloadCsv('/export/price-history')}
            className="bg-[#161b22] hover:bg-[#1c2333] border border-gray-700 text-gray-300 font-medium py-2.5 rounded-lg transition-colors text-sm min-h-[44px]"
          >
            Price History (DB)
          </button>
          {!isGuest && (
            <>
              <button
                onClick={() => downloadCsv('/export/trades', token)}
                className="bg-[#161b22] hover:bg-[#1c2333] border border-gray-700 text-gray-300 font-medium py-2.5 rounded-lg transition-colors text-sm min-h-[44px]"
              >
                My Trades
              </button>
              <button
                onClick={() => downloadCsv('/export/portfolio', token)}
                className="bg-[#161b22] hover:bg-[#1c2333] border border-gray-700 text-gray-300 font-medium py-2.5 rounded-lg transition-colors text-sm min-h-[44px]"
              >
                My Portfolio
              </button>
            </>
          )}
        </div>
      </div>

      {/* Reset Account */}
      <div className="bg-[#0d1117] border border-gray-800 rounded-xl p-4">
        <h2 className="text-lg font-bold text-white mb-2">Reset Account</h2>
        <p className="text-gray-400 text-sm mb-4">
          Reset your cash back to $100 and clear all positions and trade history. This cannot be undone.
        </p>

        {!showConfirm ? (
          <button
            onClick={() => setShowConfirm(true)}
            className="w-full bg-red-900/50 hover:bg-red-900 border border-red-800 text-red-400 font-medium py-2.5 rounded-lg transition-colors min-h-[44px]"
          >
            Reset Account
          </button>
        ) : (
          <div className="space-y-2">
            <p className="text-red-400 text-sm font-medium">Are you sure? This will erase everything.</p>
            <div className="flex gap-2">
              <button
                onClick={handleReset}
                disabled={resetting}
                className="flex-1 bg-red-600 hover:bg-red-500 disabled:bg-gray-700 text-white font-bold py-2.5 rounded-lg transition-colors min-h-[44px]"
              >
                {resetting ? 'Resetting...' : 'Yes, Reset'}
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 bg-[#161b22] hover:bg-[#1c2333] border border-gray-700 text-white font-medium py-2.5 rounded-lg transition-colors min-h-[44px]"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Reset Simulation */}
      <div className="bg-[#0d1117] border border-gray-800 rounded-xl p-4">
        <h2 className="text-lg font-bold text-white mb-2">Reset Simulation</h2>
        <p className="text-gray-400 text-sm mb-4">
          Wipe all price history and restart the engine from tick 0. Requires DEV PIN.
        </p>

        {!showResetSim ? (
          <button
            onClick={() => setShowResetSim(true)}
            className="w-full bg-red-900/50 hover:bg-red-900 border border-red-800 text-red-400 font-medium py-2.5 rounded-lg transition-colors min-h-[44px]"
          >
            Reset Simulation
          </button>
        ) : (
          <div className="space-y-2">
            <input
              type="password"
              placeholder="Enter DEV PIN"
              value={resetSimPin}
              onChange={(e) => setResetSimPin(e.target.value)}
              className="w-full bg-[#161b22] border border-gray-700 text-white rounded-lg px-3 py-2.5 text-sm min-h-[44px]"
            />
            {resetSimMsg && (
              <p className={`text-sm ${resetSimMsg.includes('failed') || resetSimMsg.includes('Invalid') ? 'text-red-400' : 'text-green-400'}`}>
                {resetSimMsg}
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={handleResetSim}
                className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-2.5 rounded-lg transition-colors min-h-[44px]"
              >
                Confirm Reset
              </button>
              <button
                onClick={() => { setShowResetSim(false); setResetSimPin(''); setResetSimMsg(''); }}
                className="flex-1 bg-[#161b22] hover:bg-[#1c2333] border border-gray-700 text-white font-medium py-2.5 rounded-lg transition-colors min-h-[44px]"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Logout */}
      <div className="bg-[#0d1117] border border-gray-800 rounded-xl p-4">
        <button
          onClick={logout}
          className="w-full bg-[#161b22] hover:bg-[#1c2333] border border-gray-700 text-gray-300 font-medium py-2.5 rounded-lg transition-colors min-h-[44px]"
        >
          {isGuest ? 'Exit to Menu' : 'Logout'}
        </button>
      </div>
    </div>
  );
}
