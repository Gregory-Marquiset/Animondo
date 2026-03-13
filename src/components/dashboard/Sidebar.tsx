'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface SidebarProps {
  userName: string
  orgName: string
}

export default function Sidebar({ userName, orgName }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const navItem = (href: string, label: string) => (
    <Link
      href={href}
      className={`flex items-center px-3 py-2 rounded-lg text-sm transition-colors ${
        pathname === href
          ? 'bg-zinc-700 text-white'
          : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
      }`}
    >
      {label}
    </Link>
  )

  return (
    <aside className="w-56 h-screen flex flex-col bg-zinc-900 text-white shrink-0">
      <div className="p-4 border-b border-zinc-800">
        <span className="font-bold text-base">Animondo</span>
        <p className="text-xs text-zinc-400 mt-0.5 truncate">{orgName}</p>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {navItem('/dashboard', 'Événements')}
      </nav>

      <div className="p-3 border-t border-zinc-800">
        <p className="text-xs text-zinc-500 truncate px-3 mb-1">{userName}</p>
        <button
          onClick={handleLogout}
          className="w-full text-left px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-white rounded-lg transition-colors"
        >
          Se déconnecter
        </button>
      </div>
    </aside>
  )
}
