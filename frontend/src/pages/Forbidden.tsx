import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function Forbidden() {
  const navigate = useNavigate();
  const { keycloak } = useAuth();

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg-base)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <div style={{ textAlign: 'center', maxWidth: 420 }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>🔒</div>
        <h1 style={{ margin: '0 0 8px', fontSize: 28, fontWeight: 700, color: 'var(--danger)' }}>403</h1>
        <h2 style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>
          Accès refusé
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6, marginBottom: 28 }}>
          Vous n'avez pas les permissions nécessaires pour accéder à cette page.
          Contactez votre administrateur si vous pensez qu'il s'agit d'une erreur.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button
            onClick={() => navigate('/')}
            style={{
              padding: '9px 20px', borderRadius: 8, border: 'none',
              background: 'var(--accent)', color: '#fff', fontSize: 14, fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Retour à l'accueil
          </button>
          <button
            onClick={() => keycloak.logout({ redirectUri: window.location.origin + '/login' })}
            style={{
              padding: '9px 20px', borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'transparent', color: 'var(--text-secondary)', fontSize: 14,
              cursor: 'pointer',
            }}
          >
            Se déconnecter
          </button>
        </div>
      </div>
    </div>
  );
}
