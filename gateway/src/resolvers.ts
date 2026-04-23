import { withFilter } from 'graphql-subscriptions';
import { GatewayContext } from './context.js';
import {
  vehicleApi,
  driverApi,
  missionApi,
  maintenanceApi,
  locationApi,
} from './api-clients.js';
import {
  pubsub,
  VEHICULE_STATUT_CHANGED,
  POSITION_VEHICULE_UPDATED,
  NOUVELLE_ALERTE,
  MISSION_EVENT,
} from './kafka-bridge.js';
import { logger } from './logger.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildQuery(params: Record<string, unknown>): string {
  const parts = Object.entries(params)
    .filter(([, v]) => v != null)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return parts.length ? `?${parts.join('&')}` : '';
}

function extractItems(res: unknown): Record<string, unknown>[] {
  if (Array.isArray(res)) return res as Record<string, unknown>[];
  const r = res as Record<string, unknown>;
  if (Array.isArray(r.items)) return r.items as Record<string, unknown>[];
  if (Array.isArray(r.data)) return r.data as Record<string, unknown>[];
  if (Array.isArray(r.content)) return r.content as Record<string, unknown>[];
  return [];
}
function normalizeConducteur(d: Record<string, unknown>): Record<string, unknown> {
  return {
    ...d,
    statut: typeof d.statut === 'string' ? d.statut.toUpperCase() : d.statut,
    dateCreation: d.created_at ?? d.dateCreation,
    dateModification: d.updated_at ?? d.dateModification,
  };
}

/**
 * Normalize a maintenance-service response object to match the GraphQL Maintenance type.
 * The Python service uses snake_case fields and lowercase enum values.
 */
function normalizeMaintenance(m: Record<string, unknown>): Record<string, unknown> {
  const rawType = (m.type ?? m.typeMaintenance) as string | undefined;
  const rawStatut = (m.statut) as string | undefined;
  return {
    id: m.id,
    vehiculeId: m.vehicule_id ?? m.vehiculeId,
    typeMaintenance: rawType ? rawType.toUpperCase() : undefined,
    statut: rawStatut ? rawStatut.toUpperCase() : undefined,
    description: m.description,
    dateDebut: m.date_planifiee ?? m.date_debut ?? m.dateDebut,
    dateFin: m.date_fin ?? m.dateFin,
    kilometrageIntervention: m.kilometrage_intervention ?? m.kilometrageIntervention,
    cout: m.cout_total ?? m.cout,
    technicien: m.technicien_id ?? m.technicien,
    notes: m.notes,
    dateCreation: m.created_at ?? m.dateCreation,
    dateModification: m.updated_at ?? m.dateModification,
  };
}

/**
 * Normalize a mission-service response object to match the GraphQL Mission type.
 * The NestJS service uses dateDebutPrevue / adresseOrigine field names.
 */
function normalizeMission(m: Record<string, unknown>): Record<string, unknown> {
  return {
    ...m,
    dateDebut: m.dateDebutPrevue ?? m.dateDebut,
    dateFin: m.dateFinPrevue ?? m.dateFin,
    adresseDepart: m.adresseOrigine ?? m.adresseDepart,
    adresseDestination: m.adresseDestination,
    dateCreation: m.createdAt ?? m.dateCreation,
    dateModification: m.updatedAt ?? m.dateModification,
  };
}

// ─── Resolvers ────────────────────────────────────────────────────────────────

export const resolvers = {
  // ── Query ──────────────────────────────────────────────────────────────────
  Query: {
    async vehicules(_: unknown, args: Record<string, unknown>, ctx: GatewayContext) {
      // Frontend sends 1-indexed pages; Spring Boot expects 0-indexed pages.
      const pageIndex = typeof args.page === 'number'
        ? Math.max(0, (args.page as number) - 1)
        : undefined;
      const q = buildQuery({ statut: args.statut, page: pageIndex, size: args.limit });
      const res = await vehicleApi.list(q, ctx.token);
      logger.debug('vehiculeApi.list raw response keys: %o', Object.keys((res as Record<string, unknown>) ?? {}));
      return extractItems(res);
    },

    async vehicule(_: unknown, args: { id: string }, ctx: GatewayContext) {
      return ctx.loaders.vehiculeLoader.load(args.id);
    },

    async historiqueStatutVehicule(_: unknown, args: { id: string }, ctx: GatewayContext) {
      const res = await vehicleApi.historique(args.id, ctx.token);
      return extractItems(res);
    },

    async conducteurs(_: unknown, args: Record<string, unknown>, ctx: GatewayContext) {
      const statut = typeof args.statut === 'string' ? args.statut.toLowerCase() : args.statut;
      const q = buildQuery({ statut, page: args.page, limit: args.limit });
      const res = await driverApi.list(q, ctx.token);
      return extractItems(res).map(normalizeConducteur);
    },

    async conducteur(_: unknown, args: { id: string }, ctx: GatewayContext) {
      const res = await ctx.loaders.conducteurLoader.load(args.id) as Record<string, unknown>;
      return res ? normalizeConducteur(res) : null;
    },

    async missions(_: unknown, args: Record<string, unknown>, ctx: GatewayContext) {
      const q = buildQuery({
        statut:       args.statut,
        vehiculeId:   args.vehiculeId,
        conducteurId: args.conducteurId,
        page:         args.page,
        limit:        args.limit,
      });
      const res = await missionApi.list(q, ctx.token);
      return extractItems(res).map(normalizeMission);
    },

    async mission(_: unknown, args: { id: string }, ctx: GatewayContext) {
      const res = await missionApi.getById(args.id, ctx.token) as Record<string, unknown>;
      return res ? normalizeMission(res) : null;
    },

    async maintenances(_: unknown, args: Record<string, unknown>, ctx: GatewayContext) {
      const q = buildQuery({ vehiculeId: args.vehiculeId, statut: args.statut, page: args.page, limit: args.limit });
      const res = await maintenanceApi.list(q, ctx.token);
      return extractItems(res).map(normalizeMaintenance);
    },

    async maintenance(_: unknown, args: { id: string }, ctx: GatewayContext) {
      const res = await maintenanceApi.getById(args.id, ctx.token) as Record<string, unknown>;
      return res ? normalizeMaintenance(res) : null;
    },

    async maintenancesVehicule(_: unknown, args: { vehiculeId: string }, ctx: GatewayContext) {
      const res = await maintenanceApi.byVehicule(args.vehiculeId, ctx.token);
      return extractItems(res).map(normalizeMaintenance);
    },

    async positionActuelle(_: unknown, args: { vehiculeId: string }, ctx: GatewayContext) {
      return locationApi.latestPosition(args.vehiculeId, ctx.token);
    },

    async historiquePositions(
      _: unknown,
      args: { vehiculeId: string; debut?: string; fin?: string; limit?: number },
      ctx: GatewayContext,
    ) {
      const q = buildQuery({ debut: args.debut, fin: args.fin, limit: args.limit });
      return locationApi.history(args.vehiculeId, q, ctx.token);
    },

    async dashboardFlotte(_: unknown, _args: unknown, ctx: GatewayContext) {
      // Parallel fan-out to all four services
      const [vehiculesRes, conducteursRes, missionsRes, maintenancesRes] = await Promise.allSettled([
        vehicleApi.list('?page=0&size=1000', ctx.token),
        driverApi.list('?limit=1000', ctx.token),
        missionApi.list('?limit=1000', ctx.token),
        maintenanceApi.list('?limit=1000', ctx.token),
      ]);

      const vList = vehiculesRes.status === 'fulfilled' ? extractItems(vehiculesRes.value) as Record<string, string>[] : [];
      const cList = conducteursRes.status === 'fulfilled' ? extractItems(conducteursRes.value) as Record<string, string>[] : [];
      const mList = missionsRes.status === 'fulfilled' ? extractItems(missionsRes.value) as Record<string, string>[] : [];
      const xList = maintenancesRes.status === 'fulfilled' ? extractItems(maintenancesRes.value) as Record<string, string>[] : [];

      return {
        totalVehicules:          vList.length,
        vehiculesDisponibles:    vList.filter((v) => v.statut === 'DISPONIBLE').length,
        vehiculesEnMission:      vList.filter((v) => v.statut === 'EN_MISSION').length,
        vehiculesEnMaintenance:  vList.filter((v) => v.statut === 'EN_MAINTENANCE').length,
        vehiculesHorsService:    vList.filter((v) => v.statut === 'HORS_SERVICE').length,
        totalConducteurs:        cList.length,
        conducteursActifs:       cList.filter((c) => c.statut === 'ACTIF').length,
        conducteursEnMission:    cList.filter((c) => c.statut === 'EN_MISSION').length,
        missionsEnCours:         mList.filter((m) => m.statut === 'EN_COURS').length,
        maintenancesEnCours:     xList.filter((x) => x.statut === 'EN_COURS').length,
      };
    },
  },

  // ── Mutation ───────────────────────────────────────────────────────────────
  Mutation: {
    async creerVehicule(_: unknown, args: { input: unknown }, ctx: GatewayContext) {
      return vehicleApi.create(args.input, ctx.token);
    },

    async modifierVehicule(_: unknown, args: { id: string; input: unknown }, ctx: GatewayContext) {
      return vehicleApi.update(args.id, args.input, ctx.token);
    },

    async changerStatutVehicule(_: unknown, args: { id: string; input: unknown }, ctx: GatewayContext) {
      return vehicleApi.changeStatut(args.id, args.input, ctx.token);
    },

    async supprimerVehicule(_: unknown, args: { id: string }, ctx: GatewayContext) {
      await vehicleApi.delete(args.id, ctx.token);
      return true;
    },

    async creerConducteur(_: unknown, args: { input: unknown }, ctx: GatewayContext) {
      return driverApi.create(args.input, ctx.token);
    },

    async modifierConducteur(_: unknown, args: { id: string; input: unknown }, ctx: GatewayContext) {
      return driverApi.update(args.id, args.input, ctx.token);
    },

    async changerStatutConducteur(_: unknown, args: { id: string; statut: string }, ctx: GatewayContext) {
      return driverApi.updateStatut(args.id, { statut: args.statut }, ctx.token);
    },

    async supprimerConducteur(_: unknown, args: { id: string }, ctx: GatewayContext) {
      await driverApi.delete(args.id, ctx.token);
      return true;
    },

    async assignerVehicule(_: unknown, args: { conducteurId: string; vehiculeId: string }, ctx: GatewayContext) {
      await driverApi.addAssignation(args.conducteurId, { vehiculeId: args.vehiculeId, dateDebut: new Date().toISOString() }, ctx.token);
      return true;
    },

    async libererVehicule(_: unknown, args: { conducteurId: string }, ctx: GatewayContext) {
      const assignation = await driverApi.getActiveAssignation(args.conducteurId, ctx.token) as { id: string } | null;
      if (!assignation) return false;
      await driverApi.closeAssignation(args.conducteurId, assignation.id, { dateFin: new Date().toISOString() }, ctx.token);
      return true;
    },

    async creerMission(_: unknown, args: { input: Record<string, unknown> }, ctx: GatewayContext) {
      const i = args.input;
      const serviceInput = {
        titre: i.titre,
        vehiculeId: i.vehiculeId,
        conducteurId: i.conducteurId,
        dateDebutPrevue: i.dateDebut,
        dateFinPrevue: i.dateFin,
        adresseOrigine: i.adresseDepart,
        adresseDestination: i.adresseDestination,
        distanceEstimeeKm: i.distanceEstimeeKm ?? null,
        notes: i.description ?? null,
      };
      const res = await missionApi.create(serviceInput, ctx.token) as Record<string, unknown>;
      return normalizeMission(res);
    },

    async changerStatutMission(_: unknown, args: { id: string; input: unknown }, ctx: GatewayContext) {
      return missionApi.changeStatut(args.id, args.input, ctx.token);
    },

    async supprimerMission(_: unknown, args: { id: string }, ctx: GatewayContext) {
      await missionApi.delete(args.id, ctx.token);
      return true;
    },

    async creerMaintenance(_: unknown, args: { input: Record<string, unknown> }, ctx: GatewayContext) {
      const i = args.input;
      const serviceInput = {
        vehicule_id: i.vehiculeId,
        type: typeof i.typeMaintenance === 'string' ? i.typeMaintenance.toLowerCase() : i.typeMaintenance,
        description: i.description ?? null,
        date_planifiee: i.dateDebut ?? new Date().toISOString(),
        date_debut: i.dateDebut ?? null,
        date_fin: i.dateFin ?? null,
        kilometrage_intervention: i.kilometrageIntervention ?? null,
        technicien_id: ctx.user?.sub,
        cout_total: i.cout ?? null,
        notes: i.notes ?? null,
      };
      const res = await maintenanceApi.create(serviceInput, ctx.token) as Record<string, unknown>;
      return normalizeMaintenance(res);
    },

    async modifierMaintenance(_: unknown, args: { id: string; input: unknown }, ctx: GatewayContext) {
      return maintenanceApi.update(args.id, args.input, ctx.token);
    },

    async changerStatutMaintenance(_: unknown, args: { id: string; statut: string }, ctx: GatewayContext) {
      return maintenanceApi.changeStatut(args.id, args.statut, ctx.token);
    },

    async supprimerMaintenance(_: unknown, args: { id: string }, ctx: GatewayContext) {
      await maintenanceApi.delete(args.id, ctx.token);
      return true;
    },

    async ingestPosition(_: unknown, args: { input: unknown }, ctx: GatewayContext) {
      return locationApi.ingest(args.input, ctx.token);
    },
  },

  // ── Subscription ───────────────────────────────────────────────────────────
  Subscription: {
    vehiculeStatutChange: {
      subscribe: withFilter(
        () => pubsub.asyncIterator(VEHICULE_STATUT_CHANGED),
        (payload: { vehiculeStatutChange: { vehiculeId: string } }, args: { vehiculeId?: string }) => {
          if (!args.vehiculeId) return true;
          return payload.vehiculeStatutChange.vehiculeId === args.vehiculeId;
        },
      ),
    },

    positionVehicule: {
      subscribe: withFilter(
        () => pubsub.asyncIterator(POSITION_VEHICULE_UPDATED),
        (payload: { positionVehicule: { vehiculeId: string } }, args: { vehiculeId: string }) => {
          return payload.positionVehicule.vehiculeId === args.vehiculeId;
        },
      ),
    },

    nouvelleAlerte: {
      subscribe: withFilter(
        () => pubsub.asyncIterator(NOUVELLE_ALERTE),
        (payload: { nouvelleAlerte: { vehiculeId?: string } }, args: { vehiculeId?: string }) => {
          if (!args.vehiculeId) return true;
          return payload.nouvelleAlerte.vehiculeId === args.vehiculeId;
        },
      ),
    },

    missionEvent: {
      subscribe: withFilter(
        () => pubsub.asyncIterator(MISSION_EVENT),
        (payload: { missionEvent: { missionId?: string } }, args: { missionId?: string }) => {
          if (!args.missionId) return true;
          return payload.missionEvent.missionId === args.missionId;
        },
      ),
    },
  },

  // ── Type resolvers ─────────────────────────────────────────────────────────

  Mission: {
    async vehicule(parent: { vehiculeId?: string }, _: unknown, ctx: GatewayContext) {
      if (!parent.vehiculeId) return null;
      try {
        return await ctx.loaders.vehiculeLoader.load(parent.vehiculeId);
      } catch (err) {
        logger.debug(`Mission.vehicule load failed: ${err}`);
        return null;
      }
    },

    async conducteur(parent: { conducteurId?: string }, _: unknown, ctx: GatewayContext) {
      if (!parent.conducteurId) return null;
      try {
        return await ctx.loaders.conducteurLoader.load(parent.conducteurId);
      } catch (err) {
        logger.debug(`Mission.conducteur load failed: ${err}`);
        return null;
      }
    },
  },

  Vehicule: {
    async conducteurActuel(parent: { id: string }, _: unknown, ctx: GatewayContext) {
      try {
        return await driverApi.getActiveByVehicule(parent.id, ctx.token);
      } catch {
        return null;
      }
    },

    async missionEnCours(parent: { id: string }, _: unknown, ctx: GatewayContext) {
      try {
        const q = buildQuery({ vehiculeId: parent.id, statut: 'EN_COURS', limit: 1 });
        const res = await missionApi.list(q, ctx.token);
        const items = extractItems(res);
        const first = items?.[0] ?? null;
        return first ? normalizeMission(first) : null;
      } catch {
        return null;
      }
    },

    async maintenances(parent: { id: string }, _: unknown, ctx: GatewayContext) {
      try {
        const res = await maintenanceApi.byVehicule(parent.id, ctx.token);
        return extractItems(res).map(normalizeMaintenance);
      } catch {
        return [];
      }
    },
  },
};
