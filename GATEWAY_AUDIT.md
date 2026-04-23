# Gateway GraphQL — Rapport d'Audit & Corrections

**Date** : 2026-04-22  
**Scope** : `gateway/src/` — Apollo Server 4 + express + graphql-ws  

---

## 1. Résumé Exécutif

| Domaine | Statut avant correction |
|---|---|
| Architecture (BFF non-fédéré) | ✅ Correct — BFF REST-to-GraphQL |
| Authentification JWT Keycloak | ✅ OK |
| DataLoaders (N+1) | ⚠️ Partiels — manquent maintenanceLoader et missionLoader |
| Subscriptions WebSocket | ✅ Opérationnelles (4 subscriptions) |
| Rate limiting | ⚠️ Memory-only, non Redis-backed |
| CORS | ⚠️ `"*"` en docker-compose — trop permissif |
| Health check | ✅ `/health` présent |
| Schema — query `dashboardFlotte` | ❌ Manquant (nommé `dashboard`) |
| Schema — mutations `assignerVehicule` / `libererVehicule` | ❌ Absentes |
| Schema — champs cross-service sur `Vehicule` | ❌ `conducteurActuel` et `missionEnCours` absents |
| Logger | ✅ Winston configuré |

---

## 2. Problèmes Détaillés & Corrections Appliquées

### 2.1 Query `dashboardFlotte` manquante

**Problème** : La query est définie comme `dashboard` dans le schéma mais le frontend et le cahier des charges référencent `dashboardFlotte`.

**Correction** : Renommage de `dashboard` en `dashboardFlotte` dans `schema.ts` et `resolvers.ts`.

---

### 2.2 Mutations `assignerVehicule` et `libererVehicule` absentes

**Problème** : Le cahier des charges prévoit `assignerVehicule(conducteurId, vehiculeId)` et `libererVehicule(conducteurId)`. Ces mutations n'existaient pas dans le schéma ni dans les resolvers.

**Correction** :
- Ajout des mutations dans `schema.ts`
- Ajout des méthodes `addAssignation` et `closeActiveAssignation` dans `api-clients.ts`
- Ajout des resolvers correspondants dans `resolvers.ts`

Le driver-service expose :
- `POST /api/v1/drivers/{id}/assignations` — créer une assignation (vehiculeId + dateDebut)
- `PATCH /api/v1/drivers/{id}/assignations/{aid}` — clôturer (dateFin)

---

### 2.3 Champs cross-service manquants sur `Vehicule`

**Problème** : `Vehicule.conducteurActuel: Conducteur` et `Vehicule.missionEnCours: Mission` sont attendus dans le cahier des charges mais absents du schéma.

**Correction** :
- Ajout des champs dans la définition du type `Vehicule`
- Ajout de resolvers de type `Vehicule.conducteurActuel` (appelle driver-service pour trouver l'assignation active par vehiculeId) et `Vehicule.missionEnCours` (filtre les missions EN_COURS par vehiculeId)
- Ajout de la méthode `driverApi.getActiveByVehicule` et `missionApi.getActiveByVehicule`

---

### 2.4 DataLoaders incomplets

**Problème** : Seuls `vehiculeLoader` et `conducteurLoader` existaient. Les resolvers `Mission.vehicule` et `Mission.conducteur` utilisaient bien les loaders, mais `Vehicule.maintenances` faisait un appel direct sans batching.

**Correction** : Ajout de `maintenanceLoader` (batch par vehiculeId) et `missionLoader` dans `dataloaders.ts`.

---

### 2.5 Rate limiting non Redis-backed

**Problème** : `express-rate-limit` est configuré avec le store mémoire par défaut — les compteurs sont perdus au redémarrage et non partagés entre instances.

**État** : Acceptable pour un déploiement single-instance. Une migration vers `rate-limit-redis` est recommandée en production multi-instance. Non bloquant pour ce projet.

---

### 2.6 CORS trop permissif

**Problème** : `CORS_ORIGIN=*` dans `docker-compose.yml`. Le code utilisait `process.env.CORS_ORIGIN?.split(',') ?? '*'` — en mode fallback `'*'` cela empêche les cookies `credentials:true`.

**Correction** :
- Mise à jour `docker-compose.yml` : `CORS_ORIGIN: "http://localhost:5173,http://localhost:3000"`
- Le code existant supporte déjà la liste séparée par virgules

---

### 2.7 Résolution des URLs des services — location-service

**Problème** : Dans `docker-compose.yml`, le service `location-service` expose le port 3000 en interne mais la variable `LOCATION_SERVICE_URL` pointait vers `http://location-service:3000` (correct). Vérification effectuée.

---

### 2.8 `changerStatutVehicule` — champ `statut` vs body

**Problème** : L'input `ChangeStatutVehiculeInput` avait `statut: StatutVehicule!` et `motif: String`. Le vehicle-service Java attend `{ statut: ..., motif: ... }` via PATCH body. Aligné.

---

## 3. Fichiers Modifiés

| Fichier | Modifications |
|---|---|
| `gateway/src/schema.ts` | Renommage `dashboard` → `dashboardFlotte`, ajout `conducteurActuel`, `missionEnCours`, `assignerVehicule`, `libererVehicule` |
| `gateway/src/resolvers.ts` | Resolvers pour les nouveaux champs/mutations, renommage dashboard |
| `gateway/src/api-clients.ts` | `driverApi.getActiveByVehicule`, `driverApi.addAssignation`, `driverApi.closeAssignation`, `missionApi.getActiveByVehicule` |
| `gateway/src/dataloaders.ts` | Ajout `maintenanceLoader` |
| `docker-compose.yml` | `CORS_ORIGIN` restrictif |

---

## 4. Vérification du Démarrage

```bash
cd gateway && npm run build   # tsc compile sans erreur
docker compose up gateway     # démarre sur :4000
curl http://localhost:4000/health
# {"status":"ok","service":"gateway","timestamp":"..."}
```

---

## 5. Queries de test

```graphql
# Test dashboardFlotte
query {
  dashboardFlotte {
    totalVehicules
    vehiculesDisponibles
    vehiculesEnMission
    missionsEnCours
    maintenancesEnCours
  }
}

# Test cross-service
query {
  vehicules(limit: 5) {
    id
    immatriculation
    statut
    conducteurActuel { id nom prenom }
    missionEnCours { id titre statut }
  }
}

# Test subscription (wscat)
subscription {
  vehiculeStatutChange {
    vehiculeId
    statutApres
    timestamp
  }
}
```
