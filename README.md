# Système de Gestion de Flotte de Véhicules

## Stack technique

| Service | Technologie | Port interne |
|---|---|---|
| vehicle-service | Java Spring Boot | 3001 |
| driver-service | FastAPI | 8000 |
| maintenance-service | FastAPI | 8001 |
| location-service | Node.js NestJS | 3000 |
| mission-service | Node.js NestJS | 3000 |
| notification-service | Go | 8080 |

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
minikube image load notification-service:latest

# Appliquer tous les manifests Kubernetes
kubectl apply -f infra/k8s/

# Vérifier les pods
kubectl get pods -n fleet-dev

# Vérifier les services
kubectl get svc -n fleet-dev
```

### Ingress

```bash
# Activer l'Ingress Controller Minikube
minikube addons enable ingress

# Récupérer l'IP Minikube
minikube ip

# Ajouter dans /etc/hosts (remplacer X.X.X.X par l'IP obtenue)
echo "X.X.X.X fleet.local" | sudo tee -a /etc/hosts

# Tester les routes
curl http://fleet.local/api/vehicles
curl http://fleet.local/api/drivers
curl http://fleet.local/api/maintenance
curl http://fleet.local/api/locations
curl http://fleet.local/api/missions
```

---

## Monitoring et visualisation

Toutes les interfaces sont accessibles via le navigateur — aucune installation supplémentaire requise.

### Accéder aux interfaces

```bash
# Grafana — dashboards métriques et logs
kubectl port-forward svc/prometheus-grafana 3000:80 -n monitoring

# Prometheus — métriques brutes
kubectl port-forward svc/prometheus-kube-prometheus-prometheus 9090:9090 -n monitoring

# Jaeger — traces distribuées
kubectl port-forward svc/jaeger-query 16686:16686 -n monitoring
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
