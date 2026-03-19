import { Request, Response } from 'express';
import db from '../config/database.js';
import { updateFournisseurSchema } from '../utils/validator.js';

const RESTRICTED_FOURNISSEUR_CODE = '03';
const RESTRICTED_FOURNISSEUR_NAME = 'NASRALLAH';

// GET /api/fournisseurs — Liste avec stats
export async function getFournisseursController(req: Request, res: Response): Promise<void> {
  try {
    const isAdmin = req.user?.role === 'ADMIN';
    const fournisseursWhere = isAdmin
      ? undefined
      : {
          NOT: {
            OR: [
              { codeGespont: RESTRICTED_FOURNISSEUR_CODE },
              { nom: { equals: RESTRICTED_FOURNISSEUR_NAME, mode: 'insensitive' as const } },
            ],
          },
        };

    const [fournisseurs, peseeStats] = await Promise.all([
      db.fournisseur.findMany({
        where: fournisseursWhere,
        orderBy: { nom: 'asc' },
        select: { id: true, nom: true, codeGespont: true, contact: true, adresse: true, actif: true, createdAt: true },
      }),
      // Fetch léger : seulement les champs nécessaires pour les stats
      db.pesee.findMany({
        select: {
          fournisseurId: true,
          poidsNet: true,
          ticket: { select: { statut: true } },
        },
      }),
    ]);

    // Grouper les stats par fournisseur en JS
    const statsMap = new Map<number, { totalPesees: number; montantEnAttente: number; montantPaye: number }>();
    for (const pesee of peseeStats) {
      if (!statsMap.has(pesee.fournisseurId)) {
        statsMap.set(pesee.fournisseurId, { totalPesees: 0, montantEnAttente: 0, montantPaye: 0 });
      }
      const s = statsMap.get(pesee.fournisseurId)!;
      s.totalPesees++;
      const kg = Number(pesee.poidsNet) / 1000;
      if (pesee.ticket?.statut === 'EN_ATTENTE') s.montantEnAttente += kg;
      else if (pesee.ticket?.statut === 'PAYÉ') s.montantPaye += kg;
    }

    res.json(fournisseurs.map((f) => {
      const s = statsMap.get(f.id) ?? { totalPesees: 0, montantEnAttente: 0, montantPaye: 0 };
      return {
        ...f,
        stats: {
          totalPesees: s.totalPesees,
          montantEnAttente: parseFloat(s.montantEnAttente.toFixed(2)),
          montantPaye: parseFloat(s.montantPaye.toFixed(2)),
          montantTotal: parseFloat((s.montantEnAttente + s.montantPaye).toFixed(2)),
        },
      };
    }));
  } catch (error) {
    res.status(500).json({
      error: 'Erreur serveur',
      details: error instanceof Error ? error.message : 'Erreur inconnue',
    });
  }
}

// GET /api/fournisseurs/:id — Détail d'un fournisseur
export async function getFournisseurByIdController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;
    const fournisseurId = parseInt(id, 10);

    if (isNaN(fournisseurId)) {
      res.status(400).json({
        error: 'ID invalide',
      });
      return;
    }

    const fournisseur = await db.fournisseur.findUnique({
      where: { id: fournisseurId },
      include: {
        pesees: {
          include: {
            ticket: true,
          },
          orderBy: {
            datePesee: 'desc',
          },
          take: 20, // Dernières 20 pesées
        },
      },
    });

    if (!fournisseur) {
      res.status(404).json({
        error: 'Fournisseur non trouvé',
      });
      return;
    }

    // Récupérer les paiements liés
    const paiements = await db.paiement.findMany({
      where: {
        fournisseurId,
      },
      include: {
        tickets: {
          include: {
            pesee: true,
          },
        },
      },
      orderBy: {
        datePaiement: 'desc',
      },
      take: 20, // Derniers 20 paiements
    });

    // Calculer les stats
    let montantEnAttente = 0;
    let montantPaye = 0;

    fournisseur.pesees.forEach((pesee) => {
      if (pesee.ticket) {
        const montant = Number(pesee.poidsNet) / 1000;
        if (pesee.ticket.statut === 'EN_ATTENTE') {
          montantEnAttente += montant;
        } else if (pesee.ticket.statut === 'PAYÉ') {
          montantPaye += montant;
        }
      }
    });

    res.json({
      fournisseur: {
        ...fournisseur,
        stats: {
          totalPesees: fournisseur.pesees.length,
          montantEnAttente: parseFloat(montantEnAttente.toFixed(2)),
          montantPaye: parseFloat(montantPaye.toFixed(2)),
        },
      },
      peseesRecentes: fournisseur.pesees,
      paiementsRecents: paiements,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Erreur serveur',
      details: error instanceof Error ? error.message : 'Erreur inconnue',
    });
  }
}

// PATCH /api/fournisseurs/:id — Modifier un fournisseur
export async function updateFournisseurController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;
    const fournisseurId = parseInt(id, 10);

    if (isNaN(fournisseurId)) {
      res.status(400).json({
        error: 'ID invalide',
      });
      return;
    }

    // Valider les données
    const updates = updateFournisseurSchema.parse(req.body);

    // Vérifier que le fournisseur existe
    const fournisseur = await db.fournisseur.findUnique({
      where: { id: fournisseurId },
    });

    if (!fournisseur) {
      res.status(404).json({
        error: 'Fournisseur non trouvé',
      });
      return;
    }

    // Mettre à jour
    const fournisseurMisAJour = await db.fournisseur.update({
      where: { id: fournisseurId },
      data: {
        ...updates,
        updatedAt: new Date(),
      },
    });

    res.json({
      message: 'Fournisseur mis à jour avec succès',
      fournisseur: fournisseurMisAJour,
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
