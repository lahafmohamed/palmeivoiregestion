import cron from 'node-cron';
import env from '../config/env.js';
import { syncPeseesFromGespont } from './gespont-sync.js';

let syncTask: cron.ScheduledTask | null = null;

/**
 * Démarrer le scheduler de synchronisation GESpont
 * Lance un sync au démarrage, puis en arrière-plan selon SYNC_INTERVAL_MINUTES (via node-cron)
 */
export function startSyncScheduler(): void {
  if (!env.SYNC_ENABLED) {
    console.log('⏭️  Synchronisation GESpont désactivée (SYNC_ENABLED=false)');
    return;
  }

  console.log(
    `🕐 Scheduler de sync GESpont activé (intervalle: ${env.SYNC_INTERVAL_MINUTES} minutes)`
  );

  // Sync immédiat au démarrage pour avoir des données tout de suite
  console.log('🔄 Lancement du sync initial...');
  performSync();

  // Construire le pattern cron basé sur SYNC_INTERVAL_MINUTES
  // Format: "minute hour day-of-month month day-of-week"
  // Exemple: "*/30 * * * *" = toutes les 30 minutes
  const cronPattern = `*/${env.SYNC_INTERVAL_MINUTES} * * * *`;

  console.log(`📅 Pattern cron: "${cronPattern}"`);

  // Programmer la tâche cron
  syncTask = cron.schedule(cronPattern, () => {
    console.log(`\n⏰ Exécution du sync programmé (${new Date().toLocaleString('fr-FR')})`);
    performSync();
  });

  console.log('✅ Scheduler de sync démarré avec node-cron');
}

/**
 * Arrêter le scheduler
 */
export function stopSyncScheduler(): void {
  if (syncTask) {
    syncTask.stop();
    syncTask = null;
    console.log('✅ Scheduler de sync arrêté');
  }
}

/**
 * Exécuter un sync (avec gestion d'erreur)
 */
async function performSync(): Promise<void> {
  try {
    const stats = await syncPeseesFromGespont();
    console.log(`\n✅ Sync complète: ${stats.inserted} insérées, ${stats.skipped} ignorées (${stats.status})`);
    console.log(`   Durée: ${stats.durationMs}ms`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`⚠️  Sync GESpont échoué (backend continue): ${message}`);
  }
}

