-- Backfill mouvement et pr_code depuis raw_json pour les données existantes
UPDATE pesees
SET
  mouvement = CASE
    WHEN raw_json->>'PR_CODE' = '1002' AND raw_json->>'PS_MOUVEMENT' = 'ENTREE' THEN 'REJET'
    ELSE raw_json->>'PS_MOUVEMENT'
  END,
  pr_code = COALESCE(pr_code, raw_json->>'PR_CODE')
WHERE raw_json IS NOT NULL
  AND (mouvement IS NULL OR pr_code IS NULL);
