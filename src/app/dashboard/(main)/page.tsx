import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import DeleteEventButton from '@/components/dashboard/DeleteEventButton'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('owner_id', user!.id)
    .single()

  const { data: events } = await supabase
    .from('events')
    .select('id, name, slug, status, start_date')
    .eq('organization_id', org!.id)
    .order('created_at', { ascending: false })

  return (
    <div className="p-8 overflow-auto flex-1">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-zinc-900">Événements</h1>
        <Link
          href="/dashboard/events/new"
          className="bg-zinc-900 text-white text-sm px-4 py-2 rounded-lg hover:bg-zinc-700 transition-colors"
        >
          + Nouvel événement
        </Link>
      </div>

      {!events || events.length === 0 ? (
        <div className="text-center py-20 text-zinc-400">
          <p className="text-base">Aucun événement pour l&apos;instant.</p>
          <p className="text-sm mt-1">Créez votre premier événement pour commencer.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {events.map(event => (
            <div
              key={event.id}
              className="bg-white border border-zinc-200 rounded-xl p-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <span className="font-medium text-zinc-900">{event.name}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  event.status === 'published'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-zinc-100 text-zinc-500'
                }`}>
                  {event.status === 'published' ? 'Publié' : 'Brouillon'}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <DeleteEventButton eventId={event.id} />
                <Link
                  href={`/dashboard/events/${event.id}/edit`}
                  className="text-sm text-zinc-400 hover:text-zinc-900 transition-colors px-2 py-1"
                >
                  Modifier
                </Link>
                <Link
                  href={`/dashboard/events/${event.id}/map`}
                  className="text-sm bg-zinc-900 text-white rounded-lg px-3 py-1.5 hover:bg-zinc-700 transition-colors"
                >
                  Carte →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
