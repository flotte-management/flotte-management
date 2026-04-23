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
  VEHICULES_QUERY, CREER_VEHICULE,
} from '../../apollo/queries/vehicules';
import type { Vehicule, StatutVehicule } from '../../types';
import { Plus, Filter } from 'lucide-react';

const STATUTS: StatutVehicule[] = ['DISPONIBLE', 'EN_MISSION', 'EN_MAINTENANCE', 'HORS_SERVICE', 'RETIRE'];
const TYPES_CARBURANT = ['ESSENCE', 'DIESEL', 'ELECTRIQUE', 'HYBRIDE', 'GPL'] as const;

function CreateVehiculeModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ immatriculation: '', marque: '', modele: '', annee: '', typeCarburant: 'ESSENCE', typeVehicule: '', kilometrage: '' });
  const [creerVehicule, { loading }] = useMutation(CREER_VEHICULE);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await creerVehicule({ variables: { input: {
        immatriculation: form.immatriculation,
        marque: form.marque,
        modele: form.modele,
        annee: parseInt(form.annee),
        typeCarburant: form.typeCarburant,
        typeVehicule: form.typeVehicule || undefined,
        kilometrage: form.kilometrage ? parseFloat(form.kilometrage) : undefined,
      }}});
      toast.success('Véhicule créé avec succès');
      onCreated();
      onClose();
    } catch (err: unknown) {
      toast.error((err as Error).message ?? 'Erreur lors de la création');
    }
  };

  const selectStyle = {
    width: '100%', padding: '8px 10px', borderRadius: 6, fontSize: 13,
    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
    color: 'var(--text-primary)', outline: 'none',
  };

  const field = (key: keyof typeof form, label: string, type = 'text', required = false) => (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{label}{required && ' *'}</label>
      <input
        type={type}
        value={form[key]}
        onChange={(e) => setForm(f => ({ ...f, [key]: e.target.value }))}
        required={required}
        style={{
          width: '100%', padding: '8px 10px', borderRadius: 6, fontSize: 13,
          background: 'var(--bg-elevated)', border: '1px solid var(--border)',
          color: 'var(--text-primary)', outline: 'none',
        }}
      />
    </div>
  );

  return (
    <Modal open={open} onClose={onClose} title="Nouveau véhicule">
      <form onSubmit={handleSubmit}>
        {field('immatriculation', 'Immatriculation', 'text', true)}
        {field('marque', 'Marque', 'text', true)}
        {field('modele', 'Modèle', 'text', true)}
        {field('annee', 'Année', 'number', true)}
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Type de carburant *</label>
          <select value={form.typeCarburant} onChange={(e) => setForm(f => ({ ...f, typeCarburant: e.target.value }))} required style={selectStyle}>
            {TYPES_CARBURANT.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        {field('typeVehicule', 'Type de véhicule')}
        {field('kilometrage', 'Kilométrage', 'number')}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
          <Button variant="secondary" type="button" onClick={onClose}>Annuler</Button>
          <Button variant="primary" type="submit" isLoading={loading}>Créer</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function VehiculesList() {
  const navigate = useNavigate();
  const { hasAnyRole } = useAuth();
  const [statutFilter, setStatutFilter] = useState<StatutVehicule | ''>('');
  const [createOpen, setCreateOpen] = useState(false);
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, loading, refetch } = useQuery<{ vehicules: Vehicule[] }>(VEHICULES_QUERY, {
    variables: { statut: statutFilter || undefined, page, limit },
    fetchPolicy: 'cache-and-network',
  });

  const vehicules = data?.vehicules ?? [];
  const canCreate = hasAnyRole(['ADMIN', 'MANAGER']);

  return (
    <AppLayout title="Véhicules">
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Filter size={14} style={{ color: 'var(--text-secondary)' }} />
          <select
            value={statutFilter}
            onChange={(e) => { setStatutFilter(e.target.value as StatutVehicule | ''); setPage(1); }}
            style={{
              padding: '6px 10px', borderRadius: 6, fontSize: 13,
              background: 'var(--bg-elevated)', border: '1px solid var(--border)',
              color: 'var(--text-primary)', cursor: 'pointer',
            }}
          >
            <option value="">Tous les statuts</option>
            {STATUTS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div style={{ flex: 1 }} />

        {canCreate && (
          <Button variant="primary" onClick={() => setCreateOpen(true)}>
            <Plus size={14} /> Nouveau véhicule
          </Button>
        )}
      </div>

      {/* Table */}
      <Card style={{ padding: 0 }}>
        <Table<Vehicule>
          isLoading={loading && vehicules.length === 0}
          data={vehicules}
          keyExtractor={(v) => v.id}
          onRowClick={(v) => navigate(`/vehicules/${v.id}`)}
          emptyMessage="Aucun véhicule trouvé"
          columns={[
            {
              key: 'immatriculation', label: 'Immatriculation',
              render: (v) => (
                <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--accent)', letterSpacing: '0.05em' }}>
                  {v.immatriculation}
                </span>
              ),
            },
            { key: 'marque',   label: 'Marque',   render: (v) => `${v.marque ?? '—'} ${v.modele ?? ''}`.trim() },
            { key: 'annee',    label: 'Année',    render: (v) => String(v.annee ?? '—') },
            { key: 'statut',   label: 'Statut',   render: (v) => <StatusBadge statut={v.statut} /> },
            { key: 'kilometrage', label: 'Km',    render: (v) => v.kilometrage != null ? `${Math.round(v.kilometrage).toLocaleString('fr-FR')} km` : '—' },
            {
              key: 'conducteurActuel', label: 'Conducteur',
              render: (v) => v.conducteurActuel
                ? `${v.conducteurActuel.prenom} ${v.conducteurActuel.nom}`
                : <span style={{ color: 'var(--text-secondary)' }}>—</span>,
            },
            {
              key: 'missionEnCours', label: 'Mission',
              render: (v) => v.missionEnCours
                ? <StatusBadge statut={v.missionEnCours.statut} size="sm" />
                : <span style={{ color: 'var(--text-secondary)' }}>—</span>,
            },
          ]}
        />
      </Card>

      {/* Pagination */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
        <Button size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Précédent</Button>
        <span style={{ alignSelf: 'center', fontSize: 13, color: 'var(--text-secondary)' }}>Page {page}</span>
        <Button size="sm" disabled={vehicules.length < limit} onClick={() => setPage(p => p + 1)}>Suivant →</Button>
      </div>

      <CreateVehiculeModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={() => refetch()} />
    </AppLayout>
  );
}
