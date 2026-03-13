'use client'

import { useTransition } from 'react'
import { deleteEvent } from '@/app/dashboard/(main)/events/actions'

export default function DeleteEventButton({ eventId }: { eventId: string }) {
  const [isPending, startTransition] = useTransition()

  function handleDelete() {
    if (!confirm('Supprimer cet événement ? Cette action est irréversible.')) return
    startTransition(async () => { await deleteEvent(eventId) })
  }

  return (
    <button
      onClick={handleDelete}
      disabled={isPending}
      className="text-sm text-zinc-400 hover:text-red-500 transition-colors disabled:opacity-40 px-2 py-1"
    >
      {isPending ? '…' : 'Supprimer'}
    </button>
  )
}
