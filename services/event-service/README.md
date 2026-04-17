# Service Notifications — Système de Gestion de Flotte

> Microservice Go · Consommateur Kafka · Dispatch d'événements métier  
> Master 1 GIL 2025/2026 — Université de Rouen Normandie

---

## Sommaire

- [Vue d'ensemble](#vue-densemble)
- [Architecture](#architecture)
- [Prérequis](#prérequis)
- [Structure du projet](#structure-du-projet)
- [Configuration](#configuration)
- [Démarrage](#démarrage)
- [Tests](#tests)
- [Comportement attendu par événement](#comportement-attendu-par-événement)
- [Arrêt propre](#arrêt-propre)

---

## Vue d'ensemble

Le service Notifications est un microservice **stateless** écrit en Go. Il n'a pas de base de données propre. Son unique responsabilité est de **consommer les événements Kafka** publiés par les autres services de la flotte et de **déclencher les notifications métier** correspondantes.

| Propriété | Valeur |
|---|---|
| Langage | Go 1.23 |
| Consumer Group | `notification-service-group` |
| Topics écoutés | `flotte.vehicules`, `flotte.conducteurs`, `flotte.maintenances`, `flotte.localisation`, `flotte.missions` |
| Événements traités | `geofence.alert`, `maintenance.planned`, `vehicule.statut_changed` (motif `Panne`) |
| Port exposé | aucun (service purement consommateur) |

---

## Architecture

```
event-service/
├── cmd/
│   └── main.go                  # Point d'entrée, injection de dépendances, graceful shutdown
├── internal/
│   ├── consumer/
│   │   └── kafka.go             # ConsumerGroup Sarama, goroutines par partition
│   ├── dispatcher/
│   │   └── dispatcher.go        # Switch eventType → handler
│   ├── handlers/
│   │   ├── geofence.go          # geofence.alert
│   │   ├── maintenance.go       # maintenance.planned
│   │   └── vehicule.go          # vehicule.statut_changed (motif Panne)
│   ├── model/
│   │   └── event.go             # Enveloppe standard + structs payload
│   └── notifier/
│       └── notifier.go          # Interface Notifier, LogNotifier, MultiNotifier
├── docker-compose.yml
├── Dockerfile
├── go.mod
└── README.md
```

### Modèle de concurrence — `flotte.localisation` (12 partitions)

```
Kafka Broker
    │
    ├── Partition 0  ──► goroutine ConsumeClaim ──► channel jobs ──► [worker 0..3]
    ├── Partition 1  ──► goroutine ConsumeClaim ──► channel jobs ──► [worker 0..3]
    │   ...
    └── Partition 11 ──► goroutine ConsumeClaim ──► channel jobs ──► [worker 0..3]

Total : 12 goroutines I/O (lecture Kafka) + 48 goroutines worker (dispatch)
```

- **1 goroutine par partition** garantit l'isolation : une partition lente ne bloque pas les autres.
- **Pool de workers par partition** (`workerPool=4`) contrôle le parallélisme CPU.
- **Channel bufferisé** (`workerPool × 2`) absorbe les micro-bursts.
- **Commit manuel** de l'offset uniquement après dispatch réussi (garantie at-least-once).

---

## Prérequis

| Outil | Version minimale |
|---|---|
| Go | 1.23 |
| Docker | 24+ |
| Docker Compose | v2 |

---

## Structure du projet

Cloner ou se placer à la racine du service :

```bash
cd event-service/
```

Télécharger les dépendances Go :

```bash
go mod download
```

---

## Configuration

| Variable d'environnement | Valeur par défaut | Description |
|---|---|---|
| `KAFKA_BROKERS` | `localhost:9092` | Adresse du broker Kafka |

---

## Démarrage

### Option 1 — Stack complète via Docker Compose

Lance Zookeeper, Kafka, la création des topics, puis le service :

```bash
docker compose up --build
```

Pour lancer uniquement l'infrastructure (Kafka) sans le service :

```bash
docker compose up zookeeper kafka kafka-init --wait
```

Puis démarrer le service en local :

```bash
KAFKA_BROKERS=localhost:9092 go run ./cmd/main.go
```

### Option 2 — Build binaire

```bash
go build -o event-service ./cmd/main.go
KAFKA_BROKERS=localhost:9092 ./event-service
```

### Vérifier que les topics ont bien été créés

```bash
docker compose exec kafka kafka-topics \
  --bootstrap-server localhost:9092 \
  --list
```

Résultat attendu :
```
flotte.conducteurs
flotte.localisation
flotte.maintenances
flotte.missions
flotte.vehicules
```

Vérifier le détail des partitions :

```bash
docker compose exec kafka kafka-topics \
  --bootstrap-server localhost:9092 \
  --describe \
  --topic flotte.localisation
```

---

## Tests

> Tous les payloads ci-dessous sont issus du rapport technique (Semaine 1, section 8).

### Ouvrir un producer Kafka

Pour chaque test, ouvre un terminal avec le producer Kafka sur le topic concerné :

```bash
# flotte.localisation (geofence.alert)
docker compose exec kafka kafka-console-producer \
  --bootstrap-server localhost:9092 \
  --topic flotte.localisation

# flotte.maintenances (maintenance.planned)
docker compose exec kafka kafka-console-producer \
  --bootstrap-server localhost:9092 \
  --topic flotte.maintenances

# flotte.vehicules (vehicule.statut_changed)
docker compose exec kafka kafka-console-producer \
  --bootstrap-server localhost:9092 \
  --topic flotte.vehicules
```

---

### Test 1 — `geofence.alert` · topic `flotte.localisation`

**Objectif :** vérifier qu'une alerte critique est générée lors de l'entrée dans une zone interdite.

Payload à injecter :

```json
{"eventId":"a7b8c9d0-bbbb-2345-6789-0abcdef12345","eventType":"geofence.alert","version":"1.0","timestamp":"2026-03-12T11:02:33.456Z","source":"service-localisation","correlationId":null,"payload":{"vehiculeId":"a1b2c3d4-e5f6-7890-abcd-ef1234567890","zoneId":"b2c3d4e5-cccc-3456-789a-bcdef0123456","nomZone":"Zone Aéroportuaire Interdite","typeAlerte":"ENTREE","latitude":49.421234,"longitude":1.065432}}
```

**Log attendu :**

```json
{
  "level": "ERROR",
  "msg": "NOTIFICATION_CRITICAL",
  "level_notif": "CRITICAL",
  "service": "service-localisation",
  "title": "🚨 Alerte Géofence — ENTREE — Zone Aéroportuaire Interdite",
  "typeAlerte": "ENTREE",
  "vehiculeId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

### Test 2 — `geofence.alert` · typeAlerte SORTIE

**Objectif :** vérifier le libellé de sortie de zone.

```json
{"eventId":"b8c9d0e1-cccc-3456-789a-bcdef0123456","eventType":"geofence.alert","version":"1.0","timestamp":"2026-03-12T11:15:00.000Z","source":"service-localisation","correlationId":null,"payload":{"vehiculeId":"a1b2c3d4-e5f6-7890-abcd-ef1234567890","zoneId":"b2c3d4e5-cccc-3456-789a-bcdef0123456","nomZone":"Zone Aéroportuaire Interdite","typeAlerte":"SORTIE","latitude":49.430000,"longitude":1.070000}}
```

**Log attendu :** même niveau `CRITICAL`, message contenant `est sorti de`.

---

### Test 3 — `maintenance.planned` · topic `flotte.maintenances`

**Objectif :** vérifier qu'une notification d'information est générée pour une maintenance planifiée.

```json
{"eventId":"d4e5f6a7-9999-0000-1111-222233334444","eventType":"maintenance.planned","version":"1.0","timestamp":"2026-03-12T08:00:00.000Z","source":"service-maintenance","correlationId":"req-manager-001","payload":{"maintenanceId":"e5f6a7b8-cccc-dddd-eeee-ffff00001111","vehiculeId":"a1b2c3d4-e5f6-7890-abcd-ef1234567890","type":"PREVENTIVE","datePlanifiee":"2026-03-20T09:00:00.000Z","technicienId":"user-uuid-technicien-001"}}
```

**Log attendu :**

```json
{
  "level": "INFO",
  "msg": "NOTIFICATION_INFO",
  "level_notif": "INFO",
  "service": "service-maintenance",
  "title": "📅 Maintenance planifiée — PREVENTIVE",
  "vehiculeId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

### Test 4 — `vehicule.statut_changed` · motif `Panne` · topic `flotte.vehicules`

**Objectif :** vérifier que l'alerte manager est déclenchée lorsque le motif est "Panne".

```json
{"eventId":"c3d2e1f0-aaaa-bbbb-cccc-ddddeeeeffffeeee","eventType":"vehicule.statut_changed","version":"1.0","timestamp":"2026-03-12T14:22:05.123Z","source":"service-vehicules","correlationId":"req-maintenance-42","payload":{"vehiculeId":"a1b2c3d4-e5f6-7890-abcd-ef1234567890","statutAvant":"EN_SERVICE","statutApres":"HORS_SERVICE","motif":"Panne","modifiePar":"user-uuid-technicien-001"}}
```

**Log attendu :**

```json
{
  "level": "ERROR",
  "msg": "NOTIFICATION_CRITICAL",
  "level_notif": "CRITICAL",
  "service": "service-vehicules",
  "title": "🔴 PANNE — Véhicule a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "motif": "Panne"
}
```

---

### Test 5 — `vehicule.statut_changed` · motif quelconque (doit être ignoré)

**Objectif :** vérifier que les changements de statut sans motif "Panne" ne génèrent aucune notification.

```json
{"eventId":"aabbccdd-1111-2222-3333-444455556666","eventType":"vehicule.statut_changed","version":"1.0","timestamp":"2026-03-12T09:00:00.000Z","source":"service-vehicules","correlationId":null,"payload":{"vehiculeId":"a1b2c3d4-e5f6-7890-abcd-ef1234567890","statutAvant":"DISPONIBLE","statutApres":"EN_SERVICE","motif":"Mission démarrée","modifiePar":"user-uuid-manager-002"}}
```

**Résultat attendu :** aucun log `NOTIFICATION_*` — le handler retourne silencieusement.

---

### Test 6 — `eventType` non géré (doit être ignoré)

**Objectif :** vérifier que les événements hors périmètre ne causent pas d'erreur.

```json
{"eventId":"ffff0000-aaaa-bbbb-cccc-111122223333","eventType":"mission.created","version":"1.0","timestamp":"2026-03-12T07:30:00.000Z","source":"service-missions","correlationId":"req-manager-456","payload":{"missionId":"d0e1f2a3-eeee-5678-9abc-def012345678"}}
```

**Résultat attendu :** log `DEBUG` avec `event type not handled, skipping` — pas d'erreur.

---

### Test 7 — JSON malformé (robustesse)

**Objectif :** vérifier que le service ne crashe pas sur un message invalide.

```bash
echo "not-valid-json" | docker compose exec -T kafka kafka-console-producer \
  --bootstrap-server localhost:9092 \
  --topic flotte.vehicules
```

**Résultat attendu :** log `ERROR` avec `dispatch: unmarshal envelope`, offset non commité, service toujours actif.

---

### Vérifier les offsets consommés

Après avoir joué les tests, vérifie que tous les messages ont bien été traités (LAG = 0) :

```bash
docker compose exec kafka kafka-consumer-groups \
  --bootstrap-server localhost:9092 \
  --group notification-service-group \
  --describe
```

Exemple de sortie attendue :

```
GROUP                        TOPIC                PARTITION  CURRENT-OFFSET  LOG-END-OFFSET  LAG
notification-service-group   flotte.vehicules     0          3               3               0
notification-service-group   flotte.localisation  0          1               1               0
notification-service-group   flotte.maintenances  0          1               1               0
...
```

---

## Comportement attendu par événement

| `eventType` | Topic | Condition | Niveau | Action |
|---|---|---|---|---|
| `geofence.alert` | `flotte.localisation` | Toujours | `CRITICAL` | Alerte entrée/sortie zone interdite |
| `maintenance.planned` | `flotte.maintenances` | Toujours | `INFO` | Notification de planification |
| `vehicule.statut_changed` | `flotte.vehicules` | `motif == "Panne"` | `CRITICAL` | Alerte manager |
| `vehicule.statut_changed` | `flotte.vehicules` | autre motif | — | Ignoré silencieusement |
| tous les autres | tous | — | — | Log `DEBUG`, ignoré |

---

## Arrêt propre

Le service écoute `SIGINT` (Ctrl+C) et `SIGTERM` (Docker stop). À réception :

1. Le context est annulé.
2. Les goroutines `ConsumeClaim` terminent la lecture en cours.
3. Les channels `jobs` sont fermés.
4. Les workers terminent les messages en cours de traitement.
5. Le consumer group est fermé proprement (`kc.Close()`).

```bash
# Arrêt propre via Docker Compose
docker compose down

# Ou directement si lancé en local
Ctrl+C
```

Log attendu à l'arrêt :

```json
{"level":"INFO","msg":"kafka consumer stopped by context"}
{"level":"INFO","msg":"notification-service stopped gracefully"}
```

---

> **Auteurs :** Oussama Cherguelaine · Saleh Moussa Souleyman  
> **Encadrants :** Lydia & Luc  
> **Université de Rouen Normandie — UFR Sciences et Techniques — M1 GIL 2025/2026**
