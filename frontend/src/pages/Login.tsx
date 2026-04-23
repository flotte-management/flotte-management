import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';

export default function Login() {
  const { keycloak, isLoading, isAuthenticated } = useAuth();
  const [loggingIn, setLoggingIn] = useState(false);

  // Auto-redirect if already authenticated
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      window.location.replace('/');
    }
  }, [isLoading, isAuthenticated]);

  const handleLogin = () => {
    setLoggingIn(true);
    keycloak.login({ redirectUri: window.location.origin + '/' });
  };

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg-base)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      {/* Background gradient effect */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(88,166,255,0.08), transparent)',
      }} />

      <div style={{
        position: 'relative', width: 380, padding: '40px 36px',
        background: 'var(--bg-surface)', borderRadius: 16,
        border: '1px solid var(--border)', boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
      }}>
        {/* Logo & branding */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14, margin: '0 auto 16px',
            background: 'linear-gradient(135deg, var(--accent), var(--purple))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24,
          }}>
            🚛
          </div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>
            FlotteManager
          </h1>
          <p style={{ margin: '8px 0 0', fontSize: 14, color: 'var(--text-secondary)' }}>
            Plateforme de gestion de flotte
          </p>
        </div>

        {/* Login box */}
        <div style={{
          background: 'var(--bg-elevated)', borderRadius: 10, padding: '20px',
          border: '1px solid var(--border)', marginBottom: 24,
        }}>
          <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Connectez-vous avec votre compte Keycloak pour accéder à la plateforme.
          </p>
          <button
            onClick={handleLogin}
            disabled={isLoading || loggingIn}
            style={{
              width: '100%', padding: '11px 16px', borderRadius: 8,
              background: loggingIn ? 'rgba(88,166,255,0.5)' : 'var(--accent)',
              border: 'none', color: '#fff', fontSize: 14, fontWeight: 600,
              cursor: loggingIn ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'background 0.2s',
            }}
          >
            {loggingIn ? (
              <>
                <span style={{
                  width: 14, height: 14, borderRadius: '50%',
                  border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff',
                  animation: 'spin 0.7s linear infinite', display: 'inline-block',
                }} />
                Connexion en cours…
              </>
            ) : (
              'Se connecter avec Keycloak'
            )}
          </button>
        </div>

        {/* Feature highlights */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[
            ['👁️', 'Suivi temps réel'],
            ['🔧', 'Maintenances'],
            ['🗺️', 'Localisation GPS'],
            ['📋', 'Missions'],
          ].map(([icon, label]) => (
            <div key={label} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 10px', borderRadius: 6,
              background: 'var(--bg-elevated)', border: '1px solid var(--border)',
              fontSize: 12, color: 'var(--text-secondary)',
            }}>
              <span>{icon}</span> {label}
            </div>
          ))}
        </div>

        <p style={{ marginTop: 20, fontSize: 11, color: 'var(--text-secondary)', textAlign: 'center', opacity: 0.6 }}>
          Université de Rouen — M1 Génie Informatique 2025/2026
        </p>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
