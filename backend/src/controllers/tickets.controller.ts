import { Request, Response } from 'express';
import db from '../config/database.js';
import {
  ticketFiltersSchema,
  updateTicketStatusSchema,
  bulkValidateTicketsSchema,
} from '../utils/validator.js';

// Mappings des transitions autorisées
const allowedTransitions: Record<string, string[]> = {
  EN_ATTENTE: ['VALIDÉ'],
  VALIDÉ: ['PAYÉ', 'EN_ATTENTE'],
  PAYÉ: ['EN_ATTENTE'],
};

// GET /api/tickets — Liste paginée filtrable
export async function getTicketsController(req: Request, res: Response): Promise<void> {
  try {
    // Valider les query params
    const filters = ticketFiltersSchema.parse(req.query);
    const { page, limit, statut, fournisseurId } = filters;

    // Construire les conditions where
    const where: any = {};

    if (statut) {
      where.statut = statut;
    }

    if (fournisseurId) {
      where.pesee = {
        fournisseurId: fournisseurId,
      };
    }

    // Récupérer le total
    const total = await db.ticket.count({ where });

    // Récupérer les tickets
    const tickets = await db.ticket.findMany({
      where,
      include: {
        pesee: {
          include: {
            fournisseur: true,
          },
        },
        modificateur: {
          select: {
            id: true,
            email: true,
            nom: true,
          },
        },
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: {
        id: 'desc',
      },
    });

    res.json({
      data: tickets,
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

// PATCH /api/tickets/:id — Changer le statut
export async function updateTicketStatusController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;
    const ticketId = parseInt(id, 10);

    if (isNaN(ticketId)) {
      res.status(400).json({
        error: 'ID invalide',
      });
      return;
    }

    if (!req.user) {
      res.status(401).json({
        error: 'Non authentifié',
      });
      return;
    }

    // Valider les données
    const { statut: newStatut } = updateTicketStatusSchema.parse(req.body);

    // Récupérer le ticket actuel
    const ticket = await db.ticket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      res.status(404).json({
        error: 'Ticket non trouvé',
      });
      return;
    }

    // Vérifier la transition est autorisée
    const currentStatut = ticket.statut;
    const allowedNextStatuts = allowedTransitions[currentStatut];

    if (!allowedNextStatuts.includes(newStatut)) {
      res.status(409).json({
        error: 'Transition de statut invalide',
        details: `Il est impossible de passer de "${currentStatut}" à "${newStatut}". Transitions autorisées: ${allowedNextStatuts.join(', ') || 'aucune'}`,
        currentStatut,
        allowedTransitions: allowedNextStatuts,
      });
      return;
    }

    // Préparer les données de mise à jour
    const updateData: any = {
      statut: newStatut,
      modifiePar: req.user.id,
    };

    if (newStatut === 'VALIDÉ') {
      updateData.dateValidation = new Date();
    }

    // Correction d'erreur : remettre en attente efface le paiement lié
    if (newStatut === 'EN_ATTENTE') {
      updateData.paiementId = null;
      updateData.datePaiement = null;
      updateData.dateValidation = null;
    }

    // Mettre à jour le ticket
    const ticketMisAJour = await db.ticket.update({
      where: { id: ticketId },
      data: updateData,
      include: {
        pesee: {
          include: {
            fournisseur: true,
          },
        },
        modificateur: {
          select: {
            id: true,
            email: true,
            nom: true,
          },
        },
      },
    });

    res.json({
      message: `Statut du ticket changé de "${currentStatut}" à "${newStatut}"`,
      ticket: ticketMisAJour,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      res.status(400).json({
        error: 'Données invalides',
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

// PATCH /api/tickets/bulk-validate — Valider plusieurs tickets
export async function bulkValidateTicketsController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        error: 'Non authentifié',
      });
      return;
    }

    // Valider les données
    const { ticketIds } = bulkValidateTicketsSchema.parse(req.body);

    // Récupérer tous les tickets
    const tickets = await db.ticket.findMany({
      where: {
        id: {
          in: ticketIds,
        },
      },
    });

    // Vérifier que tous les tickets existent
    if (tickets.length !== ticketIds.length) {
      res.status(404).json({
        error: 'Certains tickets n\'ont pas été trouvés',
        idsNotFound: ticketIds.filter(
          (id) => !tickets.map((t) => t.id).includes(id)
        ),
      });
      return;
    }

    // Vérifier que tous les tickets peuvent être validés (statut EN_ATTENTE)
    const invalidTickets = tickets.filter((t) => t.statut !== 'EN_ATTENTE');

    if (invalidTickets.length > 0) {
      res.status(409).json({
        error: 'Certains tickets ne peuvent pas être validés',
        details: 'Seuls les tickets en "EN_ATTENTE" peuvent être validés',
        invalidTickets: invalidTickets.map((t) => ({
          id: t.id,
          statut: t.statut,
        })),
      });
      return;
    }

    // Transaction Prisma: tout passe ou rien ne passe
    const result = await db.$transaction(async (tx) => {
      const updatedTickets = await Promise.all(
        ticketIds.map((ticketId) =>
          tx.ticket.update({
            where: { id: ticketId },
            data: {
              statut: 'VALIDÉ',
              dateValidation: new Date(),
              modifiePar: req.user!.id,
              dateModification: new Date(),
            },
            include: {
              pesee: {
                include: {
                  fournisseur: true,
                },
              },
              modificateur: {
                select: {
                  id: true,
                  email: true,
                  nom: true,
                },
              },
            },
          })
        )
      );

      return updatedTickets;
    });

    res.json({
      message: `${result.length} ticket(s) validé(s) avec succès`,
      tickets: result,
      count: result.length,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      res.status(400).json({
        error: 'Données invalides',
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
