import { test } from "node:test";
import assert from "node:assert/strict";
import { ECONOMY as E } from "../src/game/economy.js";
import * as G from "../src/game/engine.js";
import { buildDemo, seedDemo, DEMO_DAYS, DEMO_MARK } from "../src/demo.js";

const TODAY = "2026-10-03";
const asMap = docs => new Map(docs);
// What the app reads back from the documents (see initDb in legacy/app.js).
function appData(docs) {
  const col = c => docs.filter(([p]) => p.startsWith(c + "/")).map(([, d]) => d);
  const items = c => Object.fromEntries(col(c).flatMap(d => Object.values(d.items)).map(v => [v.id, v]));
  const steps = {}; Object.values(items("stepsm")).forEach(e => { steps[e.date] = e; });
  return { habits: col("habits"), tasks: col("tasks"), sessions: col("sessions"), learn: [], steps, food: items("foodw"), tx: items("txm"), body: items("bodym"), water: items("waterm") };
}

test("demo data covers the last 30 days and nothing outside them", () => {
  const docs = buildDemo(TODAY); const d = appData(docs);
  const first = G.addKey(TODAY, -(DEMO_DAYS - 1));
  const dates = [...Object.values(d.food), ...Object.values(d.tx), ...Object.values(d.body), ...Object.values(d.water), ...Object.values(d.steps), ...d.sessions].map(e => e.date);
  dates.push(...d.habits.flatMap(h => Object.keys(h.done)), ...d.tasks.filter(t => t.kind === "daily").flatMap(t => Object.keys(t.done)));
  assert.ok(dates.every(k => k >= first && k <= TODAY), "every date within the window");
  assert.equal(Object.keys(d.steps).length, DEMO_DAYS);
  assert.ok(Object.values(d.food).some(e => e.date === TODAY), "food logged today");
  assert.ok(Object.values(d.food).length > 60);
  assert.ok(d.sessions.length >= 10 && d.sessions.every(s => s.end > s.start && s.entries.length));
  assert.ok(Object.values(d.tx).some(t => t.type === "income"));
  // Habits exist before the first day they're ticked, or the game ignores those days.
  d.habits.forEach(h => assert.ok(G.keyOf(new Date(h.created)) < first));
});

test("buckets hold items for their own week or month", () => {
  for (const [path, data] of buildDemo(TODAY)) {
    const [col, id] = path.split("/");
    if (!data.items) continue;
    for (const e of Object.values(data.items)) assert.equal(col === "foodw" ? G.weekOf(e.date) : e.date.slice(0, 7), id, path);
  }
});

test("the same day gives the same demo, and another day shifts every date", () => {
  assert.deepEqual(buildDemo(TODAY), buildDemo(TODAY));
  const later = appData(buildDemo("2027-03-15"));
  assert.ok(Object.keys(later.steps).every(k => k > "2027-02-01"));
});

test("a hero created in the demo starts with live streaks and full HP", () => {
  const docs = buildDemo(TODAY); const d = appData(docs);
  const stepGoal = asMap(docs).get("meta/settings").stepGoal;
  const data = { ...d, stepGoal };
  // The same game the onboarding sheet creates, on the demo's last day.
  const game = { start: TODAY, dayEnd: "00:00", workoutDays: [0, 2, 4], steps: true, learn: { on: false }, order: [], pauses: [] };
  game.seed = G.seedStreak(data, game, TODAY, E);
  assert.ok(game.seed.streak >= 9, `streak from history: ${game.seed.streak}`);
  const now = new Date(2026, 9, 3, 20, 0);
  const r = G.simulate({ data, game, ledger: {}, days: {}, now, at: now.getTime(), canWrite: true, E, C: {} });
  assert.equal(r.hp, r.maxHp);
  assert.equal(r.downedRisk, false);
  assert.ok(r.streak >= 9, `overall streak alive: ${r.streak}`);
  assert.ok(r.board.today.dailies.some(q => q.done) && r.board.today.dailies.some(q => !q.done), "today is partly done");
});

function fakeDb(existing = {}) {
  const rows = new Map(Object.entries(existing)); let fresh = 0; setTimeout(() => { fresh = Date.now(); }, 5);
  return {
    rows, freshAt: () => fresh,
    doc: p => ({ get: async () => ({ exists: rows.has(p), data: () => rows.get(p) }), set: async v => { rows.set(p, v); } }),
  };
}

test("seedDemo writes every document once and the marker last", async () => {
  const db = fakeDb();
  assert.equal(await seedDemo(db, TODAY), true);
  const docs = buildDemo(TODAY);
  assert.equal(db.rows.size, docs.length);
  assert.equal([...db.rows.keys()].pop(), DEMO_MARK);
  assert.equal(await seedDemo(db, TODAY), false);
  assert.equal(db.rows.size, docs.length);
});

test("seedDemo leaves an already filled demo alone", async () => {
  const db = fakeDb({ [DEMO_MARK]: { day: "2026-09-01" } });
  assert.equal(await seedDemo(db, TODAY), false);
  assert.equal(db.rows.size, 1);
});
