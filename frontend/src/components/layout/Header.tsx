import { useState, useRef, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from '@/components/ui/navigation-menu'
import { RefreshCw, LogOut, KeyRound, X, ChevronDown } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { api } from '@/lib/api'
import type { User } from '@/types'

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard' },
  { to: '/pesees', label: 'Pesées' },
  { to: '/fournisseurss', label: 'Fournisseurs' },
  { to: '/tickets', label: 'Tickets' },
  { to: '/paiements', label: 'Paiements' },
  { to: '/admin', label: 'Admin' },
]

function getUserInitials(user: User | null): string {
  if (!user) return '?'
  return user.nom.split(' ').map((p) => p[0]).join('').toUpperCase().slice(0, 2)
}

// ─── Modal Changer mot de passe ──────────────────────────────────────────────

function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    if (next !== confirm) { setError('Les mots de passe ne correspondent pas'); return }
    if (next.length < 6) { setError('Minimum 6 caractères requis'); return }
    setLoading(true)
    try {
      await api.patch('/auth/change-password', { currentPassword: current, newPassword: next })
      setSuccess(true)
      setTimeout(onClose, 1500)
    } catch (err: any) {
      setError(err.response?.data?.error ?? 'Erreur lors du changement')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="w-full max-w-sm rounded-lg border bg-background p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">Changer le mot de passe</h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        {success ? (
          <p className="py-6 text-center text-sm font-medium text-primary">Mot de passe mis à jour ✓</p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Mot de passe actuel</label>
              <input type="password" value={current} onChange={e => setCurrent(e.target.value)} required
                className="rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Nouveau mot de passe</label>
              <input type="password" value={next} onChange={e => setNext(e.target.value)} required
                className="rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Confirmer</label>
              <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required
                className="rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <button type="submit" disabled={loading}
              className="mt-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50">
              {loading ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

// ─── Avatar dropdown maison ───────────────────────────────────────────────────

function UserMenu({ user, onLogout, onChangePwd }: {
  user: User | null
  onLogout: () => void
  onChangePwd: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 rounded-full pl-1 pr-2 py-1 hover:bg-muted transition-colors"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white">
          {getUserInitials(user)}
        </span>
        <ChevronDown className="h-3 w-3 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-52 rounded-lg border bg-background shadow-lg">
          {/* Info utilisateur */}
          <div className="px-3 py-2.5 border-b">
            <p className="text-sm font-medium">{user?.nom ?? 'Mon compte'}</p>
            {user?.email && <p className="text-xs text-muted-foreground truncate">{user.email}</p>}
          </div>

          {/* Actions */}
          <div className="p-1">
            <button
              onClick={() => { setOpen(false); onChangePwd() }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
            >
              <KeyRound className="h-4 w-4 text-muted-foreground" />
              Changer le mot de passe
            </button>
            <button
              onClick={() => { setOpen(false); onLogout() }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-destructive hover:bg-destructive/10"
            >
              <LogOut className="h-4 w-4" />
              Se déconnecter
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Header ───────────────────────────────────────────────────────────────────

export function Header() {
  const { logout, user } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)
  const [showChangePwd, setShowChangePwd] = useState(false)

  const visibleNavItems = NAV_ITEMS.filter(item =>
    item.to === '/admin' ? user?.role === 'ADMIN' : true
  )

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  const handleSync = async () => {
    if (isSyncing) return
    setIsSyncing(true)
    setSyncMsg(null)
    try {
      const res = await api.post<{ stats: { inserted: number; skipped: number } }>('/admin/sync')
      setSyncMsg(`✓ ${res.data.stats.inserted} nouvelles pesées`)
    } catch {
      setSyncMsg('Erreur sync')
    } finally {
      setIsSyncing(false)
      setTimeout(() => setSyncMsg(null), 4000)
    }
  }

  return (
    <>
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 w-full items-center justify-between px-6">
          <div className="flex items-center gap-6">
            <img src="/logoPalme.svg" alt="Palme Ivoire" className="h-40 w-auto" />
            <NavigationMenu className="hidden md:flex">
              <NavigationMenuList>
                {visibleNavItems.map((item) => (
                  <NavigationMenuItem key={item.to}>
                    <NavigationMenuLink render={<Link to={item.to} />} data-active={pathname === item.to}>
                      {item.label}
                    </NavigationMenuLink>
                  </NavigationMenuItem>
                ))}
              </NavigationMenuList>
            </NavigationMenu>
          </div>

          <div className="flex items-center gap-2">
            {syncMsg && <span className="text-xs text-muted-foreground">{syncMsg}</span>}
            <button
              onClick={handleSync}
              disabled={isSyncing}
              title="Synchroniser GESpont"
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
            </button>
            <UserMenu user={user} onLogout={handleLogout} onChangePwd={() => setShowChangePwd(true)} />
          </div>
        </div>
      </header>

      {showChangePwd && <ChangePasswordModal onClose={() => setShowChangePwd(false)} />}
    </>
  )
}
