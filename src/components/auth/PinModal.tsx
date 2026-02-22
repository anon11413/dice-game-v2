import { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useNavigate } from 'react-router-dom';

interface Props {
  onClose: () => void;
}

export function PinModal({ onClose }: Props) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const enterDevMode = useAuthStore((s) => s.enterDevMode);
  const navigate = useNavigate();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (enterDevMode(pin)) {
      onClose();
      navigate('/dev/chart');
    } else {
      setError(true);
      setPin('');
      setTimeout(() => setError(false), 1500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-[#0d1117] border border-gray-700 rounded-xl p-6 w-full max-w-xs"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-white mb-4 text-center">Developer Access</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            ref={inputRef}
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            className={`w-full bg-[#161b22] border rounded-lg px-3 py-3 text-white text-center text-2xl tracking-[0.5em] font-mono focus:outline-none ${
              error ? 'border-red-500 animate-pulse' : 'border-gray-700 focus:border-blue-500'
            }`}
            placeholder="PIN"
            maxLength={10}
            inputMode="numeric"
          />

          <button
            type="submit"
            disabled={!pin}
            className="w-full bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 text-white font-medium py-2.5 rounded-lg transition-colors"
          >
            Enter
          </button>
        </form>
      </div>
    </div>
  );
}
