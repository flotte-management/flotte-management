import { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { AppLayout } from '../../components/layout/AppLayout';
import { Table } from '../../components/ui/Table';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Card } from '../../components/ui/Card';
import { useAuth } from '../../hooks/useAuth';
import {
  MAINTENANCES_QUERY, CREER_MAINTENANCE, CHANGER_STATUT_MAINTENANCE,
} from '../../apollo/queries/maintenances';
import { VEHICULES_QUERY } from '../../apollo/queries/vehicules';
import type { Maintenance, StatutMaintenance, TypeMaintenance, Vehicule } from '../../types';
import { Plus, Filter } from 'lucide-react';

const STATUTS: StatutMaintenance[] = ['PLANIFIEE', 'EN_COURS', 'TERMINEE', 'ANNULEE'];
const TYPES: TypeMaintenance[] = ['PREVENTIVE', 'CORRECTIVE'];

function CreateMaintenanceModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ vehiculeId: '', typeMaintenance: 'PREVENTIVE' as TypeMaintenance, description: '', dateDebut: '', cout: '' });
  const [creerMaintenance, { loading }] = useMutation(CREER_MAINTENANCE);

  const { data: vehiculesData } = useQuery<{ vehicules: Vehicule[] }>(VEHICULES_QUERY, {
    variables: { page: 1, limit: 100 },
    skip: !open,
  });
  const vehicules = vehiculesData?.vehicules ?? [];

  const inputStyle = {
    width: '100%', padding: '8px 10px', borderRadius: 6, fontSize: 13,
    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
    color: 'var(--text-primary)', outline: 'none',
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await creerMaintenance({ variables: { input: {
        vehiculeId: form.vehiculeId,
        typeMaintenance: form.typeMaintenance,
        description: form.description || undefined,
        dateDebut: form.dateDebut || undefined,
        cout: form.cout ? parseFloat(form.cout) : undefined,
      }}});
      toast.success('Maintenance planifiée');
      onCreated(); onClose();
    } catch (err: unknown) { toast.error((err as Error).message ?? 'Erreur'); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Nouvelle maintenance">
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Véhicule *</label>
          <select value={form.vehiculeId} onChange={(e) => setForm(f => ({ ...f, vehiculeId: e.target.value }))} required style={inputStyle}>
            <option value="">— Sélectionner un véhicule —</option>
            {vehicules.map(v => (
              <option key={v.id} value={v.id}>
                {v.immatriculation}{v.marque ? ` — ${v.marque}${v.modele ? ' ' + v.modele : ''}` : ''}
              </option>
            ))}
          </select>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Type *</label>
          <select value={form.typeMaintenance} onChange={(e) => setForm(f => ({ ...f, typeMaintenance: e.target.value as TypeMaintenance }))} style={inputStyle}>
            {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        {[
          ['description', 'Description', 'text'],
          ['dateDebut', 'Date planifiée', 'date'],
          ['cout', 'Coût estimé (€)', 'number'],
        ].map(([k, l, t]) => (
          <div key={String(k)} style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{String(l)}</label>
            <input
              type={String(t)} value={(form as Record<string, string>)[String(k)]}
              onChange={(e) => setForm(f => ({ ...f, [String(k)]: e.target.value }))}
              style={inputStyle}
            />
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
          <Button variant="secondary" type="button" onClick={onClose}>Annuler</Button>
          <Button variant="primary" type="submit" isLoading={loading}>Créer</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function MaintenancesList() {
  const navigate = useNavigate();
  const { hasAnyRole } = useAuth();
  const [statutFilter, setStatutFilter] = useState<StatutMaintenance | ''>('');
  const [typeFilter, setTypeFilter] = useState<TypeMaintenance | ''>('');
  const [createOpen, setCreateOpen] = useState(false);
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, loading, refetch } = useQuery<{ maintenances: Maintenance[] }>(MAINTENANCES_QUERY, {
    variables: { statut: statutFilter || undefined, typeMaintenance: typeFilter || undefined, page, limit },
    fetchPolicy: 'cache-and-network',
  });

  const [changerStatut] = useMutation(CHANGER_STATUT_MAINTENANCE);

  const maintenances = data?.maintenances ?? [];
  const canCreate = hasAnyRole(['ADMIN', 'MANAGER', 'TECHNICIEN']);
  const canChangeStatut = hasAnyRole(['ADMIN', 'MANAGER', 'TECHNICIEN']);

  const handleChangeStatut = async (id: string, statut: StatutMaintenance) => {
    try {
      await changerStatut({ variables: { id, statut } });
      toast.success('Statut mis à jour');
      refetch();
    } catch (err: unknown) { toast.error((err as Error).message ?? 'Erreur'); }
  };

  return (
    <AppLayout title="Maintenances">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <Filter size={14} style={{ color: 'var(--text-secondary)' }} />
        <select
          value={statutFilter}
          onChange={(e) => { setStatutFilter(e.target.value as StatutMaintenance | ''); setPage(1); }}
          style={{ padding: '6px 10px', borderRadius: 6, fontSize: 13, background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
        >
          <option value="">Tous les statuts</option>
          {STATUTS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value as TypeMaintenance | ''); setPage(1); }}
          style={{ padding: '6px 10px', borderRadius: 6, fontSize: 13, background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
        >
          <option value="">Tous les types</option>
          {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <div style={{ flex: 1 }} />
        {canCreate && (
          <Button variant="primary" onClick={() => setCreateOpen(true)}>
            <Plus size={14} /> Nouvelle maintenance
          </Button>
        )}
      </div>

      <Card style={{ padding: 0 }}>
        <Table<Maintenance>
          isLoading={loading && maintenances.length === 0}
          data={maintenances}
          keyExtractor={(m) => m.id}
          onRowClick={(m) => navigate(`/maintenances/${m.id}`)}
          emptyMessage="Aucune maintenance trouvée"
          columns={[
            { key: 'vehiculeId', label: 'Véhicule', render: (m) => <span style={{ fontFamily: 'monospace', color: 'var(--accent)' }}>{m.vehiculeId}</span> },
            { key: 'typeMaintenance', label: 'Type', render: (m) => <StatusBadge statut={m.typeMaintenance} size="sm" /> },
            { key: 'statut', label: 'Statut', render: (m) => <StatusBadge statut={m.statut} /> },
            { key: 'dateDebut', label: 'Date début', render: (m) => m.dateDebut ? new Date(m.dateDebut).toLocaleDateString('fr-FR') : '—' },
            { key: 'dateFin', label: 'Date fin', render: (m) => m.dateFin ? new Date(m.dateFin).toLocaleDateString('fr-FR') : '—' },
            { key: 'prestataire', label: 'Prestataire', render: (m) => m.prestataire ?? '—' },
            { key: 'cout', label: 'Coût', render: (m) => m.cout != null ? `${m.cout.toLocaleString('fr-FR')} €` : '—' },
            {
              key: 'actions', label: '',
              render: (m) => canChangeStatut ? (
                <div style={{ display: 'flex', gap: 4 }} onClick={(e) => e.stopPropagation()}>
                  {m.statut === 'PLANIFIEE' && (
                    <Button size="sm" variant="secondary" onClick={() => handleChangeStatut(m.id, 'EN_COURS')}>Démarrer</Button>
                  )}
                  {m.statut === 'EN_COURS' && (
                    <Button size="sm" variant="primary" onClick={() => handleChangeStatut(m.id, 'TERMINEE')}>Terminer</Button>
                  )}
                </div>
              ) : null,
            },
          ]}
        />
      </Card>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
        <Button size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Précédent</Button>
        <span style={{ alignSelf: 'center', fontSize: 13, color: 'var(--text-secondary)' }}>Page {page}</span>
        <Button size="sm" disabled={maintenances.length < limit} onClick={() => setPage(p => p + 1)}>Suivant →</Button>
      </div>

      <CreateMaintenanceModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={() => refetch()} />
    </AppLayout>
  );
}
