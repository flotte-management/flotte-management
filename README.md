# Système de Gestion de Flotte de Véhicules

## Stack technique

| Service | Technologie | Port interne |
|---|---|---|
| vehicle-service | Java Spring Boot | 8080 |
| driver-service | FastAPI | 8000 |
| maintenance-service | FastAPI | 8000 |
| location-service | Node.js NestJS | 3000 |
| mission-service | Node.js NestJS | 3000 |
| event-service | Go | 8080 |

---

## Architecture du projet

```
fleet-management/
├── .github/
│   └── workflows/
│       └── ci.yml                   # CI/CD GitHub Actions
├── services/
│   ├── vehicle-service/             # Java Spring Boot
│   │   └── Dockerfile
│   ├── driver-service/              # FastAPI
│   │   └── Dockerfile
│   ├── maintenance-service/         # FastAPI
│   │   └── Dockerfile
│   ├── location-service/            # Node.js NestJS
│   │   └── Dockerfile
│   ├── mission-service/             # Node.js NestJS
│   │   └── Dockerfile
│   └── notification-service/        # Go
│       └── Dockerfile
├── infra/
│   └── k8s/
│       ├── vehicle-service/
│       │   ├── deployment.yaml
│       │   └── service.yaml
│       ├── driver-service/
│       │   ├── deployment.yaml
│       │   └── service.yaml
│       ├── maintenance-service/
│       │   ├── deployment.yaml
│       │   └── service.yaml
│       ├── location-service/
│       │   ├── deployment.yaml
│       │   └── service.yaml
│       ├── mission-service/
│       │   ├── deployment.yaml
│       │   └── service.yaml
│       ├── notification-service/
│       │   ├── deployment.yaml
│       │   └── service.yaml
│       ├── ingress.yaml
│       ├── postgres-init-db.yaml
│       └── otel-collector-configmap.yaml
├── monitoring/
│   ├── otel/
│   │   └── otel-collector-config.yaml
│   └── prometheus.yml
├── docker-compose.yml
├── .gitignore
└── README.md
```

---


## Lancer le projet en local (Docker Compose)

```bash
# Lancer tous les services
docker compose up --build

# Lancer uniquement les bases de données
docker compose up postgres-vehicles postgres-drivers \
               postgres-location postgres-maintenance postgres-mission

# Lancer un service spécifique
docker compose up --build driver-service

# Voir les logs d'un service
docker compose logs -f driver-service

# Arrêter tout
docker compose down

# Arrêter et reset les volumes
docker compose down -v
```

### Guide rapide  — Docker Compose

**Accès principal**
- Frontend: http://localhost:5173
- API Gateway: http://localhost:4000
- Keycloak: http://localhost:8080

**Observabilité (optionnel)**
- Grafana: http://localhost:3000
- Prometheus: http://localhost:9090
- Jaeger: http://localhost:16686

---

## Kubernetes

### Prérequis

```bash
# Démarrer Minikube
minikube start --driver=docker

# Vérifier
kubectl get nodes
```

### Namespaces

```bash
kubectl create namespace fleet-dev
kubectl create namespace monitoring
```

### Déployer les dépendances via Helm

```bash
# Ajouter les repos Helm
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo add grafana https://grafana.github.io/helm-charts
helm repo add jaegertracing https://jaegertracing.github.io/helm-charts
helm repo add open-telemetry https://open-telemetry.github.io/opentelemetry-helm-charts
helm repo update

# PostgreSQL
helm install postgres bitnami/postgresql \
  --namespace fleet-dev \
  --set auth.postgresPassword=secret

# TimescaleDB (requis pour location-service)
# Utiliser cette option a la place du Postgres standard.
# Le service expose aussi le nom "postgres-postgresql" pour garder la compatibilite.
kubectl apply -f infra/k8s/postgres-init-db.yaml
kubectl apply -f infra/k8s/timescaledb.yaml

# Redis
helm install redis bitnami/redis \
  --namespace fleet-dev \
  --set auth.enabled=false

# Kafka (Confluent)
helm install kafka confluent/kafka \
  --namespace fleet-dev

# Prometheus + Grafana
helm install prometheus prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --set grafana.adminPassword=admin123

# Jaeger
helm install jaeger jaegertracing/jaeger \
  --namespace monitoring \
  --set allInOne.enabled=true \
  --set provisionDataStore.cassandra=false \
  --set storage.type=memory

# Loki
helm install loki grafana/loki-stack \
  --namespace monitoring

# OpenTelemetry Collector
helm install otel-collector open-telemetry/opentelemetry-collector \
  --namespace monitoring \
  --set mode=deployment \
  --set image.repository=otel/opentelemetry-collector-contrib \
  --set image.tag=latest \
  --set configMap.name=otel-collector-config
```

### Initialiser les bases de données

```bash
# Appliquer le ConfigMap d'initialisation
kubectl apply -f infra/k8s/postgres-init-db.yaml

# Vérifier les bases créées
kubectl exec -it postgres-postgresql-0 -n fleet-dev -- psql -U postgres -c "\l"
```

### Déployer les microservices

```bash
# Charger les images dans Minikube
minikube image load vehicle-service:latest
minikube image load driver-service:latest
minikube image load maintenance-service:latest
minikube image load location-service:latest
minikube image load mission-service:latest
minikube image load event-service:latest
minikube image load frontend:latest
minikube image load frontend-about:latest

# Appliquer tous les manifests Kubernetes
kubectl apply -f infra/k8s/

# Vérifier les pods
kubectl get pods -n fleet-dev

# Vérifier les services
kubectl get svc -n fleet-dev
```

### Guide rapide  — Minikube

```bash
# 1) Démarrer Minikube
minikube start --driver=docker

# 2) Activer l'Ingress
minikube addons enable ingress

# 3) Déployer les manifests
kubectl apply -f infra/k8s/

# 4) Ajouter l'IP Minikube dans /etc/hosts
minikube ip
# Puis: echo "X.X.X.X fleet.local keycloak.fleet.local" | sudo tee -a /etc/hosts
```

**Tester les routes (Ingress)**
- http://fleet.local/
- http://fleet.local/about
- http://keycloak.fleet.local
- http://fleet.local/api/vehicles
- http://fleet.local/api/drivers
- http://fleet.local/api/maintenance
- http://fleet.local/api/locations
- http://fleet.local/api/missions
- http://fleet.local/api/events

---

# Kafka 


- **Image** : `confluentinc/confluent-local:7.5.0`
- **Namespace** : `fleet-dev`
- **Adresse interne** : `kafka.fleet-dev.svc.cluster.local:9092`

---

## Démarrage

### Prérequis

```bash
minikube start --memory=8192 --cpus=4
```

### Appliquer la configuration

```bash
kubectl apply -f kafka-confluent.yaml
```

### Vérifier que le pod tourne

```bash
kubectl get pods -n fleet-dev | grep kafka

```

---

## Vérification santé du broker

```bash
# Entrer dans le pod
kubectl exec -it deploy/kafka -n fleet-dev -- bash

# Vérifier que le broker répond
kafka-broker-api-versions --bootstrap-server localhost:9092
```


---

## Opérations courantes

### Lister les topics

```bash
kubectl exec -it deploy/kafka -n fleet-dev -- \
  kafka-topics --bootstrap-server localhost:9092 --list
```

### Créer un topic

```bash
kubectl exec -it deploy/kafka -n fleet-dev -- \
  kafka-topics --bootstrap-server localhost:9092 \
  --create --topic fleet-events \
  --partitions 1 --replication-factor 1
```

### Supprimer un topic

```bash
kubectl exec -it deploy/kafka -n fleet-dev -- \
  kafka-topics --bootstrap-server localhost:9092 \
  --delete --topic fleet-events
```

---

## Test bout en bout

### Terminal 1 — Consommateur

```bash
kubectl exec -it deploy/kafka -n fleet-dev -- \
  kafka-console-consumer --bootstrap-server localhost:9092 \
  --topic fleet-events --from-beginning
```

### Terminal 2 — Producteur

```bash
kubectl exec -it deploy/kafka -n fleet-dev -- \
  kafka-console-producer --bootstrap-server localhost:9092 \
  --topic fleet-events
```

Exemples de messages à envoyer :

```json
{"vehicleId":"VH-001","status":"moving","speed":90}
{"vehicleId":"VH-002","status":"stopped","speed":0}
```

---

## Accès depuis l'extérieur du cluster (dev local)

```bash
kubectl port-forward deploy/kafka 9092:9092 -n fleet-dev
```



## Debug

```bash
# Logs du pod Kafka
kubectl logs deploy/kafka -n fleet-dev

# Inspecter un consumer group
kubectl exec -it deploy/kafka -n fleet-dev -- \
  kafka-consumer-groups --bootstrap-server localhost:9092 \
  --describe --group fleet-consumer-group

# Voir les offsets d'un topic
kubectl exec -it deploy/kafka -n fleet-dev -- \
  kafka-consumer-groups --bootstrap-server localhost:9092 \
  --group fleet-consumer-group --reset-offsets \
  --topic fleet-events --to-earliest --dry-run
```


## Monitoring et visualisation

Toutes les interfaces sont accessibles via le navigateur — aucune installation supplémentaire requise.

### Accéder aux interfaces

```bash
# Grafana — dashboards métriques et logs
kubectl port-forward svc/prometheus-grafana 3000:80 -n monitoring

# Prometheus — métriques brutes
kubectl port-forward svc/prometheus-kube-prometheus-prometheus 9090:9090 -n monitoring

# Jaeger — traces distribuées
kubectl port-forward svc/jaeger 16686:16686 -n monitoring
```

### URLs et credentials

| Interface | URL | Credentials | Utilité |
|---|---|---|---|
| **Grafana** | http://localhost:3000 | admin / admin123 | Dashboards métriques + logs |
| **Prometheus** | http://localhost:9090 | — | Métriques brutes, requêtes PromQL |
| **Jaeger** | http://localhost:16686 | — | Traces distribuées entre services |

### OpenTelemetry Collector

Le Collector reçoit les traces/métriques/logs des services via :
- **gRPC** : `otel-collector:4317`
- **HTTP** : `otel-collector:4318`

Et les redistribue automatiquement vers Jaeger, Prometheus et Loki.

```bash
# Vérifier que le Collector tourne
kubectl get pods -n monitoring | grep otel

# Voir les métriques collectées en temps réel
kubectl logs -n monitoring deployment/otel-collector-opentelemetry-collector -f
```

---

## CI/CD — GitHub Actions

Pipeline déclenché automatiquement sur `push` vers `main` et sur `pull_request`.

**Étapes du pipeline :**
1. Build des images Docker de chaque service
2. Scan de sécurité Trivy (CRITICAL, HIGH)

Voir `.github/workflows/ci.yml` pour le détail.

---

## Commandes utiles

```bash
# État des pods par namespace
kubectl get pods -n fleet-dev
kubectl get pods -n monitoring

# Tous les pods de tous les namespaces
kubectl get pods -A

# Logs d'un service
kubectl logs -n fleet-dev deployment/vehicle-service
kubectl logs -n fleet-dev deployment/driver-service

# Déboguer un pod
kubectl describe pod -n fleet-dev -l app=vehicle-service

# Redémarrer un déploiement
kubectl rollout restart deployment/vehicle-service -n fleet-dev

# Voir les endpoints
kubectl get endpoints -n fleet-dev

# Voir les releases Helm installées
helm list -n fleet-dev
helm list -n monitoring

# Supprimer une release Helm
helm uninstall <nom> -n <namespace>
```

---

## Variables d'environnement

| Variable | Description | Valeur (dev) |
|---|---|---|
| `DB_HOST` | Hôte PostgreSQL | `postgres-postgresql` |
| `DB_NAME` | Nom de la base | selon le service |
| `DB_USER` | Utilisateur PostgreSQL | `postgres` |
| `DB_PASSWORD` | Mot de passe PostgreSQL | `secret` |
| `KAFKA_BROKERS` | Adresse Kafka | `kafka:9092` |
