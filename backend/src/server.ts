import express from 'express';
import cors from 'cors';
import env from './config/env.js';
import db from './config/database.js';
import authRoutes from './routes/auth.routes.js';
import peseesRoutes from './routes/pesees.routes.js';
import fournisseursRoutes from './routes/fournisseurs.routes.js';
import ticketsRoutes from './routes/tickets.routes.js';
import paiementsRoutes from './routes/paiements.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import adminRoutes from './routes/admin.routes.js';
import { startSyncScheduler, stopSyncScheduler } from './services/sync-scheduler.js';

const app = express();

// Middleware
app.use(cors({
  origin: env.FRONTEND_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes (authenticate est géré dans chaque router)
app.use('/api/auth', authRoutes);
app.use('/api/pesees', peseesRoutes);
app.use('/api/fournisseurs', fournisseursRoutes);
app.use('/api/tickets', ticketsRoutes);
app.use('/api/paiements', paiementsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/admin', adminRoutes);

// Démarrage du serveur
const server = app.listen(env.PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║  🌍 Serveur démarré avec succès!       ║
║  URL: http://localhost:${env.PORT}${' '.repeat(String(env.PORT).length > 4 ? 0 : 4)}   ║
║  Env: ${env.NODE_ENV.padEnd(31)}║
╚════════════════════════════════════════╝
  `);

  // Démarrer le scheduler de synchronisation GESpont
  startSyncScheduler();
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n📛 Arrêt du serveur...');
  stopSyncScheduler();
  server.close(async () => {
    await db.$disconnect();
    console.log('✅ Serveur arrêté gracieusement');
    process.exit(0);
  });
});

export default app;
