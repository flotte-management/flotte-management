-- =============================================================================
--  DDL — Service Missions (PostgreSQL 16)
-- =============================================================================

-- Créer la base si elle n'existe pas 
-- CREATE DATABASE flotte_missions;

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- TYPES ENUM
-- =============================================================================

DO $$ BEGIN
  CREATE TYPE statut_mission AS ENUM (
    'PLANIFIEE', 'EN_COURS', 'TERMINEE', 'ANNULEE'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE statut_etape AS ENUM (
    'EN_ATTENTE', 'ATTEINTE', 'IGNOREE'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================================================
-- TABLE : missions
-- =============================================================================

CREATE TABLE IF NOT EXISTS missions (
  id                     UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  titre                  VARCHAR(100)  NOT NULL,
  vehicule_id            UUID          NOT NULL,
  conducteur_id          UUID          NOT NULL,
  statut                 statut_mission NOT NULL DEFAULT 'PLANIFIEE',
  date_debut_prevue      TIMESTAMPTZ   NOT NULL,
  date_fin_prevue        TIMESTAMPTZ   NOT NULL,
  date_debut_reelle      TIMESTAMPTZ,
  date_fin_reelle        TIMESTAMPTZ,
  adresse_origine        VARCHAR(200)  NOT NULL,
  adresse_destination    VARCHAR(200)  NOT NULL,
  distance_estimee_km    NUMERIC(8,2),
  distance_reelle_km     NUMERIC(8,2),
  notes                  TEXT,
  motif_annulation       VARCHAR(255),
  cree_par               UUID          NOT NULL,
  created_at             TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_dates CHECK (date_fin_prevue > date_debut_prevue)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_missions_vehicule
  ON missions (vehicule_id, date_debut_prevue DESC);

CREATE INDEX IF NOT EXISTS idx_missions_conducteur
  ON missions (conducteur_id, statut);

CREATE INDEX IF NOT EXISTS idx_missions_statut
  ON missions (statut)
  WHERE statut NOT IN ('TERMINEE', 'ANNULEE');

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_missions_updated_at ON missions;
CREATE TRIGGER trg_missions_updated_at
  BEFORE UPDATE ON missions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- TABLE : etapes_mission
-- =============================================================================

CREATE TABLE IF NOT EXISTS etapes_mission (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id     UUID          NOT NULL
                   REFERENCES missions(id) ON DELETE CASCADE,
  ordre          SMALLINT      NOT NULL,
  adresse        VARCHAR(200)  NOT NULL,
  latitude       DOUBLE PRECISION,
  longitude      DOUBLE PRECISION,
  heure_prevue   TIMESTAMPTZ,
  heure_arrivee  TIMESTAMPTZ,
  statut         statut_etape  NOT NULL DEFAULT 'EN_ATTENTE',

  UNIQUE (mission_id, ordre)
);

CREATE INDEX IF NOT EXISTS idx_etapes_mission_id
  ON etapes_mission (mission_id, ordre ASC);

-- =============================================================================
-- DONNÉES DE TEST (dev uniquement)
-- =============================================================================

-- Insérer une mission de test
INSERT INTO missions (
  id, titre, vehicule_id, conducteur_id, statut,
  date_debut_prevue, date_fin_prevue,
  adresse_origine, adresse_destination,
  distance_estimee_km, cree_par
) VALUES (
  'd0e1f2a3-eeee-5678-9abc-def012345678',
  'Livraison Rouen → Le Havre',
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'f1e2d3c4-b5a6-9870-fedc-ba9876543210',
  'PLANIFIEE',
  NOW() + INTERVAL '1 hour',
  NOW() + INTERVAL '4 hours',
  '15 Rue de la République, 76000 Rouen',
  'Port du Havre, 76600 Le Havre',
  87.4,
  '00000000-0000-0000-0000-000000000001'
) ON CONFLICT (id) DO NOTHING;

-- Étapes de la mission de test
INSERT INTO etapes_mission (mission_id, ordre, adresse, latitude, longitude, heure_prevue)
VALUES
  ('d0e1f2a3-eeee-5678-9abc-def012345678', 1, 'Zone industrielle de Petit-Quevilly, 76140', 49.3976, 1.0598, NOW() + INTERVAL '2 hours'),
  ('d0e1f2a3-eeee-5678-9abc-def012345678', 2, 'Sortie A150 Yvetot, 76190',               49.6189, 0.7575, NOW() + INTERVAL '3 hours')
ON CONFLICT DO NOTHING;
