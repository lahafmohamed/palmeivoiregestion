import { Request, Response } from 'express';
import db from '../config/database.js';
import {
  createPaiementSchema,
  paiementFiltersSchema,
} from '../utils/validator.js';

// POST /api/paiements — Créer un paiement groupé (transaction)
export async function createPaiementController(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        error: 'Non authentifié',
      });
      return;
    }

    // Valider les données
    const { ticketIds, modePaiement, reference } = createPaiementSchema.parse(req.body);

    // Transaction Prisma: tout passe ou rien ne passe
    const result = await db.$transaction(async (tx) => {
      // 1. Récupérer tous les tickets avec leurs pesées
      const tickets = await tx.ticket.findMany({
        where: {
          id: {
            in: ticketIds,
          },
        },
        include: {
          pesee: {
            include: {
              fournisseur: true,
            },
          },
        },
      });

      // Vérifier que tous les tickets existent
      if (tickets.length !== ticketIds.length) {
        throw new Error(
          `Certains tickets n'ont pas été trouvés. ${ticketIds.length} attendus, ${tickets.length} trouvés.`
        );
      }

      // 2. Vérifier qu'aucun ticket n'est déjà PAYÉ
      const invalidTickets = tickets.filter(
        (t) => t.statut === 'PAYÉ'
      );

      if (invalidTickets.length > 0) {
        throw new Error(
          `${invalidTickets.length} ticket(s) sont déjà payés.`
        );
      }

      // Auto-valider les tickets EN_ATTENTE avant paiement
      const toValidate = tickets.filter((t) => t.statut === 'EN_ATTENTE');
      if (toValidate.length > 0) {
        await tx.ticket.updateMany({
          where: { id: { in: toValidate.map((t) => t.id) } },
          data: { statut: 'VALIDÉ', dateValidation: new Date(), modifiePar: req.user!.id },
        });
      }

      // 3. Vérifier que tous les tickets appartiennent au même fournisseur
      const fournisseurIds = new Set(tickets.map((t) => t.pesee.fournisseurId));

      if (fournisseurIds.size > 1) {
        throw new Error(
          'Les tickets proviennent de fournisseurs différents. Impossible de créer un paiement groupé.'
        );
      }

      const fournisseurId = Array.from(fournisseurIds)[0];

      // 4. Calculer le montant total (en tonnes = poidsNet / 1000)
      const montantTotal = tickets.reduce((sum, ticket) => {
        const poidsNetEnTonnes = Number(ticket.pesee.poidsNet) / 1000;
        return sum + poidsNetEnTonnes;
      }, 0);

      // 5. Vérifier l'unicité de la référence
      const existingRef = await tx.paiement.findUnique({
        where: { reference },
      });

      if (existingRef) {
        throw new Error(`Un paiement avec la référence "${reference}" existe déjà.`);
      }

      // 6. Créer le paiement
      const paiement = await tx.paiement.create({
        data: {
          fournisseurId,
          montantTotal: montantTotal.toString(),
          datePaiement: new Date(),
          modePaiement,
          reference,
          creePar: req.user!.id,
        },
      });

      // 7. Mettre à jour tous les tickets en PAYÉ
      await tx.ticket.updateMany({
        where: {
          id: {
            in: ticketIds,
          },
        },
        data: {
          statut: 'PAYÉ',
          paiementId: paiement.id,
          datePaiement: new Date(),
          modifiePar: req.user!.id,
        },
      });

      // Retourner le paiement créé avec les tickets
      const paiementComplet = await tx.paiement.findUnique({
        where: { id: paiement.id },
        include: {
          fournisseur: true,
          createur: {
            select: {
              id: true,
              email: true,
              nom: true,
            },
          },
          tickets: {
            include: {
              pesee: true,
            },
          },
        },
      });

      return paiementComplet;
    });

    res.status(201).json({
      message: `Paiement créé avec succès. ${ticketIds.length} ticket(s) marqué(s) comme payé(s).`,
      paiement: result,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      res.status(400).json({
        error: 'Données invalides',
        details: error.message,
      });
    } else {
      const message = error instanceof Error ? error.message : 'Erreur inconnue';
      res.status(400).json({
        error: 'Erreur lors de la création du paiement',
        details: message,
      });
    }
  }
}

// GET /api/paiements — Liste paginée avec filtres
export async function getPaiementsController(req: Request, res: Response): Promise<void> {
  try {
    // Valider les query params
    const filters = paiementFiltersSchema.parse(req.query);
    const { page, limit, fournisseurId, dateDebut, dateFin, search } = filters;

    // Construire les conditions where
    const where: any = {};

    if (fournisseurId) {
      where.fournisseurId = fournisseurId;
    }

    if (dateDebut || dateFin) {
      where.datePaiement = {};
      if (dateDebut) where.datePaiement.gte = new Date(dateDebut);
      if (dateFin)   where.datePaiement.lte = new Date(dateFin);
    }

    if (search) {
      where.fournisseur = {
        OR: [
          { nom: { contains: search, mode: 'insensitive' } },
          { codeGespont: { contains: search, mode: 'insensitive' } },
        ],
      };
    }

    // Récupérer le total
    const total = await db.paiement.count({ where });

    // Récupérer les paiements
    const paiements = await db.paiement.findMany({
      where,
      include: {
        fournisseur: true,
        createur: {
          select: {
            id: true,
            email: true,
            nom: true,
          },
        },
        tickets: {
          select: {
            id: true,
            statut: true,
          },
        },
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: {
        datePaiement: 'desc',
      },
    });

    res.json({
      data: paiements,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      res.status(400).json({
        error: 'Paramètres invalides',
        details: error.message,
      });
    } else {
      res.status(500).json({
        error: 'Erreur serveur',
        details: error instanceof Error ? error.message : 'Erreur inconnue',
      });
    }
  }
}

// GET /api/paiements/:id — Détail avec les tickets couverts
export async function getPaiementByIdController(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const paiementId = parseInt(id, 10);

    if (isNaN(paiementId)) {
      res.status(400).json({
        error: 'ID invalide',
      });
      return;
    }

    const paiement = await db.paiement.findUnique({
      where: { id: paiementId },
      include: {
        fournisseur: true,
        createur: {
          select: {
            id: true,
            email: true,
            nom: true,
          },
        },
        tickets: {
          include: {
            pesee: {
              select: {
                id: true,
                numeroTicket: true,
                produit: true,
                poidsNet: true,
              },
            },
          },
        },
      },
    });

    if (!paiement) {
      res.status(404).json({
        error: 'Paiement non trouvé',
      });
      return;
    }

    res.json({
      ...paiement,
      stats: {
        nbTickets: paiement.tickets.length,
        montantTotal: Number(paiement.montantTotal),
        poidsNetTotal: paiement.tickets.reduce(
          (sum, ticket) => sum + Number(ticket.pesee.poidsNet) / 1000,
          0
        ),
      },
    });
  } catch (error) {
    res.status(500).json({
      error: 'Erreur serveur',
      details: error instanceof Error ? error.message : 'Erreur inconnue',
    });
  }
}
