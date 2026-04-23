import { LogOut, ChevronDown } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useState } from 'react';

const ROLE_COLORS: Record<string, string> = {
  ADMIN:       '#F85149',
  MANAGER:     '#58A6FF',
  TECHNICIEN:  '#D29922',
  UTILISATEUR: '#3FB950',
};

export function Header({ title }: { title: string }) {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const primaryRole = user?.roles[0] ?? 'UTILISATEUR';
  const fullName = user ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.username : '—';

  return (
    <header style={{
      position: 'fixed',
      left: 220, right: 0, top: 0,
      height: 56,
      background: 'var(--bg-surface)',
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 24px',
      zIndex: 40,
    }}>
      <h1 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{title}</h1>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, position: 'relative' }}>
        {/* Role badge */}
        <span style={{
          padding: '3px 8px', borderRadius: 99, fontSize: 11, fontWeight: 600,
          background: (ROLE_COLORS[primaryRole] ?? '#8B949E') + '22',
          color: ROLE_COLORS[primaryRole] ?? '#8B949E',
          border: `1px solid ${(ROLE_COLORS[primaryRole] ?? '#8B949E')}44`,
        }}>
          {primaryRole}
        </span>

        <button
          onClick={() => setMenuOpen(!menuOpen)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'var(--bg-elevated)', border: '1px solid var(--border)',
            borderRadius: 6, padding: '5px 10px',
            cursor: 'pointer', color: 'var(--text-primary)', fontSize: 13,
          }}
        >
          <div style={{
            width: 24, height: 24, borderRadius: '50%',
            background: 'var(--accent)', color: '#000',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700, flexShrink: 0,
          }}>
            {fullName.charAt(0).toUpperCase()}
          </div>
          <span style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {fullName}
          </span>
          <ChevronDown size={14} />
        </button>

        {menuOpen && (
          <div style={{
            position: 'absolute', top: '100%', right: 0, marginTop: 6,
            background: 'var(--bg-elevated)', border: '1px solid var(--border)',
            borderRadius: 8, minWidth: 180, boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            zIndex: 200,
          }}>
            <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{fullName}</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{user?.email}</div>
            </div>
            <button
              onClick={logout}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 14px', background: 'none', border: 'none',
                color: 'var(--danger)', cursor: 'pointer', fontSize: 13, borderRadius: '0 0 8px 8px',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--danger)22'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; }}
            >
              <LogOut size={14} />
              Déconnexion
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
