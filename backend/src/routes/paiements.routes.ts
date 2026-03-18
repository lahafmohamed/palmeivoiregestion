import { Router } from 'express';
import {
  createPaiementController,
  getPaiementsController,
  getPaiementByIdController,
} from '../controllers/paiements.controller.js';
import { authenticate, authorize } from '../middlewares/auth.js';

const router = Router();

router.use(authenticate);

// POST /api/paiements — Créer un paiement (ADMIN ou SUPERVISEUR)
router.post('/', authorize('ADMIN', 'SUPERVISEUR'), createPaiementController);

// GET /api/paiements — Liste paginée
router.get('/', getPaiementsController);

// GET /api/paiements/:id — Détail
router.get('/:id', getPaiementByIdController);

export default router;
