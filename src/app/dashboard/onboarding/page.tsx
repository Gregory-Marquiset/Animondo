'use client'

import { useState, useTransition } from 'react'
import { createOrganization } from './actions'

export default function OnboardingPage() {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await createOrganization(formData)
      if (result?.error) setError(result.error)
    })
  }

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-zinc-900">Animondo</h1>
          <p className="text-sm text-zinc-500 mt-1">Bienvenue ! Créez votre organisation.</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-zinc-200 p-6 space-y-4 shadow-sm">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Votre organisation</h2>
            <p className="text-sm text-zinc-500 mt-1">
              C&apos;est le nom qui apparaîtra sur vos événements.
            </p>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="space-y-1">
            <label className="text-sm font-medium text-zinc-700">Nom de l&apos;organisation</label>
            <input
              name="name"
              type="text"
              required
              placeholder="Zoo de Paris, Club Canin du Nord…"
              className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-sm outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent"
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full bg-zinc-900 text-white rounded-lg py-2 text-sm font-medium hover:bg-zinc-700 transition-colors disabled:opacity-60"
          >
            {isPending ? 'Création…' : "Créer l'organisation"}
          </button>
        </form>
      </div>
    </div>
  )
}
