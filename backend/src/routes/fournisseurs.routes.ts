import { Router } from 'express';
import {
  getFournisseursController,
  getFournisseurByIdController,
  updateFournisseurController,
} from '../controllers/fournisseurs.controller.js';
import { authenticate, authorize } from '../middlewares/auth.js';

const router = Router();

// GET /api/fournisseurs — Liste (tous les users authentifiés)
router.get('/', authenticate, getFournisseursController);

// GET /api/fournisseurs/:id — Détail (tous les users authentifiés)
router.get('/:id', authenticate, getFournisseurByIdController);

// PATCH /api/fournisseurs/:id — Mise à jour (ADMIN ou SUPERVISEUR)
router.patch(
  '/:id',
  authenticate,
  authorize('ADMIN', 'SUPERVISEUR'),
  updateFournisseurController
);

export default router;
