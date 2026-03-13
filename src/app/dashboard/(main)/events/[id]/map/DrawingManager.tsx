'use client'

import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import {
  TerraDraw,
  TerraDrawSelectMode,
  TerraDrawPointMode,
  TerraDrawLineStringMode,
  TerraDrawPolygonMode,
  TerraDrawCircleMode,
} from 'terra-draw'
import { TerraDrawMapLibreGLAdapter } from 'terra-draw-maplibre-gl-adapter'
import { loadMapFeatures, saveAllFeatures, type DrawFeature } from './drawingActions'

const LAYERS = [
  { type: 'stands',  label: 'Stands',  mode: 'circle',     color: '#3B82F6' },
  { type: 'walls',   label: 'Murs',    mode: 'linestring', color: '#6B7280' },
  { type: 'pois',    label: 'POIs',    mode: 'point',      color: '#EF4444' },
  { type: 'zones',   label: 'Zones',   mode: 'polygon',    color: '#10B981' },
] as const

type LayerType = (typeof LAYERS)[number]['type']

interface Props {
  map: maplibregl.Map
  eventMapId: string
  onSaved: () => void
  onCancel: () => void
}

export default function DrawingManager({ map, eventMapId, onSaved, onCancel }: Props) {
  const drawRef = useRef<TerraDraw | null>(null)
  const [activeLayer, setActiveLayer] = useState<LayerType>('stands')
  const [featureCount, setFeatureCount] = useState(0)
  const [isSelecting, setIsSelecting] = useState(false)
  const [showSelectHelp, setShowSelectHelp] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const draw = new TerraDraw({
      adapter: new TerraDrawMapLibreGLAdapter({ map }),
      modes: [
        new TerraDrawSelectMode({
          flags: {
            polygon:    { feature: { draggable: true, scaleable: true, coordinates: { midpoints: true, deletable: true } } },
            circle:     { feature: { draggable: true, scaleable: true } },
            linestring: { feature: { draggable: true, coordinates: { midpoints: true, deletable: true } } },
            point:      { feature: { draggable: true } },
          },
        }),
        new TerraDrawCircleMode(),
        new TerraDrawLineStringMode(),
        new TerraDrawPointMode(),
        new TerraDrawPolygonMode(),
      ],
    })

    draw.start()
    draw.setMode('circle')
    drawRef.current = draw

    // Load existing features from DB
    loadMapFeatures(eventMapId).then(features => {
      if (!features.length) return
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        draw.addFeatures(features as any[])
        setFeatureCount(draw.getSnapshot().length)
      } catch (e) {
        console.warn('Could not restore features:', e)
      }
    })

    draw.on('change', () => {
      setFeatureCount(draw.getSnapshot().length)
    })

    return () => {
      try { draw.stop() } catch { /* ignore */ }
      drawRef.current = null
    }
  }, [map, eventMapId])

  function switchLayer(layer: (typeof LAYERS)[number]) {
    setActiveLayer(layer.type)
    setIsSelecting(false)
    drawRef.current?.setMode(layer.mode)
  }

  function toggleSelect() {
    if (isSelecting) {
      const cur = LAYERS.find(l => l.type === activeLayer)!
      drawRef.current?.setMode(cur.mode)
      setIsSelecting(false)
    } else {
      drawRef.current?.setMode('select')
      setIsSelecting(true)
    }
  }

  function deleteSelected() {
    const snapshot = drawRef.current?.getSnapshot() ?? []
    const selectedIds = snapshot
      .filter(f => f.properties?.selected === true)
      .map(f => f.id as string)
    if (selectedIds.length) drawRef.current?.removeFeatures(selectedIds)
  }

  async function handleSave() {
    if (!drawRef.current) return
    setSaving(true)
    setError(null)
    const snapshot = drawRef.current.getSnapshot() as DrawFeature[]
    const result = await saveAllFeatures(eventMapId, snapshot)
    setSaving(false)
    if (result?.error) {
      setError(result.error)
    } else {
      onSaved()
    }
  }

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white border border-zinc-200 rounded-xl shadow-lg px-4 py-3 flex items-center gap-3 pointer-events-auto select-none z-10 flex-wrap justify-center">
      {/* Layer type buttons */}
      <div className="flex gap-1">
        {LAYERS.map(layer => (
          <button
            key={layer.type}
            onClick={() => switchLayer(layer)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={
              activeLayer === layer.type && !isSelecting
                ? { backgroundColor: layer.color, color: '#fff' }
                : { backgroundColor: '#f4f4f5', color: '#52525b' }
            }
          >
            {layer.label}
          </button>
        ))}
      </div>

      <div className="w-px h-6 bg-zinc-200" />

      {/* Tools */}
      <div className="flex gap-1">
        <div className="relative">
          <button
            onClick={toggleSelect}
            onMouseEnter={() => setShowSelectHelp(true)}
            onMouseLeave={() => setShowSelectHelp(false)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              isSelecting ? 'bg-zinc-800 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
            }`}
          >
            Sélect.
          </button>
          {showSelectHelp && (
            <div className="absolute bottom-full left-0 mb-2 w-44 bg-zinc-800 text-white text-xs rounded-lg p-3 pointer-events-none z-20 shadow-lg">
              <p className="font-semibold mb-1.5">Mode sélection</p>
              <ul className="space-y-1 text-zinc-300">
                <li>🖱 Clic → sélectionner</li>
                <li>↔ Glisser → déplacer</li>
                <li>⬛ Coins → redimensionner</li>
                <li>🗑 Bouton Suppr. → effacer</li>
              </ul>
            </div>
          )}
        </div>
        <button
          onClick={deleteSelected}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-100 text-zinc-600 hover:bg-red-100 hover:text-red-600 transition-colors"
          title="Supprimer la sélection"
        >
          Suppr.
        </button>
      </div>

      <div className="w-px h-6 bg-zinc-200" />

      <span className="text-xs text-zinc-400 tabular-nums whitespace-nowrap">
        {featureCount} élément{featureCount !== 1 ? 's' : ''}
      </span>

      {error && <span className="text-xs text-red-500 max-w-[180px] truncate">{error}</span>}

      <div className="w-px h-6 bg-zinc-200" />

      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="text-sm text-zinc-500 hover:text-zinc-900 px-3 py-1.5 transition-colors"
        >
          Annuler
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="text-sm bg-zinc-900 text-white px-4 py-1.5 rounded-lg hover:bg-zinc-700 transition-colors font-medium disabled:opacity-50"
        >
          {saving ? 'Sauvegarde…' : 'Sauvegarder'}
        </button>
      </div>
    </div>
  )
}
