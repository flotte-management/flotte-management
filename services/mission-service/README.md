# Service Missions — Système de Gestion de Flotte

> Microservice NestJS gérant le cycle de vie des missions : planification, démarrage, étapes, clôture.
> Produit des événements Kafka sur le topic `flotte.missions`.

---

## Table des matières

- [Architecture](#architecture)
- [Stack technique](#stack-technique)
- [Prérequis](#prérequis)
- [Installation & démarrage rapide](#installation--démarrage-rapide)
- [Configuration](#configuration)
- [Endpoints REST](#endpoints-rest)
- [Machine à états](#machine-à-états-des-missions)
- [Événements Kafka](#événements-kafka)
- [Authentification & RBAC](#authentification--rbac)
- [Swagger / OpenAPI](#swagger--openapi)
- [Tests avec Postman](#tests-avec-postman)
- [Base de données](#base-de-données)
- [Structure du projet](#structure-du-projet)

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Service Missions                      │
│                  NestJS  — Port 3005                     │
│                                                          │
│  MissionsController → MissionsService → TypeORM         │
│                              ↓                           │
│                       KafkaService ──→ flotte.missions   │
│                                                          │
│  Auth : JwtStrategy (Keycloak RS256) + RolesGuard        │
└──────────────────────────┬──────────────────────────────┘
                           │
              ┌────────────┴────────────┐
              │                         │
       PostgreSQL 16               Apache Kafka
      flotte_missions              flotte.missions
                                  (6 partitions)
```

---

## Stack technique

| Composant       | Technologie              | Version |
|-----------------|--------------------------|---------|
| Framework       | NestJS                   | 10.x    |
| Langage         | TypeScript               | 5.x     |
| ORM             | TypeORM                  | 0.3.x   |
| Base de données | PostgreSQL               | 16      |
| Message broker  | Apache Kafka (KafkaJS)   | 2.x     |
| Auth            | Keycloak OIDC / RS256    | 24.x    |
| Documentation   | Swagger / OpenAPI 3      | 7.x     |
| Runtime         | Node.js                  | 20 LTS  |

---

## Prérequis

- **Node.js** ≥ 20 LTS
- **Docker** + **Docker Compose** (pour la stack locale complète)
- **npm** ≥ 9

---

## Installation & démarrage rapide

### Option A — Docker Compose (recommandé)

Lance l'ensemble de la stack (PostgreSQL + Kafka + Zookeeper + service) :

```bash
# Cloner le projet
git clone <repo>
cd service-missions

# Copier et adapter la configuration
cp .env.example .env

# Démarrer la stack complète
docker compose up -d

# Suivre les logs du service
docker compose logs -f service-missions
```

Le service est accessible sur **http://localhost:3005**
Le Swagger est accessible sur **http://localhost:3005/api/docs**
Le Kafka UI est accessible sur **http://localhost:8090**

---

### Option B — Démarrage local (Node.js natif)

```bash
# 1. Installer les dépendances
npm install

# 2. Démarrer PostgreSQL et Kafka séparément (avec Docker)
docker compose up postgres kafka zookeeper -d

# 3. Configurer l'environnement
cp .env.example .env
# → Éditer .env avec vos paramètres (voir section Configuration)

# 4. Démarrer en mode développement (hot-reload)
npm run start:dev

# 5. Build production
npm run build
npm run start:prod
```

---

## Configuration

Copier `.env.example` en `.env` et renseigner les variables :

```dotenv
# Application
APP_PORT=3005
NODE_ENV=development

# Base de données
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_NAME=flotte_missions
DB_SYNCHRONIZE=true        # true en dev, false en prod (utiliser migrations)
DB_LOGGING=true

# Kafka
KAFKA_BROKERS=localhost:9092
KAFKA_CLIENT_ID=service-missions
KAFKA_GROUP_ID=service-missions-group

# Keycloak — URL du realm (pour la JWKS auto-discovery)
KEYCLOAK_REALM_URL=http://localhost:8080/realms/flotte-management

# Clé publique Keycloak RS256 (dev sans Keycloak)
# Récupérer avec : curl http://localhost:8080/realms/flotte-management | jq .public_key
JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\nMIIBI...\n-----END PUBLIC KEY-----"

# Swagger
SWAGGER_ENABLED=true
SWAGGER_PATH=api/docs
```

> **Mode dev sans Keycloak** : vous pouvez générer un JWT de test avec la clé RS256 de votre choix
> en définissant `JWT_PUBLIC_KEY` avec la clé publique correspondante.

---

## Endpoints REST

Préfixe : `/api/v1` — Tous les endpoints nécessitent un Bearer JWT valide.

### Missions

| Méthode  | Endpoint                         | Description                              | Rôles                            |
|----------|----------------------------------|------------------------------------------|----------------------------------|
| `GET`    | `/missions`                      | Lister (paginé, filtrable)               | Tous (conducteur voit les siennes)|
| `POST`   | `/missions`                      | Créer une mission                        | ADMIN, MANAGER                   |
| `GET`    | `/missions/:id`                  | Détail d'une mission                     | ADMIN, MANAGER, UTILISATEUR      |
| `PUT`    | `/missions/:id`                  | Modifier (état PLANIFIEE seulement)      | ADMIN, MANAGER                   |
| `DELETE` | `/missions/:id`                  | Annuler/supprimer                        | ADMIN, MANAGER                   |
| `PATCH`  | `/missions/:id/statut`           | Changer le statut                        | ADMIN, MANAGER, UTILISATEUR      |

### Étapes

| Méthode  | Endpoint                              | Description                        | Rôles                       |
|----------|---------------------------------------|------------------------------------|-----------------------------|
| `GET`    | `/missions/:id/etapes`                | Lister les étapes (triées)         | Tous                        |
| `POST`   | `/missions/:id/etapes`                | Ajouter une étape                  | ADMIN, MANAGER              |
| `PATCH`  | `/missions/:id/etapes/:eid`           | Marquer atteinte / ignorée         | ADMIN, MANAGER, UTILISATEUR |

### Filtres disponibles sur `GET /missions`

| Paramètre     | Type   | Description                              |
|---------------|--------|------------------------------------------|
| `statut`      | enum   | `PLANIFIEE`, `EN_COURS`, `TERMINEE`, `ANNULEE` |
| `conducteurId`| UUID   | Filtrer par conducteur (ADMIN/MANAGER)   |
| `vehiculeId`  | UUID   | Filtrer par véhicule                     |
| `page`        | number | Numéro de page (défaut : 1)             |
| `limit`       | number | Taille de page (défaut : 20, max : 100) |

---

## Machine à états des missions

```
                 ┌─────────────┐
     création ──▶│  PLANIFIEE  │
                 └──────┬──────┘
                        │ PATCH statut: EN_COURS
                        ▼
                 ┌─────────────┐
                 │   EN_COURS  │
                 └──────┬──────┘
              ┌─────────┴──────────┐
              │                    │
    TERMINEE  ▼                    ▼  ANNULEE
       ┌──────────┐         ┌──────────┐
       │ TERMINEE │         │ ANNULEE  │
       └──────────┘         └──────────┘
              ▲                    ▲
              └──── PLANIFIEE ─────┘
                   (aussi ANNULEE)
```

Toute transition invalide retourne une erreur `400 Bad Request`.

---

## Événements Kafka

Topic : **`flotte.missions`** (6 partitions, clé = `missionId`)

Tous les messages respectent l'enveloppe standard du projet :

```json
{
  "eventId":       "uuid-v4",
  "eventType":     "mission.created",
  "version":       "1.0",
  "timestamp":     "2026-03-13T07:30:00.000Z",
  "source":        "service-missions",
  "correlationId": "req-manager-456",
  "payload":       { ... }
}
```

### Événements publiés

| eventType          | Déclencheur                        | Consommateurs attendus            |
|--------------------|------------------------------------|-----------------------------------|
| `mission.created`  | `POST /missions`                   | Véhicules, Conducteurs, Notifications |
| `mission.started`  | `PATCH /statut` → `EN_COURS`       | Véhicules, Conducteurs, Notifications |
| `mission.completed`| `PATCH /statut` → `TERMINEE`       | Véhicules, Conducteurs, Notifications |
| `mission.cancelled`| `PATCH /statut` → `ANNULEE` / `DELETE` | Véhicules, Conducteurs, Notifications |

> **Best-effort** : les publications Kafka sont asynchrones et non bloquantes.
> Une erreur Kafka ne fait pas échouer la requête HTTP, mais est loguée.

---

## Authentification & RBAC

Le service délègue entièrement l'authentification à **Keycloak** (realm `flotte-management`).

### Obtenir un token de test

```bash
# Via Keycloak (Resource Owner Password — dev uniquement)
curl -s -X POST \
  "http://localhost:8080/realms/flotte-management/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password" \
  -d "client_id=flotte-frontend" \
  -d "username=souleyman.manager" \
  -d "password=manager123" \
  | jq -r .access_token
```

### Rôles configurés

| Rôle          | Permissions sur ce service                     |
|---------------|------------------------------------------------|
| `ADMIN`       | Toutes les opérations                          |
| `MANAGER`     | CRUD complet, changement de statut             |
| `TECHNICIEN`  | Lecture seule                                  |
| `UTILISATEUR` | Ses propres missions, changement de statut     |

Les rôles sont extraits du claim JWT `realm_access.roles` (Keycloak standard).

---

## Swagger / OpenAPI

Disponible sur **http://localhost:3005/api/docs** (si `SWAGGER_ENABLED=true`).

Fonctionnalités :
- Interface « Try it out » intégrée
- Persistance du token JWT entre rechargements (`persistAuthorization`)
- Affichage de la durée des requêtes
- Export JSON : `http://localhost:3005/api/docs-json`

---

## Tests avec Postman

### Import de la collection

1. Ouvrir Postman
2. **Import** → sélectionner `postman/Service-Missions.postman_collection.json`
3. Créer un **environment** `flotte-local` avec :

| Variable     | Valeur initiale                              |
|--------------|----------------------------------------------|
| `base_url`   | `http://localhost:3005/api/v1`               |
| `jwt_token`  | *(token obtenu via Keycloak)*                |
| `mission_id` | *(rempli automatiquement après création)*    |
| `etape_id`   | *(rempli automatiquement après ajout étape)* |

### Scénario de test recommandé

```
1. Health check                      → GET /health
2. Créer une mission                 → POST /missions        (sauvegarde mission_id)
3. Lister les missions               → GET /missions
4. Consulter la mission créée        → GET /missions/:id
5. Ajouter deux étapes               → POST /missions/:id/etapes  ×2
6. Lister les étapes                 → GET /missions/:id/etapes
7. Démarrer la mission               → PATCH /statut { "statut": "EN_COURS" }
8. Marquer l'étape 1 atteinte        → PATCH /etapes/:eid
9. Terminer la mission               → PATCH /statut { "statut": "TERMINEE", "distanceReelleKm": 91.2 }
10. Vérifier le statut final         → GET /missions/:id
```

---

## Base de données

### Schéma

```
missions
├── id                  UUID PK
├── titre               VARCHAR(100)
├── vehicule_id         UUID (référence externe)
├── conducteur_id       UUID (référence externe)
├── statut              ENUM(PLANIFIEE, EN_COURS, TERMINEE, ANNULEE)
├── date_debut_prevue   TIMESTAMPTZ
├── date_fin_prevue     TIMESTAMPTZ  ─┐ CHECK fin > debut
├── date_debut_reelle   TIMESTAMPTZ
├── date_fin_reelle     TIMESTAMPTZ
├── adresse_origine     VARCHAR(200)
├── adresse_destination VARCHAR(200)
├── distance_estimee_km NUMERIC(8,2)
├── distance_reelle_km  NUMERIC(8,2)
├── notes               TEXT
├── motif_annulation    VARCHAR(255)
├── cree_par            UUID
├── created_at          TIMESTAMPTZ
└── updated_at          TIMESTAMPTZ (auto-trigger)

etapes_mission
├── id             UUID PK
├── mission_id     UUID FK → missions(id) ON DELETE CASCADE
├── ordre          SMALLINT         ─┐ UNIQUE(mission_id, ordre)
├── adresse        VARCHAR(200)
├── latitude       DOUBLE PRECISION
├── longitude      DOUBLE PRECISION
├── heure_prevue   TIMESTAMPTZ
├── heure_arrivee  TIMESTAMPTZ
└── statut         ENUM(EN_ATTENTE, ATTEINTE, IGNOREE)
```

### Appliquer le DDL manuellement

```bash
# Avec psql
psql -h localhost -p 5433 -U postgres -d flotte_missions -f sql/init.sql

# Ou via Docker
docker exec -i flotte-missions-db \
  psql -U postgres -d flotte_missions < sql/init.sql
```

### DB_SYNCHRONIZE en développement

Avec `DB_SYNCHRONIZE=true`, TypeORM applique automatiquement les changements d'entités.
**Ne jamais utiliser en production** — préférer des migrations TypeORM :

```bash
# Générer une migration après modification d'entité
npm run typeorm migration:generate -- -n AddChampMission

# Appliquer les migrations
npm run typeorm migration:run
```

---

## Structure du projet

```
service-missions/
├── src/
│   ├── main.ts                          # Bootstrap + Swagger + pipes globaux
│   ├── app.module.ts                    # Module racine
│   ├── health.controller.ts             # GET /health
│   ├── auth/
│   │   ├── auth.module.ts
│   │   └── jwt.strategy.ts              # Validation JWT Keycloak RS256
│   ├── common/
│   │   ├── decorators/
│   │   │   ├── roles.decorator.ts       # @Roles(Role.ADMIN, ...)
│   │   │   └── current-user.decorator.ts# @CurrentUser()
│   │   ├── enums/
│   │   │   └── index.ts                 # StatutMission, StatutEtape, Role
│   │   ├── filters/
│   │   │   └── http-exception.filter.ts # Réponses d'erreur normalisées
│   │   └── guards/
│   │       └── index.ts                 # JwtAuthGuard + RolesGuard
│   ├── database/
│   │   └── database.module.ts           # TypeORM async config
│   ├── kafka/
│   │   ├── kafka.module.ts
│   │   └── kafka.service.ts             # Producer + enveloppes typées
│   └── missions/
│       ├── missions.module.ts
│       ├── missions.controller.ts       # 9 endpoints REST + Swagger
│       ├── missions.service.ts          # Logique métier + machine à états
│       ├── dto/
│       │   ├── create-mission.dto.ts
│       │   └── index.ts                 # UpdateMission, ChangeStatut, Etape...
│       └── entities/
│           ├── mission.entity.ts
│           └── etape-mission.entity.ts
├── sql/
│   └── init.sql                         # DDL PostgreSQL + données de test
├── postman/
│   └── Service-Missions.postman_collection.json
├── .env.example
├── docker-compose.yml                   # Stack complète de dev
├── Dockerfile                           # Multi-stage dev/build/prod
├── nest-cli.json
├── package.json
├── tsconfig.json
└── README.md
```

---

## Liens utiles

| Ressource         | URL                                       |
|-------------------|-------------------------------------------|
| API Docs Swagger  | http://localhost:3005/api/docs            |
| Health check      | http://localhost:3005/health              |
| Kafka UI          | http://localhost:8090                     |
| PostgreSQL (port) | localhost:5433                            |
| Keycloak Admin    | http://localhost:8080/admin               |

---

*Master 1 Génie Informatique et Logiciel — Université de Rouen Normandie — 2025/2026*
*Auteurs : Oussama Cherguelaine & Saleh Moussa Souleyman*
