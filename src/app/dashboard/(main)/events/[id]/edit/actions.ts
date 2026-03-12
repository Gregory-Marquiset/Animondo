'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function updateEvent(eventId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: event } = await supabase
    .from('events').select('id, organization_id').eq('id', eventId).single()
  if (!event) return { error: 'Événement introuvable' }

  const { data: org } = await supabase
    .from('organizations').select('id').eq('id', event.organization_id).eq('owner_id', user.id).single()
  if (!org) return { error: 'Non autorisé' }

  const name = (formData.get('name') as string).trim()
  const slug = (formData.get('slug') as string).trim()
  const description = (formData.get('description') as string).trim()
  const startDate = formData.get('start_date') as string
  const endDate = formData.get('end_date') as string

  const { error } = await supabase.from('events').update({
    name,
    slug,
    description: description || null,
    start_date: startDate || null,
    end_date: endDate || null,
  }).eq('id', eventId)

  if (error) return { error: error.message }

  const planFile = formData.get('plan') as File | null
  if (planFile && planFile.size > 0) {
    const ext = planFile.name.split('.').pop()
    const path = `${eventId}/plan.${ext}`
    const { error: uploadError } = await supabase.storage
      .from('event-plans')
      .upload(path, planFile, { upsert: true })
    if (uploadError) return { error: uploadError.message }

    const { data: { publicUrl } } = supabase.storage.from('event-plans').getPublicUrl(path)
    const eventMapId = (formData.get('event_map_id') as string | null)

    if (eventMapId) {
      await supabase.from('event_maps').update({ file_url: publicUrl, file_type: planFile.type }).eq('id', eventMapId)
    } else {
      await supabase.from('event_maps').insert({ event_id: eventId, file_url: publicUrl, file_type: planFile.type })
    }
  }

  revalidatePath('/dashboard')
  redirect(`/dashboard/events/${eventId}/map`)
}
