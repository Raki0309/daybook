// End-to-end check of the RPG layer against an in-memory stand-in for Supabase.
// Run: npm run build && npx vite preview --port 4173 & PW=$(npm root -g)/playwright node e2e/game.e2e.cjs
// Optional: FONTS=<dir with fonts.css, map.txt and woff2 files> for true-to-life screenshots.
const { chromium } = require(process.env.PW || "playwright");
const fs = require("fs");
const BASE = process.env.BASE || "http://localhost:4173";
const SB = "https://yuilurluttfnwildzshx.supabase.co";
const UID = "11111111-2222-3333-4444-555555555555";
const OUT = process.env.OUT || "e2e";
const W = +(process.env.W || 390);
const b64 = o => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = () => `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: UID, role: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600, email: "raki@example.com" })}.sig`;
const pad = n => String(n).padStart(2, "0");
const key = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const daysAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return key(d); };

function mockBackend() {
  const table = new Map();
  const merge1 = (a, b) => { const o = { ...(a || {}) }; for (const [k, v] of Object.entries(b || {})) o[k] = o[k] && typeof o[k] === "object" && v && typeof v === "object" ? { ...o[k], ...v } : v; return o; };
  const user = { id: UID, aud: "authenticated", role: "authenticated", email: "raki@example.com", app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
  const put = (col, id, data) => table.set(col + "/" + id, { user_id: UID, col, id, data, deleted: false });
  async function handle(route) {
    const req = route.request(); const url = new URL(req.url()); const path = url.pathname; const method = req.method();
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" }, body: JSON.stringify(body) });
    if (method === "OPTIONS") return json({});
    const body = req.postData() ? JSON.parse(req.postData()) : null;
    if (path === "/auth/v1/token") return json({ access_token: jwt(), token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: "r1", user });
    if (path === "/auth/v1/user") return json(user);
    if (path === "/rest/v1/docs" && method === "GET") { const off = +(url.searchParams.get("offset") || 0), lim = +(url.searchParams.get("limit") || 1000); return json([...table.values()].filter(r => !r.deleted).slice(off, off + lim)); }
    if (path === "/rest/v1/docs" && method === "POST") { [].concat(body).forEach(r => table.set(r.col + "/" + r.id, { ...r })); return json(null, 201); }
    if (path === "/rest/v1/docs" && method === "PATCH") { const col = url.searchParams.get("col").slice(3), id = url.searchParams.get("id").slice(3); const r = table.get(col + "/" + id); if (r) Object.assign(r, body); return json(null, 204); }
    if (path === "/rest/v1/rpc/doc_merge") { const k = body.p_col + "/" + body.p_id; const r = table.get(k); table.set(k, { user_id: UID, col: body.p_col, id: body.p_id, deleted: false, data: r && !r.deleted ? merge1(r.data, body.p_patch) : body.p_patch }); return json(null, 204); }
    if (path === "/rest/v1/health_tokens") return json([]);
    return json({ message: "not mocked " + path }, 404);
  }
  return { table, handle, put };
}

function seed(be) {
  const long = Date.now() - 90 * 864e5;
  be.put("meta", "settings", { name: "Raki", currency: "EUR", unit: "kg", rest: 120, weeklyWorkouts: 3, budget: 600, stepGoal: 10000, budgets: {}, expenseCats: ["Groceries", "Other"], incomeCats: ["Salary"] });
  const habits = [["h1", "Drink 2 L of water", "--s1", null], ["h2", "Read 20 minutes", "--s7", null], ["h3", "Stretch", "--s3", [0, 2, 4]]];
  const done = {}; for (let i = 1; i <= 6; i++) done[daysAgo(i)] = 1;
  habits.forEach(([id, name, color, days]) => be.put("habits", id, { id, name, freq: "daily", goal: 7, color, days, done: { ...done }, created: long, order: long }));
  be.put("habits", "h4", { id: "h4", name: "Gym", freq: "weekly", goal: 3, color: "--s2", done: {}, created: long, order: long + 1 });
  be.put("tasks", "t1", { id: "t1", title: "Make the bed", kind: "daily", done: { ...done }, created: long, priority: 0, notes: "" });
  be.put("tasks", "t2", { id: "t2", title: "Laundry", kind: "weekly", done: {}, created: long, priority: 0, notes: "" });
  be.put("tasks", "t3", { id: "t3", title: "Book the dentist", kind: "todo", due: daysAgo(0), doneAt: null, created: long, priority: 1, notes: "" });
  const steps = {}; for (let i = 1; i <= 14; i++) { const k = daysAgo(i); (steps[k.slice(0, 7)] ||= {})[k] = { id: k, date: k, n: 7000 + i * 97, src: "shortcut", at: long }; }
  Object.entries(steps).forEach(([m, items]) => be.put("stepsm", m, { items }));
}

(async () => {
  const b = await chromium.launch(); const errs = []; const be = mockBackend(); seed(be);
  const ctx = await b.newContext({ viewport: { width: W, height: 844 }, deviceScaleFactor: 2, colorScheme: process.env.DARK ? "dark" : "light", serviceWorkers: "block" });
  await ctx.route(SB + "/**", r => be.handle(r)); await ctx.route("wss://**", r => r.abort());
  if (process.env.FONTS) {
    const FD = process.env.FONTS; const map = Object.fromEntries(fs.readFileSync(FD + "/map.txt", "utf8").trim().split("\n").map(l => l.split(" ")));
    await ctx.route("https://fonts.googleapis.com/**", r => r.fulfill({ status: 200, contentType: "text/css", headers: { "access-control-allow-origin": "*" }, body: fs.readFileSync(FD + "/fonts.css") }));
    await ctx.route("https://fonts.gstatic.com/**", r => { const f = map[r.request().url()]; return f ? r.fulfill({ status: 200, contentType: "font/woff2", headers: { "access-control-allow-origin": "*" }, body: fs.readFileSync(FD + "/" + f) }) : r.abort(); });
  } else await ctx.route("https://fonts.*/**", r => r.abort());
  // The app defaults to Night; light runs follow the device so the Leyndell theme gets screenshots too.
  if (!process.env.DARK) await ctx.addInitScript(() => { try { if (!localStorage.getItem("daybook-theme")) localStorage.setItem("daybook-theme", "auto"); } catch {} });
  const p = await ctx.newPage();
  p.on("pageerror", e => errs.push("pageerror: " + e.message));
  p.on("console", m => { if (m.type() === "error" && !/websocket|ERR_|fonts|Failed to load resource/i.test(m.text())) errs.push("console: " + m.text()); if (m.type() === "warning" && /game:/.test(m.text())) errs.push("warn: " + m.text()); });
  const shot = async name => { await p.waitForTimeout(250); await p.screenshot({ path: `${OUT}/game-${name}-${W}${process.env.DARK ? "-dark" : ""}.png`, fullPage: true }); };
  const rows = col => [...be.table.values()].filter(r => r.col === col && !r.deleted);
  const ledger = () => rows("ledgerm").flatMap(r => Object.values(r.data.items || {})).filter(e => !e._del);
  const gold = () => ledger().filter(e => e.cur === "gold").reduce((s, e) => s + e.amt, 0);
  const overflow = async () => p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  const check = (ok, msg) => { if (!ok) { errs.push("FAILED: " + msg); console.log("  ✗ " + msg); } else console.log("  ✓ " + msg); };

  await p.goto(BASE + "/"); await p.waitForSelector("#auth:not([hidden])");
  await p.fill("#auth-email", "raki@example.com"); await p.fill("#auth-pass", "correct-horse-9"); await p.click("#auth-go");
  await p.waitForSelector(".app:not([hidden]) #view .invite", { timeout: 10000 }); await p.waitForTimeout(600);
  check(!!(await p.$(".invite")), "Today shows the invite before the game starts");
  await shot("1-invite");

  // Character creation
  await p.click('.invite [data-act="start-game"]'); await p.waitForSelector('#sheet form[data-form="onboard"]');
  await p.fill('#sheet input[name="heroName"]', "Raki the Bold");
  await p.click('#sheet [data-name="origin"][data-v="origin.samurai"]');
  await p.screenshot({ path: `${OUT}/game-2-create-${W}.png` });
  await p.click('#sheet fieldset[data-step="1"] [data-act="ob-step"][data-d="1"]');
  const suggested = await p.textContent('#sheet [data-name="stepGoal"][aria-pressed="true"]');
  check(/suggested/.test(suggested), "step goal is suggested from the last 14 days: " + suggested.trim());
  await p.click('#sheet [data-name="learnOn"][data-v="1"]');
  await p.screenshot({ path: `${OUT}/game-3-goals-${W}.png` });
  await p.click('#sheet fieldset[data-step="2"] [data-act="ob-step"][data-d="1"]');
  await p.screenshot({ path: `${OUT}/game-4-rewards-${W}.png` });
  await p.click('#sheet fieldset[data-step="3"] button.btn.pri');
  await p.waitForSelector("#view .herocard"); await p.waitForTimeout(1600);
  const tabs = await p.$$eval("#tabbar button", bs => bs.map(b => b.textContent.trim()));
  check(tabs.join(",") === "Hero,Quests,Food,Train,Money,Town", "tabs are " + tabs.join(", "));
  const set = be.table.get("meta/settings").data;
  check(set.game && set.game.start && set.game.learn.on === true, "game settings saved on the server");
  check(set.game.seed && set.game.seed.streak >= 6, "history seeded the streak: " + JSON.stringify(set.game.seed));
  const hero0 = be.table.get("game/character") && be.table.get("game/character").data;
  check(hero0 && hero0.name === "Raki the Bold" && hero0.origin === "origin.samurai", "hero saved with the Samurai origin");
  const kit = ["gear.head.land-of-reeds-helm", "gear.chest.land-of-reeds-armor", "gear.arms.land-of-reeds-gauntlets", "gear.legs.land-of-reeds-greaves", "gear.weapon.longbow"];
  check(kit.every(id => be.table.get("inv/" + id)) && kit.every(id => Object.values(hero0.equip).includes(id)), "Samurai starter kit owned and worn");
  check(rows("rewards").length === 3, "3 starter rewards saved");
  check(ledger().length === 0, "nothing paid yet");
  await shot("5-hero");
  check(!(await overflow()), "hero page has no sideways scroll");

  // Complete a habit quest: tutorial + reward
  const before = await p.textContent(".herocard .goldpill");
  await p.click('.board [data-act="toggle-habit"] >> nth=0'); await p.waitForTimeout(400);
  const t1 = await p.textContent("#toast");
  check(/Arise, Tarnished/.test(t1), "toast after first quest: " + t1);
  await p.waitForTimeout(1500);
  check(ledger().some(e => e.src === "tutorial") && ledger().some(e => e.src === "quest"), "tutorial and quest reward on the server ledger");
  const after = await p.textContent(".herocard .goldpill");
  check(before !== after, `gold went ${before.trim()} → ${after.trim()}`);
  // finish everything that can be checked
  for (;;) { const b2 = await p.$('.board [data-act^="toggle-"][aria-pressed="false"]'); if (!b2) break; await b2.click(); await p.waitForTimeout(250); }
  await p.waitForTimeout(1500);
  console.log("  board:", await p.textContent(".board .card-h .pill"), "| server gold:", gold(), "| levels:", ledger().filter(e => e.src === "levelup").map(e => e.srcId));
  await shot("6-hero-done");

  // Profile: trophies, titles and streaks
  await p.click('.herocard [data-act="profile"].trophypill'); await p.waitForSelector("#sheet .trophy");
  check((await p.$$eval("#sheet .trophy.won .t", ts => ts.map(t => t.textContent))).includes("Arisen"), "first quest trophy is won");
  check(ledger().some(e => e.id === "ach:ach.first-quest" && e.cur === "trophy"), "the trophy is recorded in the ledger");
  await p.click('#sheet [data-act="cosmetic"][data-id="title.tarnished"]'); await p.waitForTimeout(400);
  check((await p.textContent(".herocard .hc-title")) === "Tarnished", "the chosen title shows on the hero card");
  await p.waitForTimeout(250); await p.screenshot({ path: `${OUT}/game-6b-profile-${W}${process.env.DARK ? "-dark" : ""}.png` });
  check(!(await overflow()), "profile has no sideways scroll");
  await p.click("#sheet [data-act=close]");

  // Quests tab
  await p.click('[data-tab="quests"]:visible'); await p.waitForSelector(".board");
  await shot("7-quests");
  await p.click('[data-act="reorder"]'); await p.click('.board [data-act="q-move"][data-d="1"] >> nth=0'); await p.waitForTimeout(400);
  check((be.table.get("meta/settings").data.game.order || []).length > 0, "reorder saved the board order");
  await p.click('[data-act="reorder"]');
  await p.click('[data-act="quest-tab"][data-v="learning"]'); await p.fill("#ln-min", "25"); await p.click('form[data-form="learn"] button.btn'); await p.waitForTimeout(500);
  check(rows("learnm").length === 1, "learning session saved");
  await p.click('[data-act="focus-start"]'); await p.waitForTimeout(2300);
  check(/0:0[1-9]/.test(await p.textContent("[data-focus]")), "focus timer ticks");
  await shot("8-learning");
  await p.click('[data-act="focus-stop"]');
  await p.click('[data-act="quest-tab"][data-v="habits"]'); await shot("9-quests-habits");
  check(!(await overflow()), "quests has no sideways scroll");

  // Town
  await p.click('[data-tab="town"]:visible'); await p.waitForSelector(".items");
  await shot("10-armory");
  const g0 = gold();
  const buy = await p.$('[data-act="buy"]');
  if (buy) { const id = await buy.getAttribute("data-id"); await buy.click(); await buy.click(); await p.waitForTimeout(900);
    check(!!be.table.get("inv/" + id), "bought " + id);
    check(gold() < g0, `server gold ${g0} → ${gold()}`);
    check(Object.values(be.table.get("game/character").data.equip || {}).includes(id), "new gear replaces starter gear");
  } else check(false, "nothing affordable in the Armory with " + g0 + " Gold");
  await shot("11-armory-after");
  await p.click('[data-act="armory-tab"][data-v="weapons"]'); await shot("11b-armory-weapons");
  check(/Hand of Malenia/.test(await p.textContent("#view")) && /Also drops from Malenia/.test(await p.textContent("#view")), "the Hand of Malenia is sold and drops from Malenia");
  await p.click('[data-act="armory-tab"][data-v="talismans"]'); await shot("11c-armory-talismans");
  const tbuy = await p.$('[data-act="buy"][data-id^="talisman."]');
  if (tbuy) { const id = await tbuy.getAttribute("data-id"); await tbuy.click(); await tbuy.click(); await p.waitForTimeout(900);
    check((be.table.get("game/character").data.talismans || []).includes(id), "bought talisman " + id + " is worn");
  } else console.log("  (no talisman affordable with", gold(), "Gold)");
  await p.click('[data-act="town-tab"][data-v="wardrobe"]'); await shot("12-wardrobe");
  await p.click('[data-act="town-tab"][data-v="tavern"]'); await shot("13-tavern");
  const red = await p.$('[data-act="redeem"]');
  if (red) { await red.click(); await red.click(); await p.waitForTimeout(800); check(ledger().some(e => e.src === "tavern"), "redeemed a Tavern reward"); }
  await shot("14-tavern-after");
  check(!(await overflow()), "town has no sideways scroll");
  await p.click('[data-act="ledger"]'); await p.waitForSelector("#sheet"); await p.waitForTimeout(400); await p.screenshot({ path: `${OUT}/game-15-ledger-${W}.png` }); await p.click("#sheet [data-act=close]");

  // Theme switch: Night and Leyndell
  await p.click('[data-act="settings"]:visible'); await p.waitForSelector('#sheet [data-act="theme"]');
  await p.click('#sheet [data-act="theme"][data-v="leyndell"]');
  check(await p.evaluate(() => document.documentElement.dataset.theme) === "light", "Leyndell switches to the light theme");
  await p.click('#sheet [data-act="theme"][data-v="night"]');
  check(await p.evaluate(() => document.documentElement.dataset.theme) === "dark", "Night switches back");
  await p.click(`#sheet [data-act="theme"][data-v="${process.env.DARK ? "night" : "auto"}"]`); await p.click("#sheet [data-act=close]");

  // Switch off and back on
  await p.click('[data-act="settings"]:visible'); await p.click('#sheet [data-act="game-settings"]');
  await p.screenshot({ path: `${OUT}/game-16-settings-${W}.png` });
  await p.click('#sheet [data-act="game-off"]'); await p.click('#sheet [data-act="game-off"]'); await p.waitForTimeout(400);
  const tabsOff = await p.$$eval("#tabbar button", bs => bs.map(b => b.textContent.trim()));
  check(tabsOff.join(",") === "Today,Habits,Tasks,Food,Money,Train", "game off restores tabs: " + tabsOff.join(", "));
  await p.click('[data-act="settings"]:visible'); await p.click('#sheet [data-act="game-on"]'); await p.waitForTimeout(400);
  check(!!(await p.$("#view .herocard")), "game back on");

  // Reload with an empty cache: everything comes back from the server
  const lvl = await p.textContent(".herocard .hc-lv"); const gp = await p.textContent(".herocard .goldpill");
  await p.evaluate(() => { for (const k of Object.keys(localStorage)) if (k.startsWith("daybook:v1")) localStorage.removeItem(k); });
  await p.reload(); await p.waitForSelector("#view .herocard", { timeout: 10000 }); await p.waitForTimeout(1500);
  check(await p.textContent(".herocard .hc-lv") === lvl && await p.textContent(".herocard .goldpill") === gp, `after reload: ${lvl}, ${gp.trim()}`);
  const n0 = ledger().length; await p.waitForTimeout(2000);
  check(ledger().length === n0, "no extra ledger writes after reload (idempotent)");

  // Talismans: put more Gold on the server, reload, buy one, and check its perk applies.
  const lk = [...be.table.keys()].find(k => k.startsWith("ledgerm/")); const nowD = new Date();
  const tk = `${nowD.getFullYear()}-${String(nowD.getMonth() + 1).padStart(2, "0")}-${String(nowD.getDate()).padStart(2, "0")}`;
  be.table.get(lk).data.items["e2e:gift"] = { id: "e2e:gift", date: tk, cur: "gold", amt: 2000, src: "quest", srcId: "e2e", at: Date.now() };
  await p.evaluate(() => { for (const k of Object.keys(localStorage)) if (k.startsWith("daybook:v1")) localStorage.removeItem(k); });
  await p.reload(); await p.waitForSelector("#view .herocard", { timeout: 10000 }); await p.waitForTimeout(1200);
  const hpMax = async () => +(await p.getAttribute(".herocard [aria-label=\"HP\"]", "aria-valuemax"));
  const mx0 = await hpMax();
  await p.click('[data-tab="town"]:visible'); await p.click('[data-act="town-tab"][data-v="armory"]'); await p.click('[data-act="armory-tab"][data-v="talismans"]');
  const tb = '[data-act="buy"][data-id="talisman.crimson-amber-medallion"]'; await p.click(tb); await p.click(tb); await p.waitForTimeout(800);
  check((be.table.get("game/character").data.talismans || []).includes("talisman.crimson-amber-medallion"), "bought talisman is worn");
  const pb = '[data-act="buy"][data-id="talisman.gold-scarab"]'; if (await p.$(pb)) { await p.click(pb); await p.click(pb); await p.waitForTimeout(800); }
  check((be.table.get("game/character").data.talismans || []).length === 1, "one slot: the second talisman waits in the Wardrobe");
  await p.click('[data-act="town-tab"][data-v="wardrobe"]'); await shot("17-wardrobe-talisman");
  check(/\+10 max HP/.test(await p.textContent("#view")), "Wardrobe shows the active perk");
  await p.click('[data-tab="today"]:visible'); await p.waitForTimeout(300);
  check(await hpMax() === mx0 + 10, `max HP ${mx0} → ${await hpMax()}`);

  // Spirits: buy an ash, which starts awakening; legends and Torrent show what unlocks them.
  await p.click('[data-tab="town"]:visible'); await p.click('[data-act="town-tab"][data-v="spirits"]'); await p.waitForTimeout(200);
  await shot("18-spirits");
  const ab = '[data-act="buy"][data-id="ash.lone-wolf"]'; await p.click(ab); await p.click(ab); await p.waitForTimeout(800);
  check(!!be.table.get("inv/ash.lone-wolf"), "bought Lone Wolf Ashes");
  const stb = (be.table.get("game/character").data.stable || {});
  check(stb.awakening && stb.awakening.id === "ash.lone-wolf", "a new ash starts awakening");
  const txt = await p.textContent("#view");
  check(/Awakening/.test(txt) && /Blaidd the Half-Wolf/.test(txt) && /Joins you at level 10/.test(txt), "Spirits shows awakening, legends and Torrent");
  await shot("19-spirits-after");
  check(!(await overflow()), "spirits has no sideways scroll");

  // Items: buy a Scroll of Grace; it's counted from the ledger.
  await p.click('[data-act="town-tab"][data-v="armory"]'); await p.click('[data-act="armory-tab"][data-v="items"]'); await p.waitForTimeout(200);
  const sb = '[data-act="buy"][data-id="item.scroll-of-grace"]'; await p.click(sb); await p.click(sb); await p.waitForTimeout(800);
  check(ledger().some(e => e.srcId === "item.scroll-of-grace" && e.amt === -300), "bought a Scroll of Grace");
  check(/You hold 1 of 2/.test(await p.textContent("#view")), "the Armory shows the scroll held");
  await shot("20-items");
  check(!(await overflow()), "items has no sideways scroll");
  console.log("errors:", errs);
  await b.close();
  if (errs.length) process.exit(1);
})().catch(e => { console.error(e); process.exit(1); });
