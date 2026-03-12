'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import maplibregl from 'maplibre-gl'

type Coords = [number, number]
export type GeoTransform = [Coords, Coords, Coords, Coords]

export interface Transform {
  center: Coords       // [lng, lat]
  widthMeters: number
  heightMeters: number
  rotation: number     // degrés, sens horaire vu sur l'écran
}

// Convertit un Transform en 4 coins géographiques (format MapLibre image source)
export function transformToCorners(t: Transform): GeoTransform {
  const [lng, lat] = t.center
  const mPerDegLat = 111320
  const mPerDegLng = 111320 * Math.cos(lat * Math.PI / 180)
  const halfW = t.widthMeters / 2
  const halfH = t.heightMeters / 2
  const rad = t.rotation * Math.PI / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)

  // Rotation horaire en espace métrique, puis conversion en degrés géo
  function toGeo(mx: number, my: number): Coords {
    return [
      lng + (mx * cos + my * sin) / mPerDegLng,
      lat + (-mx * sin + my * cos) / mPerDegLat,
    ]
  }

  return [
    toGeo(-halfW, halfH),   // top-left
    toGeo(halfW, halfH),    // top-right
    toGeo(halfW, -halfH),   // bottom-right
    toGeo(-halfW, -halfH),  // bottom-left
  ]
}

// Convertit 4 coins géo en Transform (inverse)
export function cornersToTransform(corners: GeoTransform): Transform {
  const [tl, tr, br] = corners
  const center: Coords = [
    (corners[0][0] + corners[1][0] + corners[2][0] + corners[3][0]) / 4,
    (corners[0][1] + corners[1][1] + corners[2][1] + corners[3][1]) / 4,
  ]
  const lat = center[1]
  const mPerDegLat = 111320
  const mPerDegLng = 111320 * Math.cos(lat * Math.PI / 180)

  const topDx = (tr[0] - tl[0]) * mPerDegLng
  const topDy = (tr[1] - tl[1]) * mPerDegLat
  const widthMeters = Math.hypot(topDx, topDy)

  const rightDx = (br[0] - tr[0]) * mPerDegLng
  const rightDy = (br[1] - tr[1]) * mPerDegLat
  const heightMeters = Math.hypot(rightDx, rightDy)

  // Rotation : angle de l'arête haute par rapport au nord, moins 90° (correction de convention)
  const rotation = Math.atan2(topDx, topDy) * 180 / Math.PI - 90

  return { center, widthMeters, heightMeters, rotation }
}

interface Props {
  map: maplibregl.Map
  containerRef: React.RefObject<HTMLDivElement | null>
  fileUrl: string
  initialTransform: Transform | null
  onSave: (corners: GeoTransform) => void
  onCancel: () => void
}

type DragType = 'center' | 'scale' | 'rotate' | null

export default function PlanPositioner({ map, containerRef, fileUrl, initialTransform, onSave, onCancel }: Props) {
  const [transform, setTransform] = useState<Transform>(
    initialTransform ?? {
      center: [map.getCenter().lng, map.getCenter().lat],
      widthMeters: 200,
      heightMeters: 150,
      rotation: 0,
    }
  )
  const [handles, setHandles] = useState({ center: { x: 0, y: 0 }, scale: { x: 0, y: 0 }, rotate: { x: 0, y: 0 } })

  const transformRef = useRef(transform)
  useEffect(() => { transformRef.current = transform }, [transform])

  const dragType = useRef<DragType>(null)
  const dragData = useRef<{
    startMouse: { x: number; y: number }
    startTransform: Transform
    centerPx: { x: number; y: number }
    startDist: number
    startAngle: number
  } | null>(null)

  // Met à jour l'overlay MapLibre quand le transform change
  useEffect(() => {
    const corners = transformToCorners(transform)
    if (map.getSource('plan-image')) {
      (map.getSource('plan-image') as maplibregl.ImageSource).setCoordinates(corners)
    } else {
      map.addSource('plan-image', { type: 'image', url: fileUrl, coordinates: corners })
      map.addLayer({ id: 'plan-overlay', type: 'raster', source: 'plan-image', paint: { 'raster-opacity': 0.85 } })
    }
  }, [transform, map, fileUrl])

  // Repositionne les poignées HTML au rendu de la carte
  const updateHandles = useCallback(() => {
    const t = transformRef.current
    const corners = transformToCorners(t)
    const cPx = map.project(t.center as [number, number])
    const trPx = map.project(corners[1] as [number, number])
    const rad = t.rotation * Math.PI / 180
    setHandles({
      center: { x: cPx.x, y: cPx.y },
      scale: { x: trPx.x, y: trPx.y },
      rotate: { x: cPx.x - Math.sin(rad) * 55, y: cPx.y - Math.cos(rad) * 55 },
    })
  }, [map])

  useEffect(() => {
    updateHandles()
    map.on('render', updateHandles)
    return () => { map.off('render', updateHandles) }
  }, [map, updateHandles])
  useEffect(() => { updateHandles() }, [transform, updateHandles])

  const getMapXY = (e: MouseEvent | React.MouseEvent) => {
    const rect = containerRef.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!dragType.current || !dragData.current) return
    const d = dragData.current

    if (dragType.current === 'center') {
      const dx = e.clientX - d.startMouse.x
      const dy = e.clientY - d.startMouse.y
      const ll = map.unproject([d.centerPx.x + dx, d.centerPx.y + dy])
      setTransform(p => ({ ...p, center: [ll.lng, ll.lat] }))
    }

    if (dragType.current === 'scale') {
      const { x, y } = getMapXY(e)
      const dist = Math.hypot(x - d.centerPx.x, y - d.centerPx.y)
      if (dist < 5 || d.startDist < 5) return
      const scale = dist / d.startDist
      setTransform(p => ({
        ...p,
        widthMeters: Math.max(10, d.startTransform.widthMeters * scale),
        heightMeters: Math.max(10, d.startTransform.heightMeters * scale),
      }))
    }

    if (dragType.current === 'rotate') {
      const { x, y } = getMapXY(e)
      const angle = Math.atan2(x - d.centerPx.x, -(y - d.centerPx.y)) * 180 / Math.PI
      setTransform(p => ({ ...p, rotation: d.startTransform.rotation + (angle - d.startAngle) }))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map])

  const onMouseUp = useCallback(() => {
    dragType.current = null
    dragData.current = null
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', onMouseUp)
  }, [onMouseMove])

  const startDrag = (type: DragType) => (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const t = transformRef.current
    const cPx = map.project(t.center as [number, number])
    const trPx = map.project(transformToCorners(t)[1] as [number, number])
    const { x: mx, y: my } = getMapXY(e)
    dragType.current = type
    dragData.current = {
      startMouse: { x: e.clientX, y: e.clientY },
      startTransform: { ...t },
      centerPx: { x: cPx.x, y: cPx.y },
      startDist: Math.hypot(trPx.x - cPx.x, trPx.y - cPx.y),
      startAngle: Math.atan2(mx - cPx.x, -(my - cPx.y)) * 180 / Math.PI,
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }

  return (
    <>
      {/* Poignées de drag */}
      <div className="absolute inset-0 pointer-events-none select-none">
        {/* Rotation (orange) */}
        <div
          style={{ left: handles.rotate.x - 10, top: handles.rotate.y - 10 }}
          className="absolute w-5 h-5 rounded-full bg-orange-400 border-2 border-white shadow-md cursor-grab active:cursor-grabbing pointer-events-auto"
          onMouseDown={startDrag('rotate')}
          title="Pivoter"
        />
        {/* Centre / déplacer (bleu) */}
        <div
          style={{ left: handles.center.x - 12, top: handles.center.y - 12 }}
          className="absolute w-6 h-6 rounded-full bg-blue-500 border-2 border-white shadow-md cursor-move pointer-events-auto"
          onMouseDown={startDrag('center')}
          title="Déplacer"
        />
        {/* Coin top-right / taille (blanc) */}
        <div
          style={{ left: handles.scale.x - 10, top: handles.scale.y - 10 }}
          className="absolute w-5 h-5 rounded-full bg-white border-2 border-zinc-700 shadow-md cursor-nwse-resize pointer-events-auto"
          onMouseDown={startDrag('scale')}
          title="Redimensionner"
        />
      </div>

      {/* Panneau de contrôle en bas */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white border border-zinc-200 rounded-xl shadow-lg px-5 py-3 flex items-center gap-5 pointer-events-auto select-none z-10">
        <div className="flex gap-4 text-xs text-zinc-500">
          <span><span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-500 mr-1.5" />Déplacer</span>
          <span><span className="inline-block w-2.5 h-2.5 rounded-full bg-orange-400 mr-1.5" />Pivoter</span>
          <span><span className="inline-block w-2.5 h-2.5 rounded-full border-2 border-zinc-700 mr-1.5" />Taille</span>
        </div>
        <div className="w-px h-8 bg-zinc-200" />
        <p className="text-xs text-zinc-500 tabular-nums">
          {Math.round(transform.widthMeters)}m × {Math.round(transform.heightMeters)}m &nbsp;·&nbsp; {Math.round(transform.rotation)}°
        </p>
        <div className="w-px h-8 bg-zinc-200" />
        <div className="flex gap-2">
          <button onClick={onCancel} className="text-sm text-zinc-500 hover:text-zinc-900 px-3 py-1.5 transition-colors">
            Annuler
          </button>
          <button
            onClick={() => onSave(transformToCorners(transform))}
            className="text-sm bg-zinc-900 text-white px-4 py-1.5 rounded-lg hover:bg-zinc-700 transition-colors font-medium"
          >
            Sauvegarder
          </button>
        </div>
      </div>
    </>
  )
}
