import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

interface AuthGuardProps {
  children: React.ReactNode;
  roles?: string[];
}

export function AuthGuard({ children, roles }: AuthGuardProps) {
  const { isAuthenticated, isLoading, hasAnyRole } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ background: 'var(--bg-base)' }}>
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-3" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
          <p style={{ color: 'var(--text-secondary)' }}>Authentification…</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (roles && roles.length > 0 && !hasAnyRole(roles)) {
    return <Navigate to="/403" replace />;
  }

  return <>{children}</>;
}
