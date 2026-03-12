-- ============================================================
-- Fonctions pour la gestion des couches dessinées
-- ============================================================

-- Sauvegarde toutes les features d'une couche (remplace l'existant)
CREATE OR REPLACE FUNCTION save_layer_features(
  p_event_map_id UUID,
  p_layer_type    TEXT,
  p_layer_name    TEXT,
  p_features      JSONB   -- [{geometry: string (GeoJSON), color: string, mode: string}]
) RETURNS UUID AS $$
DECLARE
  v_layer_id UUID;
BEGIN
  -- Vérification ownership
  IF NOT EXISTS (
    SELECT 1 FROM event_maps em
    JOIN events e ON em.event_id = e.id
    JOIN organizations o ON e.organization_id = o.id
    WHERE em.id = p_event_map_id AND o.owner_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Cherche couche existante du même type
  SELECT id INTO v_layer_id
  FROM map_layers
  WHERE event_map_id = p_event_map_id AND type = p_layer_type
  LIMIT 1;

  -- Crée la couche si elle n'existe pas (seulement si features non vides)
  IF v_layer_id IS NULL THEN
    IF jsonb_array_length(p_features) = 0 THEN
      RETURN NULL;
    END IF;
    INSERT INTO map_layers (event_map_id, name, type)
    VALUES (p_event_map_id, p_layer_name, p_layer_type)
    RETURNING id INTO v_layer_id;
  END IF;

  -- Supprime les features existantes
  DELETE FROM map_features WHERE layer_id = v_layer_id;

  -- Insère les nouvelles features
  IF jsonb_array_length(p_features) > 0 THEN
    INSERT INTO map_features (layer_id, geometry, color, feature_type)
    SELECT
      v_layer_id,
      ST_SetSRID(ST_GeomFromGeoJSON(feat->>'geometry'), 4326),
      COALESCE(feat->>'color', '#3B82F6'),
      COALESCE(feat->>'mode', p_layer_type)
    FROM jsonb_array_elements(p_features) AS feat
    WHERE feat->>'geometry' IS NOT NULL;
  END IF;

  RETURN v_layer_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Retourne toutes les features d'une carte (accès owner OU événement publié)
CREATE OR REPLACE FUNCTION get_map_features(p_event_map_id UUID)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  -- Vérification accès
  IF NOT EXISTS (
    SELECT 1 FROM event_maps em
    JOIN events e ON em.event_id = e.id
    JOIN organizations o ON e.organization_id = o.id
    WHERE em.id = p_event_map_id
      AND (o.owner_id = auth.uid() OR e.status = 'published')
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'layer_type', ml.type,
      'features', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'id',       mf.id,
            'geometry', ST_AsGeoJSON(mf.geometry)::jsonb,
            'color',    COALESCE(mf.color, '#3B82F6'),
            'mode',     COALESCE(mf.feature_type, ml.type)
          )
        )
        FROM map_features mf WHERE mf.layer_id = ml.id
      ), '[]'::jsonb)
    )
  ), '[]'::jsonb) INTO result
  FROM map_layers ml
  WHERE ml.event_map_id = p_event_map_id;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
