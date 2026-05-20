import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@apollo/client/react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { AppLayout } from '../../components/layout/AppLayout';
import { Card } from '../../components/ui/Card';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { useAuth } from '../../hooks/useAuth';
import {
  CONDUCTEUR_QUERY, CHANGER_STATUT_CONDUCTEUR, SUPPRIMER_CONDUCTEUR, MODIFIER_CONDUCTEUR,
} from '../../apollo/queries/conducteurs';
import { MISSIONS_QUERY } from '../../apollo/queries/missions';
import type { Conducteur, StatutConducteur, Mission } from '../../types';
import { ArrowLeft, Trash2, RefreshCcw } from 'lucide-react';

const STATUTS: StatutConducteur[] = ['ACTIF', 'EN_MISSION', 'EN_CONGE', 'SUSPENDU', 'INACTIF'];

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 14 }}>{value ?? '—'}</div>
    </div>
  );
}

export default function ConducteurDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasAnyRole } = useAuth();
  const [editModal, setEditModal] = useState(false);
  const [statutModal, setStatutModal] = useState(false);
  const [newStatut, setNewStatut] = useState<StatutConducteur>('ACTIF');
  const [deleteModal, setDeleteModal] = useState(false);
  const [editForm, setEditForm] = useState({ nom: '', prenom: '', email: '', telephone: '' });

  const { data, loading, refetch } = useQuery<{ conducteur: Conducteur }>(CONDUCTEUR_QUERY, {
    variables: { id }, skip: !id,
  });

  const { data: missionsData } = useQuery<{ missions: Mission[] }>(MISSIONS_QUERY, {
    variables: { conducteurId: id, limit: 10 }, skip: !id,
  });

  const [changerStatut, { loading: changingStatut }] = useMutation(CHANGER_STATUT_CONDUCTEUR);
  const [modifierConducteur, { loading: modifying }] = useMutation(MODIFIER_CONDUCTEUR);
  const [supprimerConducteur] = useMutation(SUPPRIMER_CONDUCTEUR);

  const conducteur = data?.conducteur;
  const missions = missionsData?.missions ?? [];
  const canEdit = hasAnyRole(['ADMIN', 'MANAGER']);
  const canDelete = hasAnyRole(['ADMIN']);

  const handleChangeStatut = async () => {
    try {
      await changerStatut({ variables: { id, statut: newStatut } });
      toast.success(`Statut changé en ${newStatut}`);
      setStatutModal(false); refetch();
    } catch (err: unknown) { toast.error((err as Error).message ?? 'Erreur'); }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await modifierConducteur({ variables: { id, input: editForm } });
      toast.success('Conducteur modifié'); setEditModal(false); refetch();
    } catch (err: unknown) { toast.error((err as Error).message ?? 'Erreur'); }
  };

  const handleDelete = async () => {
    try {
      await supprimerConducteur({ variables: { id } });
      toast.success('Conducteur supprimé'); navigate('/conducteurs');
    } catch (err: unknown) { toast.error((err as Error).message ?? 'Erreur'); }
  };

  if (loading) return <AppLayout title="Conducteur"><div style={{ padding: 40, color: 'var(--text-secondary)' }}>Chargement…</div></AppLayout>;
  if (!conducteur) return <AppLayout title="Conducteur"><div style={{ padding: 40, color: 'var(--text-secondary)' }}>Conducteur introuvable</div></AppLayout>;

  return (
    <AppLayout title={`${conducteur.prenom} ${conducteur.nom}`}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <Button variant="ghost" size="sm" onClick={() => navigate('/conducteurs')}><ArrowLeft size={14} /> Retour</Button>
        <div style={{ flex: 1 }} />
        {canEdit && <>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              if (conducteur) {
                setEditForm({
                  nom: conducteur.nom,
                  prenom: conducteur.prenom,
                  email: conducteur.email ?? '',
                  telephone: conducteur.telephone ?? '',
                });
              }
              setEditModal(true);
            }}
          >
            Modifier
          </Button>
          <Button variant="secondary" size="sm" onClick={() => { setNewStatut(conducteur.statut); setStatutModal(true); }}>
            <RefreshCcw size={14} /> Changer statut
          </Button>
        </>}
        {canDelete && <Button variant="danger" size="sm" onClick={() => setDeleteModal(true)}><Trash2 size={14} /></Button>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <Card>
          <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 600 }}>Informations</h3>
          <Field label="Nom complet" value={`${conducteur.prenom} ${conducteur.nom}`} />
          <Field label="Statut" value={<StatusBadge statut={conducteur.statut} />} />
          <Field label="Email" value={conducteur.email} />
          <Field label="Téléphone" value={conducteur.telephone} />
          <Field label="Date embauche" value={conducteur.dateEmbauche ? new Date(conducteur.dateEmbauche).toLocaleDateString('fr-FR') : undefined} />
        </Card>

        <Card>
          <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600 }}>Historique des missions</h3>
          {missions.length === 0 ? (
            <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Aucune mission</div>
          ) : missions.map((m: { id: string; titre: string; statut: string; dateDebut?: string }) => (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
              <StatusBadge statut={m.statut} size="sm" />
              <span style={{ fontSize: 13, flex: 1 }}>{m.titre}</span>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                {m.dateDebut ? new Date(m.dateDebut).toLocaleDateString('fr-FR') : '—'}
              </span>
            </div>
          ))}
        </Card>
      </div>

      {/* Modals */}
      <Modal open={editModal} onClose={() => setEditModal(false)} title="Modifier conducteur">
        <form onSubmit={handleEdit}>
          {(['nom', 'prenom', 'email', 'telephone'] as const).map((k) => (
            <div key={k} style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{k.charAt(0).toUpperCase() + k.slice(1)}</label>
              <input
                value={editForm[k]}
                onChange={(e) => setEditForm(f => ({ ...f, [k]: e.target.value }))}
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
          value={newStatut}
          onChange={(e) => setNewStatut(e.target.value as StatutConducteur)}
          style={{ width: '100%', padding: '8px 10px', borderRadius: 6, background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 13, marginBottom: 20 }}
        >
          {STATUTS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={() => setStatutModal(false)}>Annuler</Button>
          <Button variant="primary" isLoading={changingStatut} onClick={handleChangeStatut}>Confirmer</Button>
        </div>
      </Modal>

      <Modal open={deleteModal} onClose={() => setDeleteModal(false)} title="Supprimer le conducteur" maxWidth={400}>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 20 }}>
          Supprimer <strong style={{ color: 'var(--text-primary)' }}>{conducteur.prenom} {conducteur.nom}</strong> ?
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={() => setDeleteModal(false)}>Annuler</Button>
          <Button variant="danger" onClick={handleDelete}>Supprimer</Button>
        </div>
      </Modal>
    </AppLayout>
  );
}
