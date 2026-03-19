# ─────────────────────────────────────────
# Étape 1 : Builder
# ─────────────────────────────────────────
FROM python:3.12-slim AS builder

WORKDIR /app

# Installe les dépendances séparément pour profiter du cache Docker
COPY requirements.txt .
RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# ─────────────────────────────────────────
# Étape 2 : Image de production
# ─────────────────────────────────────────
FROM python:3.12-slim

WORKDIR /app

# Utilisateur non-root (sécurité)
RUN addgroup --system appgroup && \
    adduser --system --ingroup appgroup appuser

# Copie des dépendances installées
COPY --from=builder /usr/local/lib/python3.12/site-packages \
                    /usr/local/lib/python3.12/site-packages
COPY --from=builder /usr/local/bin/gunicorn /usr/local/bin/gunicorn

# Copie du code
COPY --chown=appuser:appgroup . .

USER appuser

EXPOSE 8000

# Gunicorn en production (pas runserver !)
CMD ["gunicorn", "driver_service.wsgi:application", \
     "--bind", "0.0.0.0:8000", "--workers", "2"]

