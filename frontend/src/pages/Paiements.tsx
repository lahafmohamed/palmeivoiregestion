import React, { useEffect, useState, useMemo, useRef } from 'react'
import { api } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import type { Fournisseur } from '@/types'
import { ChevronLeft, ChevronRight, Loader2, Search, X, CreditCard, ChevronDown, Check, Columns2, Download } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

// ─── Types ────────────────────────────────────────────────────────────────────

interface RawJson {
  PS_SITE?: string
  PS_DATEHEUREP1?: string
  PS_DATEHEUREP2?: string
  PS_ANNULEE?: number
  PS_MOUVEMENT?: string
  PS_FOURNISSEUR?: string
  PP_CODE?: string
  PR_CODE?: string
  FO_CODE?: string
  [key: string]: unknown
}

interface Pesee {
  id: number
  gespontId: string
  numeroTicket: string | null
  produit: string | null
  prCode: string | null
  poidsNet: number | string
  poidsBrut: number | string
  tare: number | string
  datePesee: string
  vehicule: string | null
  mouvement: string | null
  rawJson?: RawJson | null
  syncedAt?: string
  fournisseur?: Fournisseur
  ticket?: {
    id: number
    statut: string
    montant: number | string | null
    prixUnitaire: number | string | null
    dateValidation: string | null
    datePaiement: string | null
    notes: string | null
    paiement?: {
      createur?: { nom: string } | null
      reference?: string
      modePaiement?: string
    } | null
  }
  dernierPrix?: string | null
}

type StatutFilter = 'TOUS' | 'EN_ATTENTE' | 'PAYÉ'

const MODES = ['VIREMENT', 'ESPÈCES', 'CHÈQUE', 'AUTRE'] as const
type Mode = (typeof MODES)[number]
const MODE_LABELS: Record<Mode, string> = {
  VIREMENT: 'Virement', ESPÈCES: 'Espèces', CHÈQUE: 'Chèque', AUTRE: 'Autre',
}

const STATUT_STYLE: Record<string, string> = {
  EN_ATTENTE: 'bg-yellow-100 text-yellow-800',
  PAYÉ:       'bg-primary/10 text-primary',
}

const MV_STYLE: Record<string, string> = {
  ENTREE: 'bg-primary text-white',
  SORTIE: 'bg-orange-500 text-white',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number | string, dec = 0) {
  return Number(n).toLocaleString('fr-FR', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}
function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
function splitDT(iso?: string | null) {
  if (!iso) return { date: '—', heure: '—' }
  const d = new Date(iso)
  return {
    date: d.toLocaleDateString('fr-FR'),
    heure: d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
  }
}

const MONTH_FR = [
  'Janvier','Février','Mars','Avril','Mai','Juin',
  'Juillet','Août','Septembre','Octobre','Novembre','Décembre',
]

// Les transitions disponibles sont calculées dynamiquement selon le rôle (voir composant Paiements)

const STATUT_LABEL: Record<string, string> = {
  EN_ATTENTE: 'En attente', PAYÉ: 'Payé',
}

function StatutChanger({
  ticketId,
  statut,
  allowedTransitions,
  onChanged,
}: {
  ticketId: number
  statut: string
  allowedTransitions: Record<string, string[]>
  onChanged: () => void
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errMsg, setErrMsg] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const next = allowedTransitions[statut] ?? []

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
                s === 'PAYÉ' ? 'bg-primary/50' : 'bg-red-400'
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
  const [prixKg, setPrixKg] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const totalKg = pesees.reduce((s, p) => s + Number(p.poidsNet), 0)
  const prixNum = parseFloat(prixKg) || 0
  const montantTotal = totalKg * prixNum
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
    if (prixNum <= 0) { setError('Le prix par kg est requis'); return }
    setSubmitting(true)
    setError(null)
    try {
      await api.post('/paiements', { ticketIds, modePaiement: mode, reference: reference.trim(), prixUnitaire: prixNum })
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
          <div className="rounded-lg bg-primary/5 border border-primary/20 p-4 space-y-2">
            <div className="flex justify-between text-sm font-semibold">
              <span>{pesees.length} pesée{pesees.length > 1 ? 's' : ''} sélectionnée{pesees.length > 1 ? 's' : ''}</span>
              <span className="text-primary">{fmt(totalKg / 1000, 2)} T</span>
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
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {MODES.map((m) => <option key={m} value={m}>{MODE_LABELS[m]}</option>)}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">Prix par kg (FCFA)</label>
            <input
              type="number"
              value={prixKg}
              onChange={(e) => setPrixKg(e.target.value)}
              placeholder="Ex : 150"
              min="0"
              step="any"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {prixNum > 0 && (
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
              <div className="flex justify-between text-sm font-semibold text-blue-800">
                <span>Montant total</span>
                <span>{fmt(montantTotal, 0)} FCFA</span>
              </div>
              <p className="text-xs text-blue-600 mt-1">
                {fmt(totalKg)} kg × {fmt(prixNum, 0)} FCFA/kg
              </p>
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-medium">Référence</label>
            <input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Ex : VIR-2026-042"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="flex justify-end gap-3 border-t px-6 py-4">
          <button onClick={onClose} className="rounded-md border px-4 py-2 text-sm hover:bg-muted">Annuler</button>
          <button
            onClick={handleSubmit}
            disabled={!reference.trim() || prixNum <= 0 || submitting}
            className="flex items-center gap-2 rounded-md bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary disabled:opacity-50"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
            Valider le paiement
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Colonnes dynamiques ─────────────────────────────────────────────────────

const ALL_COLS = [
  'Sélection', 'Date', 'Fournisseur', 'Code Fournisseur',
  'PP Code', 'PS Code', 'PR Code',
  'Site', 'Produit', 'Véhicule', 'Mouvement',
  'Poids P1 (kg)', 'Poids P2 (kg)', 'Net (kg)',
  'Date P1', 'Heure P1', 'Date P2', 'Heure P2',
  'Prix/kg', 'Montant', 'Dernier prix',
  'Réf. paiement', 'Mode paiement', 'Confirmé par',
  'Annulée', 'Statut',
] as const

type ColName = (typeof ALL_COLS)[number]

const FIXED_COLS: ColName[] = ['Sélection', 'Statut']

const DEFAULT_COLS = new Set<ColName>([
  'Sélection', 'Date', 'Fournisseur', 'PS Code', 'Produit',
  'Mouvement', 'Net (kg)', 'Prix/kg', 'Montant', 'Dernier prix', 'Confirmé par', 'Statut',
])

// ─── Rapport groupé ──────────────────────────────────────────────────────────

type ReportTab = 'tableau' | 'jour' | 'semaine' | 'mois'

interface GroupedRow {
  periode: string
  totalCount: number
  totalKg: number
  enAttenteCount: number
  enAttenteKg: number
  payeCount: number
  payeKg: number
  payeMontant: number
}

function periodKey(d: Date, by: 'jour' | 'semaine' | 'mois'): string {
  if (by === 'mois') return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  if (by === 'semaine') {
    const tmp = new Date(d)
    tmp.setHours(0, 0, 0, 0)
    tmp.setDate(tmp.getDate() + 4 - (tmp.getDay() || 7))
    const yearStart = new Date(tmp.getFullYear(), 0, 1)
    const week = Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
    return `${tmp.getFullYear()}-S${String(week).padStart(2, '0')}`
  }
  return d.toISOString().slice(0, 10)
}

function formatPeriodeLabel(periode: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(periode)) {
    return new Date(periode + 'T12:00:00Z').toLocaleDateString('fr-FR')
  }
  if (/^\d{4}-S\d{2}$/.test(periode)) {
    const [year, s] = periode.split('-S')
    return `Semaine ${s} — ${year}`
  }
  if (/^\d{4}-\d{2}$/.test(periode)) {
    const [year, month] = periode.split('-')
    return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
  }
  return periode
}

// ─── Page principale ──────────────────────────────────────────────────────────

export function Paiements() {
  const { user } = useAuth()
  const canCreatePayment = user?.role === 'ADMIN' || user?.role === 'SUPERVISEUR'
  const canReverseStatus = user?.role === 'ADMIN'
  const transitions: Record<string, string[]> = {
    EN_ATTENTE: [],
    PAYÉ: canReverseStatus ? ['EN_ATTENTE'] : [],
  }

  const today = new Date()
  const [monthOffset, setMonthOffset] = useState(0) // 0 = mois courant
  const [pesees, setPesees] = useState<Pesee[]>([])
  const [total, setTotal] = useState(0)
  const [monthStats, setMonthStats] = useState({ enAttenteCount: 0, enAttenteKg: 0, payeCount: 0, payeKg: 0, payeMontant: 0 })
  const [page, setPage] = useState(1)
  const pages = Math.ceil(total / 100)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fournisseurs, setFournisseurs] = useState<{ id: number; nom: string }[]>([])
  const [fournisseurId, setFournisseurId] = useState<number | undefined>()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statut, setStatut] = useState<StatutFilter>('TOUS')
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [showModal, setShowModal] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const reload = () => setReloadKey(k => k + 1)

  // ── Onglets rapport ──
  const [activeTab, setActiveTab] = useState<ReportTab>('tableau')
  const [groupedData, setGroupedData] = useState<GroupedRow[]>([])
  const [groupedLoading, setGroupedLoading] = useState(false)
  const [groupedError, setGroupedError] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)

  const [visibleCols, setVisibleCols] = useState<Set<ColName>>(new Set(DEFAULT_COLS))
  const toggleCol = (col: ColName) => {
    if (FIXED_COLS.includes(col)) return
    setVisibleCols((prev) => {
      const next = new Set(prev)
      next.has(col) ? next.delete(col) : next.add(col)
      return next
    })
  }
  const activeCols = ALL_COLS.filter((c) => visibleCols.has(c))

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

  // Fetch fournisseurs
  useEffect(() => {
    api.get<{ id: number; nom: string }[]>('/fournisseurs')
      .then(r => setFournisseurs(r.data))
      .catch(() => {})
  }, [])

  // Debounce search + produit → reset page quand la recherche change
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => { setPage(1) }, [debouncedSearch, statut, dateDebut, dateFin, fournisseurId])

  // Chargement unique — toutes les dépendances explicites, pas de useCallback
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setSelected(new Set())

    const params = new URLSearchParams({ page: String(page), limit: '100', dateDebut, dateFin })
    params.set('mouvement', 'ENTREE')
    params.set('excludeRestricted', 'true')
    if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim())
    if (statut !== 'TOUS') params.set('statut', statut)
    if (fournisseurId) params.set('fournisseurId', String(fournisseurId))

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
            payeMontant:    Number(s.payeMontant    ?? 0),
          })
        }
      })
      .catch(() => { if (!cancelled) setError('Impossible de charger les pesées') })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [page, debouncedSearch, statut, dateDebut, dateFin, fournisseurId, reloadKey])



  // ── Fetch grouped data when tab changes ──
  useEffect(() => {
    if (activeTab === 'tableau') return
    setGroupedLoading(true)
    setGroupedError(null)

    const params = new URLSearchParams({ page: '1', limit: '9999', dateDebut, dateFin })
    params.set('mouvement', 'ENTREE')
    params.set('excludeRestricted', 'true')
    if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim())
    if (statut !== 'TOUS') params.set('statut', statut)
    if (fournisseurId) params.set('fournisseurId', String(fournisseurId))

    api.get<{ data: Pesee[] }>(`/pesees?${params}`)
      .then((r) => {
        const by = activeTab as 'jour' | 'semaine' | 'mois'
        const map = new Map<string, GroupedRow>()
        for (const p of r.data.data) {
          const key = periodKey(new Date(p.datePesee), by)
          if (!map.has(key)) {
            map.set(key, { periode: key, totalCount: 0, totalKg: 0, enAttenteCount: 0, enAttenteKg: 0, payeCount: 0, payeKg: 0, payeMontant: 0 })
          }
          const g = map.get(key)!
          const kg = Number(p.poidsNet ?? 0)
          g.totalCount++
          g.totalKg += kg
          if (p.ticket?.statut === 'EN_ATTENTE') { g.enAttenteCount++; g.enAttenteKg += kg }
          if (p.ticket?.statut === 'PAYÉ') { g.payeCount++; g.payeKg += kg; g.payeMontant += Number(p.ticket.montant ?? 0) }
        }
        setGroupedData([...map.values()].sort((a, b) => b.periode.localeCompare(a.periode)))
      })
      .catch(() => setGroupedError('Erreur de chargement'))
      .finally(() => setGroupedLoading(false))
  }, [activeTab, dateDebut, dateFin, debouncedSearch, statut, fournisseurId, reloadKey])

  // ── Export rapport Excel ──
  const handleExportReport = async () => {
    setIsExporting(true)
    try {
      const ExcelJS = (await import('exceljs')).default
      const wb = new ExcelJS.Workbook()
      wb.creator = 'Palme Ivoire Gestion'
      const tabLabel = activeTab === 'jour' ? 'Par Jour' : activeTab === 'semaine' ? 'Par Semaine' : 'Par Mois'
      const ws = wb.addWorksheet(`Rapport ${tabLabel}`, { views: [{ state: 'frozen', ySplit: 1 }] })

      const headers = ['Période', 'Total', 'Total (kg)', 'En attente', 'En attente (kg)', 'Payé', 'Payé (kg)', 'Montant payé (FCFA)']
      ws.columns = headers.map((h, i) => ({ header: h, key: String(i), width: i === 0 ? 22 : 16 }))

      ws.getRow(1).eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFCF1E25' } }
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 }
        cell.alignment = { vertical: 'middle', horizontal: 'center' }
      })
      ws.getRow(1).height = 22

      groupedData.forEach((row, idx) => {
        const r = ws.addRow([
          formatPeriodeLabel(row.periode), row.totalCount, row.totalKg,
          row.enAttenteCount, row.enAttenteKg, row.payeCount, row.payeKg, row.payeMontant,
        ])
        const bg = idx % 2 === 0 ? 'FFFFFFFF' : 'FFFFF5F5'
        r.eachCell({ includeEmpty: true }, (cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
          cell.font = { size: 9 }
          cell.alignment = { vertical: 'middle' }
        })
      })

      const buf = await wb.xlsx.writeBuffer()
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `rapport_paiements_${activeTab}_${new Date().toISOString().slice(0, 10)}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setIsExporting(false)
    }
  }

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
            <p className="mt-1 text-2xl font-bold text-yellow-600">{fmt(monthStats.enAttenteKg / 1000, 1)} T</p>
            <p className="text-xs text-muted-foreground">{monthStats.enAttenteCount} pesées</p>
          </div>
          <div className="rounded-lg border bg-card p-4 shadow-sm">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Payé</p>
            <p className="mt-1 text-2xl font-bold text-primary">{fmt(monthStats.payeKg / 1000, 1)} T</p>
            <p className="text-xs text-muted-foreground">{monthStats.payeCount} pesées</p>
            <p className="text-xs font-semibold text-primary">{fmt(monthStats.payeMontant, 0)} FCFA</p>
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
            placeholder="PS code, fournisseur, produit, code produit..."
            className="w-full rounded-md border bg-background py-2 pl-9 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex overflow-hidden rounded-md border text-sm">
          {(['TOUS', 'EN_ATTENTE', 'PAYÉ'] as StatutFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatut(s)}
              className={`px-3 py-2 font-medium transition-colors ${
                statut === s ? 'bg-primary text-white' : 'bg-background hover:bg-muted'
              }`}
            >
              {s === 'TOUS' ? 'Tous' : s === 'EN_ATTENTE' ? 'En attente' : 'Payé'}
            </button>
          ))}
        </div>

        {/* Fournisseur */}
        <select
          value={fournisseurId ?? ''}
          onChange={e => setFournisseurId(e.target.value ? Number(e.target.value) : undefined)}
          className="rounded-md border bg-background px-3 py-2 text-sm h-9 focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">Tous les fournisseurs</option>
          {fournisseurs.map(f => <option key={f.id} value={f.id}>{f.nom}</option>)}
        </select>

      </div>

      {/* Barre d'action flottante quand sélection */}
      {canCreatePayment && selected.size > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
          <span className="text-sm font-medium text-primary">
            {selected.size} pesée{selected.size > 1 ? 's' : ''} sélectionnée{selected.size > 1 ? 's' : ''} — {fmt(selectedKg / 1000, 2)} T
          </span>
          <div className="flex gap-2">
            <button onClick={() => setSelected(new Set())} className="rounded-md border px-3 py-1.5 text-sm hover:bg-white">
              Désélectionner
            </button>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 rounded-md bg-primary px-4 py-1.5 text-sm font-semibold text-white hover:bg-primary"
            >
              <CreditCard className="h-3.5 w-3.5" />
              Créer paiement
            </button>
          </div>
        </div>
      )}

      {error && <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {/* ── Onglets ── */}
      <div className="flex items-center justify-between border-b">
        <div className="flex">
          {([['tableau', 'Tableau'], ['jour', 'Par Jour'], ['semaine', 'Par Semaine'], ['mois', 'Par Mois']] as [ReportTab, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === key ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {activeTab !== 'tableau' && groupedData.length > 0 && (
          <button
            onClick={handleExportReport}
            disabled={isExporting}
            className="mb-1 inline-flex items-center gap-2 rounded-md border border-primary px-3 py-1.5 text-sm font-semibold text-primary hover:bg-primary/5 disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
            {isExporting ? 'Export...' : 'Exporter Excel'}
          </button>
        )}
      </div>

      {/* ── Vue groupée (Par Jour / Semaine / Mois) ── */}
      {activeTab !== 'tableau' && (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="bg-primary hover:bg-primary">
                {['Période', 'Total', 'Total (kg)', 'En attente', 'En attente (kg)', 'Payé', 'Payé (kg)', 'Montant payé (FCFA)'].map((h) => (
                  <TableHead key={h} className="whitespace-nowrap text-xs font-semibold text-white">{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {groupedLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-16" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : groupedError ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-12 text-center text-sm text-destructive">{groupedError}</TableCell>
                </TableRow>
              ) : groupedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-12 text-center text-muted-foreground">Aucune donnée pour {monthLabel}</TableCell>
                </TableRow>
              ) : (
                <>
                  {groupedData.map((row) => (
                    <TableRow key={row.periode} className="text-xs">
                      <TableCell className="font-medium">{formatPeriodeLabel(row.periode)}</TableCell>
                      <TableCell className="font-semibold">{row.totalCount}</TableCell>
                      <TableCell className="font-mono">{fmt(row.totalKg)}</TableCell>
                      <TableCell className="font-semibold text-yellow-600">{row.enAttenteCount}</TableCell>
                      <TableCell className="font-mono text-yellow-600">{fmt(row.enAttenteKg)}</TableCell>
                      <TableCell className="font-semibold text-primary">{row.payeCount}</TableCell>
                      <TableCell className="font-mono text-primary">{fmt(row.payeKg)}</TableCell>
                      <TableCell className="font-mono font-semibold text-primary">{fmt(row.payeMontant, 0)}</TableCell>
                    </TableRow>
                  ))}
                  {/* Ligne totaux */}
                  <TableRow className="text-xs bg-muted/50 font-bold border-t-2">
                    <TableCell className="font-bold">TOTAL</TableCell>
                    <TableCell className="font-bold">{groupedData.reduce((s, r) => s + r.totalCount, 0)}</TableCell>
                    <TableCell className="font-bold font-mono">{fmt(groupedData.reduce((s, r) => s + r.totalKg, 0))}</TableCell>
                    <TableCell className="font-bold text-yellow-600">{groupedData.reduce((s, r) => s + r.enAttenteCount, 0)}</TableCell>
                    <TableCell className="font-bold font-mono text-yellow-600">{fmt(groupedData.reduce((s, r) => s + r.enAttenteKg, 0))}</TableCell>
                    <TableCell className="font-bold text-primary">{groupedData.reduce((s, r) => s + r.payeCount, 0)}</TableCell>
                    <TableCell className="font-bold font-mono text-primary">{fmt(groupedData.reduce((s, r) => s + r.payeKg, 0))}</TableCell>
                    <TableCell className="font-bold font-mono text-primary">{fmt(groupedData.reduce((s, r) => s + r.payeMontant, 0), 0)}</TableCell>
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* ── Tableau détaillé ── */}
      {activeTab === 'tableau' && (
        <>
          <div className="overflow-x-auto rounded-lg border">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-primary hover:bg-primary">
                    {activeCols.map((col) => {
                      if (col === 'Sélection') {
                        return (
                          <TableHead key={col} className="w-8 text-center text-white">
                            {canCreatePayment && (
                              <input
                                type="checkbox"
                                checked={allSelected}
                                onChange={toggleAll}
                                className="accent-white cursor-pointer"
                                title="Sélectionner toutes les pesées en attente"
                              />
                            )}
                          </TableHead>
                        )
                      }
                      const isRight = ['Poids P1 (kg)', 'Poids P2 (kg)', 'Net (kg)', 'Prix/kg', 'Montant', 'Dernier prix'].includes(col)
                      return (
                        <TableHead
                          key={col}
                          className={`whitespace-nowrap text-xs font-semibold text-white ${isRight ? 'text-right' : ''}`}
                        >
                          {col}
                        </TableHead>
                      )
                    })}

                    {/* Sélecteur de colonnes */}
                    <TableHead className="w-8 bg-primary p-0 text-white">
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={<button className="flex h-full w-full items-center justify-center p-2 text-white opacity-70 hover:opacity-100 focus:outline-none" />}
                        >
                          <Columns2 className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52 max-h-[70vh] overflow-y-auto">
                          <div className="px-2 py-1.5 text-xs text-muted-foreground">
                            Afficher / masquer les colonnes
                          </div>
                          <DropdownMenuSeparator />
                          {ALL_COLS.filter(c => c !== 'Sélection').map((col) => (
                            <DropdownMenuItem
                              key={col}
                              onClick={() => toggleCol(col)}
                              closeOnClick={false}
                              className="flex items-center justify-between gap-3 text-sm"
                            >
                              <span className={FIXED_COLS.includes(col) ? 'text-muted-foreground' : ''}>
                                {col}
                              </span>
                              {visibleCols.has(col) && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {pesees.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={activeCols.length + 1} className="py-12 text-center text-muted-foreground">
                        Aucune pesée pour {monthLabel}
                      </TableCell>
                    </TableRow>
                  ) : (
                    pesees.map((p) => {
                      const isSelectable = p.ticket?.statut === 'EN_ATTENTE' && !!p.ticket?.id
                      const isSelected = selected.has(p.id)
                      const mv = p.mouvement ?? ''
                      const statutVal = p.ticket?.statut ?? 'EN_ATTENTE'

                      const raw = p.rawJson as RawJson | null
                      const p1 = splitDT(raw?.PS_DATEHEUREP1)
                      const p2 = splitDT(raw?.PS_DATEHEUREP2 ?? p.datePesee)
                      const annulee = raw?.PS_ANNULEE === 1
                      const fournisseurNomAffiche = p.fournisseur?.nom ?? raw?.PS_FOURNISSEUR ?? '—'
                      const fournisseurCodeAffiche = p.fournisseur?.codeGespont ?? raw?.FO_CODE ?? '—'

                      const cellMap: Record<ColName, React.ReactNode> = {
                        'Sélection': canCreatePayment && isSelectable ? (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleRow(p.id, isSelectable)}
                            onClick={(e) => e.stopPropagation()}
                            className="accent-primary cursor-pointer"
                          />
                        ) : (
                          <span className="block h-4 w-4 mx-auto" />
                        ),
                        'Date': <span className="whitespace-nowrap">{fmtDate(p.datePesee)}</span>,
                        'Fournisseur': (
                          <span className="whitespace-nowrap font-medium">{fournisseurNomAffiche}</span>
                        ),
                        'Code Fournisseur': (
                          <span className="font-mono text-muted-foreground">{fournisseurCodeAffiche}</span>
                        ),
                        'PP Code': <span className="font-mono text-muted-foreground">{p.numeroTicket ?? '—'}</span>,
                        'PS Code': <span className="font-mono text-muted-foreground">{p.gespontId}</span>,
                        'PR Code': <span className="font-mono text-muted-foreground">{p.prCode ?? raw?.PR_CODE ?? '—'}</span>,
                        'Site': <span className="whitespace-nowrap">{raw?.PS_SITE ?? '—'}</span>,
                        'Produit': <span className="whitespace-nowrap">{p.produit ?? '—'}</span>,
                        'Véhicule': <span className="font-mono">{p.vehicule ?? '—'}</span>,
                        'Mouvement': mv ? (
                          <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold ${MV_STYLE[mv] ?? 'bg-gray-100 text-gray-700'}`}>
                            {mv}
                          </span>
                        ) : <>{'—'}</>,
                        'Poids P1 (kg)': <span className="block text-right font-mono">{fmt(p.poidsBrut)}</span>,
                        'Poids P2 (kg)': <span className="block text-right font-mono">{fmt(p.tare)}</span>,
                        'Net (kg)': <span className="block text-right font-mono font-bold text-primary">{fmt(p.poidsNet)}</span>,
                        'Date P1': <span className="whitespace-nowrap">{p1.date}</span>,
                        'Heure P1': <span className="whitespace-nowrap">{p1.heure}</span>,
                        'Date P2': <span className="whitespace-nowrap">{p2.date}</span>,
                        'Heure P2': <span className="whitespace-nowrap">{p2.heure}</span>,
                        'Prix/kg': (
                          <span className="block text-right font-mono">
                            {p.ticket?.prixUnitaire ? fmt(p.ticket.prixUnitaire, 2) : '—'}
                          </span>
                        ),
                        'Montant': (
                          <span className="block text-right font-mono font-semibold">
                            {p.ticket?.montant ? fmt(p.ticket.montant, 0) : '—'}
                          </span>
                        ),
                        'Dernier prix': (
                          <span className="block text-right font-mono text-muted-foreground">
                            {p.dernierPrix ? fmt(p.dernierPrix, 2) : '—'}
                          </span>
                        ),
                        'Réf. paiement': (
                          <span className="font-mono text-muted-foreground">
                            {p.ticket?.paiement?.reference ?? '—'}
                          </span>
                        ),
                        'Mode paiement': (
                          <span>{p.ticket?.paiement?.modePaiement ?? '—'}</span>
                        ),
                        'Confirmé par': (
                          <span className="text-muted-foreground">
                            {p.ticket?.paiement?.createur?.nom ?? '—'}
                          </span>
                        ),
                        'Annulée': (
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${annulee ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                            {annulee ? 'Oui' : 'Non'}
                          </span>
                        ),
                        'Statut': p.ticket?.id ? (
                          <div className="flex flex-col gap-0.5" onClick={(e) => e.stopPropagation()}>
                            <StatutChanger
                              ticketId={p.ticket.id}
                              statut={statutVal}
                              allowedTransitions={transitions}
                              onChanged={reload}
                            />
                            {p.ticket?.statut === 'PAYÉ' && (
                              <span className="text-[10px] font-medium text-primary">
                                par {p.ticket?.paiement?.createur?.nom ?? '—'}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${STATUT_STYLE[statutVal] ?? 'bg-gray-100 text-gray-600'}`}>
                            {STATUT_LABEL[statutVal] ?? statutVal}
                          </span>
                        ),
                      }

                      return (
                        <TableRow
                          key={p.id}
                          onClick={() => canCreatePayment && toggleRow(p.id, isSelectable)}
                          className={`text-xs transition-colors ${
                            isSelectable ? 'cursor-pointer' : 'cursor-default'
                          } ${isSelected ? 'bg-primary/5 hover:bg-primary/5' : ''}`}
                        >
                          {activeCols.map((col) => (
                            <TableCell key={col}>{cellMap[col]}</TableCell>
                          ))}
                          <TableCell />
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
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
        </>
      )}
    </section>
  )
}
