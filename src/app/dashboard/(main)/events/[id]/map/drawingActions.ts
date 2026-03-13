'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// Mapping layer type → terra-draw mode
const LAYER_TO_MODE: Record<string, string> = {
  walls:  'linestring',
  stands: 'circle',
  pois:   'point',
  zones:  'polygon',
}

type RawFeature = {
  id: string
  geometry: object
  color: string
  mode: string
}

type LayerData = {
  layer_type: string
  features: RawFeature[]
}

export type DrawFeature = {
  type: 'Feature'
  id: string
  geometry: object
  properties: {
    mode: string
    color: string
  }
}

export async function loadMapFeatures(eventMapId: string): Promise<DrawFeature[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_map_features', {
    p_event_map_id: eventMapId,
  })
  if (error || !data) return []

  const features: DrawFeature[] = []
  for (const layer of data as LayerData[]) {
    const mode = LAYER_TO_MODE[layer.layer_type] ?? 'polygon'
    for (const feat of layer.features ?? []) {
      features.push({
        type: 'Feature',
        id: feat.id,
        geometry: feat.geometry,
        properties: { mode, color: feat.color },
      })
    }
  }
  return features
}

const LAYER_NAMES: Record<string, string> = {
  walls:  'Murs',
  stands: 'Stands',
  pois:   "Points d'intérêt",
  zones:  'Zones',
}

const MODE_TO_LAYER: Record<string, string> = {
  linestring: 'walls',
  circle:     'stands',
  point:      'pois',
  polygon:    'zones',
}

const LAYER_COLORS: Record<string, string> = {
  walls:  '#6B7280',
  stands: '#3B82F6',
  pois:   '#EF4444',
  zones:  '#10B981',
}

export async function saveAllFeatures(
  eventMapId: string,
  features: DrawFeature[],
): Promise<{ error?: string } | undefined> {
  const supabase = await createClient()

  // Group features by layer type
  const byLayer: Record<string, DrawFeature[]> = {
    walls: [], stands: [], pois: [], zones: [],
  }
  for (const feat of features) {
    const mode = feat.properties?.mode as string
    const layerType = MODE_TO_LAYER[mode]
    if (layerType) byLayer[layerType].push(feat)
  }

  // Save each layer (even empty = clears existing features)
  for (const [layerType, layerFeatures] of Object.entries(byLayer)) {
    const { error } = await supabase.rpc('save_layer_features', {
      p_event_map_id: eventMapId,
      p_layer_type:   layerType,
      p_layer_name:   LAYER_NAMES[layerType],
      p_features:     layerFeatures.map(f => ({
        geometry: JSON.stringify(f.geometry),
        color:    LAYER_COLORS[layerType],
        mode:     f.properties?.mode ?? layerType,
      })),
    })
    if (error) return { error: error.message }
  }

  revalidatePath('/dashboard')
  return undefined
}
