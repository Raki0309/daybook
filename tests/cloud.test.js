import { test } from "node:test";
import assert from "node:assert/strict";

// Browser globals the doc store expects.
const listeners = {};
globalThis.addEventListener = (t, fn) => { (listeners[t] ||= []).push(fn); };
globalThis.document = { visibilityState: "visible", addEventListener() {} };
const ls = new Map();
globalThis.localStorage = { getItem: k => ls.get(k) ?? null, setItem: (k, v) => ls.set(k, String(v)) };
let online = true;
Object.defineProperty(globalThis, "navigator", { value: { get onLine() { return online; } }, configurable: true });

const { createDocStore, merge1 } = await import("../src/cloud.js");
const tick = (ms = 0) => new Promise(r => setTimeout(r, ms));

// In-memory stand-in for the Supabase client: the docs table, doc_merge and realtime.
function fakeSb(uid, rows = []) {
  const table = new Map(rows.map(r => [r.col + "/" + r.id, { user_id: uid, deleted: false, ...r }]));
  let onChange = null, down = false, echoDelay = 5;
  const fail = () => ({ error: { message: "TypeError: Failed to fetch" } });
  const emit = r => setTimeout(() => onChange && onChange({ new: { ...r } }), echoDelay);
  const put = (col, id, data, deleted = false) => { const r = { user_id: uid, col, id, data, deleted }; table.set(col + "/" + id, r); emit(r); };
  const sb = {
    table, calls: 0,
    setDown(v) { down = v; }, setEchoDelay(v) { echoDelay = v; },
    remote(col, id, data) { put(col, id, data); },
    foreign(col, id, data) { setTimeout(() => onChange && onChange({ new: { user_id: "someone-else", col, id, data, deleted: false } }), 0); },
    from() {
      return {
        upsert: async r => { sb.calls++; if (down) return fail(); put(r.col, r.id, r.data); return { error: null }; },
        update: v => ({ match: async m => { sb.calls++; if (down) return fail(); put(m.col, m.id, v.data, v.deleted); return { error: null }; } }),
        select: () => {
          const q = { eq: () => q, order: () => q, range: async (a, b) => (down ? fail() : { data: [...table.values()].filter(r => !r.deleted).slice(a, b + 1), error: null }) };
          return q;
        },
      };
    },
    rpc: async (fn, a) => { sb.calls++; if (down) return fail(); const cur = table.get(a.p_col + "/" + a.p_id); put(a.p_col, a.p_id, cur && !cur.deleted ? merge1(cur.data, a.p_patch) : a.p_patch); return { error: null }; },
    channel() { const ch = { on: (_e, _f, fn) => { onChange = fn; return ch; }, subscribe: cb => { setTimeout(() => cb("SUBSCRIBED"), 0); return ch; } }; return ch; },
    removeChannel() {},
  };
  return sb;
}

test("loads existing docs and reports synced", async () => {
  const sb = fakeSb("u1", [{ col: "habits", id: "h1", data: { id: "h1", name: "Read" } }, { col: "meta", id: "settings", data: { stepGoal: 9000 } }]);
  const db = createDocStore(sb, "u1");
  const got = []; let settings = null, status = null;
  db.collection("habits").onSnapshot(s => got.push(s.docs.map(d => d.data().name)));
  db.doc("meta/settings").onSnapshot(s => { settings = s.exists ? s.data() : null; });
  db.onStatus(s => { status = s; });
  await tick(20);
  assert.deepEqual(got.at(-1), ["Read"]);
  assert.equal(settings.stepGoal, 9000);
  assert.equal(status, "synced");
  db.close();
});

test("writes apply locally at once, then reach the server", async () => {
  const sb = fakeSb("u2");
  const db = createDocStore(sb, "u2");
  let habits = [];
  db.collection("habits").onSnapshot(s => { habits = s.docs.map(d => d.id); });
  await tick(20);
  const p = db.doc("habits/h2").set({ id: "h2" });
  await tick(0);
  assert.deepEqual(habits, ["h2"]);
  await p;
  assert.deepEqual(sb.table.get("habits/h2").data, { id: "h2" });
  await db.doc("habits/h2").delete();
  await tick(20);
  assert.deepEqual(habits, []);
  assert.equal(sb.table.get("habits/h2").deleted, true);
  db.close();
});

test("bucket updates merge items instead of replacing them", async () => {
  const sb = fakeSb("u3", [{ col: "stepsm", id: "2026-09", data: { items: { "2026-09-01": { n: 1 } } } }]);
  const db = createDocStore(sb, "u3");
  let items = {};
  db.collection("stepsm").onSnapshot(s => { items = s.docs[0] ? s.docs[0].data().items : {}; });
  await tick(20);
  await db.doc("stepsm/2026-09").update({ items: { "2026-09-02": { n: 2 } } });
  await tick(20);
  assert.deepEqual(Object.keys(items).sort(), ["2026-09-01", "2026-09-02"]);
  assert.deepEqual(Object.keys(sb.table.get("stepsm/2026-09").data.items).sort(), ["2026-09-01", "2026-09-02"]);
  db.close();
});

test("offline changes wait in the outbox and send in order when back online", async () => {
  const sb = fakeSb("u4");
  const db = createDocStore(sb, "u4");
  await tick(20);
  sb.setDown(true); online = false;
  await db.doc("tasks/t1").set({ id: "t1", title: "A" });
  await db.doc("tasks/t1").set({ id: "t1", title: "B" });
  assert.equal(db.pending(), 2);
  assert.equal(JSON.parse(ls.get("daybook:outbox:u4")).length, 2);
  sb.setDown(false); online = true;
  listeners.online.forEach(fn => fn());
  await tick(40);
  assert.equal(db.pending(), 0);
  assert.equal(sb.table.get("tasks/t1").data.title, "B");
  db.close();
});

test("stale echoes of in-flight writes are ignored, other devices' changes arrive", async () => {
  const sb = fakeSb("u5");
  const db = createDocStore(sb, "u5");
  const seen = [];
  db.doc("meta/settings").onSnapshot(s => seen.push(s.exists ? s.data().v : null));
  await tick(20);
  sb.setEchoDelay(0);
  const a = db.doc("meta/settings").set({ v: 1 });
  const b = db.doc("meta/settings").set({ v: 2 });
  await Promise.all([a, b]); await tick(10);
  assert.equal(seen.at(-1), 2);
  assert.ok(!seen.slice(seen.indexOf(2)).includes(1), "value never flips back to 1 after 2");
  sb.remote("meta", "settings", { v: 3 });
  await tick(10);
  assert.equal(seen.at(-1), 3);
  db.close();
});

test("rows for another user are ignored", async () => {
  const sb = fakeSb("u6");
  const db = createDocStore(sb, "u6");
  let n = 0;
  db.collection("habits").onSnapshot(s => { n = s.docs.length; });
  await tick(20);
  sb.foreign("habits", "x", { id: "x" });
  await tick(10);
  assert.equal(n, 0);
  db.close();
});
