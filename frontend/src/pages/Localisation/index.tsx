import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useSubscription } from '@apollo/client/react';
import { AppLayout } from '../../components/layout/AppLayout';
import { Card } from '../../components/ui/Card';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { VEHICULES_QUERY } from '../../apollo/queries/vehicules';
import { POSITION_ACTUELLE_QUERY } from '../../apollo/queries/localisation';
import { POSITION_VEHICULE_SUBSCRIPTION } from '../../apollo/queries/vehicules';
import type { Vehicule, Position } from '../../types';
import { MapPin, Navigation, Radio } from 'lucide-react';

/* ---- Lazy-load Leaflet to avoid SSR issues ---- */
let L: typeof import('leaflet') | null = null;
const getLeaflet = async () => {
  if (!L) {
    L = (await import('leaflet')).default;
    // Fix default icon path in bundled environments
    const iconUrl = new URL('leaflet/dist/images/marker-icon.png', import.meta.url).href;
    const shadowUrl = new URL('leaflet/dist/images/marker-shadow.png', import.meta.url).href;
    L.Icon.Default.mergeOptions({ iconUrl, shadowUrl, iconRetinaUrl: iconUrl });
  }
  return L;
};

/* ---- Map component ---- */
function VehiculeMap({ vehicles }: { vehicles: Array<{ vehicule: Vehicule; position: Position | null }> }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import('leaflet').Map | null>(null);
  const markersRef = useRef<Record<string, import('leaflet').Marker>>({});

  // Initialize map
  useEffect(() => {
    let map: import('leaflet').Map;
    (async () => {
      const leaflet = await getLeaflet();
      if (!containerRef.current) return;
      // Avoid double-init
      if (mapRef.current) return;
      await import('leaflet/dist/leaflet.css');

      map = leaflet.map(containerRef.current, { center: [48.8566, 2.3522], zoom: 6, zoomControl: true });
      leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);
      mapRef.current = map;
    })();
    return () => {
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
  }, []);

  // Update markers when vehicle/position data changes
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    (async () => {
      const leaflet = await getLeaflet();
      vehicles.forEach(({ vehicule, position }) => {
        if (!position) return;
        const { latitude, longitude } = position;
        const existing = markersRef.current[vehicule.id];
        if (existing) {
          existing.setLatLng([latitude, longitude]);
          existing.getTooltip()?.setContent(`${vehicule.immatriculation}`);
        } else {
          const marker = leaflet.marker([latitude, longitude])
            .addTo(map)
            .bindTooltip(`${vehicule.immatriculation}`, { permanent: false, direction: 'top' })
            .bindPopup(`
              <strong>${vehicule.immatriculation}</strong><br/>
              ${vehicule.marque ?? ''} ${vehicule.modele ?? ''}<br/>
              Statut: ${vehicule.statut}<br/>
              Vitesse: ${position.vitesse != null ? `${position.vitesse} km/h` : '—'}<br/>
              Mis à jour: ${new Date(position.time).toLocaleTimeString('fr-FR')}
            `);
          markersRef.current[vehicule.id] = marker;
        }
      });
    })();
  }, [vehicles]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', borderRadius: 8, overflow: 'hidden' }} />
  );
}

/* ---- Live position hook for selected vehicle ---- */
function useLivePosition(vehiculeId: string | null) {
  const [livePos, setLivePos] = useState<Position | null>(null);

  const { data: staticData } = useQuery<{ positionActuelle: Position }>(POSITION_ACTUELLE_QUERY, {
    variables: { vehiculeId },
    skip: !vehiculeId,
  });

  useEffect(() => {
    if (staticData?.positionActuelle) setLivePos(staticData.positionActuelle);
  }, [staticData?.positionActuelle]);

  useSubscription(POSITION_VEHICULE_SUBSCRIPTION, {
    variables: { vehiculeId },
    skip: !vehiculeId,
    onData: (options) => {
      const pos = (options.data.data as { positionVehicule?: Position } | undefined)?.positionVehicule;
      if (pos) setLivePos(pos);
    },
  });

  return livePos ?? staticData?.positionActuelle ?? null;
}

/* ---- Main page ---- */
export default function Localisation() {
  const [searchParams] = useSearchParams();
  const focusVehiculeId = searchParams.get('vehiculeId');
  const [selectedId, setSelectedId] = useState<string | null>(focusVehiculeId);

  const { data: vehiculesData, loading } = useQuery<{ vehicules: Vehicule[] }>(VEHICULES_QUERY, {
    variables: { statut: undefined, page: 1, limit: 100 },
    fetchPolicy: 'cache-and-network',
  });

  const vehicules = vehiculesData?.vehicules ?? [];
  const livePosition = useLivePosition(selectedId);

  // Build combined list for the map (fetch all positions via the first query per vehicle)
  // For simplicity, we only track static positions for all vehicles but live for the selected one
  const mapVehicles = vehicules.map((v) => ({
    vehicule: v,
    position: v.id === selectedId ? livePosition : null,
  }));

  return (
    <AppLayout title="Localisation en temps réel">
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16, height: 'calc(100vh - 130px)' }}>
        {/* Sidebar: vehicle list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4, padding: '0 4px' }}>
            {vehicules.length} véhicule{vehicules.length > 1 ? 's' : ''}
          </div>
          {loading && <div style={{ color: 'var(--text-secondary)', fontSize: 13, padding: '0 4px' }}>Chargement…</div>}
          {vehicules.map((v) => (
            <div
              key={v.id}
              onClick={() => setSelectedId(v.id === selectedId ? null : v.id)}
              style={{
                padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                background: v.id === selectedId ? 'var(--bg-elevated)' : 'var(--bg-surface)',
                border: `1px solid ${v.id === selectedId ? 'var(--accent)' : 'var(--border)'}`,
                transition: 'border-color 0.15s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <MapPin size={13} style={{ color: v.id === selectedId ? 'var(--accent)' : 'var(--text-secondary)', flexShrink: 0 }} />
                <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 600, color: v.id === selectedId ? 'var(--accent)' : 'var(--text-primary)' }}>
                  {v.immatriculation}
                </span>
                {v.id === selectedId && (
                  <Radio size={11} style={{ marginLeft: 'auto', color: 'var(--success)' }} />
                )}
              </div>
              <div style={{ marginTop: 4 }}><StatusBadge statut={v.statut} size="sm" /></div>
            </div>
          ))}
        </div>

        {/* Map area */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Live position card */}
          {selectedId && (
            <Card style={{ padding: '10px 16px', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)', boxShadow: '0 0 0 2px rgba(63,185,80,0.3)', animation: 'pulse 2s ease-in-out infinite' }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--success)' }}>LIVE</span>
                {livePosition ? (
                  <>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)', marginLeft: 8 }}>
                      {livePosition.latitude.toFixed(5)}, {livePosition.longitude.toFixed(5)}
                    </span>
                    {livePosition.vitesse != null && (
                      <span style={{ marginLeft: 8, display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
                        <Navigation size={12} /> {Math.round(livePosition.vitesse)} km/h
                      </span>
                    )}
                    <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-secondary)' }}>
                      {new Date(livePosition.time).toLocaleTimeString('fr-FR')}
                    </span>
                  </>
                ) : (
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)', marginLeft: 8 }}>En attente des données GPS…</span>
                )}
              </div>
            </Card>
          )}

          {/* Map */}
          <div style={{ flex: 1, background: 'var(--bg-surface)', borderRadius: 8, border: '1px solid var(--border)', overflow: 'hidden' }}>
            {typeof window !== 'undefined' && <VehiculeMap vehicles={mapVehicles} />}
          </div>

          {!selectedId && (
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', pointerEvents: 'none' }}>
              <div style={{ background: 'rgba(13,17,23,0.85)', padding: '12px 20px', borderRadius: 8, color: 'var(--text-secondary)', fontSize: 13 }}>
                Sélectionnez un véhicule pour activer le suivi en temps réel
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 2px rgba(63,185,80,0.3); }
          50% { box-shadow: 0 0 0 5px rgba(63,185,80,0.1); }
        }
      `}</style>
    </AppLayout>
  );
}
