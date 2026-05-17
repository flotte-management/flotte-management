#!/usr/bin/env bash
# =============================================================================
# start-docker.sh — Lancement du projet Fleet Management via Docker Compose
# =============================================================================
set -euo pipefail

# --- Couleurs -----------------------------------------------------------------
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()    { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

# --- Vérification des prérequis -----------------------------------------------
info "Vérification des prérequis..."

command -v docker  >/dev/null 2>&1 || error "Docker n'est pas installé."
command -v docker compose version >/dev/null 2>&1 || \
  command -v docker-compose >/dev/null 2>&1      || \
  error "Docker Compose n'est pas installé."

# Vérifier que le daemon Docker tourne
docker info >/dev/null 2>&1 || error "Le daemon Docker n'est pas démarré."

info "Docker $(docker --version | awk '{print $3}' | tr -d ',')"

# --- NOUVEAU : GÉNÉRATION DU FICHIER .env POUR LE FRONTEND --------------------
info "Configuration de l'environnement Frontend (.env)..."

# On s'assure que le dossier frontend existe
if [ -d "frontend" ]; then
cat <<EOF > frontend/.env
# Fichier généré automatiquement par start-docker.sh
VITE_KEYCLOAK_URL=http://localhost:8080
VITE_KEYCLOAK_REALM=flotte-management
VITE_KEYCLOAK_CLIENT_ID=flotte-frontend
VITE_GRAPHQL_URL=http://localhost:4000/graphql
VITE_GRAPHQL_WS_URL=ws://localhost:4000/graphql
VITE_API_URL=http://localhost:4000/graphql
EOF
  info "Fichier frontend/.env généré avec succès."
else
  warn "Dossier 'frontend' introuvable. Le fichier .env n'a pas été généré."
fi
# ------------------------------------------------------------------------------

# --- Choix du mode ------------------------------------------------------------
echo ""
echo "Choisissez un mode de démarrage :"
echo "  1) Tous les services (défaut)"
echo "  2) Uniquement les bases de données"
echo "  3) Un service spécifique"
echo ""
read -rp "Votre choix [1] : " CHOICE
CHOICE=${CHOICE:-1}

case "$CHOICE" in
  1)
    info "Démarrage de tous les services..."
    docker compose up --build
    ;;
  2)
    info "Démarrage des bases de données uniquement..."
    docker compose up \
      postgres-vehicles postgres-drivers \
      postgres-location postgres-maintenance postgres-mission
    ;;
  3)
    read -rp "Nom du service à démarrer : " SVC
    [[ -z "$SVC" ]] && error "Aucun service spécifié."
    info "Démarrage de $SVC..."
    docker compose up --build "$SVC"
    ;;
  *)
    error "Choix invalide : $CHOICE"
    ;;
esac