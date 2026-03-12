'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateEvent } from './actions'

interface Props {
  event: {
    id: string
    name: string
    slug: string
    description: string | null
    start_date: string | null
    end_date: string | null
  }
  eventMap: { id: string; file_url: string | null; file_type: string | null } | null
}

// Formate une date ISO pour un input datetime-local
function toDatetimeLocal(iso: string | null): string {
  if (!iso) return ''
  return iso.slice(0, 16) // "2026-03-12T14:00"
}

export default function EditEventForm({ event, eventMap }: Props) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [slug, setSlug] = useState(event.slug)
  const [planFileName, setPlanFileName] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await updateEvent(event.id, formData)
      if (result?.error) setError(result.error)
    })
  }

  return (
    <div className="overflow-auto flex-1 p-8">
      <div className="max-w-2xl">
        <div className="flex items-center gap-3 mb-6">
          <button
            type="button"
            onClick={() => router.back()}
            className="text-zinc-400 hover:text-zinc-900 transition-colors text-lg leading-none"
          >
            ←
          </button>
          <h1 className="text-xl font-semibold text-zinc-900">Modifier l&apos;événement</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}

          <section className="bg-white border border-zinc-200 rounded-xl p-6 space-y-4">
            <h2 className="font-medium text-zinc-900">Informations</h2>

            <div className="space-y-1">
              <label className="text-sm font-medium text-zinc-700">Nom de l&apos;événement *</label>
              <input
                name="name"
                type="text"
                required
                defaultValue={event.name}
                className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-sm outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-zinc-700">
                Identifiant URL
                <span className="ml-2 text-xs text-zinc-400 font-normal font-mono">/e/{slug || '…'}</span>
              </label>
              <input
                name="slug"
                type="text"
                required
                value={slug}
                onChange={e => setSlug(e.target.value.replace(/[^a-z0-9-]/g, ''))}
                className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-sm outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-zinc-700">Description</label>
              <textarea
                name="description"
                rows={3}
                defaultValue={event.description ?? ''}
                className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-sm outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-zinc-700">Date de début</label>
                <input
                  name="start_date"
                  type="datetime-local"
                  defaultValue={toDatetimeLocal(event.start_date)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-sm outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-zinc-700">Date de fin</label>
                <input
                  name="end_date"
                  type="datetime-local"
                  defaultValue={toDatetimeLocal(event.end_date)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-sm outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent"
                />
              </div>
            </div>
          </section>

          <section className="bg-white border border-zinc-200 rounded-xl p-6 space-y-3">
            <div>
              <h2 className="font-medium text-zinc-900">Plan de l&apos;événement</h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                {eventMap?.file_url ? 'Remplacer le plan actuel (optionnel)' : 'Importer un plan — image ou PDF'}
              </p>
            </div>

            {eventMap?.id && <input type="hidden" name="event_map_id" value={eventMap.id} />}

            <label className={`flex flex-col items-center justify-center w-full h-36 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
              planFileName ? 'border-zinc-900 bg-zinc-50' : 'border-zinc-200 hover:border-zinc-400 hover:bg-zinc-50'
            }`}>
              <input
                name="plan"
                type="file"
                accept="image/*,.pdf"
                className="hidden"
                onChange={e => setPlanFileName(e.target.files?.[0]?.name ?? null)}
              />
              {planFileName ? (
                <div className="text-center px-4">
                  <p className="text-sm font-medium text-zinc-900 truncate max-w-xs">{planFileName}</p>
                  <p className="text-xs text-zinc-400 mt-1">Cliquer pour changer le fichier</p>
                </div>
              ) : eventMap?.file_url ? (
                <div className="text-center">
                  <p className="text-sm text-zinc-500">Plan importé ✓</p>
                  <p className="text-xs text-zinc-400 mt-1">Cliquer pour remplacer</p>
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-sm text-zinc-500">Cliquer pour sélectionner un fichier</p>
                  <p className="text-xs text-zinc-400 mt-1">JPG, PNG, WebP ou PDF · Max 50 Mo</p>
                </div>
              )}
            </label>
          </section>

          <div className="flex gap-3 pb-8">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-4 py-2 text-sm text-zinc-500 hover:text-zinc-900 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 bg-zinc-900 text-white rounded-lg py-2 text-sm font-medium hover:bg-zinc-700 transition-colors disabled:opacity-50"
            >
              {isPending ? 'Enregistrement…' : 'Enregistrer les modifications'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
