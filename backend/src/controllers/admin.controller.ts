import { Request, Response } from 'express';
import db from '../config/database.js';
import { syncPeseesFromGespont } from '../services/gespont-sync.js';

// POST /api/admin/sync — Déclencher un sync GESpont manuel (ADMIN)
export async function triggerSyncController(req: Request, res: Response): Promise<void> {
  try {
    console.log(`🔄 Sync manuel déclenché par ${req.user?.id}`);
    const stats = await syncPeseesFromGespont();
    res.json({
      message: 'Synchronisation GESpont complétée',
      status: stats.status,
      stats: {
        fetched: stats.fetched,
        inserted: stats.inserted,
        skipped: stats.skipped,
        durationMs: stats.durationMs,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`❌ Erreur lors du sync manuel: ${message}`);
    res.status(500).json({ error: 'Erreur lors de la synchronisation', details: message });
  }
}

// GET /api/admin/sync-status — Historique des syncs (ADMIN)
export async function getSyncStatusController(req: Request, res: Response): Promise<void> {
  try {
    const limitNum = Math.min(parseInt(req.query.limit as string) || 10, 100);

    const syncLogs = await db.syncLog.findMany({
      orderBy: { timestamp: 'desc' },
      take: limitNum,
    });

    res.json({
      total: syncLogs.length,
      logs: syncLogs.map((log) => ({
        id: log.id,
        status: log.status,
        timestamp: log.timestamp,
        recordsFetched: log.recordsFetched,
        recordsInserted: log.recordsInserted,
        recordsSkipped: log.recordsSkipped,
        durationMs: log.durationMs,
        errorMessage: log.errorMessage,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: 'Erreur lors de la récupération du statut', details: message });
  }
}
