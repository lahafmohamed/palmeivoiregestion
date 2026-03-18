# API GESpont - Documentation

## Endpoint

`GET /ProGetWeighings/{dateDebut}/{dateFin}`

### Format des dates

- Format: `YYYYMMDDHHmmss`
- Exemple: `20260309100000` = 09 mars 2026 à 10h00

### URL Exemple

```
http://160.154.143.124:3128/ProGetWeighings/20260309100000/20260309160000
```

## Réponse JSON

Tableau `REQ_GetPesees` contenant les objets de pesée.

### Champs de la réponse

| Champ | Type | Exemple | Description |
|-------|------|---------|-------------|
| `ST_CODE` | string | `PIG` | Code du site |
| `PS_SITE` | string | `PALME IVOIRE GUITRY` | Nom du site |
| `PP_CODE` | string | `PIG26028596` | Numéro du ticket de pesée |
| `PS_CODE` | string | `PIG26004251` | ID unique de la pesée (clé de dédoublonnage) |
| `PS_POIDSP1` | number | `44060` | Poids 1ère pesée en kg (poids brut) |
| `PS_POIDSP2` | number | `14160` | Poids 2ème pesée en kg (tare) |
| `PS_TOTAL_TARE` | number | `0` | Tare supplémentaire en kg |
| `PS_MOUVEMENT` | string | `ENTREE` / `SORTIE` | Direction du mouvement |
| `PR_CODE` | string | `1010` | Code produit |
| `PS_PRODUIT` | string | `REGIME DE PALME` | Nom du produit |
| `FO_CODE` | string | `464` | Code fournisseur (clé de dédoublonnage) |
| `PS_FOURNISSEUR` | string | `COULIBALY LACINA` | Nom du fournisseur |
| `VE_CODE` | string | `AA177RP01` | Immatriculation du véhicule |
| `PS_DATEHEUREP1` | string (ISO 8601) | `2026-03-09T08:13` | Date/heure 1ère pesée |
| `PS_DATEHEUREP2` | string (ISO 8601) | `2026-03-09T10:26` | Date/heure 2ème pesée |

## Notes

- API en lecture seule
- Les clés de dédoublonnage sont : `PS_CODE` et `FO_CODE`
- Les dates sont au format ISO 8601 dans la réponse
- Le poids net = `PS_POIDSP1 - PS_POIDSP2 - PS_TOTAL_TARE`
