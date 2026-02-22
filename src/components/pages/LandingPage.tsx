import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { LoginForm } from '../auth/LoginForm';
import { RegisterForm } from '../auth/RegisterForm';
import { PinModal } from '../auth/PinModal';

type Modal = 'login' | 'register' | 'pin' | null;

export function LandingPage() {
  const [modal, setModal] = useState<Modal>(null);
  const navigate = useNavigate();
  const loginAsGuest = useAuthStore((s) => s.loginAsGuest);

  // Hidden dev access: 10 clicks on logo within 5 seconds
  const clickTimestamps = useRef<number[]>([]);

  const handleLogoClick = useCallback(() => {
    const now = Date.now();
    clickTimestamps.current.push(now);

    // Keep only clicks within last 5 seconds
    clickTimestamps.current = clickTimestamps.current.filter(
      (t) => now - t < 5000
    );

    if (clickTimestamps.current.length >= 10) {
      clickTimestamps.current = [];
      setModal('pin');
    }
  }, []);

  const handleGuestPlay = () => {
    loginAsGuest();
    navigate('/play/chart');
  };

  return (
    <div className="min-h-screen bg-[#0a0e17] flex flex-col items-center justify-center p-4">
      {/* Logo / Title */}
      <div className="text-center mb-12">
        <h1
          className="text-5xl sm:text-6xl font-bold text-white mb-2 cursor-default select-none"
          onClick={handleLogoClick}
        >
          Dice<span className="text-blue-400">Stock</span>
        </h1>
        <p className="text-gray-500 text-lg">Simulated Stock Trading Game</p>
      </div>

      {/* Entry buttons */}
      <div className="flex flex-col gap-4 w-full max-w-xs">
        <button
          onClick={handleGuestPlay}
          className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3.5 px-6 rounded-xl transition-colors text-lg"
        >
          Play as Guest
        </button>

        <button
          onClick={() => setModal('login')}
          className="w-full bg-[#161b22] hover:bg-[#1c2333] border border-gray-700 text-white font-semibold py-3.5 px-6 rounded-xl transition-colors text-lg"
        >
          Login / Register
        </button>
      </div>

      {/* Version tag */}
      <p
        className="text-gray-600 text-sm mt-16 cursor-default select-none"
        onClick={handleLogoClick}
      >
        v1.0.0
      </p>

      {/* Modals */}
      {modal === 'login' && (
        <LoginForm
          onClose={() => { setModal(null); navigate('/play/chart'); }}
          onSwitchToRegister={() => setModal('register')}
        />
      )}
      {modal === 'register' && (
        <RegisterForm
          onClose={() => { setModal(null); navigate('/play/chart'); }}
          onSwitchToLogin={() => setModal('login')}
        />
      )}
      {modal === 'pin' && (
        <PinModal onClose={() => setModal(null)} />
      )}
    </div>
  );
}
