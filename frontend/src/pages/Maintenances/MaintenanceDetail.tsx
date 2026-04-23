import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@apollo/client/react';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { AppLayout } from '../../components/layout/AppLayout';
import { Card } from '../../components/ui/Card';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { useAuth } from '../../hooks/useAuth';
import {
  MAINTENANCE_QUERY, CHANGER_STATUT_MAINTENANCE, MODIFIER_MAINTENANCE, SUPPRIMER_MAINTENANCE,
} from '../../apollo/queries/maintenances';
import type { Maintenance, StatutMaintenance } from '../../types';
import { ArrowLeft, Trash2 } from 'lucide-react';

const STATUTS: StatutMaintenance[] = ['PLANIFIEE', 'EN_COURS', 'TERMINEE', 'ANNULEE'];

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 14 }}>{value ?? '—'}</div>
    </div>
  );
}

export default function MaintenanceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasAnyRole } = useAuth();
  const [statutModal, setStatutModal] = useState(false);
  const [newStatut, setNewStatut] = useState<StatutMaintenance>('PLANIFIEE');
  const [deleteModal, setDeleteModal] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [editForm, setEditForm] = useState({ description: '', prestataire: '', cout: '', dateFin: '' });

  const { data, loading, refetch } = useQuery<{ maintenance: Maintenance }>(MAINTENANCE_QUERY, {
    variables: { id }, skip: !id,
  });

  useEffect(() => {
    if (data?.maintenance) setEditForm({
      description: data.maintenance.description ?? '',
      prestataire: data.maintenance.prestataire ?? '',
      cout: data.maintenance.cout != null ? String(data.maintenance.cout) : '',
      dateFin: data.maintenance.dateFin ?? '',
    });
  }, [data?.maintenance]);

  const [changerStatut, { loading: changingStatut }] = useMutation(CHANGER_STATUT_MAINTENANCE);
  const [modifierMaintenance, { loading: modifying }] = useMutation(MODIFIER_MAINTENANCE);
  const [supprimerMaintenance] = useMutation(SUPPRIMER_MAINTENANCE);

  const m = data?.maintenance;
  const canEdit = hasAnyRole(['ADMIN', 'MANAGER', 'TECHNICIEN']);
  const canDelete = hasAnyRole(['ADMIN']);

  const handleChangeStatut = async () => {
    try {
      await changerStatut({ variables: { id, statut: newStatut } });
      toast.success('Statut mis à jour'); setStatutModal(false); refetch();
    } catch (err: unknown) { toast.error((err as Error).message ?? 'Erreur'); }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await modifierMaintenance({ variables: { id, input: {
        description: editForm.description || undefined,
        prestataire: editForm.prestataire || undefined,
        cout: editForm.cout ? parseFloat(editForm.cout) : undefined,
        dateFin: editForm.dateFin || undefined,
      }}});
      toast.success('Maintenance modifiée'); setEditModal(false); refetch();
    } catch (err: unknown) { toast.error((err as Error).message ?? 'Erreur'); }
  };

  const handleDelete = async () => {
    try {
      await supprimerMaintenance({ variables: { id } });
      toast.success('Maintenance supprimée'); navigate('/maintenances');
    } catch (err: unknown) { toast.error((err as Error).message ?? 'Erreur'); }
  };

  if (loading) return <AppLayout title="Maintenance"><div style={{ padding: 40, color: 'var(--text-secondary)' }}>Chargement…</div></AppLayout>;
  if (!m) return <AppLayout title="Maintenance"><div style={{ padding: 40, color: 'var(--text-secondary)' }}>Maintenance introuvable</div></AppLayout>;

  return (
    <AppLayout title={`Maintenance — ${m.typeMaintenance}`}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <Button variant="ghost" size="sm" onClick={() => navigate('/maintenances')}><ArrowLeft size={14} /> Retour</Button>
        <div style={{ flex: 1 }} />
        {canEdit && <>
          <Button variant="secondary" size="sm" onClick={() => setEditModal(true)}>Modifier</Button>
          <Button variant="secondary" size="sm" onClick={() => { setNewStatut(m.statut); setStatutModal(true); }}>Changer statut</Button>
        </>}
        {canDelete && <Button variant="danger" size="sm" onClick={() => setDeleteModal(true)}><Trash2 size={14} /></Button>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <Card>
          <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 600 }}>Détails</h3>
          <Field label="Véhicule" value={<span style={{ fontFamily: 'monospace', color: 'var(--accent)' }}>{m.vehiculeId}</span>} />
          <Field label="Type" value={<StatusBadge statut={m.typeMaintenance} />} />
          <Field label="Statut" value={<StatusBadge statut={m.statut} />} />
          <Field label="Date début" value={m.dateDebut ? new Date(m.dateDebut).toLocaleDateString('fr-FR') : undefined} />
          <Field label="Date fin" value={m.dateFin ? new Date(m.dateFin).toLocaleDateString('fr-FR') : undefined} />
          <Field label="Prestataire" value={m.prestataire} />
          <Field label="Coût" value={m.cout != null ? `${m.cout.toLocaleString('fr-FR')} €` : undefined} />
        </Card>
        <Card>
          <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 600 }}>Description</h3>
          <p style={{ fontSize: 14, color: m.description ? 'var(--text-primary)' : 'var(--text-secondary)', lineHeight: 1.6 }}>
            {m.description ?? 'Aucune description'}
          </p>
        </Card>
      </div>

      {/* Modals */}
      <Modal open={editModal} onClose={() => setEditModal(false)} title="Modifier la maintenance">
        <form onSubmit={handleEdit}>
          {[
            ['description', 'Description', 'text'],
            ['prestataire', 'Prestataire', 'text'],
            ['cout', 'Coût (€)', 'number'],
            ['dateFin', 'Date fin', 'date'],
          ].map(([k, l, t]) => (
            <div key={String(k)} style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{String(l)}</label>
              <input
                type={String(t)} value={(editForm as Record<string, string>)[String(k)]}
                onChange={(e) => setEditForm(f => ({ ...f, [String(k)]: e.target.value }))}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, fontSize: 13, background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)', outline: 'none' }}
              />
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
            <Button variant="secondary" type="button" onClick={() => setEditModal(false)}>Annuler</Button>
            <Button variant="primary" type="submit" isLoading={modifying}>Enregistrer</Button>
          </div>
        </form>
      </Modal>

      <Modal open={statutModal} onClose={() => setStatutModal(false)} title="Changer le statut">
        <select
          value={newStatut} onChange={(e) => setNewStatut(e.target.value as StatutMaintenance)}
          style={{ width: '100%', padding: '8px 10px', borderRadius: 6, background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 13, marginBottom: 20 }}
        >
          {STATUTS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={() => setStatutModal(false)}>Annuler</Button>
          <Button variant="primary" isLoading={changingStatut} onClick={handleChangeStatut}>Confirmer</Button>
        </div>
      </Modal>

      <Modal open={deleteModal} onClose={() => setDeleteModal(false)} title="Supprimer la maintenance" maxWidth={400}>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 20 }}>Supprimer cette maintenance ?</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={() => setDeleteModal(false)}>Annuler</Button>
          <Button variant="danger" onClick={handleDelete}>Supprimer</Button>
        </div>
      </Modal>
    </AppLayout>
  );
}
