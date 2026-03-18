import { z } from 'zod';

// ──── Authentification ────

// Schémas pour l'authentification
export const loginSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(1, 'Le mot de passe est requis'),
});

export const registerSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères'),
  nom: z.string().min(2, 'Le nom doit contenir au moins 2 caractères'),
  role: z.enum(['ADMIN', 'SUPERVISEUR', 'OPERATEUR']).default('OPERATEUR'),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;

// ──── Pesées ────

export const peseeFiltersSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  fournisseurId: z.coerce.number().int().optional(),
  produit: z.string().optional(),
  statut: z.enum(['EN_ATTENTE', 'VALIDÉ', 'PAYÉ', 'REJETÉ']).optional(),
  dateDebut: z.string().datetime().optional(),
  dateFin: z.string().datetime().optional(),
  search: z.string().optional(),
  mouvement: z.enum(['ENTREE', 'SORTIE', 'REJET']).optional(),
});

export type PeseeFiltersInput = z.infer<typeof peseeFiltersSchema>;

// ──── Fournisseurs ────

export const updateFournisseurSchema = z.object({
  nom: z.string().min(2, 'Le nom doit contenir au moins 2 caractères').optional(),
  contact: z.string().optional(),
  adresse: z.string().optional(),
  actif: z.boolean().optional(),
});

export type UpdateFournisseurInput = z.infer<typeof updateFournisseurSchema>;

// ──── Tickets ────

export const ticketFiltersSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(500).default(20),
  statut: z.enum(['EN_ATTENTE', 'VALIDÉ', 'PAYÉ', 'REJETÉ']).optional(),
  fournisseurId: z.coerce.number().int().optional(),
});

export type TicketFiltersInput = z.infer<typeof ticketFiltersSchema>;

export const updateTicketStatusSchema = z.object({
  statut: z.enum(['EN_ATTENTE', 'VALIDÉ', 'PAYÉ', 'REJETÉ']),
});

export type UpdateTicketStatusInput = z.infer<typeof updateTicketStatusSchema>;

export const bulkValidateTicketsSchema = z.object({
  ticketIds: z.array(z.number().int().positive()).min(1, 'Au moins un ticket est requis'),
});

export type BulkValidateTicketsInput = z.infer<typeof bulkValidateTicketsSchema>;

// ──── Paiements ────

export const createPaiementSchema = z.object({
  ticketIds: z.array(z.number().int().positive()).min(1, 'Au moins un ticket est requis'),
  modePaiement: z.enum(['VIREMENT', 'ESPÈCES', 'CHÈQUE', 'AUTRE']),
  reference: z.string().min(1, 'La référence est requise').max(100),
});

export type CreatePaiementInput = z.infer<typeof createPaiementSchema>;

export const paiementFiltersSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
  fournisseurId: z.coerce.number().int().optional(),
  dateDebut: z.string().datetime().optional(),
  dateFin: z.string().datetime().optional(),
  search: z.string().optional(),
});

export type PaiementFiltersInput = z.infer<typeof paiementFiltersSchema>;
