import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Résoudre le répertoire courant en ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Charger les variables d'environnement
const envPath = path.resolve(__dirname, '../../.env');
const result = dotenv.config({ path: envPath });

if (result.error) {
  console.warn(`⚠️  Attention: Impossible de charger ${envPath}`);
}

// Schéma de validation Zod
const envSchema = z.object({
  // Base de données
  DATABASE_URL: z.string().url('DATABASE_URL doit être une URL valide'),
  
  // JWT
  JWT_SECRET: z.string().min(32, 'JWT_SECRET doit contenir au moins 32 caractères'),
  JWT_EXPIRES_IN: z.string().default('24h'),
  
  // Serveur
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  
  // Frontend
  FRONTEND_URL: z.string().url('FRONTEND_URL doit être une URL valide'),
  
  // API Gespont (optionnels — si absents le sync est désactivé automatiquement)
  GESPONT_API_URL: z.string().optional(),
  GESPONT_API_KEY: z.string().optional(),

  // Sync
  SYNC_ENABLED: z.enum(['true', 'false']).transform(v => v === 'true').default('true' as const),
  SYNC_INTERVAL_MINUTES: z.coerce.number().int().positive().default(60),
});

// Type pour l'objet d'environnement validé
export type Env = z.infer<typeof envSchema>;

// Valider et exporter les variables d'environnement
let validatedEnv: Env;

try {
  validatedEnv = envSchema.parse(process.env);
} catch (error) {
  let errorMessage = '\n❌ Erreur de configuration\n';
  
  if (error instanceof z.ZodError) {
    errorMessage += 'Variables d\'environnement invalides!\n\n';
    error.issues.forEach((issue) => {
      const field = issue.path.join('.');
      errorMessage += `  ✗ ${field}: ${issue.message}\n`;
    });
    errorMessage += '\nAssurez-vous que votre fichier .env contient tous les champs requis.\n';
  } else {
    errorMessage += `Erreur inattendue: ${error instanceof Error ? error.message : String(error)}\n`;
  }
  
  console.error(errorMessage);
  process.exit(1);
}

export default validatedEnv;
