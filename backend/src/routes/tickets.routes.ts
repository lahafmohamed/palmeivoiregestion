import { Router, Request, Response, NextFunction } from 'express';
import {
  getTicketsController,
  updateTicketStatusController,
  bulkValidateTicketsController,
} from '../controllers/tickets.controller.js';
import { authenticate, authorize } from '../middlewares/auth.js';

const router = Router();

// Toutes les routes protégées par authentification
router.use(authenticate);

// GET /api/tickets — Liste paginée
router.get('/', getTicketsController);

// PATCH /api/tickets/bulk-validate — Validation en masse (avant :id pour éviter collision)
router.patch(
  '/bulk-validate',
  authorize('ADMIN', 'SUPERVISEUR'),
  bulkValidateTicketsController
);

// Middleware : inverser PAYÉ→EN_ATTENTE requiert ADMIN
function guardReversal(req: Request, res: Response, next: NextFunction): void {
  if (req.body?.statut === 'EN_ATTENTE') {
    authorize('ADMIN')(req, res, next);
    return;
  }
  next();
}

// PATCH /api/tickets/:id — Changer le statut
router.patch('/:id', guardReversal, updateTicketStatusController);

export default router;
