'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export async function createEvent(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!org) redirect('/dashboard/onboarding')

  const name = (formData.get('name') as string).trim()
  const description = (formData.get('description') as string).trim()
  const startDate = formData.get('start_date') as string
  const endDate = formData.get('end_date') as string
  const rawSlug = (formData.get('slug') as string).trim()
  const slug = rawSlug || generateSlug(name)

  // Création de l'événement
  const { data: event, error: eventError } = await supabase
    .from('events')
    .insert({
      organization_id: org.id,
      name,
      slug,
      description: description || null,
      start_date: startDate || null,
      end_date: endDate || null,
    })
    .select('id')
    .single()

  if (eventError) return { error: eventError.message }

  // Upload du plan si fourni
  const file = formData.get('plan') as File
  if (file && file.size > 0) {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
    const filePath = `${event.id}/plan.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('event-plans')
      .upload(filePath, file, { contentType: file.type, upsert: true })

    if (uploadError) return { error: `Upload échoué : ${uploadError.message}` }

    const { data: { publicUrl } } = supabase.storage
      .from('event-plans')
      .getPublicUrl(filePath)

    await supabase.from('event_maps').insert({
      event_id: event.id,
      file_url: publicUrl,
      file_type: ext === 'pdf' ? 'pdf' : 'image',
    })
  }

  redirect(`/dashboard/events/${event.id}/map`)
}
