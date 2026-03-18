import { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';
import {
  getDashboardStatsController,
  getDashboardChartController,
} from '../controllers/dashboard.controller.js';

const dashboardRoutes = Router();

dashboardRoutes.use(authenticate);

// GET /api/dashboard/stats
dashboardRoutes.get('/stats', getDashboardStatsController);

// GET /api/dashboard/chart
dashboardRoutes.get('/chart', getDashboardChartController);

export default dashboardRoutes;
