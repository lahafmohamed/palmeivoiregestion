-- CreateEnum
CREATE TYPE "StatutTicket" AS ENUM ('EN_ATTENTE', 'VALIDÉ', 'PAYÉ', 'REJETÉ');

-- CreateEnum
CREATE TYPE "ModePaiement" AS ENUM ('VIREMENT', 'ESPÈCES', 'CHÈQUE', 'AUTRE');

-- CreateEnum
CREATE TYPE "RoleUtilisateur" AS ENUM ('ADMIN', 'SUPERVISEUR', 'OPERATEUR');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('SUCCÈS', 'ERREUR', 'PARTIEL');

-- CreateTable
CREATE TABLE "fournisseurs" (
    "id" SERIAL NOT NULL,
    "code_gespont" VARCHAR(50) NOT NULL,
    "nom" VARCHAR(255) NOT NULL,
    "contact" VARCHAR(100),
    "adresse" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fournisseurs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pesees" (
    "id" SERIAL NOT NULL,
    "gespont_id" VARCHAR(100) NOT NULL,
    "numero_ticket" VARCHAR(50),
    "fournisseur_id" INTEGER NOT NULL,
    "produit" VARCHAR(255),
    "poids_brut" DECIMAL(10,2) NOT NULL,
    "tare" DECIMAL(10,2) NOT NULL,
    "poids_net" DECIMAL(10,2) NOT NULL,
    "date_pesee" TIMESTAMP(3) NOT NULL,
    "vehicule" VARCHAR(50),
    "raw_json" JSONB,
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pesees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tickets" (
    "id" SERIAL NOT NULL,
    "pesee_id" INTEGER NOT NULL,
    "statut" "StatutTicket" NOT NULL DEFAULT 'EN_ATTENTE',
    "montant" DECIMAL(12,2),
    "prix_unitaire" DECIMAL(10,2),
    "date_validation" TIMESTAMP(3),
    "date_paiement" TIMESTAMP(3),
    "paiement_id" INTEGER,
    "notes" TEXT,
    "modifie_par" INTEGER,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paiements" (
    "id" SERIAL NOT NULL,
    "fournisseur_id" INTEGER NOT NULL,
    "montant_total" DECIMAL(14,2) NOT NULL,
    "date_paiement" TIMESTAMP(3) NOT NULL,
    "mode_paiement" "ModePaiement" NOT NULL,
    "reference" VARCHAR(100) NOT NULL,
    "cree_par" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "paiements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "nom" VARCHAR(100) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "role" "RoleUtilisateur" NOT NULL DEFAULT 'OPERATEUR',
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_logs" (
    "id" SERIAL NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "SyncStatus" NOT NULL,
    "records_fetched" INTEGER NOT NULL DEFAULT 0,
    "records_inserted" INTEGER NOT NULL DEFAULT 0,
    "records_skipped" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "duration_ms" INTEGER,

    CONSTRAINT "sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fournisseurs_code_gespont_key" ON "fournisseurs"("code_gespont");

-- CreateIndex
CREATE UNIQUE INDEX "pesees_gespont_id_key" ON "pesees"("gespont_id");

-- CreateIndex
CREATE INDEX "pesees_numero_ticket_idx" ON "pesees"("numero_ticket");

-- CreateIndex
CREATE INDEX "pesees_date_pesee_idx" ON "pesees"("date_pesee");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_pesee_id_key" ON "tickets"("pesee_id");

-- CreateIndex
CREATE UNIQUE INDEX "paiements_reference_key" ON "paiements"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- AddForeignKey
ALTER TABLE "pesees" ADD CONSTRAINT "pesees_fournisseur_id_fkey" FOREIGN KEY ("fournisseur_id") REFERENCES "fournisseurs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_pesee_id_fkey" FOREIGN KEY ("pesee_id") REFERENCES "pesees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_paiement_id_fkey" FOREIGN KEY ("paiement_id") REFERENCES "paiements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_modifie_par_fkey" FOREIGN KEY ("modifie_par") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paiements" ADD CONSTRAINT "paiements_fournisseur_id_fkey" FOREIGN KEY ("fournisseur_id") REFERENCES "fournisseurs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paiements" ADD CONSTRAINT "paiements_cree_par_fkey" FOREIGN KEY ("cree_par") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
