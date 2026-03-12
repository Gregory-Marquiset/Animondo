'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export async function deleteEvent(eventId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Vérifie que l'utilisateur possède bien cet événement
  const { data: event } = await supabase
    .from('events')
    .select('id, organization_id')
    .eq('id', eventId)
    .single()

  if (!event) return { error: 'Événement introuvable' }

  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('id', event.organization_id)
    .eq('owner_id', user.id)
    .single()

  if (!org) return { error: 'Non autorisé' }

  const { error } = await supabase.from('events').delete().eq('id', eventId)
  if (error) return { error: error.message }

  revalidatePath('/dashboard')
}
