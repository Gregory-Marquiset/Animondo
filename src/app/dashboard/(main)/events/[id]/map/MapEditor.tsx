'use client'

import maplibregl, { type StyleSpecification } from 'maplibre-gl'
import { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import PlanPositioner, { GeoTransform, cornersToTransform, transformToCorners } from './PlanPositioner'
import DrawingManager from './DrawingManager'
import { savePlanTransform } from './actions'
import { loadMapFeatures, type DrawFeature } from './drawingActions'

const MAP_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    },
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
}
const DEFAULT_CENTER: [number, number] = [2.3522, 48.8566]
const DEFAULT_ZOOM = 14

function planBounds(geo: GeoTransform): maplibregl.LngLatBoundsLike {
  const lngs = geo.map(c => c[0])
  const lats = geo.map(c => c[1])
  return [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)],
  ]
}

interface EventMap {
  id: string
  file_url: string | null
  file_type: string | null
  geo_transform: GeoTransform | null
}

interface Props {
  event: { id: string; name: string; slug: string; status: string }
  eventMap: EventMap | null
}

export default function MapEditor({ event, eventMap: initialEventMap }: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const [mapReady, setMapReady] = useState(false)
  const [mode, setMode] = useState<'view' | 'position' | 'draw'>('view')
  const [localEventMap, setLocalEventMap] = useState<EventMap | null>(initialEventMap)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    if (!mapContainer.current || map.current) return

    const geo = localEventMap?.geo_transform
    const initCenter = geo ? cornersToTransform(geo).center : DEFAULT_CENTER

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: MAP_STYLE,
      center: initCenter,
      zoom: DEFAULT_ZOOM,
    })
    map.current.addControl(new maplibregl.NavigationControl(), 'top-right')
    map.current.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left')

    map.current.on('load', () => {
      setMapReady(true)
      if (map.current && localEventMap?.file_url && localEventMap.geo_transform) {
        addPlanOverlay(map.current, localEventMap.file_url, localEventMap.geo_transform)
        map.current.fitBounds(planBounds(localEventMap.geo_transform), { padding: 80, duration: 0 })
      }
    })

    return () => { map.current?.remove(); map.current = null }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Affiche les features dessinées en mode view
  const refreshDrawnFeatures = useCallback(async () => {
    const m = map.current
    if (!m || !localEventMap?.id) return

    // Nettoie les couches existantes
    for (const id of ['drawn-polygons-fill', 'drawn-polygons-outline', 'drawn-lines', 'drawn-points']) {
      if (m.getLayer(id)) m.removeLayer(id)
    }
    if (m.getSource('drawn-features')) m.removeSource('drawn-features')

    const features = await loadMapFeatures(localEventMap.id)
    if (!features.length || !m) return

    m.addSource('drawn-features', {
      type: 'geojson',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { type: 'FeatureCollection', features: features as any[] },
    })

    // Polygones (stands, zones)
    m.addLayer({
      id: 'drawn-polygons-fill',
      type: 'fill',
      source: 'drawn-features',
      filter: ['==', ['geometry-type'], 'Polygon'],
      paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.25 },
    })
    m.addLayer({
      id: 'drawn-polygons-outline',
      type: 'line',
      source: 'drawn-features',
      filter: ['==', ['geometry-type'], 'Polygon'],
      paint: { 'line-color': ['get', 'color'], 'line-width': 2 },
    })
    // Lignes (murs)
    m.addLayer({
      id: 'drawn-lines',
      type: 'line',
      source: 'drawn-features',
      filter: ['==', ['geometry-type'], 'LineString'],
      paint: { 'line-color': ['get', 'color'], 'line-width': 2.5 },
    })
    // Points (POIs)
    m.addLayer({
      id: 'drawn-points',
      type: 'circle',
      source: 'drawn-features',
      filter: ['==', ['geometry-type'], 'Point'],
      paint: {
        'circle-radius': 6,
        'circle-color': ['get', 'color'],
        'circle-stroke-width': 2,
        'circle-stroke-color': '#fff',
      },
    })
  }, [localEventMap])

  // Charge les features à l'ouverture (après map load)
  useEffect(() => {
    if (mapReady && mode === 'view') {
      refreshDrawnFeatures()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady])

  function removeOverlay() {
    if (!map.current) return
    if (map.current.getLayer('plan-overlay')) map.current.removeLayer('plan-overlay')
    if (map.current.getSource('plan-image')) map.current.removeSource('plan-image')
  }

  function enterPositionMode() {
    removeOverlay()
    setMode('position')
  }

  function handleCancelPosition() {
    removeOverlay()
    if (map.current && localEventMap?.file_url && localEventMap.geo_transform) {
      addPlanOverlay(map.current, localEventMap.file_url, localEventMap.geo_transform)
    }
    setMode('view')
  }

  async function handleSavePosition(corners: GeoTransform) {
    if (!localEventMap) return
    setSaveError(null)
    const result = await savePlanTransform(localEventMap.id, corners)
    if (result?.error) { setSaveError(result.error); return }
    setLocalEventMap(prev => prev ? { ...prev, geo_transform: corners } : prev)
    setMode('view')
  }

  function enterDrawMode() {
    setMode('draw')
  }

  function handleCancelDraw() {
    setMode('view')
  }

  async function handleSavedDraw() {
    setMode('view')
    // Rafraîchit l'affichage en mode view
    if (map.current?.loaded()) refreshDrawnFeatures()
  }

  const hasPlan = !!localEventMap?.file_url
  const isPositioned = !!localEventMap?.geo_transform
  const canDraw = !!localEventMap?.id

  return (
    <div className="flex flex-col h-full">
      {/* Barre d'outils */}
      <div className="shrink-0 bg-white border-b border-zinc-200 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-zinc-400 hover:text-zinc-900 transition-colors text-sm">
            ← Événements
          </Link>
          <span className="text-zinc-200">|</span>
          <span className="font-medium text-zinc-900 text-sm">{event.name}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            event.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-zinc-500'
          }`}>
            {event.status === 'published' ? 'Publié' : 'Brouillon'}
          </span>
          <Link
            href={`/dashboard/events/${event.id}/edit`}
            className="text-xs text-zinc-400 hover:text-zinc-900 transition-colors border border-zinc-200 px-2 py-1 rounded-lg"
          >
            Paramètres
          </Link>
        </div>

        <div className="flex items-center gap-3 text-xs">
          {saveError && <span className="text-red-500">{saveError}</span>}
          {!hasPlan && <span className="text-zinc-400">Aucun plan importé</span>}
          {hasPlan && isPositioned && mode === 'view' && (
            <span className="text-green-600 bg-green-50 border border-green-200 px-2 py-1 rounded-lg">
              Plan positionné ✓
            </span>
          )}
          {mode === 'view' && (
            <div className="flex gap-2">
              {hasPlan && (
                <button
                  onClick={enterPositionMode}
                  className="border border-zinc-300 text-zinc-700 px-3 py-1.5 rounded-lg hover:bg-zinc-50 transition-colors font-medium"
                >
                  {isPositioned ? 'Repositionner' : 'Positionner le plan'}
                </button>
              )}
              {canDraw && (
                <button
                  onClick={enterDrawMode}
                  className="bg-zinc-900 text-white px-3 py-1.5 rounded-lg hover:bg-zinc-700 transition-colors font-medium"
                >
                  Dessiner
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Zone carte */}
      <div ref={wrapperRef} className="flex-1 relative">
        <div ref={mapContainer} style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }} />

        {mode === 'position' && map.current && mapReady && localEventMap?.file_url && (
          <PlanPositioner
            map={map.current}
            containerRef={mapContainer}
            fileUrl={localEventMap.file_url}
            initialTransform={
              localEventMap.geo_transform
                ? cornersToTransform(localEventMap.geo_transform)
                : null
            }
            onSave={handleSavePosition}
            onCancel={handleCancelPosition}
          />
        )}

        {mode === 'draw' && map.current && mapReady && localEventMap?.id && (
          <DrawingManager
            map={map.current}
            eventMapId={localEventMap.id}
            onSaved={handleSavedDraw}
            onCancel={handleCancelDraw}
          />
        )}
      </div>
    </div>
  )
}

function addPlanOverlay(map: maplibregl.Map, url: string, coordinates: GeoTransform) {
  if (map.getSource('plan-image')) return
  map.addSource('plan-image', { type: 'image', url, coordinates })
  map.addLayer({ id: 'plan-overlay', type: 'raster', source: 'plan-image', paint: { 'raster-opacity': 0.85 } })
}
