# Subdivisions (ISO 3166-2)

`subdivisions.json`: first-level subdivisions for ES (provinces), MX, AR, CO, CL, PE.

- Source: Unicode CLDR 49 (`common/subdivisions/es.xml` + `cldr-core` `subdivisionContainment.json`), Unicode License v3 (`LICENSE-CLDR`). Listed on the licences screen.
- Cleaned: prefixes removed ("Provincia de…", "Departamento de…"), footnote marks stripped, and official / co-official names used where CLDR had exonyms or ambiguities (A Coruña, Girona, Lleida, Ourense, Gipuzkoa, Bizkaia, Araba/Álava, Illes Balears, Valencia/València, Alicante/Alacant, Castellón/Castelló, Ciudad Autónoma de Buenos Aires, Estado de México, Lima Metropolitana / Lima (región), Callao, La Araucanía, Región Metropolitana de Santiago).
- `term` = local label key (province / state / department / region) for the UI.
- Edit by hand; it changes rarely.
