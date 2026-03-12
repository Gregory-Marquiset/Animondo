'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // retire les accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export async function createOrganization(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const name = (formData.get('name') as string).trim()
  if (!name) return { error: 'Le nom est requis' }

  // Suffixe aléatoire pour éviter les conflits de slug
  const slug = `${generateSlug(name)}-${Math.random().toString(36).slice(2, 6)}`

  const { error } = await supabase.from('organizations').insert({
    name,
    slug,
    owner_id: user.id,
  })

  if (error) return { error: error.message }
  redirect('/dashboard')
}
