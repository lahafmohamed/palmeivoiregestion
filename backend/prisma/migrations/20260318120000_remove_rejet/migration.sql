-- Convertir les tickets REJETÉ en EN_ATTENTE (fonctionne avec les deux noms d'enum)
UPDATE tickets SET statut = 'EN_ATTENTE' WHERE statut::text = 'REJETÉ';

-- Convertir les pesées avec mouvement REJET en ENTREE
UPDATE pesees SET mouvement = 'ENTREE' WHERE mouvement = 'REJET';

-- Créer le nouvel enum sans REJETÉ (si n'existe pas déjà)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StatutTicket' AND typtype = 'e') THEN
    CREATE TYPE "StatutTicket" AS ENUM ('EN_ATTENTE', 'VALIDÉ', 'PAYÉ');
  END IF;
END $$;

-- Supprimer le DEFAULT avant changement de type
ALTER TABLE tickets ALTER COLUMN statut DROP DEFAULT;

-- Convertir la colonne vers le nouveau type
ALTER TABLE tickets
  ALTER COLUMN statut TYPE "StatutTicket"
  USING statut::text::"StatutTicket";

-- Remettre le DEFAULT
ALTER TABLE tickets ALTER COLUMN statut SET DEFAULT 'EN_ATTENTE'::"StatutTicket";

-- Supprimer l'ancien enum (avec CASCADE si nécessaire)
DROP TYPE IF EXISTS "StatutTicket_old" CASCADE;
