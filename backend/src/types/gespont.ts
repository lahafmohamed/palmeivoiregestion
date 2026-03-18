/**
 * Types pour l'API GESpont
 */

export interface GespontWeighing {
  ST_CODE: string;           // Code du site
  PS_SITE: string;           // Nom du site
  PP_CODE: string;           // Numéro du ticket de pesée
  PS_CODE: string;           // ID unique de la pesée (clé de dédoublonnage)
  PS_POIDSP1: number;        // Poids 1ère pesée en kg (poids brut)
  PS_POIDSP2: number;        // Poids 2ème pesée en kg (tare)
  PS_TOTAL_TARE: number;     // Tare supplémentaire en kg
  PS_MOUVEMENT: 'ENTREE' | 'SORTIE'; // Direction du mouvement
  PR_CODE: string;           // Code produit
  PS_PRODUIT: string;        // Nom du produit
  FO_CODE: string;           // Code fournisseur (clé de dédoublonnage)
  PS_FOURNISSEUR: string;    // Nom du fournisseur
  VE_CODE: string;           // Immatriculation du véhicule
  PS_DATEHEUREP1: string;    // Date/heure 1ère pesée (ISO 8601)
  PS_DATEHEUREP2: string;    // Date/heure 2ème pesée (ISO 8601)
  PS_ANNULEE?: number | string; // Flag annulation (0 = normal, 1 = annulée)
}

export interface GespontResponse {
  REQ_GetPesees: GespontWeighing[];
}

/**
 * Calculer le poids net d'une pesée
 * Formule: Poids brut - Tare - Tare supplémentaire
 */
export function calculateNetWeight(weighting: GespontWeighing): number {
  return weighting.PS_POIDSP1 - weighting.PS_POIDSP2 - weighting.PS_TOTAL_TARE;
}

/**
 * Formater une date au format GESpont (YYYYMMDDHHmmss)
 * @param date Date JavaScript
 * @returns String au format YYYYMMDDHHmmss
 */
export function formatGespontDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  
  return `${year}${month}${day}${hours}${minutes}${seconds}`;
}

/**
 * Parser une date du format GESpont (YYYYMMDDHHmmss) en Date JavaScript
 * @param dateStr String au format YYYYMMDDHHmmss
 * @returns Date JavaScript
 */
export function parseGespontDate(dateStr: string): Date {
  const year = parseInt(dateStr.substring(0, 4), 10);
  const month = parseInt(dateStr.substring(4, 6), 10);
  const day = parseInt(dateStr.substring(6, 8), 10);
  const hours = parseInt(dateStr.substring(8, 10), 10);
  const minutes = parseInt(dateStr.substring(10, 12), 10);
  const seconds = parseInt(dateStr.substring(12, 14), 10);
  
  return new Date(year, month - 1, day, hours, minutes, seconds);
}
