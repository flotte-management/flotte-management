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
import { MISSION_QUERY, CHANGER_STATUT_MISSION, SUPPRIMER_MISSION } from '../../apollo/queries/missions';
import type { Mission, StatutMission } from '../../types';
import { ArrowLeft, Trash2, MapPin } from 'lucide-react';

const STATUTS: StatutMission[] = ['PLANIFIEE', 'EN_COURS', 'TERMINEE', 'ANNULEE', 'SUSPENDUE'];

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 14 }}>{value ?? '—'}</div>
    </div>
  );
}

export default function MissionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasAnyRole } = useAuth();
  const [statutModal, setStatutModal] = useState(false);
  const [newStatut, setNewStatut] = useState<StatutMission>('PLANIFIEE');
  const [deleteModal, setDeleteModal] = useState(false);

  const { data, loading, refetch } = useQuery<{ mission: Mission }>(MISSION_QUERY, {
    variables: { id }, skip: !id,
  });

  const [changerStatut, { loading: changingStatut }] = useMutation(CHANGER_STATUT_MISSION);
  const [supprimerMission] = useMutation(SUPPRIMER_MISSION);

  const mission = data?.mission;
  const canEdit = hasAnyRole(['ADMIN', 'MANAGER']);
  const canDelete = hasAnyRole(['ADMIN']);

  const handleChangeStatut = async () => {
    try {
      await changerStatut({ variables: { id, statut: newStatut } });
      toast.success(`Statut changé en ${newStatut}`); setStatutModal(false); refetch();
    } catch (err: unknown) { toast.error((err as Error).message ?? 'Erreur'); }
  };

  const handleDelete = async () => {
    try {
      await supprimerMission({ variables: { id } });
      toast.success('Mission supprimée'); navigate('/missions');
    } catch (err: unknown) { toast.error((err as Error).message ?? 'Erreur'); }
  };

  if (loading) return <AppLayout title="Mission"><div style={{ padding: 40, color: 'var(--text-secondary)' }}>Chargement…</div></AppLayout>;
  if (!mission) return <AppLayout title="Mission"><div style={{ padding: 40, color: 'var(--text-secondary)' }}>Mission introuvable</div></AppLayout>;

  return (
    <AppLayout title={mission.titre}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <Button variant="ghost" size="sm" onClick={() => navigate('/missions')}><ArrowLeft size={14} /> Retour</Button>
        <div style={{ flex: 1 }} />
        {canEdit && (
          <Button variant="secondary" size="sm" onClick={() => { setNewStatut(mission.statut); setStatutModal(true); }}>
            Changer statut
          </Button>
        )}
        {canDelete && <Button variant="danger" size="sm" onClick={() => setDeleteModal(true)}><Trash2 size={14} /></Button>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <Card>
          <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 600 }}>Informations</h3>
          <Field label="Titre" value={<strong>{mission.titre}</strong>} />
          <Field label="Statut" value={<StatusBadge statut={mission.statut} />} />
          <Field label="Véhicule" value={mission.vehiculeId
            ? <span
                style={{ fontFamily: 'monospace', color: 'var(--accent)', cursor: 'pointer' }}
                onClick={() => navigate(`/vehicules/${mission.vehiculeId}`)}
              >{mission.vehiculeId}</span>
            : undefined}
          />
          <Field label="Conducteur" value={mission.conducteurId
            ? <span
                style={{ cursor: 'pointer', color: 'var(--accent)' }}
                onClick={() => navigate(`/conducteurs/${mission.conducteurId}`)}
              >{mission.conducteurId}</span>
            : undefined}
          />
          <Field label="Date début" value={mission.dateDebut ? new Date(mission.dateDebut).toLocaleString('fr-FR') : undefined} />
          <Field label="Date fin prévue" value={mission.dateFin ? new Date(mission.dateFin).toLocaleString('fr-FR') : undefined} />
        </Card>

        <Card>
          <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 600 }}>Itinéraire</h3>
          {mission.adresseDepart && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--success)' }} />
                <span style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Départ</span>
              </div>
              <div style={{ fontSize: 14, paddingLeft: 16 }}>{mission.adresseDepart}</div>
            </div>
          )}
          {mission.adresseDepart && mission.adresseDestination && (
            <div style={{ paddingLeft: 4, marginBottom: 4 }}>
              <div style={{ width: 2, height: 24, background: 'var(--border)', margin: '0 4px' }} />
            </div>
          )}
          {mission.adresseDestination && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <MapPin size={10} style={{ color: 'var(--danger)' }} />
                <span style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Destination</span>
              </div>
              <div style={{ fontSize: 14, paddingLeft: 16 }}>{mission.adresseDestination}</div>
            </div>
          )}
          {!mission.adresseDepart && !mission.adresseDestination && (
            <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Aucun itinéraire défini</div>
          )}

          {mission.vehiculeId && (
            <div style={{ marginTop: 16 }}>
              <Button variant="secondary" size="sm" onClick={() => navigate(`/localisation?vehiculeId=${mission.vehiculeId}`)}>
                <MapPin size={13} /> Voir la position en direct
              </Button>
            </div>
          )}
        </Card>

        {mission.description && (
          <Card style={{ gridColumn: '1 / -1' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600 }}>Description</h3>
            <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text-secondary)' }}>{mission.description}</p>
          </Card>
        )}
      </div>

      {/* Modals */}
      <Modal open={statutModal} onClose={() => setStatutModal(false)} title="Changer le statut">
        <select
          value={newStatut} onChange={(e) => setNewStatut(e.target.value as StatutMission)}
          style={{ width: '100%', padding: '8px 10px', borderRadius: 6, background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 13, marginBottom: 20 }}
        >
          {STATUTS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={() => setStatutModal(false)}>Annuler</Button>
          <Button variant="primary" isLoading={changingStatut} onClick={handleChangeStatut}>Confirmer</Button>
        </div>
      </Modal>

      <Modal open={deleteModal} onClose={() => setDeleteModal(false)} title="Supprimer la mission" maxWidth={400}>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 20 }}>
          Supprimer la mission <strong style={{ color: 'var(--text-primary)' }}>{mission.titre}</strong> ?
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={() => setDeleteModal(false)}>Annuler</Button>
          <Button variant="danger" onClick={handleDelete}>Supprimer</Button>
        </div>
      </Modal>
    </AppLayout>
  );
}
