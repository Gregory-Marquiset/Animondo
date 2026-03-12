-- ============================================================
-- Migration 001 — Schéma initial Animondo MVP
-- À exécuter dans Supabase > SQL Editor
-- ============================================================

-- PostGIS (coordonnées géographiques réelles)
CREATE EXTENSION IF NOT EXISTS postgis;

-- ============================================================
-- TABLES
-- ============================================================

-- Profils utilisateurs (étend auth.users de Supabase)
CREATE TABLE profiles (
  id          UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  full_name   TEXT,
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Organisations (zoo, event, ferme, etc.)
CREATE TABLE organizations (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  owner_id    UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Événements
CREATE TABLE events (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  name            TEXT NOT NULL,
  -- slug = identifiant de l'URL publique : /e/[slug]
  slug            TEXT NOT NULL UNIQUE,
  description     TEXT,
  start_date      TIMESTAMPTZ,
  end_date        TIMESTAMPTZ,
  status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Plans d'événements (1 plan par événement pour le MVP)
CREATE TABLE event_maps (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id     UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL UNIQUE,
  file_url     TEXT,         -- URL Supabase Storage (image ou PDF)
  file_type    TEXT CHECK (file_type IN ('image', 'pdf')),
  -- Calage géographique : coordonnées des 4 coins du plan sur la carte réelle
  -- Format MapLibre : [[lng,lat], [lng,lat], [lng,lat], [lng,lat]]
  -- Ordre : top-left, top-right, bottom-right, bottom-left
  geo_transform JSONB,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Couches de dessin (walls, stands, pois, zones, allées)
CREATE TABLE map_layers (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_map_id  UUID REFERENCES event_maps(id) ON DELETE CASCADE NOT NULL,
  name          TEXT NOT NULL,
  type          TEXT NOT NULL CHECK (type IN ('walls', 'stands', 'pois', 'zones', 'allees')),
  visible       BOOLEAN NOT NULL DEFAULT TRUE,
  display_order INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Objets GeoJSON individuels sur les couches
CREATE TABLE map_features (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  layer_id       UUID REFERENCES map_layers(id) ON DELETE CASCADE NOT NULL,
  geometry       GEOMETRY NOT NULL,        -- PostGIS (point, polygone, ligne)
  -- Propriétés communes
  name           TEXT,
  feature_type   TEXT,                     -- type de stand, type de POI, etc.
  color          TEXT DEFAULT '#3B82F6',
  category       TEXT,
  status         TEXT DEFAULT 'active',
  display_order  INT DEFAULT 0,
  -- Propriétés stands
  stand_number   TEXT,
  exhibitor_name TEXT,
  description    TEXT,
  -- Propriétés supplémentaires libres
  extra          JSONB DEFAULT '{}',
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEX
-- ============================================================

CREATE INDEX idx_events_slug     ON events(slug);
CREATE INDEX idx_events_org      ON events(organization_id);
CREATE INDEX idx_events_status   ON events(status);
CREATE INDEX idx_features_layer  ON map_features(layer_id);
CREATE INDEX idx_features_geom   ON map_features USING GIST(geometry);

-- ============================================================
-- TRIGGERS updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER event_maps_updated_at
  BEFORE UPDATE ON event_maps
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER map_features_updated_at
  BEFORE UPDATE ON map_features
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- TRIGGER : création automatique du profil à l'inscription
-- ============================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- RLS (Row Level Security) — sécurité par défaut
-- Seul le propriétaire peut éditer ses données.
-- Les événements publiés sont lisibles par tous (sans auth).
-- ============================================================

ALTER TABLE profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE events        ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_maps    ENABLE ROW LEVEL SECURITY;
ALTER TABLE map_layers    ENABLE ROW LEVEL SECURITY;
ALTER TABLE map_features  ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "Profil visible par son propriétaire"
  ON profiles FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Profil modifiable par son propriétaire"
  ON profiles FOR UPDATE USING (auth.uid() = id);

-- Organizations
CREATE POLICY "Orga gérée par son propriétaire"
  ON organizations FOR ALL USING (auth.uid() = owner_id);

-- Events
CREATE POLICY "Events gérés par l'orga propriétaire"
  ON events FOR ALL USING (
    organization_id IN (
      SELECT id FROM organizations WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Events publiés visibles par tous"
  ON events FOR SELECT USING (status = 'published');

-- Event maps
CREATE POLICY "Plans gérés par l'orga propriétaire"
  ON event_maps FOR ALL USING (
    event_id IN (
      SELECT e.id FROM events e
      JOIN organizations o ON e.organization_id = o.id
      WHERE o.owner_id = auth.uid()
    )
  );

CREATE POLICY "Plans visibles si événement publié"
  ON event_maps FOR SELECT USING (
    event_id IN (SELECT id FROM events WHERE status = 'published')
  );

-- Map layers
CREATE POLICY "Couches gérées par l'orga propriétaire"
  ON map_layers FOR ALL USING (
    event_map_id IN (
      SELECT em.id FROM event_maps em
      JOIN events e ON em.event_id = e.id
      JOIN organizations o ON e.organization_id = o.id
      WHERE o.owner_id = auth.uid()
    )
  );

CREATE POLICY "Couches visibles si événement publié"
  ON map_layers FOR SELECT USING (
    event_map_id IN (
      SELECT em.id FROM event_maps em
      JOIN events e ON em.event_id = e.id
      WHERE e.status = 'published'
    )
  );

-- Map features
CREATE POLICY "Objets gérés par l'orga propriétaire"
  ON map_features FOR ALL USING (
    layer_id IN (
      SELECT ml.id FROM map_layers ml
      JOIN event_maps em ON ml.event_map_id = em.id
      JOIN events e ON em.event_id = e.id
      JOIN organizations o ON e.organization_id = o.id
      WHERE o.owner_id = auth.uid()
    )
  );

CREATE POLICY "Objets visibles si événement publié"
  ON map_features FOR SELECT USING (
    layer_id IN (
      SELECT ml.id FROM map_layers ml
      JOIN event_maps em ON ml.event_map_id = em.id
      JOIN events e ON em.event_id = e.id
      WHERE e.status = 'published'
    )
  );
