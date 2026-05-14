#!/usr/bin/env bash
# =============================================================================
# start-minikube.sh — Déploiement Fleet Management sur Minikube
# =============================================================================
set -euo pipefail

# --- Couleurs -----------------------------------------------------------------
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; CYAN='\033[0;36m'; NC='\033[0m'
info()    { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }
step()    { echo -e "\n${CYAN}━━━ $* ${NC}"; }

# --- Fonctions utilitaires ----------------------------------------------------

# Attendre que tous les pods d'un namespace soient Ready
wait_for_pods() {
  local namespace="$1"
  local label="${2:-}"
  local timeout="${3:-180}"
  local selector=""
  [[ -n "$label" ]] && selector="-l $label"

  info "Attente des pods dans '$namespace' (timeout : ${timeout}s)..."
  if ! kubectl wait pod \
    --for=condition=Ready \
    --namespace="$namespace" \
    $selector \
    --all \
    --timeout="${timeout}s" 2>/dev/null; then
    warn "Certains pods ne sont pas encore Ready après ${timeout}s — vérifier avec :"
    warn "  kubectl get pods -n $namespace"
  fi
}

# Attendre qu'un déploiement Helm soit disponible
wait_for_deployment() {
  local name="$1"
  local namespace="$2"
  info "Attente du déploiement '$name'..."
  kubectl rollout status deployment/"$name" -n "$namespace" --timeout=120s 2>/dev/null || \
    warn "Déploiement '$name' pas encore prêt — continuer quand même."
}

# Vérifier si une release Helm est déjà installée
helm_installed() {
  helm list -n "$2" --short 2>/dev/null | grep -q "^$1$"
}

# --- Vérification des prérequis -----------------------------------------------
step "1 / 9 — Vérification des prérequis"

for cmd in minikube kubectl helm docker; do
  command -v "$cmd" >/dev/null 2>&1 || error "'$cmd' n'est pas installé ou absent du PATH."
  info "✓ $cmd trouvé"
done

docker info >/dev/null 2>&1 || error "Le daemon Docker n'est pas démarré."

# --- Démarrage de Minikube ----------------------------------------------------
step "2 / 9 — Démarrage de Minikube"

MINIKUBE_STATUS=$(minikube status --format='{{.Host}}' 2>/dev/null || echo "Stopped")

if [[ "$MINIKUBE_STATUS" == "Running" ]]; then
  info "Minikube est déjà en cours d'exécution."
else
  info "Démarrage de Minikube (8 Go RAM, 4 CPU)..."
  minikube start --driver=docker --memory=8192 --cpus=4
fi

info "Activation de l'addon Ingress..."
minikube addons enable ingress

kubectl get nodes
info "Minikube prêt."

# --- Namespaces ---------------------------------------------------------------
step "3 / 9 — Création des namespaces"

for ns in fleet-dev monitoring; do
  if kubectl get namespace "$ns" >/dev/null 2>&1; then
    info "Namespace '$ns' existe déjà."
  else
    kubectl create namespace "$ns"
    info "Namespace '$ns' créé."
  fi
done

# --- Dépendances Helm ---------------------------------------------------------
step "4 / 9 — Installation des dépendances via Helm"

info "Mise à jour des repos Helm..."
helm repo add bitnami              https://charts.bitnami.com/bitnami                         2>/dev/null || true
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts         2>/dev/null || true
helm repo add grafana              https://grafana.github.io/helm-charts                      2>/dev/null || true
helm repo add jaegertracing        https://jaegertracing.github.io/helm-charts                2>/dev/null || true
helm repo add open-telemetry       https://open-telemetry.github.io/opentelemetry-helm-charts 2>/dev/null || true
helm repo update

# Redis
if helm_installed redis fleet-dev; then
  info "Redis déjà installé — skip."
else
  info "Installation de Redis..."
  helm install redis bitnami/redis \
    --namespace fleet-dev \
    --set auth.enabled=false \
    --wait --timeout=120s
fi

# Prometheus + Grafana
if helm_installed prometheus monitoring; then
  info "Prometheus+Grafana déjà installés — skip."
else
  info "Installation de Prometheus + Grafana..."
  helm install prometheus prometheus-community/kube-prometheus-stack \
    --namespace monitoring \
    --set grafana.adminPassword=admin123 \
    --wait --timeout=180s
fi

# Jaeger
if helm_installed jaeger monitoring; then
  info "Jaeger déjà installé — skip."
else
  info "Installation de Jaeger..."
  helm install jaeger jaegertracing/jaeger \
    --namespace monitoring \
    --set allInOne.enabled=true \
    --set provisionDataStore.cassandra=false \
    --set storage.type=memory \
    --wait --timeout=120s
fi

# Loki
if helm_installed loki monitoring; then
  info "Loki déjà installé — skip."
else
  info "Installation de Loki..."
  helm install loki grafana/loki-stack \
    --namespace monitoring \
    --wait --timeout=120s
fi

# OpenTelemetry Collector
if helm_installed otel-collector monitoring; then
  info "OTel Collector déjà installé — skip."
else
  info "Installation de l'OpenTelemetry Collector..."
  helm install otel-collector open-telemetry/opentelemetry-collector \
    --namespace monitoring \
    --set mode=deployment \
    --set image.repository=otel/opentelemetry-collector-contrib \
    --set image.tag=latest \
    --set configMap.name=otel-collector-config \
    --wait --timeout=120s
fi

# --- Attente stabilisation des pods -------------------------------------------
step "5 / 9 — Attente stabilisation des dépendances"

wait_for_pods fleet-dev  "" 180
wait_for_pods monitoring "" 180

# --- Déploiement de Kafka -----------------------------------------------------
step "6 / 9 — Déploiement de Kafka (manifest)"

if [[ -f "kafka-confluent.yaml" ]]; then
  info "Application de kafka-confluent.yaml..."
  kubectl apply -f kafka-confluent.yaml -n fleet-dev
  info "Attente du pod Kafka..."
  kubectl wait pod \
    --for=condition=Ready \
    --namespace=fleet-dev \
    -l app=kafka \
    --timeout=180s 2>/dev/null || warn "Pod Kafka pas encore Ready — continuer quand même."
else
  warn "kafka-confluent.yaml introuvable à la racine du projet — skip."
fi

# --- Deploiement Keycloak -----------------------------------------------------
step "7 / 10 — Deploiement de Keycloak"

if [[ -d "infra/keycloak" ]]; then
  info "Creation/maj du ConfigMap keycloak-realm depuis infra/keycloak/..."
  kubectl create configmap keycloak-realm -n fleet-dev \
    --from-file=infra/keycloak \
    --dry-run=client -o yaml | kubectl apply -f -
else
  warn "infra/keycloak introuvable — Keycloak ne pourra pas importer les realms."
fi

if [[ -d "infra/k8s/keycloak" ]]; then
  info "Deploiement Keycloak (DB + serveur)..."
  kubectl apply -f infra/k8s/keycloak/keycloak-db.yaml -n fleet-dev
  kubectl apply -f infra/k8s/keycloak/keycloak.yaml -n fleet-dev
else
  warn "infra/k8s/keycloak/ introuvable — skip Keycloak."
fi

# --- Deploiement TimescaleDB + Init SQL ---------------------------------------
step "8 / 10 — Déploiement de TimescaleDB et initialisation des bases"

if [[ -f "infra/k8s/postgres-init-db.yaml" ]]; then
  info "Application de postgres-init-db.yaml..."
  kubectl apply -f infra/k8s/postgres-init-db.yaml -n fleet-dev
else
  warn "infra/k8s/postgres-init-db.yaml introuvable — skip init SQL."
fi

if [[ -f "infra/k8s/timescaledb.yaml" ]]; then
  info "Application de timescaledb.yaml..."
  kubectl apply -f infra/k8s/timescaledb.yaml -n fleet-dev

  info "Attente que TimescaleDB soit opérationnel..."
  kubectl wait pod \
    --for=condition=Ready \
    --namespace=fleet-dev \
    -l app=timescaledb \
    --timeout=120s 2>/dev/null || warn "Pod TimescaleDB pas encore prêt."
else
  warn "infra/k8s/timescaledb.yaml introuvable — skip déploiement TimescaleDB."
fi

info "Initialisation des bases de données et extensions..."

# Recuperation dynamique du mot de passe via Secret (fallback: secret)
PG_PWD="secret"
if kubectl get secret --namespace fleet-dev postgres-postgresql >/dev/null 2>&1; then
  PG_PWD=$(kubectl get secret --namespace fleet-dev postgres-postgresql \
    -o jsonpath="{.data.postgres-password}" 2>/dev/null | base64 -d) || PG_PWD="secret"
fi

TS_POD=$(kubectl get pod -l app=timescaledb -n fleet-dev \
  -o jsonpath="{.items[0].metadata.name}" 2>/dev/null) || TS_POD=""

if [[ -z "$TS_POD" ]]; then
  warn "Aucun pod TimescaleDB trouvé — skip initialisation SQL."
else
  DB_LIST=("vehicles_db" "drivers_db" "maintenance_db" "location_db" "mission_db")
  for db in "${DB_LIST[@]}"; do
    info "  > Configuration de $db..."
    kubectl exec -i "$TS_POD" -n fleet-dev -- \
      env PGPASSWORD="$PG_PWD" psql -U postgres \
      -c "CREATE DATABASE $db;" 2>/dev/null || true
    kubectl exec -i "$TS_POD" -n fleet-dev -- \
      env PGPASSWORD="$PG_PWD" psql -U postgres -d "$db" \
      -c "CREATE EXTENSION IF NOT EXISTS timescaledb;"
    kubectl exec -i "$TS_POD" -n fleet-dev -- \
      env PGPASSWORD="$PG_PWD" psql -U postgres -d "$db" \
      -c "CREATE EXTENSION IF NOT EXISTS postgis;"
  done
  info "Bases initialisées : ${DB_LIST[*]}"
fi

# --- Build et chargement des images -------------------------------------------
step "9 / 10 — Build et chargement des images Docker dans Minikube"

SERVICES=(vehicle-service driver-service maintenance-service location-service mission-service event-service)

for svc in "${SERVICES[@]}"; do
  SVC_DIR="services/$svc"
  if [[ -f "$SVC_DIR/Dockerfile" ]]; then
    info "Build de l'image $svc:latest..."
    docker build -t "$svc:latest" "$SVC_DIR"
    info "Chargement de $svc:latest dans Minikube..."
    minikube image load "$svc:latest"
  else
    warn "Dockerfile introuvable pour $svc ($SVC_DIR/Dockerfile) — skip."
  fi
done

# Frontend + microfrontend
if [[ -f "frontend/Dockerfile" ]]; then
  info "Build de l'image frontend:latest (Keycloak K8s)..."
  docker build -t frontend:latest ./frontend \
    --build-arg VITE_KEYCLOAK_URL=http://keycloak.fleet.local \
    --build-arg VITE_KEYCLOAK_REALM=flotte-management \
    --build-arg VITE_KEYCLOAK_CLIENT_ID=flotte-frontend
  info "Chargement de frontend:latest dans Minikube..."
  minikube image load frontend:latest
else
  warn "frontend/Dockerfile introuvable — skip frontend."
fi

if [[ -f "frontend-about/Dockerfile" ]]; then
  info "Build de l'image frontend-about:latest..."
  docker build -t frontend-about:latest ./frontend-about
  info "Chargement de frontend-about:latest dans Minikube..."
  minikube image load frontend-about:latest
else
  warn "frontend-about/Dockerfile introuvable — skip microfrontend."
fi

# --- Deploiement des microservices -------------------------------------------
step "10 / 10 — Déploiement des microservices"

if [[ ! -d "infra/k8s" ]]; then
  error "Répertoire infra/k8s/ introuvable. Assurez-vous d'exécuter ce script depuis la racine du projet."
fi

SERVICES_K8S=("vehicle-service" "driver-service" "maintenance-service" "location-service" "mission-service" "event-service" "frontend" "frontend-about")

for svc in "${SERVICES_K8S[@]}"; do
  if [[ -d "infra/k8s/$svc" ]]; then
    info "  > Application des manifests pour $svc..."
    kubectl apply -f "infra/k8s/$svc/" -n fleet-dev
  else
    warn "Dossier infra/k8s/$svc/ introuvable — skip."
  fi
done

# Ingress appliqué en dernier pour éviter les 503 prématurés
if [[ -f "infra/k8s/ingress.yaml" ]]; then
  info "Application de l'Ingress..."
  kubectl apply -f infra/k8s/ingress.yaml -n fleet-dev
else
  warn "infra/k8s/ingress.yaml introuvable — skip."
fi

info "Attente des pods microservices..."
wait_for_pods fleet-dev "" 240

# --- Résumé final -------------------------------------------------------------
MINIKUBE_IP=$(minikube ip)

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  ✓  Fleet Management déployé avec succès sur Minikube${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  IP Minikube : ${CYAN}${MINIKUBE_IP}${NC}"
echo ""
echo -e "  Ajoutez cette ligne a votre ${YELLOW}/etc/hosts${NC} :"
echo -e "  ${CYAN}${MINIKUBE_IP}  fleet.local keycloak.fleet.local${NC}"
echo ""
echo -e "  Routes disponibles apres configuration :"
echo -e "    http://fleet.local/"
echo -e "    http://fleet.local/about"
echo -e "    http://keycloak.fleet.local"
echo ""
echo -e "  Observabilité (port-forward nécessaire) :"
echo -e "    kubectl port-forward svc/prometheus-grafana 3000:80 -n monitoring"
echo -e "    kubectl port-forward svc/prometheus-kube-prometheus-prometheus 9090:9090 -n monitoring"
echo -e "    kubectl port-forward svc/jaeger 16686:16686 -n monitoring"
echo ""
echo -e "  État des pods :"
kubectl get pods -n fleet-dev 2>/dev/null || true
echo ""

