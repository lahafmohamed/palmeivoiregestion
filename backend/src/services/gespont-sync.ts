import env from '../config/env.js';
import db from '../config/database.js';
import {
  GespontWeighing,
  GespontResponse,
  formatGespontDate,
  calculateNetWeight,
} from '../types/gespont.js';

async function getPeseesFromGespont(dateDebut: Date, dateFin: Date): Promise<GespontWeighing[]> {
  if (!env.GESPONT_API_URL) {
    console.warn('⚠️  GESPONT_API_URL non configuré — sync ignoré');
    return [];
  }

  try {
    const url = `${env.GESPONT_API_URL}/ProGetWeighings/${formatGespontDate(dateDebut)}/${formatGespontDate(dateFin)}`;
    console.log(`📡 Appel GESpont: ${url}`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (!response.ok) throw new Error(`Erreur GESpont (${response.status}): ${response.statusText}`);

    const data: GespontResponse = await response.json();
    if (!data.REQ_GetPesees || !Array.isArray(data.REQ_GetPesees)) {
      console.warn('⚠️  Réponse GESpont invalide: REQ_GetPesees manquant');
      return [];
    }

    console.log(`✅ ${data.REQ_GetPesees.length} pesées récupérées de GESpont`);
    return data.REQ_GetPesees;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('❌ GESpont injoignable (timeout 15s)');
    } else {
      console.error('❌ Erreur GESpont:', error instanceof Error ? error.message : String(error));
    }
    throw error;
  }
}

interface SyncStats {
  fetched: number;
  inserted: number;
  skipped: number;
  durationMs: number;
  status: 'SUCCÈS' | 'PARTIEL' | 'ERREUR';
}

export async function syncPeseesFromGespont(dateDebut?: Date, dateFin?: Date): Promise<SyncStats> {
  const startTime = Date.now();
  const stats: SyncStats = { fetched: 0, inserted: 0, skipped: 0, durationMs: 0, status: 'SUCCÈS' };

  try {
    // Fenêtre fixe : 3 jours en arrière → maintenant (rattrape les arrêts serveur)
    const syncStart = dateDebut ? new Date(dateDebut) : (() => {
      const d = new Date(); d.setDate(d.getDate() - 3); d.setHours(0, 0, 0, 0); return d;
    })();
    const syncEnd = dateFin ? new Date(dateFin) : (() => {
      const d = new Date(); d.setHours(23, 59, 59, 999); return d;
    })();

    console.log(`\n🔄 Sync GESpont: ${syncStart.toISOString()} → ${syncEnd.toISOString()}\n`);

    const peseesGespont = await getPeseesFromGespont(syncStart, syncEnd);
    stats.fetched = peseesGespont.length;

    if (peseesGespont.length === 0) {
      console.log('ℹ️  Aucune pesée à synchroniser');
      stats.durationMs = Date.now() - startTime;
      await logSync(stats);
      return stats;
    }

    for (const peseeGespont of peseesGespont) {
      try {
        if (peseeGespont.PS_ANNULEE === 1 || peseeGespont.PS_ANNULEE === '1') {
          stats.skipped++;
          continue;
        }

        const fournisseur = await db.fournisseur.upsert({
          where: { codeGespont: peseeGespont.FO_CODE },
          create: {
            codeGespont: peseeGespont.FO_CODE,
            nom: peseeGespont.PS_FOURNISSEUR || `Fournisseur ${peseeGespont.FO_CODE}`,
            contact: null, adresse: null, actif: true,
          },
          update: { nom: peseeGespont.PS_FOURNISSEUR || undefined },
        });

        const poidsNet = calculateNetWeight(peseeGespont);

        const mouvement = peseeGespont.PS_MOUVEMENT || null;

        const exists = await db.pesee.findFirst({ where: { gespontId: peseeGespont.PS_CODE }, select: { id: true } });

        if (exists) {
          stats.skipped++;
        } else {
          await db.$transaction(async (tx) => {
            const newPesee = await tx.pesee.create({
              data: {
                gespontId: peseeGespont.PS_CODE,
                numeroTicket: peseeGespont.PP_CODE,
                fournisseurId: fournisseur.id,
                poidsBrut: peseeGespont.PS_POIDSP1,
                tare: peseeGespont.PS_POIDSP2,
                poidsNet,
                produit: peseeGespont.PS_PRODUIT || '',
                vehicule: peseeGespont.VE_CODE || '',
                mouvement,
                prCode: peseeGespont.PR_CODE || null,
                datePesee: new Date(peseeGespont.PS_DATEHEUREP2),
                rawJson: peseeGespont,
                syncedAt: new Date(),
              },
            });
            await tx.ticket.create({
              data: {
                peseeId: newPesee.id,
                statut: 'EN_ATTENTE',
                montant: poidsNet,
                prixUnitaire: 1,
                notes: 'Auto-créé lors du sync GESpont',
              },
            });
          });
          stats.inserted++;
          console.log(`✨ Pesée créée: ${peseeGespont.PS_CODE}`);
        }
      } catch (error) {
        stats.skipped++;
        if (!(error instanceof Error && error.message.includes('Unique constraint'))) {
          console.error(`⚠️  Erreur ${peseeGespont.PS_CODE}:`, error instanceof Error ? error.message : String(error));
        }
      }
    }

    console.log(`\n📊 Sync: ${stats.fetched} récupérées, ${stats.inserted} insérées, ${stats.skipped} ignorées (${Date.now() - startTime}ms)`);
    stats.durationMs = Date.now() - startTime;
    await logSync(stats);
    return stats;
  } catch (error) {
    stats.status = 'ERREUR';
    stats.durationMs = Date.now() - startTime;
    console.error('❌ Erreur critique sync:', error instanceof Error ? error.message : String(error));
    await logSync(stats, error instanceof Error ? error.message : String(error));
    throw error;
  }
}

async function logSync(stats: SyncStats, errorDetails?: string): Promise<void> {
  try {
    await db.syncLog.create({
      data: {
        status: stats.status,
        recordsFetched: stats.fetched,
        recordsInserted: stats.inserted,
        recordsSkipped: stats.skipped,
        durationMs: stats.durationMs,
        errorMessage: errorDetails || null,
      },
    });
  } catch {
    console.warn('⚠️  Impossible d\'enregistrer dans sync_logs');
  }
}
