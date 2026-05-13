import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Car, Users, Wrench, MapPin, ClipboardList, Info,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

const NAV_ITEMS = [
  { to: '/dashboard',     icon: LayoutDashboard, label: 'Dashboard',       roles: [] as string[] },
  { to: '/vehicules',     icon: Car,             label: 'Véhicules',        roles: [] as string[] },
  { to: '/conducteurs',   icon: Users,           label: 'Conducteurs',      roles: ['ADMIN', 'MANAGER'] },
  { to: '/maintenances',  icon: Wrench,          label: 'Maintenances',     roles: ['ADMIN', 'MANAGER', 'TECHNICIEN'] },
  { to: '/localisation',  icon: MapPin,          label: 'Localisation',     roles: ['ADMIN', 'MANAGER'] },
  { to: '/missions',      icon: ClipboardList,   label: 'Missions',         roles: [] as string[] },
  { to: '/about',         icon: Info,            label: 'A propos',         roles: [] as string[] },
];

export function Sidebar() {
  const { hasAnyRole } = useAuth();

  return (
    <aside style={{
      position: 'fixed',
      left: 0, top: 0, bottom: 0,
      width: 220,
      background: 'var(--bg-surface)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 50,
    }}>
      {/* Brand */}
      <div style={{
        padding: '20px 16px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: 'var(--accent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, color: '#000', fontSize: 16,
        }}>F</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>FlotteMS</div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Fleet Management</div>
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '12px 8px', overflowY: 'auto' }}>
        {NAV_ITEMS.filter(item => item.roles.length === 0 || hasAnyRole(item.roles)).map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 12px',
                borderRadius: 6,
                marginBottom: 2,
                textDecoration: 'none',
                fontSize: 13,
                fontWeight: 500,
                color: isActive ? '#000' : 'var(--text-secondary)',
                background: isActive ? 'var(--accent)' : 'transparent',
                transition: 'all 0.1s',
              })}
            >
              <Icon size={16} />
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text-secondary)' }}>
        v1.0.0 — M1 GIL 2026
      </div>
    </aside>
  );
}
