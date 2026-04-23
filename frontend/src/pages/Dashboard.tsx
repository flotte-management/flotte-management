import { useQuery, useSubscription } from '@apollo/client/react';
import { useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { AppLayout } from '../components/layout/AppLayout';
import { Card, StatCard } from '../components/ui/Card';
import { DASHBOARD_QUERY, NOUVELLE_ALERTE_SUBSCRIPTION } from '../apollo/queries/dashboard';
import type { DashboardStats, AlerteEvent } from '../types';
import { Car, Users, Wrench, ClipboardList } from 'lucide-react';

const STATUT_COLORS = {
  'Disponible':     '#3FB950',
  'En mission':     '#58A6FF',
  'En maintenance': '#D29922',
  'Hors service':   '#F85149',
};

function formatTs(ts?: string) {
  if (!ts) return '';
  try { return new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); }
  catch { return ts; }
}

export default function Dashboard() {
  const { data, loading } = useQuery<{ dashboardFlotte: DashboardStats }>(DASHBOARD_QUERY, {
    pollInterval: 30_000,
  });

  const [alerts, setAlerts] = useState<(AlerteEvent & { receivedAt: string })[]>([]);

  useSubscription<{ nouvelleAlerte: AlerteEvent }>(NOUVELLE_ALERTE_SUBSCRIPTION, {
    onData: ({ data: sub }) => {
      const alerte = sub.data?.nouvelleAlerte;
      if (alerte) {
        setAlerts((prev) => [{ ...alerte, receivedAt: new Date().toISOString() }, ...prev].slice(0, 20));
      }
    },
  });

  const stats = data?.dashboardFlotte;

  const pieData = stats ? [
    { name: 'Disponible',     value: stats.vehiculesDisponibles },
    { name: 'En mission',     value: stats.vehiculesEnMission },
    { name: 'En maintenance', value: stats.vehiculesEnMaintenance },
    { name: 'Hors service',   value: stats.vehiculesHorsService },
  ].filter(d => d.value > 0) : [];

  return (
    <AppLayout title="Dashboard">
      {loading && !stats ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>Chargement…</div>
      ) : (
        <>
          {/* KPI row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
            <StatCard label="Total véhicules"       value={stats?.totalVehicules ?? 0}       color="var(--text-primary)" icon={<Car size={18} />} />
            <StatCard label="Disponibles"           value={stats?.vehiculesDisponibles ?? 0} color="#3FB950"             icon={<Car size={18} />} />
            <StatCard label="En mission"            value={stats?.vehiculesEnMission ?? 0}   color="#58A6FF"             icon={<Car size={18} />} />
            <StatCard label="En maintenance"        value={stats?.vehiculesEnMaintenance ?? 0} color="#D29922"           icon={<Wrench size={18} />} />
            <StatCard label="Conducteurs actifs"    value={stats?.conducteursActifs ?? 0}    color="#3FB950"             icon={<Users size={18} />} />
            <StatCard label="Missions en cours"     value={stats?.missionsEnCours ?? 0}      color="#BC8CFF"             icon={<ClipboardList size={18} />} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {/* Donut chart */}
            <Card>
              <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 600 }}>Répartition des véhicules</h3>
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="value">
                      {pieData.map((entry) => (
                        <Cell key={entry.name} fill={STATUT_COLORS[entry.name as keyof typeof STATUT_COLORS] ?? '#8B949E'} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }}
                      labelStyle={{ color: 'var(--text-primary)' }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text-secondary)' }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                  Aucune donnée
                </div>
              )}
            </Card>

            {/* Alerts feed */}
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Alertes en temps réel</h3>
                <span style={{
                  width: 8, height: 8, borderRadius: '50%', background: '#3FB950',
                  boxShadow: '0 0 6px #3FB950', display: 'inline-block',
                  animation: 'pulse 1.5s ease infinite',
                }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 220, overflowY: 'auto' }}>
                {alerts.length === 0 ? (
                  <div style={{ color: 'var(--text-secondary)', fontSize: 13, padding: '20px 0', textAlign: 'center' }}>
                    En attente d'alertes…
                  </div>
                ) : alerts.map((a, i) => (
                  <div key={i} style={{
                    padding: '8px 12px',
                    background: 'var(--bg-elevated)',
                    borderRadius: 6,
                    borderLeft: `3px solid ${a.type === 'GEOFENCE' ? '#D29922' : a.type === 'MAINTENANCE' ? '#58A6FF' : '#F85149'}`,
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 500 }}>{a.message}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                      {a.type} · {formatTs(a.receivedAt)}
                      {a.vehiculeId && ` · Véh. ${a.vehiculeId.slice(0, 8)}`}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Stats row 2 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginTop: 20 }}>
            <StatCard label="Conducteurs en mission"  value={stats?.conducteursEnMission ?? 0}  color="#58A6FF" />
            <StatCard label="Maintenances en cours"   value={stats?.maintenancesEnCours ?? 0}   color="#D29922" />
            <StatCard label="Véhicules hors service"  value={stats?.vehiculesHorsService ?? 0}  color="#F85149" />
          </div>
        </>
      )}
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </AppLayout>
  );
}
