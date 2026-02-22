import { useState } from 'react';
import { useAuthStore } from '../../store/authStore';

interface Props {
  onClose: () => void;
  onSwitchToLogin: () => void;
}

export function RegisterForm({ onClose, onSwitchToLogin }: Props) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState('');
  const { register, isLoading, error, clearError } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');

    if (password !== confirmPassword) {
      setLocalError('Passwords do not match');
      return;
    }

    try {
      await register(username, password);
      onClose();
    } catch {
      // Error is set in store
    }
  };

  const displayError = localError || error;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-[#0d1117] border border-gray-700 rounded-xl p-6 w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold text-white mb-4">Create Account</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => { setUsername(e.target.value); clearError(); setLocalError(''); }}
              className="w-full bg-[#161b22] border border-gray-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-blue-500"
              placeholder="3-50 chars, letters/numbers/_"
              autoFocus
              autoComplete="username"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); clearError(); setLocalError(''); }}
              className="w-full bg-[#161b22] border border-gray-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-blue-500"
              placeholder="At least 6 characters"
              autoComplete="new-password"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); setLocalError(''); }}
              className="w-full bg-[#161b22] border border-gray-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-blue-500"
              placeholder="Confirm password"
              autoComplete="new-password"
            />
          </div>

          {displayError && (
            <p className="text-red-400 text-sm">{displayError}</p>
          )}

          <button
            type="submit"
            disabled={isLoading || !username || !password || !confirmPassword}
            className="w-full bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium py-2.5 rounded-lg transition-colors"
          >
            {isLoading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-gray-500 text-sm mt-4">
          Already have an account?{' '}
          <button onClick={onSwitchToLogin} className="text-blue-400 hover:text-blue-300">
            Login
          </button>
        </p>
      </div>
    </div>
  );
}
