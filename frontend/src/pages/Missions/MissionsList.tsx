import { useState } from 'react';
import { useQuery, useMutation, useSubscription } from '@apollo/client/react';
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
  MISSIONS_QUERY, CREER_MISSION, MISSION_EVENT_SUBSCRIPTION,
} from '../../apollo/queries/missions';
import { VEHICULES_QUERY } from '../../apollo/queries/vehicules';
import { CONDUCTEURS_QUERY } from '../../apollo/queries/conducteurs';
import type { Mission, StatutMission, Vehicule, Conducteur } from '../../types';
import { Plus, Filter, Radio } from 'lucide-react';

const STATUTS: StatutMission[] = ['PLANIFIEE', 'EN_COURS', 'TERMINEE', 'ANNULEE', 'SUSPENDUE'];

function CreateMissionModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    titre: '', description: '',
    vehiculeId: '', conducteurId: '',
    adresseDepart: '', adresseDestination: '',
    dateDebut: '', dateFin: '',
  });
  const [creerMission, { loading }] = useMutation(CREER_MISSION);

  const { data: vehiculesData } = useQuery<{ vehicules: Vehicule[] }>(VEHICULES_QUERY, {
    variables: { statut: 'DISPONIBLE', page: 1, limit: 100 },
    skip: !open,
  });
  const { data: conducteursData } = useQuery<{ conducteurs: Conducteur[] }>(CONDUCTEURS_QUERY, {
    variables: { statut: 'ACTIF', page: 1, limit: 100 },
    skip: !open,
  });
  const vehicules = vehiculesData?.vehicules ?? [];
  const conducteurs = conducteursData?.conducteurs ?? [];

  const inputStyle = {
    width: '100%', padding: '7px 10px', borderRadius: 6, fontSize: 13,
    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
    color: 'var(--text-primary)', outline: 'none',
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await creerMission({ variables: { input: {
        titre: form.titre,
        vehiculeId: form.vehiculeId,
        conducteurId: form.conducteurId,
        adresseDepart: form.adresseDepart,
        adresseDestination: form.adresseDestination,
        dateDebut: form.dateDebut,
        dateFin: form.dateFin,
        description: form.description || undefined,
      }}});
      toast.success('Mission créée'); onCreated(); onClose();
    } catch (err: unknown) { toast.error((err as Error).message ?? 'Erreur'); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Nouvelle mission">
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 3 }}>Titre *</label>
          <input type="text" value={form.titre} onChange={e => setForm(f => ({ ...f, titre: e.target.value }))} required style={inputStyle} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 3 }}>Véhicule *</label>
          <select value={form.vehiculeId} onChange={e => setForm(f => ({ ...f, vehiculeId: e.target.value }))} required style={inputStyle}>
            <option value="">— Sélectionner —</option>
            {vehicules.map(v => (
              <option key={v.id} value={v.id}>{v.immatriculation}{v.marque ? ` — ${v.marque}` : ''}</option>
            ))}
          </select>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 3 }}>Conducteur *</label>
          <select value={form.conducteurId} onChange={e => setForm(f => ({ ...f, conducteurId: e.target.value }))} required style={inputStyle}>
            <option value="">— Sélectionner —</option>
            {conducteurs.map(c => (
              <option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>
            ))}
          </select>
        </div>
        {([
          ['adresseDepart', 'Adresse de départ *', 'text', true],
          ['adresseDestination', 'Adresse de destination *', 'text', true],
          ['dateDebut', 'Date de début *', 'datetime-local', true],
          ['dateFin', 'Date de fin prévue *', 'datetime-local', true],
          ['description', 'Notes / description', 'text', false],
        ] as [keyof typeof form, string, string, boolean][]).map(([k, l, t, r]) => (
          <div key={k} style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 3 }}>{l}</label>
            <input type={t} value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} required={r} style={inputStyle} />
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

export default function MissionsList() {
  const navigate = useNavigate();
  const { hasAnyRole, user } = useAuth();
  const [statutFilter, setStatutFilter] = useState<StatutMission | ''>('');
  const [createOpen, setCreateOpen] = useState(false);
  const [liveEvents, setLiveEvents] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const limit = 20;

  const isConducteur = hasAnyRole(['CONDUCTEUR']) && !hasAnyRole(['ADMIN', 'MANAGER']);
  const conducteurIdFilter = isConducteur ? user?.id : undefined;

  const { data, loading, refetch } = useQuery<{ missions: Mission[] }>(MISSIONS_QUERY, {
    variables: {
      statut: statutFilter || undefined,
      conducteurId: conducteurIdFilter,
      page, limit,
    },
    fetchPolicy: 'cache-and-network',
  });

  useSubscription(MISSION_EVENT_SUBSCRIPTION, {
    onData: (options) => {
      const event = (options.data.data as { missionEvent?: { eventType: string; missionId: string } } | undefined)?.missionEvent;
      if (event) {
        const msg = `[${event.eventType}] Mission ${event.missionId}`;
        setLiveEvents(prev => [msg, ...prev].slice(0, 5));
        refetch();
      }
    },
  });

  const missions = data?.missions ?? [];
  const canCreate = hasAnyRole(['ADMIN', 'MANAGER']);

  return (
    <AppLayout title="Missions">
      {/* Live events indicator */}
      {liveEvents.length > 0 && (
        <div style={{ marginBottom: 16, padding: '10px 14px', background: 'var(--bg-surface)', borderRadius: 8, borderLeft: '3px solid var(--accent)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <Radio size={13} style={{ color: 'var(--accent)' }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)' }}>Événements en temps réel</span>
          </div>
          {liveEvents.map((ev, i) => (
            <div key={i} style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '2px 0' }}>{ev}</div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <Filter size={14} style={{ color: 'var(--text-secondary)' }} />
        <select
          value={statutFilter}
          onChange={(e) => { setStatutFilter(e.target.value as StatutMission | ''); setPage(1); }}
          style={{ padding: '6px 10px', borderRadius: 6, fontSize: 13, background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
        >
          <option value="">Tous les statuts</option>
          {STATUTS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <div style={{ flex: 1 }} />
        {canCreate && (
          <Button variant="primary" onClick={() => setCreateOpen(true)}>
            <Plus size={14} /> Nouvelle mission
          </Button>
        )}
      </div>

      <Card style={{ padding: 0 }}>
        <Table<Mission>
          isLoading={loading && missions.length === 0}
          data={missions}
          keyExtractor={(m) => m.id}
          onRowClick={(m) => navigate(`/missions/${m.id}`)}
          emptyMessage="Aucune mission trouvée"
          columns={[
            { key: 'titre', label: 'Titre', render: (m) => <span style={{ fontWeight: 500 }}>{m.titre}</span> },
            { key: 'statut', label: 'Statut', render: (m) => <StatusBadge statut={m.statut} /> },
            { key: 'vehiculeId', label: 'Véhicule', render: (m) => m.vehiculeId ? <span style={{ fontFamily: 'monospace', color: 'var(--accent)', fontSize: 12 }}>{m.vehiculeId}</span> : '—' },
            { key: 'conducteurId', label: 'Conducteur', render: (m) => m.conducteurId ?? '—' },
            { key: 'adresseDepart', label: 'Départ', render: (m) => m.adresseDepart ?? '—' },
            { key: 'adresseDestination', label: 'Destination', render: (m) => m.adresseDestination ?? '—' },
            { key: 'dateDebut', label: 'Début', render: (m) => m.dateDebut ? new Date(m.dateDebut).toLocaleDateString('fr-FR') : '—' },
            { key: 'dateFin', label: 'Fin prévue', render: (m) => m.dateFin ? new Date(m.dateFin).toLocaleDateString('fr-FR') : '—' },
          ]}
        />
      </Card>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
        <Button size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Précédent</Button>
        <span style={{ alignSelf: 'center', fontSize: 13, color: 'var(--text-secondary)' }}>Page {page}</span>
        <Button size="sm" disabled={missions.length < limit} onClick={() => setPage(p => p + 1)}>Suivant →</Button>
      </div>

      <CreateMissionModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={() => refetch()} />
    </AppLayout>
  );
}
