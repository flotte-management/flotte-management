import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useSubscription } from '@apollo/client/react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { AppLayout } from '../../components/layout/AppLayout';
import { Card } from '../../components/ui/Card';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { useAuth } from '../../hooks/useAuth';
import {
  VEHICULE_QUERY, HISTORIQUE_STATUT_QUERY,
  CHANGER_STATUT_VEHICULE, SUPPRIMER_VEHICULE, VEHICULE_STATUT_SUBSCRIPTION,
} from '../../apollo/queries/vehicules';
import type { Vehicule, StatutVehicule } from '../../types';
import { ArrowLeft, MapPin, Trash2, RefreshCcw } from 'lucide-react';

const STATUTS: StatutVehicule[] = ['DISPONIBLE', 'EN_MISSION', 'EN_MAINTENANCE', 'HORS_SERVICE', 'RETIRE'];
type HistoriqueStatut = { id: string; statutAvant?: string; statutApres: string; motif?: string; dateChangement: string };

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 14 }}>{value ?? '—'}</div>
    </div>
  );
}

export default function VehiculeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasAnyRole } = useAuth();
  const [statutModal, setStatutModal] = useState(false);
  const [newStatut, setNewStatut] = useState<StatutVehicule>('DISPONIBLE');
  const [motif, setMotif] = useState('');
  const [deleteModal, setDeleteModal] = useState(false);

  const { data, loading, refetch } = useQuery<{ vehicule: Vehicule }>(VEHICULE_QUERY, {
    variables: { id },
    skip: !id,
  });

  const { data: historiqueData } = useQuery<{ historiqueStatutVehicule: HistoriqueStatut[] }>(HISTORIQUE_STATUT_QUERY, {
    variables: { id },
    skip: !id,
  });

  const [changerStatut, { loading: changingStatut }] = useMutation(CHANGER_STATUT_VEHICULE);
  const [supprimerVehicule] = useMutation(SUPPRIMER_VEHICULE);

  // Real-time subscription
  useSubscription(VEHICULE_STATUT_SUBSCRIPTION, {
    variables: { vehiculeId: id },
    skip: !id,
    onData: () => refetch(),
  });

  const vehicule = data?.vehicule;
  const canChangeStatut = hasAnyRole(['ADMIN', 'MANAGER', 'TECHNICIEN']);
  const canDelete = hasAnyRole(['ADMIN']);

  const handleChangeStatut = async () => {
    try {
      await changerStatut({ variables: { id, input: { statut: newStatut, motif: motif || undefined } } });
      toast.success(`Statut changé en ${newStatut}`);
      setStatutModal(false);
      refetch();
    } catch (err: unknown) {
      toast.error((err as Error).message ?? 'Erreur');
    }
  };

  const handleDelete = async () => {
    try {
      await supprimerVehicule({ variables: { id } });
      toast.success('Véhicule supprimé');
      navigate('/vehicules');
    } catch (err: unknown) {
      toast.error((err as Error).message ?? 'Erreur');
    }
  };

  if (loading) return <AppLayout title="Véhicule"><div style={{ padding: 40, color: 'var(--text-secondary)' }}>Chargement…</div></AppLayout>;
  if (!vehicule) return <AppLayout title="Véhicule"><div style={{ padding: 40, color: 'var(--text-secondary)' }}>Véhicule introuvable</div></AppLayout>;

  return (
    <AppLayout title={vehicule.immatriculation}>
      {/* Back + actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <Button variant="ghost" size="sm" onClick={() => navigate('/vehicules')}>
          <ArrowLeft size={14} /> Retour
        </Button>
        <div style={{ flex: 1 }} />
        {canChangeStatut && (
          <Button variant="secondary" size="sm" onClick={() => { setNewStatut(vehicule.statut); setStatutModal(true); }}>
            <RefreshCcw size={14} /> Changer statut
          </Button>
        )}
        {canDelete && (
          <Button variant="danger" size="sm" onClick={() => setDeleteModal(true)}>
            <Trash2 size={14} /> Supprimer
          </Button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Info card */}
        <Card>
          <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 600 }}>Informations véhicule</h3>
          <Field label="Immatriculation" value={
            <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 16, color: 'var(--accent)' }}>{vehicule.immatriculation}</span>
          } />
          <Field label="Statut" value={<StatusBadge statut={vehicule.statut} />} />
          <Field label="Marque / Modèle" value={`${vehicule.marque ?? '—'} ${vehicule.modele ?? ''}`.trim()} />
          <Field label="Année" value={vehicule.annee} />
          <Field label="Type" value={vehicule.typeVehicule} />
          <Field label="Kilométrage" value={vehicule.kilometrage != null ? `${Math.round(vehicule.kilometrage).toLocaleString('fr-FR')} km` : undefined} />
          <Field label="Charge max (kg)" value={vehicule.capaciteCharge} />
          <Field label="Conso. moy. (L/100km)" value={vehicule.consommationMoyenne} />
          {vehicule.notes && <Field label="Notes" value={vehicule.notes} />}
        </Card>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Conducteur */}
          <Card>
            <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600 }}>Conducteur actuel</h3>
            {vehicule.conducteurActuel ? (
              <>
                <div style={{ fontWeight: 600 }}>{vehicule.conducteurActuel.prenom} {vehicule.conducteurActuel.nom}</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>{vehicule.conducteurActuel.email}</div>
                <div style={{ marginTop: 8 }}><StatusBadge statut={vehicule.conducteurActuel.statut} size="sm" /></div>
              </>
            ) : (
              <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Aucun conducteur assigné</div>
            )}
          </Card>

          {/* Mission en cours */}
          <Card>
            <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600 }}>Mission en cours</h3>
            {vehicule.missionEnCours ? (
              <>
                <div style={{ fontWeight: 600 }}>{vehicule.missionEnCours.titre}</div>
                <div style={{ marginTop: 8 }}><StatusBadge statut={vehicule.missionEnCours.statut} size="sm" /></div>
                {vehicule.missionEnCours.dateDebut && (
                  <div style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 6 }}>
                    Début : {new Date(vehicule.missionEnCours.dateDebut).toLocaleDateString('fr-FR')}
                  </div>
                )}
              </>
            ) : (
              <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Aucune mission en cours</div>
            )}
          </Card>

          {/* GPS indicator */}
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <MapPin size={16} style={{ color: 'var(--accent)' }} />
              <span style={{ fontSize: 13, fontWeight: 500 }}>Localisation en temps réel</span>
            </div>
            <div style={{ marginTop: 8 }}>
              <Button variant="secondary" size="sm" onClick={() => navigate(`/localisation?vehiculeId=${id}`)}>
                Voir sur la carte
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {/* Maintenances */}
      {vehicule.maintenances && vehicule.maintenances.length > 0 && (
        <Card style={{ marginTop: 20 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600 }}>Maintenances récentes</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {vehicule.maintenances.slice(0, 5).map((m) => (
              <div key={m.id} style={{
                display: 'flex', alignItems: 'center', gap: 16,
                padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: 6,
              }}>
                <StatusBadge statut={m.typeMaintenance} size="sm" />
                <StatusBadge statut={m.statut} size="sm" />
                <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                  {m.dateDebut ? new Date(m.dateDebut).toLocaleDateString('fr-FR') : '—'}
                </span>
                {m.cout != null && <span style={{ fontSize: 12 }}>{m.cout.toLocaleString('fr-FR')} €</span>}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Historique statuts */}
      {(historiqueData?.historiqueStatutVehicule?.length ?? 0) > 0 && (
        <Card style={{ marginTop: 20 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600 }}>Historique des statuts</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {(historiqueData!.historiqueStatutVehicule ?? []).slice(0, 8).map((h) => (
              <div key={h.id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '7px 10px', background: 'var(--bg-elevated)', borderRadius: 6, fontSize: 12,
              }}>
                {h.statutAvant && <StatusBadge statut={h.statutAvant} size="sm" />}
                <span style={{ color: 'var(--text-secondary)' }}>→</span>
                <StatusBadge statut={h.statutApres} size="sm" />
                {h.motif && <span style={{ color: 'var(--text-secondary)' }}>{h.motif}</span>}
                <span style={{ marginLeft: 'auto', color: 'var(--text-secondary)' }}>
                  {new Date(h.dateChangement).toLocaleDateString('fr-FR')}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Changer statut modal */}
      <Modal open={statutModal} onClose={() => setStatutModal(false)} title="Changer le statut">
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Nouveau statut</label>
          <select
            value={newStatut}
            onChange={(e) => setNewStatut(e.target.value as StatutVehicule)}
            style={{ width: '100%', padding: '8px 10px', borderRadius: 6, background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 13 }}
          >
            {STATUTS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Motif (optionnel)</label>
          <input
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            style={{ width: '100%', padding: '8px 10px', borderRadius: 6, background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 13 }}
          />
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={() => setStatutModal(false)}>Annuler</Button>
          <Button variant="primary" isLoading={changingStatut} onClick={handleChangeStatut}>Confirmer</Button>
        </div>
      </Modal>

      {/* Delete confirm modal */}
      <Modal open={deleteModal} onClose={() => setDeleteModal(false)} title="Supprimer le véhicule" maxWidth={400}>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 20 }}>
          Êtes-vous sûr de vouloir supprimer le véhicule <strong style={{ color: 'var(--text-primary)' }}>{vehicule.immatriculation}</strong> ? Cette action est irréversible.
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={() => setDeleteModal(false)}>Annuler</Button>
          <Button variant="danger" onClick={handleDelete}>Supprimer</Button>
        </div>
      </Modal>
    </AppLayout>
  );
}
