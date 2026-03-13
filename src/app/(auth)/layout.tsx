export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-zinc-900">Animondo</h1>
          <p className="text-sm text-zinc-500 mt-1">Dashboard organisateur</p>
        </div>
        {children}
      </div>
    </div>
  )
}
