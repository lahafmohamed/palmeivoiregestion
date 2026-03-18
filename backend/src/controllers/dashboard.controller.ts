import { Request, Response } from 'express';
import db from '../config/database.js';

// GET /api/dashboard/stats — Stats globales
export async function getDashboardStatsController(req: Request, res: Response): Promise<void> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Stats du jour
    const [peseesDayCount, peseesWeight, ticketsStats] = await Promise.all([
      db.pesee.count({
        where: {
          datePesee: {
            gte: today,
            lt: tomorrow,
          },
        },
      }),
      db.pesee.aggregate({
        where: {
          datePesee: {
            gte: today,
            lt: tomorrow,
          },
        },
        _sum: {
          poidsNet: true,
        },
      }),
      db.ticket.groupBy({
        by: ['statut'],
        where: {
          pesee: {
            datePesee: {
              gte: today,
              lt: tomorrow,
            },
          },
        },
        _count: true,
      }),
    ]);

    // Montants en attente et payés (global — tous les tickets, toutes dates)
    const [ticketsEnAttente, ticketsPaye] = await Promise.all([
      db.ticket.aggregate({
        where: { statut: 'EN_ATTENTE' },
        _sum: { montant: true },
      }),
      db.ticket.aggregate({
        where: { statut: 'PAYÉ' },
        _sum: { montant: true },
      }),
    ]);

    const montantEnAttenteTotal = Number(ticketsEnAttente._sum.montant ?? 0) / 1000;
    const montantPayeTotal = Number(ticketsPaye._sum.montant ?? 0) / 1000;

    // Récupérer les stats globales (tous les jours)
    const [totalPesees, totalWeight] = await Promise.all([
      db.pesee.count(),
      db.pesee.aggregate({
        _sum: {
          poidsNet: true,
        },
      }),
    ]);

    res.json({
      today: {
        pesees: peseesDayCount,
        tonnage: Number(peseesWeight._sum.poidsNet ?? 0) / 1000,
        ticketsByStatut: ticketsStats.map((stat) => ({
          statut: stat.statut,
          count: stat._count,
        })),
      },
      montants: {
        enAttente: parseFloat(montantEnAttenteTotal.toFixed(2)),
        paye: parseFloat(montantPayeTotal.toFixed(2)),
        total: parseFloat((montantEnAttenteTotal + montantPayeTotal).toFixed(2)),
      },
      global: {
        totalPesees,
        totalTonnage: Number(totalWeight._sum.poidsNet ?? 0) / 1000,
      },
    });
  } catch (error) {
    res.status(500).json({
      error: 'Erreur serveur',
      details: error instanceof Error ? error.message : 'Erreur inconnue',
    });
  }
}

// GET /api/dashboard/chart — Données pour graphique (30 derniers jours)
export async function getDashboardChartController(req: Request, res: Response): Promise<void> {
  try {
    // Récupérer les 30 derniers jours
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);

    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 29); // 29 jours avant = 30 jours en tout
    startDate.setHours(0, 0, 0, 0);

    // Récupérer toutes les pesées sur cette période
    const pesees = await db.pesee.findMany({
      where: {
        datePesee: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        datePesee: true,
        poidsNet: true,
      },
    });

    // Grouper par jour
    const dataByDay: Record<string, { count: number; tonnage: number }> = {};

    // Initialiser tous les jours (même s'il n'y a pas de données)
    for (let i = 0; i < 30; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
      dataByDay[dateStr] = { count: 0, tonnage: 0 };
    }

    // Remplir les données
    pesees.forEach((pesee) => {
      const dateStr = pesee.datePesee.toISOString().split('T')[0];
      if (dataByDay[dateStr]) {
        dataByDay[dateStr].count += 1;
        dataByDay[dateStr].tonnage += Number(pesee.poidsNet) / 1000;
      }
    });

    // Transformer en array pour le frontend
    const chartData = Object.entries(dataByDay)
      .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
      .map(([date, data]) => ({
        date,
        pesees: data.count,
        tonnage: parseFloat(data.tonnage.toFixed(2)),
      }));

    res.json({
      period: {
        start: startDate.toISOString().split('T')[0],
        end: endDate.toISOString().split('T')[0],
        days: 30,
      },
      data: chartData,
      summary: {
        totalPesees: pesees.length,
        totalTonnage: parseFloat(
          (pesees.reduce((sum, p) => sum + Number(p.poidsNet), 0) / 1000).toFixed(2)
        ),
        averagePeseesPerDay: parseFloat((pesees.length / 30).toFixed(1)),
        averageTonnagePerDay: parseFloat(
          (pesees.reduce((sum, p) => sum + Number(p.poidsNet), 0) / 1000 / 30).toFixed(2)
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
