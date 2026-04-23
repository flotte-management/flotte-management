import type { StatutVehicule, StatutConducteur, StatutMission, StatutMaintenance } from '../../types';

type AnyStatut = StatutVehicule | StatutConducteur | StatutMission | StatutMaintenance | string;

const STATUT_CONFIG: Record<string, { label: string; color: string }> = {
  // Vehicles
  DISPONIBLE:      { label: 'Disponible',      color: '#3FB950' },
  EN_MISSION:      { label: 'En mission',       color: '#58A6FF' },
  EN_MAINTENANCE:  { label: 'En maintenance',   color: '#D29922' },
  HORS_SERVICE:    { label: 'Hors service',     color: '#F85149' },
  RETIRE:          { label: 'Retiré',            color: '#8B949E' },
  // Conducteurs
  ACTIF:           { label: 'Actif',            color: '#3FB950' },
  EN_CONGE:        { label: 'En congé',          color: '#D29922' },
  SUSPENDU:        { label: 'Suspendu',          color: '#F85149' },
  INACTIF:         { label: 'Inactif',           color: '#8B949E' },
  // Missions
  PLANIFIEE:       { label: 'Planifiée',         color: '#BC8CFF' },
  EN_COURS:        { label: 'En cours',          color: '#58A6FF' },
  TERMINEE:        { label: 'Terminée',          color: '#3FB950' },
  ANNULEE:         { label: 'Annulée',           color: '#F85149' },
  EN_PAUSE:        { label: 'En pause',          color: '#D29922' },
  // Types maintenance
  PREVENTIVE:      { label: 'Préventive',        color: '#58A6FF' },
  CORRECTIVE:      { label: 'Corrective',        color: '#D29922' },
  URGENCE:         { label: 'Urgence',           color: '#F85149' },
  REVISION:        { label: 'Révision',          color: '#BC8CFF' },
};

interface StatusBadgeProps {
  statut: AnyStatut;
  size?: 'sm' | 'md';
}

export function StatusBadge({ statut, size = 'md' }: StatusBadgeProps) {
  const cfg = STATUT_CONFIG[statut] ?? { label: statut, color: '#8B949E' };
  const px = size === 'sm' ? '6px 10px' : '4px 10px';
  const fontSize = size === 'sm' ? '11px' : '12px';

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: px,
        borderRadius: 99,
        fontSize,
        fontWeight: 600,
        letterSpacing: '0.02em',
        background: cfg.color + '22',
        color: cfg.color,
        border: `1px solid ${cfg.color}44`,
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.color, flexShrink: 0 }} />
      {cfg.label}
    </span>
  );
}
