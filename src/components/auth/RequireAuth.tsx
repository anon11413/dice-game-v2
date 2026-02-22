import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

interface Props {
  children: React.ReactNode;
}

export function RequireAuth({ children }: Props) {
  const { user, isGuest } = useAuthStore();

  if (!user && !isGuest) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

export function RequireDevAuth({ children }: Props) {
  const isDevMode = useAuthStore((s) => s.isDevMode);

  if (!isDevMode) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
