// End-to-end check of the built app against an in-memory stand-in for Supabase.
// Run: npm run build && npx vite preview --port 4173 & PW=$(npm root -g)/playwright node e2e/app.e2e.cjs
const { chromium } = require(process.env.PW || "playwright");
const fs = require("fs");
const BASE = process.env.BASE || "http://localhost:4173";
const SB = "https://yuilurluttfnwildzshx.supabase.co";
const UID = "11111111-2222-3333-4444-555555555555";
const b64 = o => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = () => `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: UID, role: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600, email: "raki@example.com" })}.sig`;

function mockBackend() {
  const table = new Map(); let token = null; const log = [];
  const merge1 = (a, b) => { const o = { ...(a || {}) }; for (const [k, v] of Object.entries(b || {})) o[k] = o[k] && typeof o[k] === "object" && v && typeof v === "object" ? { ...o[k], ...v } : v; return o; };
  const user = { id: UID, aud: "authenticated", role: "authenticated", email: "raki@example.com", app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
  async function handle(route) {
    const req = route.request(); const url = new URL(req.url()); const path = url.pathname; const method = req.method();
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" }, body: JSON.stringify(body) });
    if (method === "OPTIONS") return json({});
    const body = req.postData() ? JSON.parse(req.postData()) : null;
    log.push(`${method} ${path}`);
    if (path === "/auth/v1/token") {
      if (body.password !== "correct-horse-9") return json({ code: 400, error_code: "invalid_credentials", msg: "Invalid login credentials" }, 400);
      return json({ access_token: jwt(), token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: "r1", user });
    }
    if (path === "/auth/v1/user") return json(user);
    if (path === "/auth/v1/logout") return route.fulfill({ status: 204, body: "" });
    if (path === "/rest/v1/docs" && method === "GET") {
      const off = +(url.searchParams.get("offset") || 0), lim = +(url.searchParams.get("limit") || 1000);
      return json([...table.values()].filter(r => !r.deleted).slice(off, off + lim));
    }
    if (path === "/rest/v1/docs" && method === "POST") { [].concat(body).forEach(r => table.set(r.col + "/" + r.id, { ...r })); return json(null, 201); }
    if (path === "/rest/v1/docs" && method === "PATCH") { const col = url.searchParams.get("col").slice(3), id = url.searchParams.get("id").slice(3); const r = table.get(col + "/" + id); if (r) Object.assign(r, body); return json(null, 204); }
    if (path === "/rest/v1/rpc/doc_merge") { const k = body.p_col + "/" + body.p_id; const r = table.get(k); table.set(k, { user_id: UID, col: body.p_col, id: body.p_id, deleted: false, data: r && !r.deleted ? merge1(r.data, body.p_patch) : body.p_patch }); return json(null, 204); }
    if (path === "/rest/v1/rpc/create_health_token") { token = { created_at: new Date().toISOString(), last_used: null }; return json("a".repeat(64)); }
    if (path === "/rest/v1/health_tokens") {
      const accept = req.headers()["accept"] || "";
      if (accept.includes("pgrst.object")) return token ? json(token) : json({ code: "PGRST116", message: "no rows" }, 406);
      return json(token ? [token] : []);
    }
    return json({ message: "not mocked " + path }, 404);
  }
  return { table, log, handle };
}

(async () => {
  const b = await chromium.launch(); const errs = []; const be = mockBackend();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  await ctx.route(SB + "/**", r => be.handle(r));
  await ctx.route("wss://**", r => r.abort());
  const p = await ctx.newPage();
  p.on("pageerror", e => errs.push("pageerror: " + e.message));
  p.on("console", m => { if (m.type() === "error" && !/websocket|ERR_|fonts|Failed to load resource/i.test(m.text())) errs.push("console: " + m.text()); });
  await p.goto(BASE + "/"); await p.waitForSelector("#auth:not([hidden])");
  await p.screenshot({ path: "e2e/shot-signin.png" });
  await p.fill("#auth-email", "raki@example.com"); await p.fill("#auth-pass", "wrong-password"); await p.click("#auth-go");
  await p.waitForFunction(() => !document.querySelector("#auth-msg").hidden && /match/.test(document.querySelector("#auth-msg").textContent));
  console.log("bad password message:", await p.textContent("#auth-msg"));
  await p.fill("#auth-pass", "correct-horse-9"); await p.click("#auth-go");
  await p.waitForSelector(".app:not([hidden]) #view .hero", { timeout: 10000 });
  console.log("signed in, today view rendered");
  // add a habit and log steps
  await p.click('.card [data-act="add-habit"] >> nth=0'); await p.fill('#sheet input[name=name]', "Read 20 pages"); await p.click('#sheet form[data-form=habit] button.btn.pri');
  await p.waitForTimeout(300);
  await p.click('.hero .lr[data-v="steps"]'); await p.fill("#st-n", "8123"); await p.click("form[data-form=steps] button"); await p.waitForTimeout(400);
  const habitRows = [...be.table.values()].filter(r => r.col === "habits");
  const stepRows = [...be.table.values()].filter(r => r.col === "stepsm");
  console.log("server habits:", habitRows.map(r => r.data.name), "steps buckets:", stepRows.map(r => Object.values(r.data.items).map(e => e.n)));
  await p.screenshot({ path: "e2e/shot-steps.png", fullPage: true });
  // health setup
  await p.click('[data-act="health-setup"] >> nth=0'); await p.waitForSelector('#sheet [data-act="health-token"]');
  await p.click('#sheet [data-act="health-token"]'); await p.waitForSelector("#hk-token");
  const hkUrl = await p.textContent("#hk-url"); if (!/\/rest\/v1\/rpc\/ingest_health\?apikey=sb_/.test(hkUrl)) throw new Error("health address lacks the app key: " + hkUrl);
  console.log("token shown:", (await p.textContent("#hk-token")).length, "chars; url:", hkUrl);
  await p.screenshot({ path: "e2e/shot-health.png", fullPage: false });
  await p.click("#sheet [data-act=close]");
  // restore an old Daybook backup
  const backup = { app: "daybook", version: 1, settings: { name: "Raki", stepGoal: 12000 }, habits: { h9: { id: "h9", name: "Stretch", freq: "daily", goal: 7, color: "--s3", done: {}, created: 1 } }, tasks: {}, tx: { t1: { id: "t1", type: "expense", amount: 12.5, cat: "Food", date: "2026-09-20", note: "", created: 1 } }, body: {}, foods: {}, food: {}, water: {}, steps: { "2026-09-20": { id: "2026-09-20", date: "2026-09-20", n: 11000, src: "export" } }, exercises: {}, splits: {}, sessions: {} };
  fs.writeFileSync("/tmp/daybook-backup.json", JSON.stringify(backup));
  await p.click('[data-tab="today"]:visible'); await p.click('[data-act="settings"]:visible');
  await p.waitForSelector("#sheet"); await p.screenshot({ path: "e2e/shot-settings.png", fullPage: false });
  await p.click('#sheet [data-act="import"]'); await p.setInputFiles("#imp-file", "/tmp/daybook-backup.json"); await p.click('#sheet [data-act="do-import"]');
  await p.waitForTimeout(800);
  const names = [...be.table.values()].filter(r => r.col === "habits").map(r => r.data.name).sort();
  const settingsRow = be.table.get("meta/settings");
  console.log("after restore, server habits:", names, "tx:", [...be.table.values()].filter(r => r.col === "txm").length, "settings name:", settingsRow && settingsRow.data.name);
  // reload: data comes back from the server, not just local cache
  await p.evaluate(() => { for (const k of Object.keys(localStorage)) if (k.startsWith("daybook:v1")) localStorage.removeItem(k); });
  await p.reload(); await p.waitForSelector(".app:not([hidden]) #view .hero"); await p.waitForTimeout(800);
  console.log("after reload with empty cache, greeting:", await p.textContent("#view h1"));
  console.log("errors:", errs);
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
