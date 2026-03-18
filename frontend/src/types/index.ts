export type StatutTicket = 'EN_ATTENTE' | 'VALIDÉ' | 'PAYÉ'
export type ModePaiement = 'VIREMENT' | 'ESPÈCES' | 'CHÈQUE' | 'AUTRE'
export type RoleUtilisateur = 'ADMIN' | 'SUPERVISEUR' | 'OPERATEUR'

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
  stats?: {
    entreesCount: number
    entreesKg: number
    sortiesCount: number
    sortiesKg: number
  }
}

export interface RawPeseeJson {
  FO_CODE?: string
  PP_CODE?: string
  PR_CODE?: string
  PS_CODE?: string
  PS_SITE?: string
  ST_CODE?: string
  VE_CODE?: string
  PS_ANNULEE?: number
  PS_POIDSP1?: number
  PS_POIDSP2?: number
  PS_PRODUIT?: string
  PS_MOUVEMENT?: string
  PS_TOTAL_TARE?: number
  PS_DATEHEUREP1?: string
  PS_DATEHEUREP2?: string
  PS_FOURNISSEUR?: string
}

export interface FournisseurStats {
  totalPesees: number
  montantEnAttente: number
  montantPaye: number
  montantTotal: number
}

export interface Fournisseur {
  id: number
  codeGespont: string
  nom: string
  contact?: string | null
  adresse?: string | null
  actif: boolean
  createdAt: string
  updatedAt: string
  stats?: FournisseurStats
}

export interface Ticket {
  id: number
  peseeId: number
  statut: StatutTicket
  montant?: number | string | null
  prixUnitaire?: number | string | null
  dateValidation?: string | null
  datePaiement?: string | null
  paiementId?: number | null
  notes?: string | null
  modifiePar?: number | null
}

export interface Pesee {
  id: number
  gespontId: string
  numeroTicket?: string | null
  fournisseurId: number
  produit?: string | null
  poidsBrut: number | string
  tare: number | string
  poidsNet: number | string
  datePesee: string
  vehicule?: string | null
  mouvement?: string | null
  prCode?: string | null
  rawJson?: RawPeseeJson | null
  syncedAt: string
  fournisseur?: Fournisseur
  ticket?: Ticket
}

export interface Paiement {
  id: number
  fournisseurId: number
  montantTotal: number
  datePaiement: string
  modePaiement: ModePaiement
  reference: string
  creePar: number
  createdAt: string
}

export interface User {
  id: number
  nom: string
  email: string
  role: RoleUtilisateur
  actif?: boolean
  createdAt?: string
}
