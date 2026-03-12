# Animondo — Progression MVP

## Étapes complétées

- [x] **Étape 1** — Schéma base de données (PostGIS, RLS, storage)
- [x] **Étape 2** — Auth (login, signup, middleware, callback, onboarding orga)
- [x] **Étape 3** — Layout dashboard (sidebar, route groups)
- [x] **Étape 4** — Dashboard principal (liste événements, create/delete)
- [x] **Étape 5** — Création d'événement + upload plan
- [x] **Étape 6** — Page carte (MapLibre + overlay plan)
- [x] **Étape 7** — Positionnement / rotation / redimensionnement du plan (PlanPositioner)
- [x] **Étape 7b** — Édition d'événement (EditEventForm + upload/remplacement plan depuis edit)

## Prochaines étapes

- [ ] **Étape 8** — Dessin des couches (Terra Draw) : murs, stands, POIs
- [ ] **Étape 9** — Édition des métadonnées des objets dessinés
- [ ] **Étape 10** — Prévisualisation vue publique depuis le dashboard
- [ ] **Étape 11** — Publication (draft → published)
- [ ] **Étape 12** — Vue publique `/e/[slug]` — mobile-first, sans auth
- [ ] **Étape 13** — Géolocalisation dans la vue publique

## Bugs résolus

### Map blanche (MapLibre + Next.js 16 Turbopack)
**Symptôme** : La carte MapLibre s'initialise correctement (WebGL OK, `load` event fired, tiles 200 OK) mais reste complètement blanche.

**Diagnostic** :
1. Style OpenFreeMap Positron : valeur `null` dans le style incompatible avec MapLibre v5 (`Expected value to be of type number, but found null instead`) — tiles chargent mais rendu bloqué
2. Tuiles OSM raster : chargent en 200 mais canvas reste blanc → problème CSS
3. **Root cause** : Turbopack (Next.js 16) ne traite pas `import 'maplibre-gl/dist/maplibre-gl.css'` dans un composant client → le CSS MapLibre n'est pas appliqué → le canvas est invisible

**Fix** :
1. **Tuiles** : Style OSM raster inline (`StyleSpecification`) au lieu d'une URL OpenFreeMap (bug MapLibre v5 / style null)
2. **CSS** : `@import "maplibre-gl/dist/maplibre-gl.css"` déplacé dans `globals.css` (traité par Turbopack via le pipeline CSS global)
3. **Container** : `style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}` au lieu de `className="absolute inset-0"` (évite conflit Tailwind v4 / MapLibre CSS)

### Carte noire (hauteur 0px) — Session 1
La page `/map` était hors du groupe `(main)` → pas de layout `flex h-screen` → hauteur nulle. Fix : déplacer `events/` dans `(main)/events/`.

## Stack technique

- Next.js 16.1.6 (Turbopack) + TypeScript
- Tailwind CSS v4
- MapLibre GL JS v5 (tuiles OSM raster, `StyleSpecification` inline)
- Supabase (Auth + Storage bucket `event-plans` + Postgres + PostGIS)
- Projet : `/home/gmarquis/Documents/claude/animondo/`
