-- ============================================================
-- Migration 002 — Bucket Storage pour les plans d'événements
-- À exécuter dans Supabase > SQL Editor
-- ============================================================

-- Création du bucket (public = les plans sont lisibles sans auth)
INSERT INTO storage.buckets (id, name, public)
VALUES ('event-plans', 'event-plans', true)
ON CONFLICT (id) DO NOTHING;

-- Les utilisateurs connectés peuvent uploader dans ce bucket
CREATE POLICY "Upload autorisé aux utilisateurs connectés"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'event-plans'
    AND auth.role() = 'authenticated'
  );

-- Tout le monde peut lire (nécessaire pour afficher le plan dans la vue publique)
CREATE POLICY "Lecture publique des plans"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'event-plans');

-- Un utilisateur peut remplacer/supprimer ses propres fichiers
CREATE POLICY "Mise à jour par l'uploader"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'event-plans' AND auth.role() = 'authenticated');

CREATE POLICY "Suppression par l'uploader"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'event-plans' AND auth.role() = 'authenticated');
