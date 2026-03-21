import { Request, Response } from 'express';
import db from '../config/database.js';
import { peseeFiltersSchema } from '../utils/validator.js';

const RESTRICTED_FOURNISSEUR_CODE = '03';
const RESTRICTED_FOURNISSEUR_NAME = 'NASRALLAH';

// GET /api/pesees/produits — Liste distincte des produits
export async function getProduitsController(_req: Request, res: Response): Promise<void> {
  try {
    const produits = await db.pesee.findMany({
      distinct: ['produit'],
      select: { produit: true },
      where: { produit: { not: '' } },
      orderBy: { produit: 'asc' },
    });
    res.json(produits.map(p => p.produit).filter(Boolean));
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
}

// GET /api/pesees — Liste paginée avec filtres
export async function getPeseesController(req: Request, res: Response): Promise<void> {
  try {
    // Valider les query params
    const filters = peseeFiltersSchema.parse(req.query);
    const { page, limit, fournisseurId, produit, statut, dateDebut, dateFin, search, mouvement } = filters;

    // Construire les conditions where
    const where: any = {};
    const excludeRestricted = req.query.excludeRestricted === 'true';
    const isAdmin = req.user?.role === 'ADMIN';
    const isSuperviseur = req.user?.role === 'SUPERVISEUR';
    // Superviseurs voient NASRALLAH sauf si excludeRestricted (page paiement)
    const hideRestricted = !isAdmin && (!isSuperviseur || excludeRestricted);

    if (hideRestricted) {
      where.AND = [
        ...(where.AND ?? []),
        {
          NOT: {
            OR: [
              { fournisseur: { codeGespont: RESTRICTED_FOURNISSEUR_CODE } },
              { fournisseur: { nom: { equals: RESTRICTED_FOURNISSEUR_NAME, mode: 'insensitive' } } },
            ],
          },
        },
      ];
    }

    if (fournisseurId) {
      where.fournisseurId = fournisseurId;
    }

    if (produit) {
      where.AND = [
        ...(where.AND ?? []),
        {
          OR: [
            { produit: { contains: produit, mode: 'insensitive' } },
            { prCode: { contains: produit, mode: 'insensitive' } },
          ],
        },
      ];
    }

    if (statut) {
      where.ticket = {
        statut: statut,
      };
    }

    if (dateDebut || dateFin) {
      where.datePesee = {};
      if (dateDebut) where.datePesee.gte = new Date(dateDebut);
      if (dateFin)   where.datePesee.lte = new Date(dateFin);
    }

    if (mouvement) {
      where.mouvement = mouvement;
    }

    if (search) {
      where.AND = [
        ...(where.AND ?? []),
        {
          OR: [
            { gespontId: { contains: search, mode: 'insensitive' } },
            { numeroTicket: { contains: search, mode: 'insensitive' } },
            { vehicule: { contains: search, mode: 'insensitive' } },
            { produit: { contains: search, mode: 'insensitive' } },
            { prCode: { contains: search, mode: 'insensitive' } },
            { fournisseur: { nom: { contains: search, mode: 'insensitive' } } },
            { fournisseur: { codeGespont: { contains: search, mode: 'insensitive' } } },
          ],
        },
      ];
    }

    // Stats : seulement si un filtre de date est actif (évite de charger toute la BD)
    const hasDateFilter = !!(dateDebut || dateFin);

    const total = await db.pesee.count({ where });

    let statsRow = {
      entreesCount: 0, entreesKg: 0, sortiesCount: 0, sortiesKg: 0,
      enAttenteCount: 0, enAttenteKg: 0, payeCount: 0, payeKg: 0, payeMontant: 0,
    };
    if (hasDateFilter) {
      const allForStats = await db.pesee.findMany({
        where,
        select: { mouvement: true, poidsNet: true, ticket: { select: { statut: true, montant: true } } },
      });
      statsRow = allForStats.reduce(
        (acc, p) => {
          const kg = Number(p.poidsNet ?? 0);
          if (p.mouvement === 'ENTREE') { acc.entreesCount++; acc.entreesKg += kg; }
          if (p.mouvement === 'SORTIE') { acc.sortiesCount++; acc.sortiesKg += kg; }
          if (p.ticket?.statut === 'EN_ATTENTE') { acc.enAttenteCount++; acc.enAttenteKg += kg; }
          if (p.ticket?.statut === 'PAYÉ') {
            acc.payeCount++;
            acc.payeKg += kg;
            acc.payeMontant += Number(p.ticket.montant ?? 0);
          }
          return acc;
        },
        { entreesCount: 0, entreesKg: 0, sortiesCount: 0, sortiesKg: 0,
          enAttenteCount: 0, enAttenteKg: 0, payeCount: 0, payeKg: 0, payeMontant: 0 }
      );
    }

    // Récupérer les pesées avec pagination
    const pesees = await db.pesee.findMany({
      where,
      include: {
        fournisseur: true,
        ticket: {
          include: {
            paiement: {
              include: {
                createur: { select: { nom: true } },
              },
            },
          },
        },
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: {
        datePesee: 'desc',
      },
    });

    // Pour chaque pesée, trouver le dernier prix payé à ce fournisseur
    // dont la date de pesée est AVANT la date de pesée de cette ligne
    const peseesWithDernierPrix = await Promise.all(
      pesees.map(async (p) => {
        const lastPaidTicket = await db.ticket.findFirst({
          where: {
            statut: 'PAYÉ',
            prixUnitaire: { not: null },
            pesee: {
              fournisseurId: p.fournisseurId,
              datePesee: { lt: p.datePesee },
            },
          },
          orderBy: { pesee: { datePesee: 'desc' } },
          select: { prixUnitaire: true },
        });
        return {
          ...p,
          dernierPrix: lastPaidTicket?.prixUnitaire?.toString() ?? null,
        };
      })
    );

    res.json({
      data: peseesWithDernierPrix,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
      stats: statsRow,
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

// GET /api/pesees/:id — Détail d'une pesée
export async function getPeseeByIdController(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const peseeId = parseInt(id, 10);

    if (isNaN(peseeId)) {
      res.status(400).json({
        error: 'ID invalide',
      });
      return;
    }

    const pesee = await db.pesee.findUnique({
      where: { id: peseeId },
      include: {
        fournisseur: true,
        ticket: true,
      },
    });

    if (!pesee) {
      res.status(404).json({
        error: 'Pesée non trouvée',
      });
      return;
    }

    res.json(pesee);
  } catch (error) {
    res.status(500).json({
      error: 'Erreur serveur',
      details: error instanceof Error ? error.message : 'Erreur inconnue',
    });
  }
}

// GET /api/pesees/grouped?by=day|week|month&dateDebut=...&dateFin=...
export async function getPeseesGroupedController(req: Request, res: Response): Promise<void> {
  try {
    const by = (req.query.by as string) || 'day';
    const dateDebut = req.query.dateDebut as string | undefined;
    const dateFin   = req.query.dateFin   as string | undefined;

    const where: any = {};
    if (dateDebut || dateFin) {
      where.datePesee = {};
      if (dateDebut) where.datePesee.gte = new Date(dateDebut);
      if (dateFin)   where.datePesee.lte = new Date(dateFin);
    } else {
      // Par défaut : 6 derniers mois pour éviter de charger toute la BD
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      where.datePesee = { gte: sixMonthsAgo };
    }

    const records = await db.pesee.findMany({
      where,
      select: { datePesee: true, mouvement: true, poidsNet: true },
    });

    function periodKey(d: Date): string {
      if (by === 'month') return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (by === 'week') {
        // ISO week number
        const tmp = new Date(d);
        tmp.setHours(0, 0, 0, 0);
        tmp.setDate(tmp.getDate() + 4 - (tmp.getDay() || 7));
        const yearStart = new Date(tmp.getFullYear(), 0, 1);
        const week = Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
        return `${tmp.getFullYear()}-S${String(week).padStart(2, '0')}`;
      }
      return d.toISOString().slice(0, 10);
    }

    const map = new Map<string, { periode: string; total: number; entreesCount: number; sortiesCount: number; entreesKg: number; sortiesKg: number }>();

    for (const r of records) {
      const key = periodKey(new Date(r.datePesee));
      if (!map.has(key)) map.set(key, { periode: key, total: 0, entreesCount: 0, sortiesCount: 0, entreesKg: 0, sortiesKg: 0 });
      const g = map.get(key)!;
      g.total++;
      const mv = r.mouvement ?? undefined;
      const kg = Number(r.poidsNet ?? 0);
      if (mv === 'ENTREE') { g.entreesCount++; g.entreesKg += kg; }
      if (mv === 'SORTIE') { g.sortiesCount++; g.sortiesKg += kg; }
    }

    const result = [...map.values()].sort((a, b) => b.periode.localeCompare(a.periode));
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur', details: error instanceof Error ? error.message : 'Erreur inconnue' });
  }
}

