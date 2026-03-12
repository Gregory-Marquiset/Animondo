import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/dashboard/Sidebar'

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: org } = await supabase
    .from('organizations')
    .select('id, name, slug')
    .eq('owner_id', user.id)
    .maybeSingle()

  // Pas d'orga → onboarding
  if (!org) redirect('/dashboard/onboarding')

  return (
    <div className="flex h-screen bg-zinc-50">
      <Sidebar userName={user.email!} orgName={org.name} />
      <main className="flex-1 overflow-hidden flex flex-col">
        {children}
      </main>
    </div>
  )
}
