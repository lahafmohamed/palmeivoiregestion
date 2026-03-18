import React, { useEffect, useState } from 'react'
import { CalendarIcon, Check, Columns2, Download, RefreshCw } from 'lucide-react'
import { fr } from 'react-day-picker/locale'
import { usePesees } from '@/hooks/usePesees'
import type { PeseesParams } from '@/hooks/usePesees'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { api } from '@/lib/api'
import type { RawPeseeJson } from '@/types'

type Mouvement = 'TOUS' | 'ENTREE' | 'SORTIE'

const ALL_COLS = [
  '#', 'PP CODE', 'PS CODE', 'PR CODE', 'Site', 'Mouvement', 'Produit',
  'Fournisseur', 'Véhicule', 'Code Fournisseur',
  'Poids P1 (kg)', 'Poids P2 (kg)', 'Net (kg)',
  'Date P1', 'Heure P1', 'Date P2', 'Heure P2', 'Statut', 'Annulée',
] as const

type ColName = (typeof ALL_COLS)[number]

const FIXED_COLS: ColName[] = ['#']

function buildISO(date: Date, time: string) {
  const dateStr = date.toISOString().slice(0, 10)
  return `${dateStr}T${time}:00.000Z`
}

function DatePicker({ value, onChange }: { value: Date; onChange: (d: Date) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button className="inline-flex h-9 w-36 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        }
      >
        <CalendarIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        {value.toLocaleDateString('fr-FR')}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" side="bottom" align="start">
        <Calendar
          mode="single"
          selected={value}
          onSelect={(d) => { if (d) { onChange(d); setOpen(false) } }}
          locale={fr}
        />
      </PopoverContent>
    </Popover>
  )
}

function formatNum(val: number | string | null | undefined): string {
  if (val == null) return '—'
  const n = typeof val === 'string' ? parseFloat(val) : val
  return isNaN(n) ? '—' : n.toLocaleString('fr-FR')
}

function splitDT(iso?: string | null) {
  if (!iso) return { date: '—', heure: '—' }
  const d = new Date(iso)
  return {
    date: d.toLocaleDateString('fr-FR'),
    heure: d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
  }
}

const inputCls =
  'h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring'

export function Pesees() {
  const { data, isLoading, error, pagination, stats, refresh } = usePesees()

  const [startDate, setStartDate] = useState<Date>(new Date())
  const [startTime, setStartTime] = useState('00:00')
  const [endDate, setEndDate] = useState<Date>(new Date())
  const [endTime, setEndTime] = useState('23:59')
  const [mouvement, setMouvement] = useState<Mouvement>('TOUS')

  const handleMouvement = (m: Mouvement) => {
    setMouvement(m)
    setQuery((q) => ({
      ...q,
      page: 1,
      mouvement: m === 'TOUS' ? undefined : m,
    }))
  }

  const [visibleCols, setVisibleCols] = useState<Set<ColName>>(
    new Set<ColName>(['#', 'PS CODE', 'Mouvement', 'Produit', 'Fournisseur', 'Poids P1 (kg)', 'Poids P2 (kg)', 'Date P2', 'Heure P2', 'Statut'])
  )
  const toggleCol = (col: ColName) => {
    if (FIXED_COLS.includes(col)) return
    setVisibleCols((prev) => {
      const next = new Set(prev)
      next.has(col) ? next.delete(col) : next.add(col)
      return next
    })
  }
  const activeCols = ALL_COLS.filter((c) => visibleCols.has(c))

  const [query, setQuery] = useState<PeseesParams>({ page: 1, limit: 50 })

  useEffect(() => {
    refresh(query)
  }, [query, refresh])

  const handleRechercher = () => {
    setMouvement('TOUS')
    setQuery({ dateDebut: buildISO(startDate, startTime), dateFin: buildISO(endDate, endTime), page: 1, limit: 50 })
  }

  const handleEffacer = () => {
    setMouvement('TOUS')
    setStartDate(new Date())
    setStartTime('00:00')
    setEndDate(new Date())
    setEndTime('23:59')
    setQuery({ page: 1, limit: 50 })
  }

  const hasDateFilter = Boolean(query.dateDebut || query.dateFin)

  // ── Onglets groupés ──
  type Tab = 'tableau' | 'jour' | 'semaine' | 'mois'
  const [activeTab, setActiveTab] = useState<Tab>('tableau')

  interface GroupedRow {
    periode: string
    total: number
    entreesCount: number
    sortiesCount: number
    entreesKg: number
    sortiesKg: number
  }
  const [groupedData, setGroupedData] = useState<GroupedRow[]>([])
  const [groupedLoading, setGroupedLoading] = useState(false)
  const [groupedError, setGroupedError] = useState<string | null>(null)

  useEffect(() => {
    if (activeTab === 'tableau') return
    const by = activeTab === 'jour' ? 'day' : activeTab === 'semaine' ? 'week' : 'month'
    setGroupedLoading(true)
    setGroupedError(null)
    const params = new URLSearchParams({ by })
    if (query.dateDebut) params.set('dateDebut', query.dateDebut)
    if (query.dateFin) params.set('dateFin', query.dateFin)
    api.get<GroupedRow[]>(`/pesees/grouped?${params}`)
      .then((r) => setGroupedData(r.data))
      .catch((e) => { setGroupedError(e?.message ?? 'Erreur'); setGroupedData([]) })
      .finally(() => setGroupedLoading(false))
  }, [activeTab, query.dateDebut, query.dateFin])

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

  const [isSyncing, setIsSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)
  const handleSync = async () => {
    if (isSyncing) return
    setIsSyncing(true)
    setSyncMsg(null)
    try {
      const res = await api.post<{ stats: { inserted: number } }>('/admin/sync')
      setSyncMsg(`${res.data.stats.inserted} nouvelles pesées`)
      refresh(query)
    } catch {
      setSyncMsg('Erreur sync')
    } finally {
      setIsSyncing(false)
      setTimeout(() => setSyncMsg(null), 4000)
    }
  }

  const filteredData = data


  const COL_WIDTHS: Partial<Record<ColName, number>> = {
    '#': 5, 'PP CODE': 14, 'PS CODE': 14, 'PR CODE': 10, 'Site': 22,
    'Mouvement': 12, 'Produit': 28, 'Fournisseur': 28, 'Véhicule': 12,
    'Code Fournisseur': 16, 'Poids P1 (kg)': 14, 'Poids P2 (kg)': 14,
    'Net (kg)': 12, 'Date P1': 12, 'Heure P1': 10, 'Date P2': 12, 'Heure P2': 10, 'Statut': 14, 'Annulée': 8,
  }

  const [isExporting, setIsExporting] = useState(false)

  const handleExportExcel = async () => {
    setIsExporting(true)
    try {
      const ExcelJS = (await import('exceljs')).default
      const wb = new ExcelJS.Workbook()
      wb.creator = 'Palme Ivoire Gestion'
      wb.created = new Date()

      const ws = wb.addWorksheet('Pesées', { views: [{ state: 'frozen', ySplit: 1 }] })

      ws.columns = activeCols.map((col) => ({
        header: col,
        key: col,
        width: COL_WIDTHS[col] ?? 12,
      }))

      // Style entête verte
      ws.getRow(1).eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF166534' } }
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 }
        cell.alignment = { vertical: 'middle', horizontal: 'center' }
        cell.border = { bottom: { style: 'medium', color: { argb: 'FF14532D' } } }
      })
      ws.getRow(1).height = 22

      // Lignes de données
      filteredData.forEach((p, idx) => {
        const raw = p.rawJson as RawPeseeJson | null
        const p1 = splitDT(raw?.PS_DATEHEUREP1)
        const p2 = splitDT(raw?.PS_DATEHEUREP2 ?? p.datePesee)
        const mv = p.mouvement || raw?.PS_MOUVEMENT || ''

        const vals: Record<ColName, string | number> = {
          '#': idx + 1 + (pagination.page - 1) * (query.limit ?? 50),
          'PP CODE': p.numeroTicket ?? '',
          'PS CODE': p.gespontId,
          'PR CODE': p.prCode ?? raw?.PR_CODE ?? '',
          'Site': raw?.PS_SITE ?? '',
          'Mouvement': mv,
          'Produit': p.produit ?? '',
          'Fournisseur': p.fournisseur?.nom ?? raw?.PS_FOURNISSEUR ?? '',
          'Véhicule': p.vehicule ?? '',
          'Code Fournisseur': p.fournisseur?.codeGespont ?? raw?.FO_CODE ?? '',
          'Poids P1 (kg)': p.poidsBrut != null ? Number(p.poidsBrut) : '',
          'Poids P2 (kg)': p.tare != null ? Number(p.tare) : '',
          'Net (kg)': p.poidsNet != null ? Number(p.poidsNet) : '',
          'Date P1': p1.date, 'Heure P1': p1.heure,
          'Date P2': p2.date, 'Heure P2': p2.heure,
          'Statut': p.ticket?.statut ?? 'EN_ATTENTE',
          'Annulée': raw?.PS_ANNULEE ? 'Oui' : 'Non',
        }

        const row = ws.addRow(activeCols.map((c) => vals[c]))
        row.height = 16

        // Couleur de fond alternée
        const bg = idx % 2 === 0 ? 'FFFFFFFF' : 'FFF0FDF4'
        row.eachCell({ includeEmpty: true }, (cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
          cell.font = { size: 9 }
          cell.alignment = { vertical: 'middle' }
          cell.border = { bottom: { style: 'hair', color: { argb: 'FFE5E7EB' } } }
        })

        // Badge mouvement coloré
        const mvIdx = activeCols.indexOf('Mouvement')
        if (mvIdx >= 0) {
          const c = row.getCell(mvIdx + 1)
          const color = mv === 'ENTREE' ? 'FF166534' : mv === 'SORTIE' ? 'FFF97316' : 'FFDC2626'
          c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } }
          c.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9 }
          c.alignment = { horizontal: 'center', vertical: 'middle' }
        }

        // Nombre centré pour les poids
        ;(['Poids P1 (kg)', 'Poids P2 (kg)', 'Net (kg)'] as ColName[]).forEach((col) => {
          const ci = activeCols.indexOf(col)
          if (ci >= 0) {
            row.getCell(ci + 1).alignment = { horizontal: 'right', vertical: 'middle' }
            row.getCell(ci + 1).numFmt = '#,##0'
          }
        })
      })

      const buf = await wb.xlsx.writeBuffer()
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `pesees_${new Date().toISOString().slice(0, 10)}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <section className="space-y-4">
      {/* ── Barre de filtres ── */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Date P2 — Début</span>
          <DatePicker value={startDate} onChange={setStartDate} />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Heure P2 — Début</span>
          <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={inputCls} />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Date P2 — Fin</span>
          <DatePicker value={endDate} onChange={setEndDate} />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Heure P2 — Fin</span>
          <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={inputCls} />
        </div>

        <button
          onClick={handleRechercher}
          disabled={isLoading}
          className="inline-flex h-9 items-center gap-2 rounded-md bg-green-800 px-4 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
        >
          {isLoading && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
          Rechercher
        </button>

        {hasDateFilter && (
          <button
            onClick={handleEffacer}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-input px-4 text-sm text-muted-foreground hover:bg-muted"
          >
            Effacer
          </button>
        )}

        <div className="flex overflow-hidden rounded-md border">
          {(['TOUS', 'ENTREE', 'SORTIE'] as Mouvement[]).map((m) => (
            <button
              key={m}
              onClick={() => handleMouvement(m)}
              className={`px-3 py-2 text-sm font-medium transition-colors ${
                mouvement === m ? 'bg-green-800 text-white' : 'bg-background text-foreground hover:bg-muted'
              }`}
            >
              {m === 'TOUS' ? 'Tous' : m === 'ENTREE' ? 'Entrées' : 'Sorties'}
            </button>
          ))}
        </div>

        <button
          onClick={handleExportExcel}
          disabled={filteredData.length === 0 || isExporting}
          className="inline-flex h-9 items-center gap-2 rounded-md border border-green-800 px-4 text-sm font-semibold text-green-800 hover:bg-green-50 disabled:opacity-50"
        >
          <Download className="h-3.5 w-3.5" />
          {isExporting ? 'Export...' : 'Exporter Excel'}
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-input px-4 text-sm font-medium text-muted-foreground hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Sync...' : 'Sync GESpont'}
          </button>
          {syncMsg && <span className="text-xs text-muted-foreground">{syncMsg}</span>}
        </div>
      </div>

      {/* ── Badge résultats ── */}
      {!isLoading && !error && (
        <span className="inline-flex items-center rounded-full bg-green-800 px-3 py-1 text-xs font-semibold text-white">
          {pagination.total} pesée(s) trouvée(s)
        </span>
      )}

      {/* ── Cartes stats (uniquement si filtre date actif) ── */}
      {!isLoading && !error && data.length > 0 && hasDateFilter && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border bg-background p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Total pesées</p>
            <p className="mt-1 text-2xl font-bold">{pagination.total}</p>
          </div>
          <div className="rounded-lg border bg-background p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Entrées ({stats.entreesCount})</p>
            <p className="mt-1 text-2xl font-bold text-green-800">{formatNum(stats.entreesKg)} kg</p>
          </div>
          <div className="rounded-lg border bg-background p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Sorties ({stats.sortiesCount})</p>
            <p className="mt-1 text-2xl font-bold text-red-500">{formatNum(stats.sortiesKg)} kg</p>
          </div>
        </div>
      )}

      {/* ── Onglets ── */}
      <div className="flex border-b">
        {([['tableau', 'Tableau'], ['jour', 'Par Jour'], ['semaine', 'Par Semaine'], ['mois', 'Par Mois']] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === key ? 'border-b-2 border-green-800 text-green-800' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Vue groupée (Par Jour / Semaine / Mois) ── */}
      {activeTab !== 'tableau' && (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="bg-green-800 hover:bg-green-800">
                {['Période', 'Total', 'Entrées', 'Sorties', 'Tonnage Entrées (kg)', 'Tonnage Sorties (kg)'].map((h) => (
                  <TableHead key={h} className="whitespace-nowrap text-xs font-semibold text-white">{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {groupedLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : groupedError ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-12 text-center text-sm text-destructive">{groupedError}</TableCell>
                </TableRow>
              ) : groupedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">Aucune donnée</TableCell>
                </TableRow>
              ) : (
                groupedData.map((row) => (
                  <TableRow key={row.periode} className="text-xs">
                    <TableCell className="font-medium">{formatPeriodeLabel(row.periode)}</TableCell>
                    <TableCell>{row.total}</TableCell>
                    <TableCell className="font-semibold text-green-700">{row.entreesCount}</TableCell>
                    <TableCell className="font-semibold text-orange-500">{row.sortiesCount}</TableCell>
                    <TableCell className="font-semibold text-green-800">{formatNum(row.entreesKg)} kg</TableCell>
                    <TableCell className="font-semibold text-orange-500">{formatNum(row.sortiesKg)} kg</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* ── Tableau détaillé ── */}
      {activeTab === 'tableau' && <div className="overflow-x-auto rounded-lg border">
        {error ? (
          <div className="px-6 py-10 text-center text-sm text-destructive">{error}</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-green-800 hover:bg-green-800">
                {activeCols.map((col) => (
                  <TableHead
                    key={col}
                    className={`whitespace-nowrap text-xs font-semibold text-white ${
                      ['Poids P1 (kg)', 'Poids P2 (kg)', 'Net (kg)'].includes(col) ? 'text-center' : ''
                    }`}
                  >
                    {col}
                  </TableHead>
                ))}

                {/* ── Sélecteur de colonnes style Odoo ── */}
                <TableHead className="w-8 bg-green-800 p-0 text-white">
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
                      {ALL_COLS.map((col) => (
                        <DropdownMenuItem
                          key={col}
                          onClick={() => toggleCol(col)}
                          closeOnClick={false}
                          className="flex items-center justify-between gap-3 text-sm"
                        >
                          <span className={FIXED_COLS.includes(col) ? 'text-muted-foreground' : ''}>
                            {col}
                          </span>
                          {visibleCols.has(col) && <Check className="h-3.5 w-3.5 shrink-0 text-green-700" />}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    {activeCols.map((col) => (
                      <TableCell key={col}>
                        <Skeleton className="h-4 w-16" />
                      </TableCell>
                    ))}
                    <TableCell />
                  </TableRow>
                ))
              ) : filteredData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={activeCols.length + 1} className="py-12 text-center text-muted-foreground">
                    Aucune pesée trouvée
                  </TableCell>
                </TableRow>
              ) : (
                filteredData.map((pesee, idx) => {
                  const raw = pesee.rawJson as RawPeseeJson | null
                  const p1 = splitDT(raw?.PS_DATEHEUREP1)
                  const p2 = splitDT(raw?.PS_DATEHEUREP2 ?? pesee.datePesee)
                  const mv = raw?.PS_MOUVEMENT ?? ''
                  const annulee = raw?.PS_ANNULEE === 1

                  const cellMap: Record<ColName, React.ReactNode> = {
                    '#': <span className="text-muted-foreground">{idx + 1 + (pagination.page - 1) * (query.limit ?? 50)}</span>,
                    'PP CODE': <span className="font-mono">{pesee.numeroTicket ?? '—'}</span>,
                    'PS CODE': <span className="font-mono">{pesee.gespontId}</span>,
                    'PR CODE': <span className="font-mono">{pesee.prCode ?? raw?.PR_CODE ?? '—'}</span>,
                    'Site': <span className="whitespace-nowrap">{raw?.PS_SITE ?? '—'}</span>,
                    'Mouvement': (pesee.mouvement || mv) ? (
                      <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold ${
                        (pesee.mouvement || mv) === 'ENTREE' ? 'bg-green-800 text-white' :
                        (pesee.mouvement || mv) === 'SORTIE' ? 'bg-orange-500 text-white' :
                        'bg-red-600 text-white'
                      }`}>
                        {pesee.mouvement || mv}
                      </span>
                    ) : '—',
                    'Produit': <span className="whitespace-nowrap">{pesee.produit ?? '—'}</span>,
                    'Fournisseur': <span className="whitespace-nowrap">{pesee.fournisseur?.nom ?? raw?.PS_FOURNISSEUR ?? '—'}</span>,
                    'Véhicule': <span className="font-mono">{pesee.vehicule ?? '—'}</span>,
                    'Code Fournisseur': <>{pesee.fournisseur?.codeGespont ?? raw?.FO_CODE ?? '—'}</>,
                    'Poids P1 (kg)': <span className="block text-center">{formatNum(pesee.poidsBrut)}</span>,
                    'Poids P2 (kg)': <span className="block text-center">{formatNum(pesee.tare)}</span>,
                    'Net (kg)': <span className="block text-center font-bold text-green-800">{formatNum(pesee.poidsNet)}</span>,
                    'Date P1': <span className="whitespace-nowrap">{p1.date}</span>,
                    'Heure P1': <span className="whitespace-nowrap">{p1.heure}</span>,
                    'Date P2': <span className="whitespace-nowrap">{p2.date}</span>,
                    'Heure P2': <span className="whitespace-nowrap">{p2.heure}</span>,
                    'Statut': (() => {
                      const statut = pesee.ticket?.statut ?? 'EN_ATTENTE'
                      const map: Record<string, string> = {
                        EN_ATTENTE: 'bg-yellow-100 text-yellow-800',
                        VALIDÉ: 'bg-blue-100 text-blue-800',
                        PAYÉ: 'bg-green-100 text-green-800',
                      }
                      return (
                        <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${map[statut] ?? 'bg-gray-100 text-gray-600'}`}>
                          {statut.replace('_', ' ')}
                        </span>
                      )
                    })(),
                    'Annulée': (
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${annulee ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                        {annulee ? 'Oui' : 'Non'}
                      </span>
                    ),
                  }

                  return (
                    <TableRow key={pesee.id} className="text-xs">
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
      </div>}

      {/* ── Pagination ── */}
      {activeTab === 'tableau' && pagination.pages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Page {pagination.page} / {pagination.pages} — {pagination.total} résultats</span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1 || isLoading}
              onClick={() => setQuery((q) => ({ ...q, page: Math.max(1, (q.page ?? 1) - 1) }))}
            >
              Précédent
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.pages || isLoading}
              onClick={() => setQuery((q) => ({ ...q, page: Math.min(pagination.pages, (q.page ?? 1) + 1) }))}
            >
              Suivant
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}
