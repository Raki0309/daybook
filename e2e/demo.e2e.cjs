// End-to-end check of "Try the demo": an anonymous sign-in, a month of example data
// written through the document store, and demo-only limits in Settings and Train.
// Run: npm run build && npx vite preview --port 4173 & PW=$(npm root -g)/playwright node e2e/demo.e2e.cjs
// With CAPTCHA=1, build with VITE_TURNSTILE_SITE_KEY set; a stand-in Turnstile hands out tokens.
const { chromium } = require(process.env.PW || "playwright");
const BASE = process.env.BASE || "http://localhost:4173";
const SB = "https://yuilurluttfnwildzshx.supabase.co";
const UID = "99999999-2222-3333-4444-555555555555";
const b64 = o => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = () => `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: UID, role: "authenticated", is_anonymous: true, exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`;
const assert = (ok, msg) => { if (!ok) throw new Error(msg); };

function mockBackend() {
  const table = new Map(); const log = [];
  const user = { id: UID, aud: "authenticated", role: "authenticated", email: "", is_anonymous: true, app_metadata: { provider: "anonymous" }, user_metadata: {}, created_at: new Date().toISOString() };
  async function handle(route) {
    const req = route.request(); const url = new URL(req.url()); const path = url.pathname; const method = req.method();
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" }, body: JSON.stringify(body) });
    if (method === "OPTIONS") return json({});
    const body = req.postData() ? JSON.parse(req.postData()) : null;
    log.push(`${method} ${path}`);
    if (path === "/auth/v1/signup") {
      if (body.email) return json({ msg: "not mocked" }, 400);
      if (process.env.CAPTCHA && !(body.gotrue_meta_security && /^tok-/.test(body.gotrue_meta_security.captcha_token))) return json({ code: 400, error_code: "captcha_failed", msg: "captcha protection: request disallowed (captcha verification process failed)" }, 400);
      return json({ access_token: jwt(), token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: "r1", user });
    }
    if (path === "/auth/v1/user") return json(user);
    if (path === "/auth/v1/logout") return route.fulfill({ status: 204, body: "" });
    if (path === "/rest/v1/docs" && method === "GET") {
      const off = +(url.searchParams.get("offset") || 0), lim = +(url.searchParams.get("limit") || 1000);
      return json([...table.values()].filter(r => !r.deleted).slice(off, off + lim));
    }
    if (path === "/rest/v1/docs" && method === "POST") { [].concat(body).forEach(r => table.set(r.col + "/" + r.id, { ...r })); return json(null, 201); }
    if (path === "/rest/v1/rpc/doc_merge") { const k = body.p_col + "/" + body.p_id; const r = table.get(k); table.set(k, { user_id: UID, col: body.p_col, id: body.p_id, deleted: false, data: r && !r.deleted ? { ...r.data, ...body.p_patch, items: { ...(r.data.items || {}), ...(body.p_patch.items || {}) } } : body.p_patch }); return json(null, 204); }
    if (path.startsWith("/rest/v1/rpc/create_health_token") || path === "/rest/v1/health_tokens") return json({ message: "demo must not call " + path }, 500);
    return json({ message: "not mocked " + path }, 404);
  }
  return { table, log, handle };
}

(async () => {
  const b = await chromium.launch(); const errs = []; const be = mockBackend();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  await ctx.route(SB + "/**", r => be.handle(r));
  await ctx.route("wss://**", r => r.abort());
  let rendered = 0;
  await ctx.route("https://challenges.cloudflare.com/**", r => { rendered++; r.fulfill({ contentType: "text/javascript", body: "let cb;window.turnstile={render:(el,o)=>{cb=o.callback;setTimeout(()=>cb('tok-'+Date.now()),50);return 1},reset:()=>setTimeout(()=>cb('tok-'+Date.now()),50)};" }); });
  const p = await ctx.newPage();
  p.on("pageerror", e => errs.push("pageerror: " + e.message));
  p.on("console", m => { if (m.type() === "error" && !/websocket|ERR_|fonts|Failed to load resource/i.test(m.text())) errs.push("console: " + m.text()); });
  await p.goto(BASE + "/"); await p.waitForSelector("#auth:not([hidden]) #auth-demo");
  await p.screenshot({ path: "e2e/shot-demo-signin.png" });
  await p.click("#auth-demo");
  await p.waitForSelector(".app:not([hidden]) #view", { timeout: 15000 });

  const rows = [...be.table.values()];
  const cols = {}; rows.forEach(r => { cols[r.col] = (cols[r.col] || 0) + 1; });
  console.log("seeded docs:", rows.length, cols, "captcha script loaded:", rendered);
  if (process.env.CAPTCHA) assert(rendered === 1, "Turnstile loaded");
  for (const c of ["habits", "tasks", "sessions", "exercises", "splits", "foodw", "txm", "stepsm", "bodym", "waterm"]) assert(cols[c], "missing " + c);
  assert(be.table.has("meta/demo") && be.table.has("meta/settings"), "marker and settings saved");
  const pad = n => String(n).padStart(2, "0"); const d = new Date(); const today = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const steps = rows.filter(r => r.col === "stepsm").flatMap(r => Object.keys(r.data.items)).sort();
  assert(steps.length === 30 && steps[29] === today, "30 days of steps ending today: " + steps[0] + ".." + steps[29]);
  await p.waitForTimeout(600);
  await p.screenshot({ path: "e2e/shot-demo-today.png", fullPage: true });
  console.log("greeting:", (await p.textContent("#view h1")).trim());

  // Train > Steps: no automatic Health sync for the demo
  await p.goto(BASE + "/#train"); await p.waitForSelector(".app:not([hidden]) #view");
  const stepsTab = p.locator('[data-act="train-tab"][data-v="steps"], [data-v="steps"][data-act]').first();
  if (await stepsTab.count()) { await stepsTab.click(); await p.waitForTimeout(300); }
  assert(!(await p.locator('#view [data-act="health-setup"]').count()), "Health setup is hidden in Train");
  await p.screenshot({ path: "e2e/shot-demo-train.png", fullPage: true });

  // Settings: demo card, no Health, no restore
  await p.click('[data-act="settings"]:visible'); await p.waitForSelector("#sheet:not([hidden])");
  assert(await p.locator('#sheet [data-act="demo-signup"]').count(), "demo card shown");
  assert(!(await p.locator('#sheet [data-act="health-setup"]').count()), "no Health section");
  assert(!(await p.locator('#sheet [data-act="import"]').count()), "no restore button");
  await p.locator('#sheet [data-act="demo-signup"]').scrollIntoViewIfNeeded();
  await p.screenshot({ path: "e2e/shot-demo-settings.png" });
  assert(!be.log.some(l => /health/.test(l)), "no Health calls: " + be.log.filter(l => /health/.test(l)));

  // Reload: the demo isn't filled twice
  const before = be.table.size; await p.reload(); await p.waitForSelector(".app:not([hidden]) #view"); await p.waitForTimeout(800);
  assert(be.log.filter(l => l === "POST /auth/v1/signup").length === 1, "one anonymous sign-in");
  console.log("docs after reload:", be.table.size, "(was", before + ")");

  // Create my account: signs out of the demo and opens the sign-up form
  await p.click('[data-act="settings"]:visible'); await p.click('#sheet [data-act="demo-signup"]');
  await p.waitForSelector("#auth:not([hidden])", { timeout: 10000 });
  console.log("after leaving:", (await p.textContent("#auth-title")).trim());
  assert(/create/i.test(await p.textContent("#auth-title")), "sign-up form shown");
  const left = await p.evaluate(id => Object.keys(localStorage).filter(k => k.includes(id)), UID);
  assert(!left.length, "demo cache cleared: " + left);
  console.log("errors:", errs);
  assert(!errs.length, "page errors");
  await b.close();
  console.log("demo e2e passed");
})().catch(e => { console.error(e); process.exit(1); });
