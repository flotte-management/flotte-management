# Système de Gestion de Flotte

## Stack technique
- vehicle-service : Java Spring Boot
- driver-service : Python Django REST Framework
- maintenance-service : Python Django REST Framework
- location-service : Node.js NestJS
- mission-service : Node.js NestJS
- event-service : Go

## Lancer le projet en local
docker compose up --build

## Kubernetes
kubectl apply -f infra/k8s/

## CI/CD
GitHub Actions — déclenché sur push main/develop

## Semaine 2 — Statut
- [x] Dockerfiles multi-stage   
- [x] Docker Compose fonctionnel
- [x] Kubernetes local (Minikube)
- [x] PostgreSQL, Redis, Kafka via Helm
  [x]  Kafka via Helm et confluent
- [x] Prometheus, Grafana, Jaeger, Loki
- [x] Ingress configuré
- [x] CI/CD GitHub Actions
- [ ] OpenTelemetry Collector