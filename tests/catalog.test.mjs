import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
await build({
  entryPoints: ["src/lib/catalog.ts", "src/lib/drive.ts", "src/lib/filter.ts"],
  outdir: "/tmp/hikes-test",
  bundle: true,
  platform: "node",
  format: "esm",
  outExtension: { ".js": ".mjs" },
});
const { catalog, coordinates, recommendations, extended, segments, access } = await import("/tmp/hikes-test/catalog.mjs");
const { estimate, roughEstimate } = await import("/tmp/hikes-test/drive.mjs");
const { matches } = await import("/tmp/hikes-test/filter.mjs");
const blank = {
  category: "",
  region: "",
  length: "",
  difficulty: "",
  structure: "",
  water: "",
  season: "",
  shade: "",
  landscape: "",
  provenance: "",
  drive: "",
};
test("complete unique catalog and start coverage", () => {
  assert.equal(catalog.length, recommendations.length+extended.length+segments.length);
  assert.equal(new Set(catalog.map((t) => t.id)).size, catalog.length);
  assert.equal(catalog.filter(coordinates).length, Object.keys(access).length);
});
test("categories, shared provenance and unknowns filter honestly", () => {
  assert.equal(
    catalog.filter((t) =>
      matches(t, "", { ...blank, category: "verified" }, null),
    ).length,
    recommendations.length,
  );
  assert.equal(
    catalog.filter((t) =>
      matches(t, "", { ...blank, category: "extended" }, null),
    ).length,
    extended.length,
  );
  assert.equal(
    catalog.filter((t) =>
      matches(t, "", { ...blank, provenance: "מסמך משותף" }, null),
    ).length,
    extended.filter(t=>t.src==="friend").length,
  );
  assert(
    catalog
      .filter((t) => matches(t, "", { ...blank, water: "לא ידוע" }, null))
      .every((t) => t.water === "לא ידוע"),
  );
});
test("named route and drive estimation", () => {
  const t = catalog.find((t) => t.id === "ofer");
  assert(matches(t, "יער עופר", blank, null));
  assert(estimate(t, "telaviv").km > 0);
  assert.equal(
    estimate(
      catalog.find((t) => !coordinates(t)),
      "telaviv",
    ),
    null,
  );
  assert.equal(roughEstimate(t, [32, 35]).method, "air-estimate");
});
test("circular sea-to-sea day trip is not marked linear", () =>
  assert.equal(catalog.find((t) => t.id === "seg-y2y-d").structure, "מעגלי"));
test("combined filters apply to every category", () => {
  for (const t of catalog) {
    if (
      matches(
        t,
        "",
        { ...blank, structure: "מעגלי", drive: "עד 90 דקות" },
        estimate(t, "telaviv"),
      )
    )
      assert(t.structure === "מעגלי" && estimate(t, "telaviv").minutes <= 90);
  }
});
