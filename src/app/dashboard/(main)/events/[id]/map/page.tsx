import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import MapEditor from './MapEditor'

export default async function MapPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: event } = await supabase
    .from('events')
    .select('id, name, slug, status, organization_id')
    .eq('id', id)
    .single()

  if (!event) notFound()

  // Vérifie que l'utilisateur est bien propriétaire de l'événement
  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('id', event.organization_id)
    .eq('owner_id', user.id)
    .single()

  if (!org) notFound()

  const { data: eventMap } = await supabase
    .from('event_maps')
    .select('id, file_url, file_type, geo_transform')
    .eq('event_id', id)
    .maybeSingle()

  return <MapEditor event={event} eventMap={eventMap} />
}
