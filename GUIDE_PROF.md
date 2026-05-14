# Guide Prof — Lancement et acces (Docker + Minikube)

Ce guide resume les commandes de demarrage et les URLs utiles pour tester.

## Option A — Docker Compose (local)

### Demarrage
```bash
chmod +x start-docker.sh
./start-docker.sh
```

### Liens utiles
- Frontend: http://localhost:5173/
- Microfrontend: http://localhost:3001/
- Keycloak: http://localhost:8080/
- Grafana: http://localhost:3000/
- Jaeger: http://localhost:16686/
- Prometheus: http://localhost:9090/

### Comptes
- Keycloak admin (realm master):
  - Login: `admin`
  - Mot de passe: `admin123`

- comptes de test (realm `flotte-management`):
  - Login: `admin.flotte` password: `admin123`
  - `souleyman.manager` password: `manager123`
  - `oussama.technicien` password: `tech123`
  - `moussa.conducteur` password: `user123`

### Utilisateurs applicatifs (realm `flotte-management`)
Utilisateurs importes depuis `infra/keycloak/flotte-management-users-0.json`:
- `admin.flotte` (role `ADMIN`)
- `souleyman.manager` (role `MANAGER`)
- `oussama.technicien` (role `TECHNICIEN`)
- `moussa.conducteur` (role `UTILISATEUR`)

## Option B — Minikube (Kubernetes)

### Demarrage (script)
```bash
chmod +x start-minikube.sh
./start-minikube.sh
```

### Ajouter les hosts
```bash
minikube ip
# Puis:
# echo "X.X.X.X fleet.local keycloak.fleet.local" | sudo tee -a /etc/hosts
```

### Liens utiles
- Frontend: http://fleet.local/
- Microfrontend: http://fleet.local/about
- Keycloak: http://keycloak.fleet.local/

### Observabilite (port-forward requis)
```bash
kubectl port-forward svc/prometheus-grafana 3000:80 -n monitoring
kubectl port-forward svc/jaeger 16686:16686 -n monitoring
kubectl port-forward svc/prometheus-kube-prometheus-prometheus 9090:9090 -n monitoring
```

- Grafana: http://localhost:3000/
- Jaeger: http://localhost:16686/
- Prometheus: http://localhost:9090/

### Comptes
- Keycloak admin (realm master):
  - Login: `admin`
  - Mot de passe: `admin123`

### Utilisateurs applicatifs (realm `flotte-management`)
Utilisateurs importes depuis `infra/keycloak/flotte-management-users-0.json`:
- `admin.flotte` (role `ADMIN`)
- `souleyman.manager` (role `MANAGER`)
- `oussama.technicien` (role `TECHNICIEN`)
- `moussa.conducteur` (role `UTILISATEUR`)


