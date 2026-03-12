'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

type Coords = [number, number]
type GeoTransform = [Coords, Coords, Coords, Coords]

export async function savePlanTransform(eventMapId: string, geoTransform: GeoTransform) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non autorisé' }

  const { error } = await supabase
    .from('event_maps')
    .update({ geo_transform: geoTransform })
    .eq('id', eventMapId)

  if (error) return { error: error.message }
  revalidatePath('/dashboard')
}
