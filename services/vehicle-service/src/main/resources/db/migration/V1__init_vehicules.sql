-- Migration initiale — Service Véhicules

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── ENUMs ───────────────────────────────────────────────────────────────────

CREATE TYPE statut_vehicule AS ENUM (
    'DISPONIBLE',
    'EN_SERVICE',
    'EN_MAINTENANCE',
    'HORS_SERVICE',
    'RETIRE'
);

CREATE TYPE type_carburant AS ENUM (
    'ESSENCE',
    'DIESEL',
    'ELECTRIQUE',
    'HYBRIDE',
    'GPL'
);

-- ─── Table principale ─────────────────────────────────────────────────────────

CREATE TABLE vehicules (
                           id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
                           immatriculation VARCHAR(10)  UNIQUE NOT NULL,
                           marque          VARCHAR(50)  NOT NULL,
                           modele          VARCHAR(50)  NOT NULL,
                           annee           SMALLINT     NOT NULL CHECK (annee >= 1990),
                           type_carburant  type_carburant NOT NULL,
                           statut          statut_vehicule NOT NULL DEFAULT 'DISPONIBLE',
                           kilometrage     INTEGER      NOT NULL DEFAULT 0 CHECK (kilometrage >= 0),
                           created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
                           updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
                           deleted_at      TIMESTAMPTZ  -- soft-delete
);

-- ─── Historique des changements de statut ────────────────────────────────────

CREATE TABLE historique_statut (
                                   id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
                                   vehicule_id   UUID         NOT NULL REFERENCES vehicules(id),
                                   statut_avant  statut_vehicule NOT NULL,
                                   statut_apres  statut_vehicule NOT NULL,
                                   motif         VARCHAR(255),
                                   modifie_par   UUID         NOT NULL,
                                   modifie_le    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─── Index ───────────────────────────────────────────────────────────────────

CREATE INDEX idx_vehicules_statut
    ON vehicules (statut) WHERE deleted_at IS NULL;

-- Recherche par marque (ILIKE)
CREATE INDEX idx_vehicules_marque
    ON vehicules (marque) WHERE deleted_at IS NULL;

-- Historique d'un véhicule, du plus récent au plus ancien
CREATE INDEX idx_historique_vehicule_id
    ON historique_statut (vehicule_id, modifie_le DESC);

-- ─── Trigger updated_at automatique ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_vehicules_updated_at
    BEFORE UPDATE ON vehicules
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
