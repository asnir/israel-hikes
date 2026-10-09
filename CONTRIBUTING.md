# תרומה למאגר | Contributing

תודה על עזרה בשיפור המידע. כל שינוי עובר Pull Request, אין גישה ישירה ל-main.

1. פתחו fork וענף חדש.
2. הוסיפו או תקנו נתונים בקובצי `src/data/`. אין צורך לשנות את ה-UI.
3. ציינו מקור פומבי, תאריך בדיקה והבדלים בין גרסאות המסלול.
4. אל תנחשו קושי, מים, גישה או סגירות. השאירו מידע חסר ריק או `לא ידוע`, בהתאם לשדה.
5. אל תוסיפו פרטים אישיים, מסמכים פרטיים, סודות, עצות לעקיפת חסימות או תמונות ללא רישיון.
6. הריצו `npm run validate`, `npm test`, ו-`npm run build`. לשינוי חזותי בדקו גם טלפון ברוחב 390px ומחשב.
7. פתחו PR עם תיאור השינוי, קישורי המקור ובדיקות שביצעתם. בעל המאגר בודק ומחליט אם למזג.

## English

Use a fork and pull request. Edit data separately from UI. Include public sources and the check date. Preserve honest unknowns and route-version differences. No personal data, private-document URLs, secrets, access-bypass advice or unlicensed images. Run validation, tests and build. For UI changes, inspect both 390px mobile and desktop layouts. Repository owner reviews external contributions before merging.

## Easy data workflow | הוספה, עדכון ומחיקה

The entry point is `npm run trail`. Most new trails are planning leads (`extended`), not verified recommendations. Start with `examples/trail.json`; replace every example value, choose a never-used `n`, and use actual public sources. Do not renumber existing records. IDs such as `ext-1001` keep saved trails and links stable.

```sh
cp examples/trail.json /tmp/my-trail.json
# edit /tmp/my-trail.json, then:
npm run trail -- add extended /tmp/my-trail.json /tmp/english.json
npm run trail -- update extended /tmp/my-trail.json /tmp/english.json
npm run trail -- delete extended ext-1001
npm run check
```

`/tmp/english.json` maps each NEW Hebrew string to its reviewed English translation, e.g. `{"שם חדש":"New name"}`. Already-known strings need no translation; an all-English entry can omit this argument. The tool checks the entire result before writing, installs translation keys automatically, rejects duplicate/changing IDs and malformed/private source data, and cleans start/city records on deletion. Keep unknown length as `null`, unknown strings empty, and unknown lists `[]`. Never guess an unknown coordinate.

Three categories use their existing source files: `extended` → `src/data/extended.json`; `verified` → `recommendations.json`; `segment` → `segments.json`. The tool changes just that file (plus translation resources, or derived records when deleting). Full schema checks are in `scripts/trail-data.mjs`; `examples/trail.json` is the complete planning-lead template. Segment `trail` must match `long-trails.json`. Starting coordinates belong separately in `access.json` only when verified. City estimates are optional; new routes without them remain honest unknowns. Add checked start data and regenerate estimates with the existing precompute script only after verifying the source and routing service terms.

Review `git diff`, run the full checks, inspect the new/updated detail page in both languages, then submit a PR. Deletion intentionally makes the old detail URL show not-found; already-saved IDs are not reassigned to another trail. Historical source-count assertions must not prevent legitimate additions/deletions. Workflow tests add/update/delete a temporary route without contaminating real data.
