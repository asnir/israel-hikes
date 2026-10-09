import { spawn } from "node:child_process";
const process = spawn(
  "node",
  [
    "node_modules/wrangler/bin/wrangler.js",
    "dev",
    "--local",
    "--port",
    "8787",
    "--show-interactive-dev-session=false",
  ],
  { stdio: ["ignore", "pipe", "pipe"] },
);
let log = "";
process.stdout.on("data", (d) => (log += d));
process.stderr.on("data", (d) => (log += d));
try {
  let ready = false;
  for (let i = 0; i < 70; i++) {
    try {
      const r = await fetch("http://127.0.0.1:8787/");
      if (r.ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  if (!ready) throw Error(log);
  const short = await fetch("http://127.0.0.1:8787/api/geocode?q=x");
  console.log("short query", short.status);
  const wrong = await fetch("http://127.0.0.1:8787/api/route", {
    method: "POST",
    headers: { Origin: "https://evil.invalid" },
    body: "{}",
  });
  console.log("cross-origin rejected", wrong.status);
  const invalid = await fetch("http://127.0.0.1:8787/api/route", {
    method: "POST",
    headers: {
      Origin: "http://127.0.0.1:8787",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ origin: [100, 200], targets: [] }),
  });
  console.log("bad coordinates", invalid.status);
  const r = await fetch("http://127.0.0.1:8787/api/geocode?q=Haifa");
  console.log("geocode", r.status, (await r.text()).slice(0, 300));
  const route = await fetch("http://127.0.0.1:8787/api/route", {
    method: "POST",
    headers: {
      Origin: "http://127.0.0.1:8787",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      origin: [32.07849, 34.773982],
      targets: [{ id: "ofer", point: [32.67065, 34.96676] }],
    }),
  });
  console.log("route", route.status, await route.text());
} finally {
  process.kill();
}
