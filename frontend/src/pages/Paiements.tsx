import { useEffect, useState, useMemo, useRef } from 'react'
import { api } from '@/lib/api'
import type { Fournisseur } from '@/types'
import { ChevronLeft, ChevronRight, Loader2, Search, X, CreditCard, ChevronDown } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Pesee {
  id: number
  gespontId: string
  numeroTicket: string | null
  produit: string | null
  poidsNet: number | string
  poidsBrut: number | string
  tare: number | string
  datePesee: string
  vehicule: string | null
  mouvement: string | null
  fournisseur?: Fournisseur
  ticket?: {
    id: number
    statut: string
    montant: number | string | null
  }
}

type StatutFilter = 'TOUS' | 'EN_ATTENTE' | 'VALIDÉ' | 'PAYÉ'

const MODES = ['VIREMENT', 'ESPÈCES', 'CHÈQUE', 'AUTRE'] as const
type Mode = (typeof MODES)[number]
const MODE_LABELS: Record<Mode, string> = {
  VIREMENT: 'Virement', ESPÈCES: 'Espèces', CHÈQUE: 'Chèque', AUTRE: 'Autre',
}

const STATUT_STYLE: Record<string, string> = {
  EN_ATTENTE: 'bg-yellow-100 text-yellow-800',
  VALIDÉ:     'bg-blue-100 text-blue-800',
  PAYÉ:       'bg-green-100 text-green-800',
}

const MV_STYLE: Record<string, string> = {
  ENTREE: 'bg-green-800 text-white',
  SORTIE: 'bg-orange-500 text-white',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number | string, dec = 0) {
  return Number(n).toLocaleString('fr-FR', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}
function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const MONTH_FR = [
  'Janvier','Février','Mars','Avril','Mai','Juin',
  'Juillet','Août','Septembre','Octobre','Novembre','Décembre',
]

const TRANSITIONS: Record<string, string[]> = {
  EN_ATTENTE: [],
  VALIDÉ:     ['EN_ATTENTE'],
  PAYÉ:       ['EN_ATTENTE'],
}

const STATUT_LABEL: Record<string, string> = {
  EN_ATTENTE: 'En attente', VALIDÉ: 'Validé', PAYÉ: 'Payé',
}

function StatutChanger({
  ticketId,
  statut,
  onChanged,
}: {
  ticketId: number
  statut: string
  onChanged: () => void
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errMsg, setErrMsg] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const next = TRANSITIONS[statut] ?? []

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  if (next.length === 0) {
    return (
      <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${STATUT_STYLE[statut] ?? 'bg-gray-100 text-gray-600'}`}>
        {STATUT_LABEL[statut] ?? statut}
      </span>
    )
  }

  const change = async (newStatut: string) => {
    setOpen(false)
    setLoading(true)
    setErrMsg(null)
    try {
      await api.patch(`/tickets/${ticketId}`, { statut: newStatut })
      onChanged()
    } catch (e: any) {
      const msg = e?.response?.data?.details ?? e?.response?.data?.error ?? 'Erreur'
      setErrMsg(msg)
      setTimeout(() => setErrMsg(null), 4000)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o) }}
        disabled={loading}
        className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium transition-opacity hover:opacity-80 disabled:opacity-50 ${STATUT_STYLE[statut] ?? 'bg-gray-100 text-gray-600'}`}
      >
        {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : STATUT_LABEL[statut] ?? statut}
        <ChevronDown className="h-3 w-3" />
      </button>
      {errMsg && (
        <div className="absolute left-0 top-full z-30 mt-1 w-56 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 shadow-md">
          {errMsg}
        </div>
      )}
      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 min-w-[130px] rounded-md border bg-background shadow-lg">
          <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Changer en
          </p>
          {next.map((s) => (
            <button
              key={s}
              onClick={(e) => { e.stopPropagation(); change(s) }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-muted"
            >
              <span className={`inline-block h-2 w-2 rounded-full ${
                s === 'EN_ATTENTE' ? 'bg-yellow-400' :
                s === 'PAYÉ' ? 'bg-green-500' :
                s === 'VALIDÉ' ? 'bg-blue-400' : 'bg-red-400'
              }`} />
              {STATUT_LABEL[s]}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Modal Créer Paiement ─────────────────────────────────────────────────────

function CreerPaiementModal({
  pesees,
  onClose,
  onDone,
}: {
  pesees: Pesee[]
  onClose: () => void
  onDone: () => void
}) {
  const [mode, setMode] = useState<Mode>('VIREMENT')
  const [reference, setReference] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const totalKg = pesees.reduce((s, p) => s + Number(p.poidsNet), 0)
  const ticketIds = pesees.map((p) => p.ticket!.id)

  // Group by fournisseur for display
  const byFournisseur = useMemo(() => {
    const m = new Map<string, { count: number; kg: number }>()
    for (const p of pesees) {
      const nom = p.fournisseur?.nom ?? '—'
      const cur = m.get(nom) ?? { count: 0, kg: 0 }
      cur.count++
      cur.kg += Number(p.poidsNet)
      m.set(nom, cur)
    }
    return [...m.entries()]
  }, [pesees])

  const handleSubmit = async () => {
    if (!reference.trim()) { setError('La référence est requise'); return }
    setSubmitting(true)
    setError(null)
    try {
      await api.post('/paiements', { ticketIds, modePaiement: mode, reference: reference.trim() })
      onDone()
    } catch (e: any) {
      setError(e?.response?.data?.details ?? e?.response?.data?.error ?? 'Erreur')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl border bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-lg font-bold">Créer un paiement</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>

        <div className="p-6 space-y-4">
          {/* Résumé */}
          <div className="rounded-lg bg-green-50 border border-green-200 p-4 space-y-2">
            <div className="flex justify-between text-sm font-semibold">
              <span>{pesees.length} pesée{pesees.length > 1 ? 's' : ''} sélectionnée{pesees.length > 1 ? 's' : ''}</span>
              <span className="text-green-800">{fmt(totalKg / 1000, 2)} T</span>
            </div>
            {byFournisseur.map(([nom, s]) => (
              <div key={nom} className="flex justify-between text-xs text-muted-foreground">
                <span>{nom} ({s.count})</span>
                <span>{fmt(s.kg / 1000, 2)} T</span>
              </div>
            ))}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">Mode de paiement</label>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as Mode)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
            >
              {MODES.map((m) => <option key={m} value={m}>{MODE_LABELS[m]}</option>)}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">Référence</label>
            <input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Ex : VIR-2026-042"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="flex justify-end gap-3 border-t px-6 py-4">
          <button onClick={onClose} className="rounded-md border px-4 py-2 text-sm hover:bg-muted">Annuler</button>
          <button
            onClick={handleSubmit}
            disabled={!reference.trim() || submitting}
            className="flex items-center gap-2 rounded-md bg-green-700 px-5 py-2 text-sm font-semibold text-white hover:bg-green-800 disabled:opacity-50"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
            Valider le paiement
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Page principale ──────────────────────────────────────────────────────────

export function Paiements() {
  const today = new Date()
  const [monthOffset, setMonthOffset] = useState(0) // 0 = mois courant
  const [pesees, setPesees] = useState<Pesee[]>([])
  const [total, setTotal] = useState(0)
  const [monthStats, setMonthStats] = useState({ enAttenteCount: 0, enAttenteKg: 0, payeCount: 0, payeKg: 0 })
  const [page, setPage] = useState(1)
  const pages = Math.ceil(total / 100)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statut, setStatut] = useState<StatutFilter>('TOUS')
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [showModal, setShowModal] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const reload = () => setReloadKey(k => k + 1)

  // Calcul du mois affiché
  const displayDate = useMemo(() => {
    const d = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1)
    return d
  }, [monthOffset])

  const monthLabel = `${MONTH_FR[displayDate.getMonth()]} ${displayDate.getFullYear()}`

  const dateDebut = useMemo(() => {
    const d = new Date(displayDate.getFullYear(), displayDate.getMonth(), 1)
    return d.toISOString().slice(0, 10) + 'T00:00:00.000Z'
  }, [displayDate])

  const dateFin = useMemo(() => {
    const d = new Date(displayDate.getFullYear(), displayDate.getMonth() + 1, 0)
    return d.toISOString().slice(0, 10) + 'T23:59:59.999Z'
  }, [displayDate])

  // Debounce search → reset page quand la recherche change
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => { setPage(1) }, [debouncedSearch, statut, dateDebut, dateFin])

  // Chargement unique — toutes les dépendances explicites, pas de useCallback
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setSelected(new Set())

    const params = new URLSearchParams({ page: String(page), limit: '100', dateDebut, dateFin })
    if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim())
    if (statut !== 'TOUS') params.set('statut', statut)

    api.get<{ data: Pesee[]; pagination: { total: number }; stats?: any }>(`/pesees?${params}`)
      .then((r) => {
        if (!cancelled) {
          setPesees(r.data.data)
          setTotal(r.data.pagination.total)
          const s = r.data.stats ?? {}
          setMonthStats({
            enAttenteCount: Number(s.enAttenteCount ?? 0),
            enAttenteKg:    Number(s.enAttenteKg    ?? 0),
            payeCount:      Number(s.payeCount      ?? 0),
            payeKg:         Number(s.payeKg         ?? 0),
          })
        }
      })
      .catch(() => { if (!cancelled) setError('Impossible de charger les pesées') })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [page, debouncedSearch, statut, dateDebut, dateFin, reloadKey])



  // Sélection
  const selectablePesees = pesees.filter(p => p.ticket?.statut === 'EN_ATTENTE' && p.ticket?.id)
  const allSelected = selectablePesees.length > 0 && selectablePesees.every(p => selected.has(p.id))

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(selectablePesees.map(p => p.id)))
    }
  }

  const toggleRow = (id: number, isSelectable: boolean) => {
    if (!isSelectable) return
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const selectedPesees = pesees.filter(p => selected.has(p.id))
  const selectedKg = selectedPesees.reduce((s, p) => s + Number(p.poidsNet), 0)

  return (
    <section className="space-y-4">
      {showModal && (
        <CreerPaiementModal
          pesees={selectedPesees}
          onClose={() => setShowModal(false)}
          onDone={() => { setShowModal(false); reload() }}
        />
      )}

      {/* Header + navigation mois */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Paiements</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => { setMonthOffset(o => o - 1); setPage(1) }} className="rounded-md border p-1.5 hover:bg-muted">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[160px] text-center text-sm font-semibold">{monthLabel}</span>
          <button
            onClick={() => { setMonthOffset(o => o + 1); setPage(1) }}
            disabled={monthOffset >= 0}
            className="rounded-md border p-1.5 hover:bg-muted disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Stats */}
      {!loading && (
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="rounded-lg border bg-card p-4 shadow-sm">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Total pesées</p>
            <p className="mt-1 text-2xl font-bold">{total}</p>
          </div>
          <div className="rounded-lg border bg-card p-4 shadow-sm">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">En attente</p>
            <p className="mt-1 text-2xl font-bold text-yellow-600">{monthStats.enAttenteCount}</p>
            <p className="text-xs text-muted-foreground">{fmt(monthStats.enAttenteKg / 1000, 1)} T</p>
          </div>
          <div className="rounded-lg border bg-card p-4 shadow-sm">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Payé</p>
            <p className="mt-1 text-2xl font-bold text-green-700">{monthStats.payeCount}</p>
            <p className="text-xs text-muted-foreground">{fmt(monthStats.payeKg / 1000, 1)} T</p>
          </div>
          <div className="rounded-lg border bg-card p-4 shadow-sm">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Taux payé</p>
            <p className="mt-1 text-2xl font-bold">
              {total > 0 ? Math.round((monthStats.payeCount / total) * 100) : 0}%
            </p>
          </div>
        </div>
      )}

      {/* Barre de recherche + filtres statut */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="PS code, fournisseur, nom..."
            className="w-full rounded-md border bg-background py-2 pl-9 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex overflow-hidden rounded-md border text-sm">
          {(['TOUS', 'EN_ATTENTE', 'PAYÉ', 'VALIDÉ'] as StatutFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatut(s)}
              className={`px-3 py-2 font-medium transition-colors ${
                statut === s ? 'bg-green-800 text-white' : 'bg-background hover:bg-muted'
              }`}
            >
              {s === 'TOUS' ? 'Tous' : s === 'EN_ATTENTE' ? 'En attente' : s === 'PAYÉ' ? 'Payé' : 'Validé'}
            </button>
          ))}
        </div>
      </div>

      {/* Barre d'action flottante quand sélection */}
      {selected.size > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 px-4 py-3">
          <span className="text-sm font-medium text-green-800">
            {selected.size} pesée{selected.size > 1 ? 's' : ''} sélectionnée{selected.size > 1 ? 's' : ''} — {fmt(selectedKg / 1000, 2)} T
          </span>
          <div className="flex gap-2">
            <button onClick={() => setSelected(new Set())} className="rounded-md border px-3 py-1.5 text-sm hover:bg-white">
              Désélectionner
            </button>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 rounded-md bg-green-700 px-4 py-1.5 text-sm font-semibold text-white hover:bg-green-800"
            >
              <CreditCard className="h-3.5 w-3.5" />
              Créer paiement
            </button>
          </div>
        </div>
      )}

      {error && <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {/* Table */}
      <div className="rounded-lg border bg-card shadow-sm overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-green-700 text-white text-xs uppercase tracking-wide">
              <tr>
                <th className="px-3 py-3 text-center w-8">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="accent-white cursor-pointer"
                    title="Sélectionner toutes les pesées en attente"
                  />
                </th>
                <th className="px-3 py-3 text-left">Date</th>
                <th className="px-3 py-3 text-left">Fournisseur</th>
                <th className="px-3 py-3 text-left">PS Code</th>
                <th className="px-3 py-3 text-left">Produit</th>
                <th className="px-3 py-3 text-left">Mouvement</th>
                <th className="px-3 py-3 text-right">Net (kg)</th>
                <th className="px-3 py-3 text-left">Statut</th>
              </tr>
            </thead>
            <tbody>
              {pesees.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                    Aucune pesée pour {monthLabel}
                  </td>
                </tr>
              ) : (
                pesees.map((p, i) => {
                  const isSelectable = p.ticket?.statut === 'EN_ATTENTE' && !!p.ticket?.id
                  const isSelected = selected.has(p.id)
                  const mv = p.mouvement ?? ''
                  const statutVal = p.ticket?.statut ?? 'EN_ATTENTE'
                  return (
                    <tr
                      key={p.id}
                      onClick={() => toggleRow(p.id, isSelectable)}
                      className={`transition-colors ${
                        isSelectable ? 'cursor-pointer' : 'cursor-default'
                      } ${
                        isSelected ? 'bg-green-50' :
                        i % 2 === 0 ? 'bg-background hover:bg-muted/30' : 'bg-muted/20 hover:bg-muted/40'
                      }`}
                    >
                      <td className="px-3 py-2.5 text-center">
                        {isSelectable ? (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleRow(p.id, isSelectable)}
                            onClick={(e) => e.stopPropagation()}
                            className="accent-green-700 cursor-pointer"
                          />
                        ) : (
                          <span className="block h-4 w-4 mx-auto" />
                        )}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">{fmtDate(p.datePesee)}</td>
                      <td className="px-3 py-2.5 font-medium">
                        <div>{p.fournisseur?.nom ?? '—'}</div>
                        {p.fournisseur?.codeGespont && (
                          <div className="text-xs text-muted-foreground font-mono">{p.fournisseur.codeGespont}</div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{p.gespontId}</td>
                      <td className="px-3 py-2.5">{p.produit ?? '—'}</td>
                      <td className="px-3 py-2.5">
                        {mv ? (
                          <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${MV_STYLE[mv] ?? 'bg-gray-100 text-gray-700'}`}>
                            {mv}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-semibold">{fmt(p.poidsNet)}</td>
                      <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                        {p.ticket?.id ? (
                          <StatutChanger
                            ticketId={p.ticket.id}
                            statut={statutVal}
                            onChanged={reload}
                          />
                        ) : (
                          <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${STATUT_STYLE[statutVal] ?? 'bg-gray-100 text-gray-600'}`}>
                            {STATUT_LABEL[statutVal] ?? statutVal}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Page {page} / {pages} — {total} pesées</span>
          <div className="flex gap-2">
            <button disabled={page <= 1 || loading} onClick={() => setPage(p => p - 1)} className="rounded-md border px-3 py-1.5 hover:bg-muted disabled:opacity-50">Précédent</button>
            <button disabled={page >= pages || loading} onClick={() => setPage(p => p + 1)} className="rounded-md border px-3 py-1.5 hover:bg-muted disabled:opacity-50">Suivant</button>
          </div>
        </div>
      )}
    </section>
  )
}
