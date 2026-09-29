import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ECONOMY as E } from "../src/game/economy.js";
import * as G from "../src/game/engine.js";

const C = JSON.parse(readFileSync(new URL("../src/game/catalog.json", import.meta.url)));
const at = (k, h = 12, m = 0) => { const d = G.parseKey(k); d.setHours(h, m, 0, 0); return d; };
const ms = k => at(k, 8).getTime();

// A small world: habits, tasks, steps, sessions and learning, plus the stored game docs.
function world(start, habits = 4) {
  return {
    data: {
      habits: Array.from({ length: habits }, (_, i) => ({ id: "h" + i, name: "Habit " + i, freq: "daily", created: ms("2026-01-01"), done: {}, order: i })),
      tasks: [], steps: {}, sessions: [], learn: [], stepGoal: 0,
    },
    game: { start, dayEnd: "00:00", workoutDays: [], learn: { on: false }, steps: false },
    ledger: {}, days: {},
  };
}
const doAll = (w, k) => w.data.habits.forEach(h => { h.done[k] = 1; });
// Open the app at a moment: run the day-end job and store what it writes.
function open(w, now, canWrite = true) {
  const r = G.simulate({ data: w.data, game: w.game, ledger: w.ledger, days: w.days, now, at: now.getTime(), canWrite, E, C });
  if (!r.active) return r;
  r.ledgerWrites.forEach(e => { w.ledger[e.id] = e; });
  r.dayWrites.forEach(d => { w.days[d.id] = d; });
  return r;
}

test("XP curve follows base × level^exp and levels carry over", () => {
  const n = L => Math.round(E.xp.base * L ** E.xp.exp);
  assert.equal(G.xpToNext(1, E), n(1));
  assert.equal(G.xpToNext(10, E), n(10));
  assert.deepEqual(G.levelInfo(n(1) - 1, E), { level: 1, into: n(1) - 1, need: n(1), max: false });
  assert.deepEqual(G.levelInfo(n(1), E), { level: 2, into: 0, need: n(2), max: false });
  assert.equal(G.levelInfo(1e9, E).level, E.xp.levelCap);
  assert.equal(E.xp.levelCap, 99, "room past the level 50 to 70 bosses");
});

test("verified and streak bonuses multiply the base reward", () => {
  assert.deepEqual(G.reward(E.earn.daily, {}, E), { xp: 20, gold: 20 });
  assert.deepEqual(G.reward(E.earn.daily, { verified: true }, E), { xp: 25, gold: 25 });
  assert.equal(G.streakBonus(0, E), 0);
  assert.equal(G.streakBonus(5, E), 0.1);
  assert.equal(G.streakBonus(15, E), 0.3);
  assert.equal(G.streakBonus(40, E), 0.3);
  assert.deepEqual(G.reward(E.earn.daily, { verified: true, bonus: 0.3 }, E), { xp: 33, gold: 33 });
});

test("the day boundary moves late nights to the previous day, across daylight saving", () => {
  const tz = process.env.TZ; process.env.TZ = "Europe/Belgrade";
  try {
    assert.equal(G.gameDate(new Date(2026, 8, 29, 1, 30), "03:00"), "2026-09-28");
    assert.equal(G.gameDate(new Date(2026, 8, 29, 3, 0), "03:00"), "2026-09-29");
    assert.equal(G.gameDate(new Date(2026, 8, 29, 0, 0), "00:00"), "2026-09-29");
    // Clocks go back on 25 Oct and forward on 29 Mar in Europe.
    assert.equal(G.gameDate(new Date(2026, 9, 25, 1, 30), "03:00"), "2026-10-24");
    assert.equal(G.gameDate(new Date(2026, 9, 25, 4, 0), "03:00"), "2026-10-25");
    assert.equal(G.addKey("2026-10-24", 1), "2026-10-25");
    assert.equal(G.addKey("2026-10-25", 1), "2026-10-26");
    assert.equal(G.addKey("2026-03-28", 1), "2026-03-29");
    assert.equal(G.addKey("2026-03-29", 1), "2026-03-30");
    assert.equal(G.weekdayOf("2026-09-28"), 0);
    assert.equal(G.weekOf("2026-09-28"), "2026-W40");
  } finally { process.env.TZ = tz; }
});

test("day one pays quests, the all-clear, the tutorial and the first level-up", () => {
  const w = world("2026-09-29", 2); doAll(w, "2026-09-29");
  const r = open(w, at("2026-09-29"));
  const ids = r.ledgerWrites.map(e => e.id).sort();
  assert.deepEqual(ids.filter(id => !id.startsWith("lvl:")), ["ac:2026-09-29:gold", "ac:2026-09-29:xp", "q:2026-09-29:habit:h0:gold", "q:2026-09-29:habit:h0:xp", "q:2026-09-29:habit:h1:gold", "q:2026-09-29:habit:h1:xp", "tut:quest.tutorial.awakens:gold", "tut:quest.tutorial.awakens:xp"]);
  assert.equal(r.xp, 20 + 20 + 30 + 50);
  assert.equal(r.level, G.levelInfo(120, E).level);
  assert.equal(r.gold, 20 + 20 + 20 + 50 + 100 * (r.level - 1));
  assert.equal(r.hp, G.maxHp(2, E), "a level-up restores full HP");
  const g = r.ledgerWrites.filter(e => e.cur === "gold");
  assert.ok(g.every(e => typeof e.bal === "number" && e.src && e.srcId && e.at), "gold entries carry source, balance and time");
});

test("running the day-end job again, or on a second device, pays nothing twice", () => {
  const w = world("2026-09-29", 3); doAll(w, "2026-09-29");
  open(w, at("2026-09-29"));
  const again = open(w, at("2026-09-29", 18));
  assert.equal(again.ledgerWrites.length, 0);
  const other = G.simulate({ data: w.data, game: w.game, ledger: w.ledger, days: w.days, now: at("2026-09-29", 20), canWrite: true, E, C });
  assert.equal(other.ledgerWrites.length, 0);
});

test("undoing a check-off takes its reward back but keeps the level-up", () => {
  const w = world("2026-09-29", 2); doAll(w, "2026-09-29");
  const first = open(w, at("2026-09-29"));
  delete w.data.habits[1].done["2026-09-29"];
  const r = open(w, at("2026-09-29", 13));
  const byId = Object.fromEntries(r.ledgerWrites.map(e => [e.id, e.amt]));
  assert.deepEqual(byId, { "q:2026-09-29:habit:h1:xp": 0, "q:2026-09-29:habit:h1:gold": 0, "ac:2026-09-29:xp": 0, "ac:2026-09-29:gold": 0 });
  assert.equal(r.gold, first.gold - 20 - 20);
  assert.equal(r.level, 1);
  assert.ok(w.ledger["lvl:2:gold"], "level-up gold stays");
});

test("only the first reward slots pay, but the all-clear needs every daily", () => {
  const w = world("2026-09-29", 7); doAll(w, "2026-09-29");
  const r = open(w, at("2026-09-29"));
  const paid = r.ledgerWrites.filter(e => e.src === "quest" && e.cur === "gold");
  assert.equal(paid.length, E.slots.start);
  assert.deepEqual(paid.map(e => e.srcId), ["habit:h0", "habit:h1", "habit:h2", "habit:h3", "habit:h4"]);
  assert.ok(r.ledgerWrites.some(e => e.id === "ac:2026-09-29:gold"));
  // Reordering changes which ones pay.
  const w2 = world("2026-09-29", 7); doAll(w2, "2026-09-29"); w2.game.order = ["habit:h6"];
  const r2 = open(w2, at("2026-09-29"));
  assert.equal(r2.ledgerWrites.filter(e => e.src === "quest" && e.cur === "gold")[0].srcId, "habit:h6");
});

test("the overall streak grows the bonus by 2% a day and freezes past days", () => {
  const w = world("2026-09-01", 4);
  for (let k = "2026-09-01"; k <= "2026-09-12"; k = G.addKey(k, 1)) { doAll(w, k); open(w, at(k, 21)); }
  const r = open(w, at("2026-09-12", 22));
  assert.equal(r.streak, 12);
  assert.equal(r.bonus, 0.22, "11 finished days before today");
  assert.equal(w.days["2026-09-10"].streak, 10);
  assert.ok(!w.days["2026-09-11"], "yesterday stays open");
  assert.equal(w.ledger["q:2026-09-12:habit:h0:gold"].amt, Math.round(20 * 1.22));
  // Editing history after it froze changes nothing.
  delete w.data.habits[0].done["2026-09-05"];
  assert.equal(open(w, at("2026-09-12", 23)).streak, 12);
});

test("a rest day with nothing scheduled neither adds to nor breaks the streak", () => {
  const w = world("2026-09-21", 1); w.data.habits[0].days = [0, 1, 2, 3, 4]; // weekdays only
  for (let k = "2026-09-21"; k <= "2026-09-29"; k = G.addKey(k, 1)) { if (G.weekdayOf(k) < 5) doAll(w, k); open(w, at(k, 21)); }
  const r = open(w, at("2026-09-29", 22));
  assert.equal(r.streak, 7);
});

test("days while the game was switched off are rest days: no damage, streak kept", () => {
  const w = world("2026-09-20", 2);
  for (const k of ["2026-09-20", "2026-09-21"]) { doAll(w, k); open(w, at(k, 21)); }
  // Off on the 22nd; back on the 28th. The off day itself still counts, the days after it don't.
  w.game.pauses = [{ from: "2026-09-23", to: "2026-09-27" }];
  doAll(w, "2026-09-22"); doAll(w, "2026-09-28");
  const r = open(w, at("2026-09-28", 21));
  assert.equal(r.streak, 4, "20, 21, 22 and 28 all clear; the paused days neither add nor break");
  assert.equal(r.hp, r.maxHp);
  assert.equal(Object.keys(w.ledger).filter(id => /^q:2026-09-2[3-7]/.test(id)).length, 0, "paused days pay nothing");
});

test("missed dailies cost HP, capped per day, and a full miss streak ends Downed", () => {
  const w = world("2026-09-20", 4);
  w.ledger["seed:gold"] = { id: "seed:gold", date: "2026-09-20", cur: "gold", amt: 1000, src: "test", srcId: "x" };
  let r = open(w, at("2026-09-20"));
  r = open(w, at("2026-09-22"));
  assert.equal(w.days["2026-09-20"].dmg, E.hp.dailyDamageCap, "4 misses would be 40, the cap keeps it at 20");
  assert.equal(r.hp, 50 - 20 - 20, "yesterday's damage already shows, still provisional");
  r = open(w, at("2026-09-23"));
  r = open(w, at("2026-09-24"));
  const down = w.days["2026-09-22"];
  assert.equal(down.downed, true);
  assert.equal(w.ledger["down:2026-09-22:gold"].amt, -100, "10% of carried Gold");
  assert.equal(w.days["2026-09-22"].hp, 50, "HP resets to full");
  assert.equal(r.level, 1, "levels are never lost");
});

test("yesterday stays open: checking it off restores the streak and pays", () => {
  const w = world("2026-09-27", 2);
  doAll(w, "2026-09-27"); open(w, at("2026-09-27"));
  let r = open(w, at("2026-09-29"));
  assert.equal(r.streak, 0); assert.equal(r.hp, G.maxHp(2, E) - 20, "day one levelled up to 2");
  doAll(w, "2026-09-28");
  r = open(w, at("2026-09-29", 9));
  assert.equal(r.streak, 2);
  assert.ok(w.ledger["q:2026-09-28:habit:h0:gold"].amt > 0);
  assert.ok(r.hp > G.maxHp(2, E) - 20);
});

test("self-reported completions older than yesterday pay nothing; verified steps still do", () => {
  const w = world("2026-09-20", 1); w.data.stepGoal = 8000; w.game.steps = true;
  open(w, at("2026-09-20"));
  w.data.habits[0].done["2026-09-24"] = 1;
  w.data.steps["2026-09-24"] = { n: 9000, src: "health" };
  w.data.steps["2026-09-25"] = { n: 9000, src: "manual" };
  open(w, at("2026-09-29"));
  assert.ok(!w.ledger["q:2026-09-24:habit:h0:gold"], "backdated habit");
  assert.equal(w.ledger["q:2026-09-24:steps:gold"].amt, 25, "verified steps, ×1.25");
  assert.ok(!w.ledger["q:2026-09-25:steps:gold"], "typed-in steps count as self-reported");
});

test("weekly tasks pay once per week and can be undone within the week", () => {
  const w = world("2026-09-28", 0);
  w.data.tasks.push({ id: "t1", title: "Laundry", kind: "weekly", created: ms("2026-09-01"), done: { "2026-W40": 1 } });
  let r = open(w, at("2026-09-29"));
  assert.equal(w.ledger["per:task:t1:2026-W40:gold"].amt, 20);
  r = open(w, at("2026-09-30"));
  assert.equal(r.ledgerWrites.length, 0);
  delete w.data.tasks[0].done["2026-W40"];
  open(w, at("2026-09-30", 13));
  assert.equal(w.ledger["per:task:t1:2026-W40:gold"].amt, 0);
});

test("steps, workouts and learning become dailies with the right verification", () => {
  const w = world("2026-09-28", 0);
  Object.assign(w.game, { steps: true, workoutDays: [0], learn: { on: true, goalMin: 20 } });
  w.data.stepGoal = 8000; w.data.steps["2026-09-28"] = { n: 8100, src: "shortcut" };
  w.data.sessions.push({ id: "s1", date: "2026-09-28", start: ms("2026-09-28"), end: ms("2026-09-28") + 3.6e6 });
  w.data.learn.push({ date: "2026-09-28", min: 25, timer: true });
  const qs = G.dailiesOn(G.indexData(w.data), w.game, "2026-09-28", E);
  assert.deepEqual(qs.map(q => [q.key, q.done, q.verified]), [["steps", true, true], ["workout", true, true], ["learn", true, true]]);
  const tue = G.dailiesOn(G.indexData(w.data), w.game, "2026-09-29", E);
  assert.deepEqual(tue.map(q => q.key), ["steps", "learn"], "workout only on scheduled weekdays");
});

test("nothing is written until the data has synced", () => {
  const w = world("2026-09-29", 1); doAll(w, "2026-09-29");
  const r = open(w, at("2026-09-29"), false);
  assert.equal(r.ledgerWrites.length, 0);
  assert.ok(r.gold > 0, "the screen still shows what you've earned");
});

test("your history seeds the first-day streak but pays nothing", () => {
  const w = world("2026-09-29", 1);
  for (const k of ["2026-09-24", "2026-09-25", "2026-09-26", "2026-09-27", "2026-09-28"]) doAll(w, k);
  // A learning quest and a step goal chosen today don't erase the habit streak you already have.
  w.game.learn = { on: true, goalMin: 20 }; w.game.steps = true; w.data.stepGoal = 9000;
  w.game.seed = G.seedStreak(w.data, w.game, "2026-09-29", E);
  assert.deepEqual(w.game.seed, { streak: 5, best: 5 });
  w.game.learn = { on: false }; w.game.steps = false;
  const r = open(w, at("2026-09-29"));
  assert.equal(r.streak, 5);
  assert.equal(r.bonus, 0.1);
  assert.ok(Object.values(w.ledger).every(e => e.date >= "2026-09-29"));
});

const item = id => { const it = C.items.find(i => i.id === id); assert.ok(it, "missing item " + id); return it; };
test("shop prices follow rarity × slot and the level gates", () => {
  assert.equal(G.itemPrice(item("gear.head.kaiden-helm"), E).gold, 150);
  assert.equal(G.itemPrice(item("gear.chest.knight-armor"), E).gold, 675);
  assert.equal(G.itemPrice(item("gear.arms.carian-knight-gauntlets"), E).gold, 900);
  assert.equal(G.itemPrice(item("gear.weapon.uchigatana"), E).gold, 1500, "the Uchigatana is a Rare weapon");
  assert.equal(G.itemPrice(item("gear.head.vagabond-knight-helm"), E), null, "origin gear is never sold");
  assert.equal(G.itemPrice(item("pouch.radahn"), E), null, "boss pouches only drop");
  assert.deepEqual(G.itemPrice(item("pouch.armory"), E), { gold: E.talismans.pouch.gold, level: E.talismans.pouch.level });
  assert.deepEqual(G.canBuy(item("gear.weapon.uchigatana"), { level: 7, gold: 5000 }, E), { ok: false, reason: "level", need: 8 });
  assert.deepEqual(G.canBuy(item("gear.head.kaiden-helm"), { level: 1, gold: 100 }, E), { ok: false, reason: "gold", short: 50 });
  assert.equal(G.canBuy(item("gear.head.kaiden-helm"), { level: 1, gold: 150 }, E).ok, true);
  const sold = G.armoryItems(C, E);
  assert.ok(sold.some(i => i.slot === "weapon") && sold.some(i => i.type === "talisman") && sold.some(i => i.id === "pouch.armory"));
  assert.ok(sold.every(i => i.rarity !== "starter" && i.purchasable));
  assert.equal(new Set(C.items.map(i => i.id)).size, C.items.length, "item ids are unique");
});

test("the Hand of Malenia costs about six months of full-effort Gold, or drops from Malenia", () => {
  const hand = item("gear.weapon.hand-of-malenia");
  const p = G.itemPrice(hand, E);
  // Steady full effort: 4 dailies and the all-clear at the capped streak bonus, plus level-up Gold.
  const perDay = 4 * G.reward(E.earn.daily, { bonus: E.streakBonus.cap }, E).gold + G.reward(E.earn.allClear, { bonus: E.streakBonus.cap }, E).gold + E.levelUp.gold * 50 / 365;
  const days = p.gold / perDay;
  assert.ok(days > 150 && days < 210, `${Math.round(days)} days of Gold`);
  assert.ok(hand.source.includes("boss.malenia"));
  const boss = C.bosses.find(b => b.id === "boss.malenia");
  assert.ok(boss.drops.includes(hand.id) && E.bosses[boss.id].level >= 50);
});

test("talismans add capped perks, and pouches add slots up to four", () => {
  assert.deepEqual(G.talismanPerks(["talisman.gold-scarab", "talisman.crimson-amber-medallion"], C, E), { goldPct: 3, maxHp: 10 });
  assert.equal(G.talismanPerks(["talisman.dragoncrest-shield-talisman", "talisman.dragoncrest-greatshield-talisman"], C, E).dmgPct, E.talismans.caps.dmgPct, "stacked shields stop at the cap");
  assert.deepEqual(G.talismanPerks(["gear.weapon.uchigatana", "nope"], C, E), {}, "only talismans carry perks");
  assert.equal(G.talismanSlots([], C, E), 1);
  assert.equal(G.talismanSlots(["pouch.armory", "gear.weapon.club"], C, E), 2);
  assert.equal(G.talismanSlots(["pouch.armory", "pouch.radahn", "pouch.malenia"], C, E), 4);
  assert.ok(C.items.filter(i => i.type === "gear").every(i => !i.perk), "armor and weapons never give stats");
});

test("talisman perks change open days' rewards, HP and damage", () => {
  const base = world("2026-09-20", 4); const P = { goldPct: 5, xpPct: 5, maxHp: 20, heal: 1, dmgPct: 50, streakRate: 1 };
  for (let k = "2026-09-20"; k <= "2026-09-27"; k = G.addKey(k, 1)) if (k !== "2026-09-24") doAll(base, k);
  const plain = G.simulate({ ...base, now: at("2026-09-28"), canWrite: false, E, C });
  const perk = G.simulate({ ...base, now: at("2026-09-28"), canWrite: false, E, C, perks: P });
  assert.equal(perk.maxHp, plain.maxHp + 20);
  assert.ok(perk.gold > plain.gold && perk.xp > plain.xp);
  assert.equal(G.dayDamage(2, E, P), 10, "half of the 20 damage from two misses");
  assert.equal(G.streakBonus(5, E, P), 0.2, "the streak bonus builds twice as fast");
  assert.equal(G.streakBonus(50, E, P), E.streakBonus.cap, "but keeps its cap");
});

test("the catalog is complete: origins, sets, bosses and slots all line up", () => {
  const slots = new Set(C.slots.map(s => s.id));
  for (const it of C.items) {
    assert.ok(C.rarityNames[it.rarity] && E.rarities[it.rarity], "rarity " + it.id);
    if (it.type === "gear" || it.type === "talisman") assert.ok(slots.has(it.slot), "slot " + it.id);
    if (it.type === "gear" && it.slot === "weapon") assert.ok(it.kind, "weapon kind " + it.id);
  }
  assert.equal(C.origins.length, 5);
  for (const o of C.origins) {
    item(o.weapon);
    if (o.setId) assert.equal(C.items.filter(i => i.setId === o.setId).length, 4, o.id + " wears a full set");
  }
  for (const b of C.bosses) { assert.ok(E.bosses[b.id], b.id); b.drops.forEach(item); }
});

test("the Tavern estimates days of quests and respects cooldowns", () => {
  const ledger = {};
  for (let i = 0; i < 14; i++) { const k = G.addKey("2026-09-29", -i); ledger["q" + i] = { id: "q" + i, date: k, cur: "gold", amt: 100, src: "quest" }; }
  ledger.buy = { id: "buy", date: "2026-09-29", cur: "gold", amt: -500, src: "armory" };
  ledger.lvl = { id: "lvl", date: "2026-09-29", cur: "gold", amt: 100, src: "levelup" };
  ledger.tut = { id: "tut", date: "2026-09-28", cur: "gold", amt: 50, src: "tutorial" };
  assert.equal(G.avgDailyGold(ledger, "2026-09-29", "2026-01-01", E), 100);
  assert.equal(G.avgDailyGold(ledger, "2026-09-29", "2026-09-28", E), 100, "a new player averages over the days played");
  const r = { price: 400, repeatable: true, cooldownDays: 7, lastDate: "2026-09-25" };
  assert.deepEqual(G.canRedeem(r, { gold: 1000, today: "2026-09-29" }), { ok: false, reason: "cooldown", until: "2026-10-02" });
  assert.equal(G.canRedeem(r, { gold: 1000, today: "2026-10-02" }).ok, true);
  assert.equal(G.canRedeem({ price: 50, repeatable: false, redeemedAt: 1 }, { gold: 100, today: "2026-09-29" }).reason, "used");
});

test("step goal suggestion is the recent baseline plus 10%", () => {
  const steps = {}; for (let i = 1; i <= 14; i++) steps[G.addKey("2026-09-29", -i)] = { n: 8000 };
  assert.equal(G.stepBaseline(steps, "2026-09-29", E), 9000);
  assert.equal(G.stepBaseline({}, "2026-09-29", E), null);
});

test("full daily completion reaches the pacing targets in the right ballpark", () => {
  const w = world("2026-01-01", 4); let r;
  const levelOn = {};
  for (let k = "2026-01-01"; k <= "2026-03-01"; k = G.addKey(k, 1)) { doAll(w, k); r = open(w, at(k, 21)); if (!levelOn[r.level]) levelOn[r.level] = k; }
  const days = k => Math.round((G.parseKey(k) - G.parseKey("2026-01-01")) / 864e5) + 1;
  assert.ok(days(levelOn[5]) <= 10, `level 5 on day ${days(levelOn[5])}`);
  assert.ok(days(levelOn[10]) <= 28, `level 10 on day ${days(levelOn[10])}`);
  // Level 50 takes about a year of the same effort (steady state, capped streak bonus, weekly task).
  let need = 0; for (let L = 1; L < 50; L++) need += G.xpToNext(L, E);
  const perDay = 4 * G.reward(E.earn.daily, { bonus: E.streakBonus.cap }, E).xp + G.reward(E.earn.allClear, { bonus: E.streakBonus.cap }, E).xp;
  assert.ok(need / perDay > 320 && need / perDay < 400, `level 50 in about ${Math.round(need / perDay)} days`);
});

test("each quest type keeps its own streak; frozen days remember them", () => {
  const w = world("2026-09-01", 2); w.game.workoutDays = [0, 2, 4]; // Mon, Wed, Fri
  const sess = []; w.data.sessions = sess;
  for (let k = "2026-09-01"; k <= "2026-09-20"; k = G.addKey(k, 1)) {
    doAll(w, k);
    if ([0, 2, 4].includes(G.weekdayOf(k)) && k !== "2026-09-09") sess.push({ id: "s" + k, date: k, start: 1, end: 2 });
    open(w, at(k, 21));
  }
  const r = open(w, at("2026-09-21", 9));
  assert.equal(r.streaks.discipline.cur, 20, "habits done every day");
  assert.equal(r.streaks.discipline.best, 20);
  // Workouts: Wed 9/9 missed, then Fri 11, Mon 14, Wed 16, Fri 18 done; today (Mon 21) isn't done yet.
  assert.equal(r.streaks.workouts.cur, 4, "the missed Wednesday reset it, and today can't break it yet");
  assert.equal(r.streaks.workouts.best, 4);
  assert.equal(r.streaks.steps.cur, 0, "no step quest, no step streak");
  assert.ok(w.days["2026-09-09"].types && w.days["2026-09-09"].types.workouts === 0, "frozen days store type outcomes");
  // Replaying from the frozen records gives the same answer.
  const again = G.simulate({ ...w, now: at("2026-09-21", 9), canWrite: false, E, C });
  assert.deepEqual(again.streaks, r.streaks);
});

test("Spirit Ashes awaken from quests done, and Bond grows only while summoned", () => {
  const w = world("2026-09-01", 2);
  for (let k = "2026-09-01"; k <= "2026-09-10"; k = G.addKey(k, 1)) doAll(w, k);
  let st = { awakening: { id: "ash.jellyfish", from: "2026-09-03" } };
  let r = G.simulate({ ...w, now: at("2026-09-10", 21), canWrite: false, E, C, stable: st });
  assert.deepEqual(r.stable.awakening, { id: "ash.jellyfish", progress: 16, goal: E.stable.awakenQuests.uncommon, ready: false }, "8 days × 2 quests");
  st = { awakening: { id: "ash.lone-wolf", from: "2026-09-03" } };
  assert.equal(G.simulate({ ...w, now: at("2026-09-10", 21), canWrite: false, E, C, stable: st }).stable.awakening.ready, true);
  // Summon the wolf on the 5th, switch to the jellyfish on the 8th: the wolf gets the 5th to the 7th.
  st = G.summon({}, "ash.lone-wolf", "2026-09-05");
  st = G.summon(st, "ash.jellyfish", "2026-09-08");
  assert.deepEqual(st.periods, { "ash.lone-wolf": [["2026-09-05", "2026-09-08"]], "ash.jellyfish": [["2026-09-08", null]] });
  r = G.simulate({ ...w, now: at("2026-09-10", 21), canWrite: false, E, C, stable: st });
  const perDay = 2 * E.stable.bond.perQuest + E.stable.bond.allClear;
  assert.equal(r.stable.bond["ash.lone-wolf"].points, 3 * perDay);
  assert.equal(r.stable.bond["ash.jellyfish"].points, 3 * perDay);
  assert.equal(r.stable.bond["ash.lone-wolf"].level, E.stable.bond.levels.filter(n => 3 * perDay >= n).length);
  // Switching twice in one day leaves no empty period behind.
  const same = G.summon(G.summon({}, "ash.lone-wolf", "2026-09-05"), "ash.jellyfish", "2026-09-05");
  assert.deepEqual(same.periods, { "ash.lone-wolf": [], "ash.jellyfish": [["2026-09-05", null]] });
  assert.equal(G.summon(same, null, "2026-09-06").summoned, null, "dismiss");
});

test("NPC companions unlock from a long streak of one quest type; ashes are sold by rarity", () => {
  const s = G.npcStatus({ workouts: { cur: 12, best: E.stable.npcs["npc.blaidd"].days }, steps: { cur: 3, best: 5 } }, E);
  assert.equal(s["npc.blaidd"].unlocked, true);
  assert.equal(s["npc.alexander"].unlocked, false);
  assert.equal(s["npc.sellen"].best, 0);
  assert.equal(C.items.find(i => i.id === "npc.blaidd").rarity, "mythic");
  const ashes = G.shopItems(C, "ash", E);
  assert.equal(ashes.length, 5);
  assert.equal(G.itemPrice(ashes.find(a => a.id === "ash.lone-wolf"), E).gold, E.rarities.common.gold);
  assert.equal(G.shopItems(C, "npc", E).length, 0, "companions can't be bought");
});
