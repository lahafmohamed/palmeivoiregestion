/**
 * Types pour l'API GESpont
 */

export interface GespontWeighing {
  // Identification
  ST_CODE: string;              // Code du site
  PS_SITE: string;              // Nom du site
  PP_CODE: string;              // Numéro du ticket de pesée
  PS_CODE: string;              // ID unique de la pesée (clé de dédoublonnage)
  IDF_PESEE?: number;           // ID interne GESpont

  // Poids
  PS_POIDSP1: number;           // Poids brut (kg)
  PS_POIDSP2: number;           // Tare (kg)
  PS_TOTAL_TARE: number;        // Tare supplémentaire (kg)
  PS_POIDSNET?: number;         // Poids net calculé par GESpont (prioritaire)
  PS_POIDSDECLARE?: number;     // Poids déclaré
  PS_ECART?: number;            // Écart

  // Mouvement & Produit
  PS_MOUVEMENT: 'ENTREE' | 'SORTIE';
  PR_CODE: string;              // Code produit
  PS_PRODUIT: string;           // Nom du produit
  PS_CODEFAMILLEPROD?: string;  // Code famille produit
  PS_LIBFAMILLEPROD?: string;   // Libellé famille produit

  // Fournisseur & Véhicule
  FO_CODE: string;              // Code fournisseur
  PS_FOURNISSEUR: string;       // Nom du fournisseur
  VE_CODE: string;              // Immatriculation véhicule
  PS_REMORQUE?: string;         // Immatriculation remorque

  // Dates — nouveau format : date et heure séparées
  PS_DATEP1?: string;           // Date 1ère pesée (YYYYMMDD)
  PS_HEUREP1?: string;          // Heure 1ère pesée (HHmmss)
  PS_DATEP2?: string;           // Date 2ème pesée (YYYYMMDD)
  PS_HEUREP2?: string;          // Heure 2ème pesée (HHmmss)
  PS_DATEHEUREP2: string;       // Date/heure 2ème pesée (ISO 8601) — utilisé pour datePesee
  PS_DATEHEUREP1?: string;      // Date/heure 1ère pesée (ancien format, optionnel)

  // Logistique
  PS_RAMASSAGE?: string;        // Date de ramassage (YYYYMMDD)
  PS_PROVENANCE?: string;       // Provenance
  PV_CODE?: string;             // Code provenance
  PS_DESTINATION?: string;      // Destination
  DS_CODE?: string;             // Code destination
  PS_NUMLIV_1?: string;         // Numéro de livraison 1
  PS_NUMLIV_2?: string;         // Numéro de livraison 2
  PS_NUMLOT_1?: string;         // Numéro de lot 1
  PS_NUMLOT_2?: string;         // Numéro de lot 2

  // Client & Transport
  CL_CODE?: string;             // Code client
  PS_CLIENT?: string;           // Nom client
  TP_CODE?: string;             // Code transporteur
  PS_TRANSPORTEUR?: string;     // Nom transporteur
  PS_CHAUFFEUR?: string;        // Nom chauffeur
  PS_NUMPERMISCH?: string;      // Numéro permis chauffeur

  // Peseurs & Quart
  PS_PESEUR_P1?: string;        // Peseur P1
  PS_PESEUR_P2?: string;        // Peseur P2
  PS_CHEFQUART?: string;        // Chef de quart
  QT_CODE?: string;             // Code quart
  PS_QUART?: string;            // Libellé quart

  // Pont & Contrôle
  PS_PONT_P1?: string;          // Pont utilisé P1
  PS_PONT_P2?: string;          // Pont utilisé P2
  PS_CRCP1?: string;            // CRC P1
  PS_CRCP2?: string;            // CRC P2
  PS_CRCPNET?: string;          // CRC poids net
  PS_CLEFCONTROL?: string;      // Clé de contrôle

  // Flags
  PS_ANNULEE?: number | string; // 0 = normal, 1 = annulée
  PS_MODULE?: number;
  PS_PESEE_UNIK?: number;
  PS_TRSF_CT?: number;
  PS_CENTRALISE?: number;

  // Emballage
  MG_CODE?: string;
  PS_MAGASIN?: string;
  EM_CODE?: string;
  PS_EMBALLAGE?: string;
  PS_TAREUNIT_EMB?: number;
  PS_NBR_EMB?: number;
  PS_TARE_EMB?: number;

  // Divers
  MV_CODE?: string;
  PS_OBSERVATION?: string;
  PS_TICKET_ROUTE?: string;
  PS_ECART_TEMPSP1_P2?: string;
  PS_GENERERAP_XLS?: number;
  PS_CHEMIN_P1A?: string;
  PS_CHEMIN_P1D?: string;
  PS_CHEMIN_P2A?: string;
  PS_CHEMIN_P2D?: string;
}

export interface GespontResponse {
  REQ_GetPesees: GespontWeighing[];
}

/**
 * Calculer le poids net d'une pesée.
 * Utilise PS_POIDSNET fourni par GESpont si disponible,
 * sinon calcule : Poids brut - Tare - Tare supplémentaire.
 */
export function calculateNetWeight(weighting: GespontWeighing): number {
  if (weighting.PS_POIDSNET != null && weighting.PS_POIDSNET > 0) {
    return weighting.PS_POIDSNET;
  }
  return weighting.PS_POIDSP1 - weighting.PS_POIDSP2 - weighting.PS_TOTAL_TARE;
}

/**
 * Formater une date au format attendu par l'URL GESpont (YYYYMMDDHHmmss)
 */
export function formatGespontDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

/**
 * Parser une date du format GESpont séparé (YYYYMMDD + HHmmss) en Date JavaScript
 */
export function parseGespontDate(dateStr: string, timeStr = '000000'): Date {
  const year  = parseInt(dateStr.substring(0, 4), 10);
  const month = parseInt(dateStr.substring(4, 6), 10);
  const day   = parseInt(dateStr.substring(6, 8), 10);
  const hours = parseInt(timeStr.substring(0, 2), 10);
  const mins  = parseInt(timeStr.substring(2, 4), 10);
  const secs  = parseInt(timeStr.substring(4, 6), 10);
  return new Date(year, month - 1, day, hours, mins, secs);
}
