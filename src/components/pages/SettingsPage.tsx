import { useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { usePlayerStore } from '../../store/playerStore';

export function SettingsPage() {
  const { user, isGuest, logout } = useAuthStore();
  const { resetAccount } = usePlayerStore();
  const [showConfirm, setShowConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);

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
