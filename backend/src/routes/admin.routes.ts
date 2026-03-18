import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.js';
import {
  triggerSyncController,
  getSyncStatusController,
} from '../controllers/admin.controller.js';

const adminRoutes = Router();

// POST /api/admin/sync — Déclencher sync GESpont (ADMIN only)
adminRoutes.post('/sync', authenticate, authorize('ADMIN'), triggerSyncController);

// GET /api/admin/sync-status — Historique syncs (ADMIN only)
adminRoutes.get(
  '/sync-status',
  authenticate,
  authorize('ADMIN'),
  getSyncStatusController
);

export default adminRoutes;
