import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import EditEventForm from './EditEventForm'

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: event } = await supabase
    .from('events')
    .select('id, name, slug, description, start_date, end_date, organization_id')
    .eq('id', id)
    .single()

  if (!event) notFound()

  const { data: org } = await supabase
    .from('organizations').select('id').eq('id', event.organization_id).eq('owner_id', user.id).single()

  if (!org) notFound()

  const { data: eventMap } = await supabase
    .from('event_maps')
    .select('id, file_url, file_type')
    .eq('event_id', id)
    .single()

  return <EditEventForm event={event} eventMap={eventMap ?? null} />
}
