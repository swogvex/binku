# Catálogo (lo rellena la propietaria/el propietario)

`catalog.json` es la única fuente del catálogo base. Ahora contiene **datos falsos de desarrollo** (grupos `fake-*` con "TEST" en el nombre): sustitúyelos por los reales antes de la beta.

## Formato

```json
{
  "groups": [
    {
      "id": "skz",
      "name": "Stray Kids",
      "name_ko": "스트레이 키즈",
      "monogram": "SKZ",
      "color": "cobalt",
      "members": [{ "id": "hyunjin", "name": "Hyunjin", "name_ko": "현진" }],
      "releases": [
        {
          "id": "ate",
          "title": "ATE",
          "kind": "album",
          "year": 2024,
          "era_color": "mango",
          "versions": [{ "id": "a", "label": "Ver. A" }],
          "cards": [
            { "member": "hyunjin", "version": "a", "type": "album" },
            { "member": "hyunjin", "type": "pob", "store": "Soundwave" }
          ]
        }
      ]
    }
  ]
}
```

- `id`: corto, en minúsculas, sin espacios. Dentro de un grupo, los `id` de miembros y lanzamientos solo tienen que ser únicos en ese grupo.
- `color` / `era_color`: uno de `tomato`, `cobalt`, `mango`, `mint`, `bubblegum`.
- `kind`: `album`, `single`, `sg`, `event`, `other`.
- `type`: `album`, `pob`, `lucky_draw`, `event`, `season_greetings`, `other`. Todo lo que no sea `album` sale con efecto holo, salvo que pongas `"special": false`.
- El id de cada carta se calcula solo (`skz-ate-a-hyunjin-album`). **No cambies ids ni campos de cartas ya publicadas**: los binders de la gente las referencian. Si dos cartas saldrían iguales, añade `"id": "algo-unico"` a una.
- Nunca: imágenes oficiales, logos, precios.

## Publicar cambios

1. Edita `catalog.json`. `npm test` avisa si algo está mal (miembro o versión inexistente, ids repetidos).
2. `npm run catalog:seed` genera `supabase/seed.sql`.
3. `npx supabase db push --remote --include-seed` lo sube. Las cartas que quites del archivo se ocultan (no se borran) y desaparecen de los móviles en la siguiente sincronización.
