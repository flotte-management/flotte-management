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
  CONDUCTEURS_QUERY, CREER_CONDUCTEUR,
} from '../../apollo/queries/conducteurs';
import type { Conducteur, StatutConducteur } from '../../types';
import { Plus, Filter } from 'lucide-react';

const STATUTS: StatutConducteur[] = ['ACTIF', 'EN_MISSION', 'EN_CONGE', 'SUSPENDU', 'INACTIF'];

function CreateConducteurModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ nom: '', prenom: '', email: '', telephone: '', dateEmbauche: '' });
  const [creerConducteur, { loading }] = useMutation(CREER_CONDUCTEUR);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await creerConducteur({ variables: { input: {
        nom: form.nom, prenom: form.prenom,
        email: form.email || undefined,
        telephone: form.telephone || undefined,
        dateEmbauche: form.dateEmbauche || undefined,
      }}});
      toast.success('Conducteur créé');
      onCreated();
      onClose();
    } catch (err: unknown) {
      toast.error((err as Error).message ?? 'Erreur');
    }
  };

  const field = (key: keyof typeof form, label: string, type = 'text', required = false) => (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{label}{required && ' *'}</label>
      <input
        type={type} value={form[key]}
        onChange={(e) => setForm(f => ({ ...f, [key]: e.target.value }))}
        required={required}
        style={{ width: '100%', padding: '8px 10px', borderRadius: 6, fontSize: 13, background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)', outline: 'none' }}
      />
    </div>
  );

  return (
    <Modal open={open} onClose={onClose} title="Nouveau conducteur">
      <form onSubmit={handleSubmit}>
        {field('nom', 'Nom', 'text', true)}
        {field('prenom', 'Prénom', 'text', true)}
        {field('email', 'Email', 'email')}
        {field('telephone', 'Téléphone')}
        {field('dateEmbauche', 'Date embauche', 'date')}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
          <Button variant="secondary" type="button" onClick={onClose}>Annuler</Button>
          <Button variant="primary" type="submit" isLoading={loading}>Créer</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function ConducteursList() {
  const navigate = useNavigate();
  const { hasAnyRole } = useAuth();
  const [statutFilter, setStatutFilter] = useState<StatutConducteur | ''>('');
  const [createOpen, setCreateOpen] = useState(false);
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, loading, refetch } = useQuery<{ conducteurs: Conducteur[] }>(CONDUCTEURS_QUERY, {
    variables: { statut: statutFilter || undefined, page, limit },
    fetchPolicy: 'cache-and-network',
  });

  const conducteurs = data?.conducteurs ?? [];
  const canCreate = hasAnyRole(['ADMIN', 'MANAGER']);

  return (
    <AppLayout title="Conducteurs">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Filter size={14} style={{ color: 'var(--text-secondary)' }} />
          <select
            value={statutFilter}
            onChange={(e) => { setStatutFilter(e.target.value as StatutConducteur | ''); setPage(1); }}
            style={{ padding: '6px 10px', borderRadius: 6, fontSize: 13, background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)', cursor: 'pointer' }}
          >
            <option value="">Tous les statuts</option>
            {STATUTS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div style={{ flex: 1 }} />
        {canCreate && (
          <Button variant="primary" onClick={() => setCreateOpen(true)}>
            <Plus size={14} /> Nouveau conducteur
          </Button>
        )}
      </div>

      <Card style={{ padding: 0 }}>
        <Table<Conducteur>
          isLoading={loading && conducteurs.length === 0}
          data={conducteurs}
          keyExtractor={(c) => c.id}
          onRowClick={(c) => navigate(`/conducteurs/${c.id}`)}
          emptyMessage="Aucun conducteur trouvé"
          columns={[
            { key: 'nom', label: 'Nom', render: (c) => `${c.prenom} ${c.nom}` },
            { key: 'email', label: 'Email', render: (c) => c.email ?? '—' },
            { key: 'telephone', label: 'Téléphone', render: (c) => c.telephone ?? '—' },
            { key: 'statut', label: 'Statut', render: (c) => <StatusBadge statut={c.statut} /> },
            { key: 'dateEmbauche', label: 'Embauché le', render: (c) => c.dateEmbauche ? new Date(c.dateEmbauche).toLocaleDateString('fr-FR') : '—' },
          ]}
        />
      </Card>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
        <Button size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Précédent</Button>
        <span style={{ alignSelf: 'center', fontSize: 13, color: 'var(--text-secondary)' }}>Page {page}</span>
        <Button size="sm" disabled={conducteurs.length < limit} onClick={() => setPage(p => p + 1)}>Suivant →</Button>
      </div>

      <CreateConducteurModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={() => refetch()} />
    </AppLayout>
  );
}
