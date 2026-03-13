'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { login } from './actions'

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await login(formData)
      if (result?.error) setError(result.error)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-zinc-200 p-6 space-y-4 shadow-sm">
      <h2 className="text-lg font-semibold text-zinc-900">Connexion</h2>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="space-y-1">
        <label className="text-sm font-medium text-zinc-700">Email</label>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-sm outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent"
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium text-zinc-700">Mot de passe</label>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-sm outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full bg-zinc-900 text-white rounded-lg py-2 text-sm font-medium hover:bg-zinc-700 transition-colors disabled:opacity-60"
      >
        {isPending ? 'Connexion…' : 'Se connecter'}
      </button>

      <p className="text-sm text-center text-zinc-500">
        Pas encore de compte ?{' '}
        <Link href="/signup" className="text-zinc-900 font-medium hover:underline">
          S&apos;inscrire
        </Link>
      </p>
    </form>
  )
}
