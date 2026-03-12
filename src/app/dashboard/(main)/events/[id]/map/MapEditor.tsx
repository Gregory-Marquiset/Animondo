'use client'

import maplibregl, { type StyleSpecification } from 'maplibre-gl'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import PlanPositioner, { GeoTransform, cornersToTransform, transformToCorners } from './PlanPositioner'
import { savePlanTransform } from './actions'

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
  const [mode, setMode] = useState<'view' | 'position'>('view')
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

  function removeOverlay() {
    if (!map.current) return
    if (map.current.getLayer('plan-overlay')) map.current.removeLayer('plan-overlay')
    if (map.current.getSource('plan-image')) map.current.removeSource('plan-image')
  }

  function enterPositionMode() {
    removeOverlay() // PlanPositioner prend la main sur l'overlay
    setMode('position')
  }

  function handleCancel() {
    removeOverlay()
    // Restaure l'overlay sauvegardé si existant
    if (map.current && localEventMap?.file_url && localEventMap.geo_transform) {
      addPlanOverlay(map.current, localEventMap.file_url, localEventMap.geo_transform)
    }
    setMode('view')
  }

  async function handleSave(corners: GeoTransform) {
    if (!localEventMap) return
    setSaveError(null)
    const result = await savePlanTransform(localEventMap.id, corners)
    if (result?.error) { setSaveError(result.error); return }
    setLocalEventMap(prev => prev ? { ...prev, geo_transform: corners } : prev)
    setMode('view')
    // L'overlay est déjà à jour (PlanPositioner l'a modifié en temps réel)
  }

  const hasPlan = !!localEventMap?.file_url
  const isPositioned = !!localEventMap?.geo_transform

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
          {hasPlan && mode === 'view' && (
            <button
              onClick={enterPositionMode}
              className="bg-zinc-900 text-white px-3 py-1.5 rounded-lg hover:bg-zinc-700 transition-colors font-medium"
            >
              {isPositioned ? 'Repositionner le plan' : 'Positionner le plan'}
            </button>
          )}
        </div>
      </div>

      {/* Zone carte + poignées */}
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
            onSave={handleSave}
            onCancel={handleCancel}
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
