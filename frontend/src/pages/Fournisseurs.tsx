import { useEffect, useState, useMemo } from 'react'
import { api } from '@/lib/api'
import type { Fournisseur, Pesee, Paiement } from '@/types'
import { Search, X, Edit2, Check, ChevronRight, Loader2, ArrowLeft } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface FournisseurDetail {
  fournisseur: Fournisseur & {
    pesees: Pesee[]
    stats: { totalPesees: number; montantEnAttente: number; montantPaye: number }
  }
  peseesRecentes: Pesee[]
  paiementsRecents: Paiement[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function MouvementBadge({ mouvement }: { mouvement?: string | null }) {
  if (!mouvement) return <span className="text-muted-foreground text-xs">—</span>
  const map: Record<string, string> = {
    ENTREE: 'bg-green-100 text-green-800',
    SORTIE: 'bg-orange-100 text-orange-800',
  }
  return (
    <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${map[mouvement] ?? 'bg-gray-100 text-gray-700'}`}>
      {mouvement}
    </span>
  )
}

function StatutBadge({ statut }: { statut: string }) {
  const map: Record<string, string> = {
    EN_ATTENTE: 'bg-yellow-100 text-yellow-800',
    VALIDÉ: 'bg-blue-100 text-blue-800',
    PAYÉ: 'bg-green-100 text-green-800',
  }
  return (
    <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${map[statut] ?? 'bg-gray-100 text-gray-700'}`}>
      {statut.replace('_', ' ')}
    </span>
  )
}

// ─── Edit Form ────────────────────────────────────────────────────────────────

interface EditForm {
  nom: string
  contact: string
  adresse: string
  actif: boolean
}

// ─── Detail View ──────────────────────────────────────────────────────────────

function FournisseurDetailView({
  fournisseurId,
  onBack,
  onUpdated,
}: {
  fournisseurId: number
  onBack: () => void
  onUpdated: () => void
}) {
  const [detail, setDetail] = useState<FournisseurDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<EditForm>({ nom: '', contact: '', adresse: '', actif: true })
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    api
      .get<FournisseurDetail>(`/fournisseurs/${fournisseurId}`)
      .then((r) => {
        setDetail(r.data)
        const f = r.data.fournisseur
        setForm({ nom: f.nom, contact: f.contact ?? '', adresse: f.adresse ?? '', actif: f.actif })
      })
      .catch(() => setError('Impossible de charger le fournisseur'))
      .finally(() => setLoading(false))
  }, [fournisseurId])

  const handleSave = async () => {
    if (!detail) return
    setSaving(true)
    setSaveError(null)
    try {
      await api.patch(`/fournisseurs/${fournisseurId}`, {
        nom: form.nom || undefined,
        contact: form.contact || null,
        adresse: form.adresse || null,
        actif: form.actif,
      })
      setDetail((prev) =>
        prev
          ? {
              ...prev,
              fournisseur: {
                ...prev.fournisseur,
                nom: form.nom,
                contact: form.contact || null,
                adresse: form.adresse || null,
                actif: form.actif,
              },
            }
          : prev
      )
      setEditing(false)
      onUpdated()
    } catch {
      setSaveError('Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !detail) {
    return (
      <div className="py-10 text-center text-red-500">{error ?? 'Erreur inconnue'}</div>
    )
  }

  const { fournisseur, peseesRecentes, paiementsRecents } = detail

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour
          </button>
          <span className="text-muted-foreground">/</span>
          <h2 className="text-xl font-bold">{fournisseur.nom}</h2>
          {!fournisseur.actif && (
            <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-500">Inactif</span>
          )}
        </div>
        {!editing ? (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
          >
            <Edit2 className="h-3.5 w-3.5" />
            Modifier
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => {
                setEditing(false)
                setSaveError(null)
                setForm({
                  nom: fournisseur.nom,
                  contact: fournisseur.contact ?? '',
                  adresse: fournisseur.adresse ?? '',
                  actif: fournisseur.actif,
                })
              }}
              className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
            >
              Annuler
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-md bg-green-700 px-3 py-1.5 text-sm text-white hover:bg-green-800 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Enregistrer
            </button>
          </div>
        )}
      </div>

      {saveError && (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {saveError}
        </div>
      )}

      {/* Info Card */}
      <div className="rounded-lg border bg-card p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Informations
        </h3>
        {editing ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Nom</label>
              <input
                value={form.nom}
                onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))}
                className="w-full rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Contact</label>
              <input
                value={form.contact}
                onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))}
                placeholder="—"
                className="w-full rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Adresse</label>
              <input
                value={form.adresse}
                onChange={(e) => setForm((f) => ({ ...f, adresse: e.target.value }))}
                placeholder="—"
                className="w-full rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="actif"
                checked={form.actif}
                onChange={(e) => setForm((f) => ({ ...f, actif: e.target.checked }))}
                className="accent-green-700"
              />
              <label htmlFor="actif" className="text-sm">Actif</label>
            </div>
          </div>
        ) : (
          <dl className="grid gap-2 sm:grid-cols-2 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Code GESpont</dt>
              <dd className="font-mono font-medium">{fournisseur.codeGespont}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Statut</dt>
              <dd>
                <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${fournisseur.actif ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                  {fournisseur.actif ? 'Actif' : 'Inactif'}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Contact</dt>
              <dd>{fournisseur.contact ?? <span className="text-muted-foreground">—</span>}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Adresse</dt>
              <dd>{fournisseur.adresse ?? <span className="text-muted-foreground">—</span>}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Enregistré le</dt>
              <dd>{fmtDate(fournisseur.createdAt)}</dd>
            </div>
          </dl>
        )}
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border bg-card p-4 shadow-sm text-center">
          <p className="text-2xl font-bold">{fournisseur.stats.totalPesees}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Pesées (20 dernières affichées)</p>
        </div>
        <div className="rounded-lg border bg-card p-4 shadow-sm text-center">
          <p className="text-2xl font-bold text-yellow-600">{fmt(fournisseur.stats.montantEnAttente)} T</p>
          <p className="text-xs text-muted-foreground mt-0.5">En attente</p>
        </div>
        <div className="rounded-lg border bg-card p-4 shadow-sm text-center">
          <p className="text-2xl font-bold text-green-700">{fmt(fournisseur.stats.montantPaye)} T</p>
          <p className="text-xs text-muted-foreground mt-0.5">Payé</p>
        </div>
      </div>

      {/* Recent Pesées */}
      <div className="rounded-lg border bg-card shadow-sm">
        <div className="border-b px-4 py-3">
          <h3 className="text-sm font-semibold">20 dernières pesées</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-left">Ticket</th>
                <th className="px-3 py-2 text-left">Produit</th>
                <th className="px-3 py-2 text-left">Mouvement</th>
                <th className="px-3 py-2 text-right">Poids net (kg)</th>
                <th className="px-3 py-2 text-left">Statut</th>
              </tr>
            </thead>
            <tbody>
              {peseesRecentes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                    Aucune pesée
                  </td>
                </tr>
              ) : (
                peseesRecentes.map((p, i) => (
                  <tr key={p.id} className={i % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                    <td className="px-3 py-2 whitespace-nowrap">{fmtDate(p.datePesee)}</td>
                    <td className="px-3 py-2 font-mono text-xs">{p.numeroTicket ?? '—'}</td>
                    <td className="px-3 py-2">{p.produit ?? '—'}</td>
                    <td className="px-3 py-2">
                      <MouvementBadge mouvement={p.mouvement} />
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {Number(p.poidsNet).toLocaleString('fr-FR')}
                    </td>
                    <td className="px-3 py-2">
                      {p.ticket ? <StatutBadge statut={p.ticket.statut} /> : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Paiements */}
      {paiementsRecents.length > 0 && (
        <div className="rounded-lg border bg-card shadow-sm">
          <div className="border-b px-4 py-3">
            <h3 className="text-sm font-semibold">20 derniers paiements</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Référence</th>
                  <th className="px-3 py-2 text-left">Mode</th>
                  <th className="px-3 py-2 text-right">Montant</th>
                </tr>
              </thead>
              <tbody>
                {paiementsRecents.map((p, i) => (
                  <tr key={p.id} className={i % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                    <td className="px-3 py-2 whitespace-nowrap">{fmtDate(p.datePaiement)}</td>
                    <td className="px-3 py-2 font-mono text-xs">{p.reference}</td>
                    <td className="px-3 py-2">{p.modePaiement}</td>
                    <td className="px-3 py-2 text-right font-mono font-medium">
                      {fmt(p.montantTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function Fournisseurs() {
  const [data, setData] = useState<Fournisseur[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filterActif, setFilterActif] = useState<'tous' | 'actifs' | 'inactifs'>('actifs')
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const loadFournisseurs = () => {
    setLoading(true)
    setError(null)
    api
      .get<Fournisseur[]>('/fournisseurs')
      .then((r) => setData(r.data))
      .catch(() => setError('Impossible de charger les fournisseurs'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadFournisseurs()
  }, [])

  const filtered = useMemo(() => {
    let list = data
    if (filterActif === 'actifs') list = list.filter((f) => f.actif)
    if (filterActif === 'inactifs') list = list.filter((f) => !f.actif)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (f) =>
          f.nom.toLowerCase().includes(q) ||
          f.codeGespont.toLowerCase().includes(q) ||
          f.contact?.toLowerCase().includes(q) ||
          false,
      )
    }
    return list
  }, [data, search, filterActif])

  // Totals
  const totalPesees = useMemo(() => filtered.reduce((a, f) => a + (f.stats?.totalPesees ?? 0), 0), [filtered])
  const totalEnAttente = useMemo(() => filtered.reduce((a, f) => a + (f.stats?.montantEnAttente ?? 0), 0), [filtered])
  const totalPaye = useMemo(() => filtered.reduce((a, f) => a + (f.stats?.montantPaye ?? 0), 0), [filtered])

  // ── Detail view
  if (selectedId !== null) {
    return (
      <section className="space-y-4">
        <FournisseurDetailView
          fournisseurId={selectedId}
          onBack={() => setSelectedId(null)}
          onUpdated={loadFournisseurs}
        />
      </section>
    )
  }

  // ── List view
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Fournisseurs</h1>
        <span className="text-sm text-muted-foreground">{filtered.length} fournisseur{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Stats cards */}
      {!loading && !error && (
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="rounded-lg border bg-card p-4 shadow-sm">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Total fournisseurs</p>
            <p className="mt-1 text-2xl font-bold">{data.length}</p>
            <p className="text-xs text-muted-foreground">{data.filter((f) => f.actif).length} actifs</p>
          </div>
          <div className="rounded-lg border bg-card p-4 shadow-sm">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Pesées (sélection)</p>
            <p className="mt-1 text-2xl font-bold">{totalPesees.toLocaleString('fr-FR')}</p>
          </div>
          <div className="rounded-lg border bg-card p-4 shadow-sm">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">En attente</p>
            <p className="mt-1 text-2xl font-bold text-yellow-600">{fmt(totalEnAttente)} T</p>
          </div>
          <div className="rounded-lg border bg-card p-4 shadow-sm">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Total payé</p>
            <p className="mt-1 text-2xl font-bold text-green-700">{fmt(totalPaye)} T</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un fournisseur..."
            className="w-full rounded-md border bg-background py-1.5 pl-8 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex rounded-md border overflow-hidden text-sm">
          {(['tous', 'actifs', 'inactifs'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setFilterActif(v)}
              className={`px-3 py-1.5 capitalize ${filterActif === v ? 'bg-green-700 text-white' : 'bg-background hover:bg-muted'}`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border bg-card shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-green-700 text-white text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">Fournisseur</th>
                  <th className="px-4 py-3 text-left">Code GESpont</th>
                  <th className="px-4 py-3 text-left">Contact</th>
                  <th className="px-4 py-3 text-center">Statut</th>
                  <th className="px-4 py-3 text-right">Pesées</th>
                  <th className="px-4 py-3 text-right">En attente (T)</th>
                  <th className="px-4 py-3 text-right">Payé (T)</th>
                  <th className="px-4 py-3 text-right">Total (T)</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-muted-foreground">
                      Aucun fournisseur trouvé
                    </td>
                  </tr>
                ) : (
                  filtered.map((f, i) => (
                    <tr
                      key={f.id}
                      onClick={() => setSelectedId(f.id)}
                      className={`cursor-pointer transition-colors hover:bg-green-50 ${i % 2 === 0 ? 'bg-background' : 'bg-muted/20'}`}
                    >
                      <td className="px-4 py-3 font-medium">{f.nom}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{f.codeGespont}</td>
                      <td className="px-4 py-3 text-muted-foreground">{f.contact ?? '—'}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${f.actif ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}`}>
                          {f.actif ? 'Actif' : 'Inactif'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono">{(f.stats?.totalPesees ?? 0).toLocaleString('fr-FR')}</td>
                      <td className="px-4 py-3 text-right font-mono text-yellow-700">{fmt(f.stats?.montantEnAttente ?? 0)}</td>
                      <td className="px-4 py-3 text-right font-mono text-green-700">{fmt(f.stats?.montantPaye ?? 0)}</td>
                      <td className="px-4 py-3 text-right font-mono font-semibold">{fmt(f.stats?.montantTotal ?? 0)}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        <ChevronRight className="h-4 w-4" />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}
