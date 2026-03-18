import { Router } from 'express';
import { loginController, registerController, getMeController, changePasswordController } from '../controllers/auth.controller.js';
import { authenticate, authorize } from '../middlewares/auth.js';

const router = Router();

// POST /api/auth/login - Pas d'authentification requise
router.post('/login', loginController);

// POST /api/auth/register - Protégé ADMIN
router.post('/register', authenticate, authorize('ADMIN'), registerController);

// GET /api/auth/me - Protégé (tous les users authentifiés)
router.get('/me', authenticate, getMeController);

// PATCH /api/auth/change-password - Protégé
router.patch('/change-password', authenticate, changePasswordController);

export default router;
