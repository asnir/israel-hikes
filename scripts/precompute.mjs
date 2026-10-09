// One-time, single-process OSRM road-distance extraction. Never over 1 request/second.
import fs from "node:fs";
const read = (n) =>
  JSON.parse(fs.readFileSync("src/data/" + n + ".json", "utf8"));
const a = read("access"),
  cities = read("cities"),
  rec = read("recommendations"),
  ext = read("extended"),
  segs = read("segments");
const trails = [
  ...rec.map((t) => ({ id: t.id, key: t.id })),
  ...ext.map((t) => ({ id: "ext-" + t.n, key: String(t.n) })),
  ...segs.map((t) => ({ id: "seg-" + t.id, key: t.id })),
].filter((t) => /^\d+\.\d+,\d+\.\d+$/.test(a[t.key]?.destination || ""));
const output = {};
let failures = 0;
for (const c of cities) {
  output[c.id] = {};
  for (let i = 0; i < trails.length; i += 60) {
    const part = trails.slice(i, i + 60),
      coord = [
        c.point.slice().reverse().join(","),
        ...part.map((t) => a[t.key].destination.split(",").reverse().join(",")),
      ].join(";");
    const url =
      "https://router.project-osrm.org/table/v1/driving/" +
      coord +
      "?sources=0&annotations=distance";
    try {
      const r = await fetch(url, {
        headers: {
          "User-Agent": "IsraelHikes/1.0 one-time road distance preparation",
        },
        signal: AbortSignal.timeout(25000),
      });
      if (!r.ok) throw Error("HTTP " + r.status);
      const data = await r.json();
      if (data.code !== "Ok") throw Error(data.code);
      data.distances[0].slice(1).forEach((m, j) => {
        if (m !== null)
          output[c.id][part[j].id] = {
            km: Math.round(m / 1000),
            minutes: Math.round(m / 1000 / 5) * 5,
          };
      });
      console.log(c.id, i, Object.keys(output[c.id]).length);
    } catch (e) {
      failures++;
      console.log("FAILED", c.id, i, e.message);
    }
    await new Promise((r) => setTimeout(r, 1100));
  }
  fs.writeFileSync(
    "src/data/city-estimates.json",
    JSON.stringify(output, null, 2) + "\n",
  );
}
console.log({ coordinateTrails: trails.length, failures });
