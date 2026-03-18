import { Router } from 'express';
import {
  getPeseesController,
  getPeseeByIdController,
  getPeseesGroupedController,
} from '../controllers/pesees.controller.js';
import { authenticate } from '../middlewares/auth.js';

const router = Router();
router.use(authenticate);

// Avant /:id pour éviter les collisions
router.get('/grouped', getPeseesGroupedController);
router.get('/', getPeseesController);
router.get('/:id', getPeseeByIdController);

export default router;
