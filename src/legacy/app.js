import { cloudDb, cloudConfig, account, createHealthToken, healthTokenInfo, signOut } from "../cloud.js";
import { ECONOMY as E } from "../game/economy.js";
import CAT from "../game/catalog.json";
import * as GE from "../game/engine.js";
import { avatarSvg, itemArt, DEFAULT_LOOK } from "../game/art.js";
import { pixelIcon, ICONS as PX } from "../ui/icons.mjs";

"use strict";
/* ---------- tiny helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const pad = n => String(n).padStart(2, "0");
const dkey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseD = k => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d || 1); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const mkey = (d = new Date()) => dkey(d).slice(0, 7);
// The day a moment belongs to. With the game's "day ends at" setting, late nights count toward the day before.
const today = () => { const g = S.settings && S.settings.game; return g && g.dayEnd && g.dayEnd !== "00:00" ? GE.gameDate(new Date(), g.dayEnd) : dkey(); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const clone = o => JSON.parse(JSON.stringify(o));
const sum = a => a.reduce((s, v) => s + (+v || 0), 0);
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
function wkey(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return `${t.getUTCFullYear()}-W${pad(Math.ceil(((t - y0) / 864e5 + 1) / 7))}`;
}
const startOfWeek = d => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - (x.getDay() + 6) % 7); return x; };
const fmtDate = (k, o = {day: "numeric", month: "short"}) => parseD(k).toLocaleDateString(undefined, o);
const relDay = k => { const t = today(); if (k === t) return "Today"; if (k === dkey(addDays(new Date(), -1))) return "Yesterday"; if (k === dkey(addDays(new Date(), 1))) return "Tomorrow"; return fmtDate(k, {weekday: "short", day: "numeric", month: "short"}); };
const monthName = mk => parseD(mk + "-01").toLocaleDateString(undefined, {month: "long", year: "numeric"});
const monthShort = mk => parseD(mk + "-01").toLocaleDateString(undefined, {month: "short", year: "numeric"});
const monthDays = mk => { const d = parseD(mk + "-01"); return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); };
const monthElapsed = mk => mk === mkey() ? new Date().getDate() / monthDays(mk) : mk < mkey() ? 1 : 0;
const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const round = (w, inc) => +(Math.round(w / inc) * inc).toFixed(2);
const e1rm = (w, r) => (!w || !r) ? 0 : r === 1 ? +w : +w * (1 + r / 30);
const n1 = v => +(+v).toFixed(1);

/* ---------- icons ---------- */
const IC = {
  today: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  food: '<path d="M7 3v8M4.5 3v5a2.5 2.5 0 0 0 5 0V3M7 11v10M17 21V3c-2.2 1.2-3.5 3.6-3.5 7 0 2 .9 3 3.5 3"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  barcode: '<path d="M4 5v14M7 5v14M10 5v14M14 5v14M16 5v14M20 5v14"/>',
  spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
  drop: '<path d="M12 3c3 4 6 7.5 6 11a6 6 0 0 1-12 0c0-3.5 3-7 6-11z"/>',
  habits: '<path d="M12 3c2 3 5 5 5 9a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3 0-3-1-5 1-7.5z"/>',
  tasks: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M3.5 6l1.2 1.2L6.8 5M3.5 12l1.2 1.2L6.8 11M3.5 18l1.2 1.2L6.8 17"/>',
  money: '<rect x="3" y="6" width="18" height="13" rx="3"/><path d="M3 10h18M16 14.5h2"/>',
  train: '<path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="M5 12.5l4.2 4.2L19 7"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  left: '<path d="M15 5l-7 7 7 7"/>',
  right: '<path d="M9 5l7 7-7 7"/>',
  up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  down: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  flat: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>',
  play: '<path d="M7 5l12 7-12 7z"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  dots: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
  hero: '<path d="M12 3l7 3v5.5c0 4.5-3 7.8-7 9.5-4-1.7-7-5-7-9.5V6z"/><path d="M12 8v8M8.5 11.5h7"/>',
  quests: '<path d="M14.5 17.5L3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2"/><path d="M14.5 6.5L18 3h3v3l-3.5 3.5M5 14l4 4M7 17l-3 3M3 19l2 2"/>',
  town: '<path d="M22 20v-9H2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2z"/><path d="M18 11V4H6v7M15 22v-4a3 3 0 0 0-6 0v4M22 11V9M2 11V9M6 4V2M18 4V2M10 4V2M14 4V2"/>',
  steps: '<path d="M4 16v-2.4C4 11.5 3 10.5 3 8c0-2.7 1.5-6 4.5-6C9.4 2 10 3.8 10 5.5c0 3.1-2 5.7-2 8.7V16a2 2 0 1 1-4 0zM20 20v-2.4c0-2.1 1-3.1 1-5.6 0-2.7-1.5-6-4.5-6C14.6 6 14 7.8 14 9.5c0 3.1 2 5.7 2 8.7V20a2 2 0 1 0 4 0zM16 17h4M4 13h4"/>',
  book: '<path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2zM22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z"/>',
  task1: '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
  bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1.1-2.1-.2-4.1 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.2.4-2.3 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  shield: '<path d="M12 3l7 3v5.5c0 4.5-3 7.8-7 9.5-4-1.7-7-5-7-9.5V6z"/><path d="M9 12l2 2 4-4"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
};
// Pixel icons from the art thread, drawn only at whole multiples of their 12px grid; the line icons stay as a fallback.
const pxSize = s => s <= 16 ? 12 : s <= 26 ? 24 : 36;
const icon = (n, s = 20, w = 2) => PX[n] ? pixelIcon(n, pxSize(s)) : `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[n] || ""}</svg>`;

/* ---------- state ---------- */
const EXP_CATS = ["Groceries","Eating out","Rent","Bills","Transport","Health","Fitness","Shopping","Entertainment","Subscriptions","Travel","Other"];
const INC_CATS = ["Salary","Freelance","Gifts","Refunds","Other"];
const MUSCLES = ["Chest","Back","Shoulders","Biceps","Triceps","Quads","Hamstrings","Glutes","Calves","Core","Forearms","Full body"];
const COLORS = ["--s1","--s2","--s3","--s4","--s5","--s6","--s7","--s8"];
const DEF_SETTINGS = {name: "", currency: "EUR", unit: "kg", rest: 120, weeklyWorkouts: 4, budget: 0, stepGoal: 10000, budgets: {}, expenseCats: EXP_CATS, incomeCats: INC_CATS};
const DOC_COLS = ["habits", "tasks", "exercises", "splits", "sessions", "foods", "rewards", "inv"];
const BUCKETS = {tx: "txm", body: "bodym", food: "foodw", water: "waterm", steps: "stepsm", learn: "learnm", ledger: "ledgerm", gdays: "daym"};
const BKEY = {food: d => wkey(parseD(d))};
const LS_KEY = "daybook:v1:" + (account.user ? account.user.id : "local");
const cached = lsGet(LS_KEY, null);
const S = Object.assign({settings: {...DEF_SETTINGS}, habits: {}, tasks: {}, exercises: {}, splits: {}, sessions: {}, tx: {}, body: {}, foods: {}, food: {}, water: {}, steps: {}, active: null, learn: {}, ledger: {}, gdays: {}, rewards: {}, inv: {}, hero: null}, cached || {});
S.settings = {...DEF_SETTINGS, ...S.settings};
const ui = Object.assign({foodMeal: "breakfast", tab: "today", taskTab: "todo", trainTab: "workout", month: mkey(), progEx: "", progMetric: "e1rm", showDone: false}, lsGet("daybook:ui", {}));
ui.month = ui.month || mkey();
ui.foodDate = today();
const TABS = [["today","Today"],["habits","Habits"],["tasks","Tasks"],["food","Food"],["money","Money"],["train","Train"]];
// Once the game has started, Habits and Tasks merge into Quests and the Town opens.
const GAME_TABS = [["today","Hero"],["quests","Quests"],["food","Food"],["train","Train"],["money","Money"],["town","Town"]];
const gameOn = () => { const g = S.settings.game; return !!(g && g.start && !g.off); };
const tabList = () => gameOn() ? GAME_TABS : TABS;
ui.questTab = ui.questTab || "board"; ui.townTab = ui.townTab || "armory"; ui.armoryTab = ui.armoryTab || "armor";
function fixTab() {
  if (gameOn() && (ui.tab === "habits" || ui.tab === "tasks")) { ui.questTab = ui.tab; ui.tab = "quests"; }
  if (!gameOn() && ui.tab === "quests") ui.tab = ui.questTab === "tasks" ? "tasks" : "habits";
  if (!tabList().some(t => t[0] === ui.tab)) ui.tab = "today";
}
const tabFromHash = location.hash.replace("#", "");
if ([...TABS, ...GAME_TABS].some(t => t[0] === tabFromHash)) ui.tab = tabFromHash;

let db = null, dbState = "local", activeDirty = false;
let saveT = 0;
function saveLocal() { clearTimeout(saveT); saveT = setTimeout(() => lsSet(LS_KEY, S), 250); }
const saveUi = () => lsSet("daybook:ui", ui);

/* ---------- sync layer (artifact db, local fallback) ---------- */
const chains = {};
let inflight = 0; const waiters = [];
async function slot() { while (inflight >= 4) await new Promise(r => waiters.push(r)); inflight++; }
function release() { inflight--; const w = waiters.shift(); if (w) w(); }
async function withRetry(fn) { try { return await fn(); } catch (e) { if (e && e.code === "unavailable") { await sleep(300 + Math.random() * 600); return fn(); } throw e; } }
function q(path, fn) {
  const p = (chains[path] || Promise.resolve()).then(async () => { await slot(); try { await fn(); } finally { release(); } }).catch(e => {
    console.warn("save failed", path, e);
    if (e && e.code === "quota_exceeded") toast("Storage is full. Delete old entries, then try again.");
    else if (e && e.code === "revoked") { db = null; dbState = "local"; renderChrome(); }
    else toast("Couldn't save that change. Check your connection.");
  });
  chains[path] = p; return p;
}
function bucketPath(col, date) { return BUCKETS[col] + "/" + (BKEY[col] ? BKEY[col](date) : date.slice(0, 7)); }
function bucketWrite(path, id, val) {
  q(path, async () => {
    const ref = db.doc(path);
    try { await withRetry(() => ref.update({items: {[id]: val}})); }
    catch (e) {
      if (e && (e.code === "invalid_argument" || e.code === "transform_error")) {
        const s = await ref.get(); if (s.exists) throw e;
        await withRetry(() => ref.set({items: {[id]: val}}));
      } else throw e;
    }
  });
}
// Several bucket items at once: one merge per month document instead of one per item.
function putMany(col, objs, silent) {
  if (!objs.length) return;
  const m = {...S[col]}; objs.forEach(o => { m[o.id] = o; }); S[col] = m; saveLocal(); if (!silent) scheduleRender();
  if (!db) return;
  const byPath = {}; objs.forEach(o => { (byPath[bucketPath(col, o.date)] ||= {})[o.id] = clone(o); });
  for (const [path, items] of Object.entries(byPath)) q(path, async () => {
    const ref = db.doc(path);
    try { await withRetry(() => ref.update({items})); }
    catch (e) { if (e && (e.code === "invalid_argument" || e.code === "transform_error")) { const s2 = await ref.get(); if (s2.exists) throw e; await withRetry(() => ref.set({items})); } else throw e; }
  });
}
function setHero(patch) {
  S.hero = {...(S.hero || {}), ...patch}; saveLocal(); scheduleRender();
  if (db) { const data = clone(S.hero); q("game/character", () => withRetry(() => db.doc("game/character").set(data))); }
}
function put(col, obj, silent) {
  const prev = S[col][obj.id];
  S[col] = {...S[col], [obj.id]: obj}; saveLocal(); if (!silent) scheduleRender();
  if (!db) return;
  if (BUCKETS[col]) {
    if (prev && bucketPath(col, prev.date) !== bucketPath(col, obj.date)) bucketWrite(bucketPath(col, prev.date), prev.id, {id: prev.id, _del: 1});
    bucketWrite(bucketPath(col, obj.date), obj.id, clone(obj));
  } else {
    const data = clone(obj);
    q(col + "/" + obj.id, () => withRetry(() => db.doc(col + "/" + obj.id).set(data)));
  }
}
function del(col, id) {
  const prev = S[col][id]; if (!prev) return;
  const m = {...S[col]}; delete m[id]; S[col] = m; saveLocal(); scheduleRender();
  if (!db) return;
  if (BUCKETS[col]) bucketWrite(bucketPath(col, prev.date), id, {id, _del: 1});
  else q(col + "/" + id, () => withRetry(() => db.doc(col + "/" + id).delete()));
}
function setSettings(patch) {
  S.settings = {...S.settings, ...patch}; saveLocal(); scheduleRender();
  if (db) { const data = clone(S.settings); q("meta/settings", () => withRetry(() => db.doc("meta/settings").set(data))); }
}
let activeT = 0;
function setActive(session, now) {
  S.active = session; saveLocal(); activeDirty = true;
  clearTimeout(activeT);
  const run = () => {
    if (!db) { activeDirty = false; return; }
    const data = S.active ? {session: clone(S.active)} : null;
    q("meta/active", () => withRetry(() => data ? db.doc("meta/active").set(data) : db.doc("meta/active").delete())).then(() => { activeDirty = false; });
  };
  if (now) run(); else activeT = setTimeout(run, 900);
}
function applyCol(col, m, snap) {
  if (snap.metadata && snap.metadata.fromCache && snap.empty && Object.keys(S[col]).length) return;
  if (JSON.stringify(m) === JSON.stringify(S[col])) return;
  S[col] = m; saveLocal(); scheduleRender();
}
function onDbErr(e) { console.warn("db", e); if (e && (e.code === "revoked" || e.code === "not_granted")) { db = null; dbState = "local"; renderChrome(); } }
async function initDb() {
  db = cloudDb();
  if (!db) { dbState = "local"; renderChrome(); return; }
  db.onStatus(st => { dbState = st; renderChrome(); if (st === "synced") scheduleReconcile(); });
  DOC_COLS.forEach(col => db.collection(col).onSnapshot(snap => {
    const m = {}; snap.docs.forEach(d => { const v = d.data(); if (v) m[d.id] = v; }); applyCol(col, m, snap);
  }, onDbErr));
  Object.entries(BUCKETS).forEach(([col, path]) => db.collection(path).onSnapshot(snap => {
    const m = {}; snap.docs.forEach(d => { const items = (d.data() || {}).items || {}; for (const [id, v] of Object.entries(items)) if (v && !v._del) m[id] = v; });
    applyCol(col, m, snap);
  }, onDbErr));
  db.doc("meta/settings").onSnapshot(s => {
    if (s.exists) { const v = {...DEF_SETTINGS, ...s.data()}; if (JSON.stringify(v) !== JSON.stringify(S.settings)) { S.settings = v; saveLocal(); scheduleRender(); } }
  }, onDbErr);
  db.doc("game/character").onSnapshot(s => {
    if (s.exists) { const v = s.data(); if (JSON.stringify(v) !== JSON.stringify(S.hero)) { S.hero = v; saveLocal(); scheduleRender(); } }
  }, onDbErr);
  db.doc("meta/active").onSnapshot(s => {
    if (activeDirty) return;
    const v = s.exists ? (s.data().session || null) : null;
    if (JSON.stringify(v) === JSON.stringify(S.active)) return;
    S.active = v; saveLocal(); scheduleRender();
  }, onDbErr);
}

/* ---------- formatting ---------- */
function money(v, whole) {
  try { return new Intl.NumberFormat(undefined, {style: "currency", currency: S.settings.currency || "EUR", maximumFractionDigits: whole ? 0 : 2, minimumFractionDigits: whole ? 0 : 2}).format(v || 0); }
  catch { return (v || 0).toFixed(whole ? 0 : 2) + " " + S.settings.currency; }
}
const U = () => S.settings.unit || "kg";
const fmtW = w => `${+(+w || 0).toFixed(2)} ${U()}`;
const fmtVol = v => v >= 10000 ? `${n1(v / 1000)}k ${U()}` : `${Math.round(v)} ${U()}`;
const fmtDur = ms => { const m = Math.round(ms / 60000); return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`; };

/* ---------- habits ---------- */
const habitList = () => Object.values(S.habits).filter(h => !h.archived).sort((a, b) => (a.order ?? a.created) - (b.order ?? b.created));
const hDone = (h, k) => !!(h.done && h.done[k]);
function weekCount(h, d = new Date()) { const s = startOfWeek(d); let c = 0; for (let i = 0; i < 7; i++) if (hDone(h, dkey(addDays(s, i)))) c++; return c; }
const scheduledOn = (x, k) => !x.days || x.days.includes(GE.weekdayOf(k));
function habitStreak(h) {
  if (h.freq === "weekly") {
    let s = startOfWeek(new Date()), n = 0;
    if (weekCount(h, s) < (h.goal || 1)) s = addDays(s, -7);
    while (weekCount(h, s) >= (h.goal || 1)) { n++; s = addDays(s, -7); if (n > 520) break; }
    return n;
  }
  // Days a habit isn't scheduled on neither add to nor break its streak.
  let d = new Date(), n = 0;
  if (!hDone(h, dkey(d))) d = addDays(d, -1);
  for (let i = 0; i < 3660; i++, d = addDays(d, -1)) { const k = dkey(d); if (hDone(h, k)) n++; else if (scheduledOn(h, k)) break; }
  return n;
}
function habitBest(h) {
  const keys = Object.keys(h.done || {}).filter(k => h.done[k]).sort(); if (!keys.length) return 0;
  if (h.freq === "weekly") {
    const weeks = {}; keys.forEach(k => { const w = dkey(startOfWeek(parseD(k))); weeks[w] = (weeks[w] || 0) + 1; });
    const ok = Object.keys(weeks).filter(w => weeks[w] >= (h.goal || 1)).sort();
    let best = 0, run = 0, prev = null;
    ok.forEach(w => { run = prev && dkey(addDays(parseD(prev), 7)) === w ? run + 1 : 1; best = Math.max(best, run); prev = w; });
    return best;
  }
  let best = 1, run = 1;
  for (let i = 1; i < keys.length; i++) { run = dkey(addDays(parseD(keys[i - 1]), 1)) === keys[i] ? run + 1 : 1; best = Math.max(best, run); }
  return best;
}
function habitRate(h) {
  const created = h.created ? new Date(h.created) : addDays(new Date(), -29);
  if (h.freq === "weekly") {
    let met = 0, n = 0; let s = startOfWeek(new Date());
    for (let i = 0; i < 8; i++) { if (i > 0 || weekCount(h, s) >= (h.goal || 1)) { if (addDays(s, 6) >= startOfWeek(created)) { n++; if (weekCount(h, s) >= (h.goal || 1)) met++; } } s = addDays(s, -7); }
    return n ? met / n : 0;
  }
  const days = Math.max(1, Math.min(30, Math.floor((new Date() - new Date(created.getFullYear(), created.getMonth(), created.getDate())) / 864e5) + 1));
  let c = 0, n = 0; for (let i = 0; i < days; i++) { const k = dkey(addDays(new Date(), -i)); if (!scheduledOn(h, k)) continue; n++; if (hDone(h, k)) c++; }
  return n ? c / n : 0;
}
function toggleHabit(id, k) {
  const h = S.habits[id]; if (!h) return;
  const done = {...(h.done || {})}; if (done[k]) delete done[k]; else done[k] = 1;
  put("habits", {...h, done});
}

/* ---------- tasks ---------- */
const periodKey = (kind, d = parseD(today())) => kind === "daily" ? dkey(d) : kind === "weekly" ? wkey(d) : kind === "monthly" ? mkey(d) : "";
const taskDone = t => t.kind === "todo" ? !!t.doneAt : !!(t.done && t.done[periodKey(t.kind)]);
// A daily task can be checked off for a given day (yesterday, from the quest board); others use the current period.
function toggleTask(id, day) {
  const t = S.tasks[id]; if (!t) return;
  if (t.kind === "todo") put("tasks", {...t, doneAt: t.doneAt ? null : Date.now()});
  else { const done = {...(t.done || {})}; const k = day && t.kind === "daily" ? day : periodKey(t.kind); if (done[k]) delete done[k]; else done[k] = 1; put("tasks", {...t, done}); }
}
function dueToday() {
  const t = today();
  return Object.values(S.tasks).filter(x => {
    if (x.kind === "todo") return !x.doneAt && x.due && x.due <= t;
    if (x.kind === "daily" && !scheduledOn(x, t)) return false;
    return !taskDone(x);
  }).sort((a, b) => (b.priority || 0) - (a.priority || 0) || (a.due || "").localeCompare(b.due || ""));
}
function periodStreak(t) {
  let d = new Date(), n = 0;
  const step = t.kind === "daily" ? (x => addDays(x, -1)) : t.kind === "weekly" ? (x => addDays(x, -7)) : (x => new Date(x.getFullYear(), x.getMonth() - 1, 1));
  if (!(t.done || {})[periodKey(t.kind, d)]) d = step(d);
  for (let i = 0; i < 3660; i++, d = step(d)) { const k = periodKey(t.kind, d); if ((t.done || {})[k]) n++; else if (t.kind !== "daily" || scheduledOn(t, k)) break; }
  return n;
}

/* ---------- money ---------- */
const txIn = mk => Object.values(S.tx).filter(t => t.date.slice(0, 7) === mk);
const sumTx = (mk, type) => sum(txIn(mk).filter(t => t.type === type).map(t => t.amount));
function catTotals(mk) { const m = {}; txIn(mk).filter(t => t.type === "expense").forEach(t => { m[t.cat] = (m[t.cat] || 0) + t.amount; }); return m; }
const shiftMonth = (mk, n) => { const d = parseD(mk + "-01"); return mkey(new Date(d.getFullYear(), d.getMonth() + n, 1)); };

/* ---------- training ---------- */
const exName = id => (S.exercises[id] || {}).name || "Removed exercise";
const exList = () => Object.values(S.exercises).sort((a, b) => a.name.localeCompare(b.name));
const sessionsSorted = () => Object.values(S.sessions).sort((a, b) => a.start - b.start);
function exHistory(exId) {
  return sessionsSorted().map(s => ({s, sets: (s.entries || []).filter(e => e.ex === exId).flatMap(e => e.sets || [])})).filter(h => h.sets.length);
}
function suggest(exId, rmin, rmax, n) {
  const inc = +(S.exercises[exId] || {}).inc || 2.5;
  const H = exHistory(exId);
  if (!H.length) return {w: null, reps: Array(n).fill(rmax), text: `No history yet. Pick a weight you could lift for ${rmax} reps with 2 to 3 reps left.`, kind: "new"};
  const last = H[H.length - 1].sets;
  const top = Math.max(...last.map(s => +s.w || 0));
  const atTop = last.filter(s => (+s.w || 0) === top);
  const allMax = atTop.length >= Math.min(n, last.length) && atTop.every(s => +s.r >= rmax);
  const rirs = atTop.map(s => s.rir).filter(v => v !== "" && v != null).map(Number);
  const easy = rirs.length && rirs.length === atTop.length && Math.min(...rirs) >= 3 && atTop.every(s => +s.r >= rmin);
  if (allMax || easy) {
    const w = round(top + inc, inc);
    return {w, reps: Array(n).fill(rmin), kind: "up", text: allMax ? `You hit ${rmax}+ reps on every set at ${fmtW(top)}. Go up to <b>${fmtW(w)}</b> for ${rmin}+ reps.` : `Last time felt easy (3+ reps in reserve). Go up to <b>${fmtW(w)}</b>.`};
  }
  const prev = H.length > 1 ? H[H.length - 2].sets : null;
  if (atTop.some(s => +s.r < rmin) && prev) {
    const ptop = Math.max(...prev.map(s => +s.w || 0));
    if (ptop === top && prev.filter(s => (+s.w || 0) === top).some(s => +s.r < rmin) && top > 0) {
      const w = round(top * 0.9, inc);
      return {w, reps: Array(n).fill(rmax), kind: "down", text: `Two sessions under ${rmin} reps at ${fmtW(top)}. Drop to <b>${fmtW(w)}</b> and build back up.`};
    }
  }
  const reps = Array.from({length: n}, (_, i) => { const p = atTop[i] || atTop[atTop.length - 1]; return Math.min(rmax, Math.max(rmin, (+p.r || rmin) + 1)); });
  return {w: top, reps, kind: "flat", text: `Stay at <b>${fmtW(top)}</b> and beat last time by a rep: <b>${reps.join(" · ")}</b>.`};
}
function lastSetsText(exId) {
  const H = exHistory(exId); if (!H.length) return "";
  const l = H[H.length - 1]; return `${fmtDate(l.s.date)}: ` + l.sets.map(s => `${+s.w}×${s.r}`).join(", ");
}
function exStats(exId) {
  return exHistory(exId).map(h => ({
    date: h.s.date, t: h.s.start,
    e1rm: Math.max(...h.sets.map(s => e1rm(+s.w, +s.r))),
    top: Math.max(...h.sets.map(s => +s.w || 0)),
    vol: sum(h.sets.map(s => (+s.w || 0) * (+s.r || 0))),
    reps: Math.max(...h.sets.map(s => +s.r || 0)),
    sets: h.sets,
  }));
}
const activeSplit = () => { const all = Object.values(S.splits).sort((a, b) => a.created - b.created); return all.find(s => s.active) || all[0] || null; };
function nextDay(split) {
  if (!split || !split.days.length) return null;
  const last = sessionsSorted().filter(s => s.splitId === split.id).pop();
  if (!last) return split.days[0];
  const i = split.days.findIndex(d => d.id === last.dayId);
  return split.days[(i + 1) % split.days.length];
}
function weekSessions() { const s = dkey(startOfWeek(new Date())); return Object.values(S.sessions).filter(x => x.date >= s); }
function muscleSets(sessions) {
  const m = {}; sessions.forEach(s => (s.entries || []).forEach(e => { const mu = (S.exercises[e.ex] || {}).muscle || "Other"; m[mu] = (m[mu] || 0) + (e.sets || []).length; })); return m;
}
const sessVol = s => sum((s.entries || []).flatMap(e => e.sets || []).map(x => (+x.w || 0) * (+x.r || 0)));
const sessSets = s => sum((s.entries || []).map(e => (e.sets || []).length));

const LIB = [
  ["Bench Press","Chest",2.5,6,10],["Incline Dumbbell Press","Chest",2,8,12],["Cable Fly","Chest",2.5,12,15],
  ["Overhead Press","Shoulders",2.5,6,10],["Lateral Raise","Shoulders",1,12,15],["Face Pull","Shoulders",2.5,12,15],
  ["Triceps Pushdown","Triceps",2.5,10,15],["Overhead Triceps Extension","Triceps",2.5,10,15],
  ["Pull-up","Back",2.5,6,10],["Barbell Row","Back",2.5,6,10],["Lat Pulldown","Back",2.5,8,12],["Seated Cable Row","Back",2.5,8,12],["Deadlift","Back",5,3,6],
  ["Barbell Curl","Biceps",1.25,8,12],["Hammer Curl","Biceps",1,10,12],
  ["Back Squat","Quads",2.5,5,8],["Leg Press","Quads",5,10,15],["Romanian Deadlift","Hamstrings",2.5,8,10],["Leg Curl","Hamstrings",2.5,10,15],
  ["Hip Thrust","Glutes",5,8,12],["Standing Calf Raise","Calves",2.5,10,15],["Cable Crunch","Core",2.5,10,15],
];
const TEMPLATES = {
  "Push / Pull / Legs": [["Push", ["Bench Press","Incline Dumbbell Press","Overhead Press","Lateral Raise","Triceps Pushdown"]], ["Pull", ["Pull-up","Barbell Row","Seated Cable Row","Face Pull","Barbell Curl","Hammer Curl"]], ["Legs", ["Back Squat","Romanian Deadlift","Leg Press","Leg Curl","Standing Calf Raise"]]],
  "Upper / Lower": [["Upper", ["Bench Press","Barbell Row","Overhead Press","Lat Pulldown","Barbell Curl","Triceps Pushdown"]], ["Lower", ["Back Squat","Romanian Deadlift","Leg Press","Leg Curl","Standing Calf Raise","Cable Crunch"]]],
  "Full body A / B": [["Full body A", ["Back Squat","Bench Press","Barbell Row","Barbell Curl"]], ["Full body B", ["Deadlift","Overhead Press","Pull-up","Hip Thrust"]]],
};
function ensureExercise(name) {
  const found = Object.values(S.exercises).find(e => e.name.toLowerCase() === name.toLowerCase()); if (found) return found.id;
  const l = LIB.find(x => x[0] === name) || [name, "Full body", 2.5, 8, 12];
  const ex = {id: uid(), name: l[0], muscle: l[1], inc: l[2], repMin: l[3], repMax: l[4], created: Date.now()};
  put("exercises", ex, true); return ex.id;
}
function applyTemplate(name) {
  const t = TEMPLATES[name]; if (!t) return;
  Object.values(S.splits).filter(s => s.active).forEach(s => put("splits", {...s, active: false}, true));
  const split = {id: uid(), name, created: Date.now(), active: true, days: t.map(([dn, exs]) => ({id: uid(), name: dn, items: exs.map(n => { const id = ensureExercise(n); const e = S.exercises[id]; return {ex: id, sets: 3, repMin: e.repMin, repMax: e.repMax}; })}))};
  put("splits", split); toast(`Added ${name}. It's now your active split.`);
}

/* ---------- charts ---------- */
const chartSpecs = {}; let chartSeq = 0;
function chart(spec) { const id = "c" + (++chartSeq); chartSpecs[id] = spec; return `<div class="chart" id="${id}" data-chart="${id}" style="height:${spec.h || 180}px" role="img" aria-label="${esc(spec.label || "Chart")}"></div>`; }
function niceTicks(min, max, count = 4) {
  if (min === max) { min -= 1; max += 1; }
  const step0 = (max - min) / count, mag = 10 ** Math.floor(Math.log10(step0)), err = step0 / mag;
  const step = (err >= 7.5 ? 10 : err >= 3.5 ? 5 : err >= 1.5 ? 2 : 1) * mag;
  const t = []; for (let v = Math.floor(min / step) * step; v <= Math.ceil(max / step) * step + step / 2; v += step) t.push(+v.toFixed(6));
  return t;
}
const shortNum = v => Math.abs(v) >= 10000 ? n1(v / 1000) + "k" : Math.abs(v) >= 1000 ? (v / 1000).toFixed(1).replace(/\.0$/, "") + "k" : String(+v.toFixed(1));
function drawCharts() {
  $$("[data-chart]").forEach(el => {
    const spec = chartSpecs[el.dataset.chart]; if (!spec) return;
    const W = el.clientWidth; if (!W) return;
    el.innerHTML = spec.type === "bars" ? svgBars(spec, W) : spec.type === "group" ? svgGroup(spec, W) : svgLine(spec, W);
    el._spec = spec; el._W = W;
  });
}
function svgLine(spec, W) {
  const H = spec.h || 180, P = spec.spark ? {l: 2, r: 8, t: 8, b: 6} : {l: 42, r: 14, t: 12, b: 26};
  const pts = spec.points; if (!pts.length) return "";
  const ys = pts.map(p => p.y); let lo = Math.min(...ys), hi = Math.max(...ys);
  if (spec.zero) lo = Math.min(0, lo);
  if (spec.pace) hi = Math.max(hi, spec.pace.y1);
  const pad0 = (hi - lo) * 0.12 || 1; if (!spec.zero) lo -= pad0; hi += pad0;
  const ticks = spec.spark ? [lo, hi] : niceTicks(lo, hi, 4); const y0 = ticks[0], y1 = ticks[ticks.length - 1];
  const xs = pts.map(p => p.x); const x0 = spec.x0 ?? Math.min(...xs), x1 = spec.x1 ?? Math.max(...xs);
  const X = x => P.l + (x1 === x0 ? (W - P.l - P.r) / 2 : (x - x0) / (x1 - x0) * (W - P.l - P.r));
  const Y = y => P.t + (1 - (y - y0) / (y1 - y0 || 1)) * (H - P.t - P.b);
  const c = spec.color || "var(--s1)";
  let g = "";
  if (!spec.spark) {
    ticks.forEach(t => { g += `<line x1="${P.l}" x2="${W - P.r}" y1="${Y(t)}" y2="${Y(t)}" stroke="var(--line)" stroke-width="1" ${t === y0 ? "" : 'stroke-dasharray="2 4"'}/><text x="${P.l - 8}" y="${Y(t) + 4}" text-anchor="end">${shortNum(t)}</text>`; });
    const idx = pts.length > 2 ? [0, Math.floor((pts.length - 1) / 2), pts.length - 1] : pts.map((_, i) => i);
    [...new Set(idx)].forEach((i, k, a) => { const anchor = a.length > 1 && k === 0 ? "start" : k === a.length - 1 && a.length > 1 ? "end" : "middle"; g += `<text x="${X(pts[i].x)}" y="${H - 6}" text-anchor="${anchor}">${esc(pts[i].xl)}</text>`; });
  }
  if (spec.pace) g += `<line x1="${X(x0)}" x2="${X(x1)}" y1="${Y(spec.pace.y0)}" y2="${Y(spec.pace.y1)}" stroke="var(--ink-2)" stroke-width="1.5" stroke-dasharray="5 4"/>`;
  const d = pts.map((p, i) => `${i ? "L" : "M"}${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join("");
  const area = `${d}L${X(pts[pts.length - 1].x).toFixed(1)},${H - P.b}L${X(pts[0].x).toFixed(1)},${H - P.b}Z`;
  const gid = "g" + Math.random().toString(36).slice(2, 7);
  const dots = spec.spark ? "" : pts.length <= 40 ? pts.map(p => `<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="3.2" fill="${c}" stroke="var(--surface)" stroke-width="2"/>`).join("") : "";
  const lp = pts[pts.length - 1];
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs><linearGradient id="${gid}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${c}" stop-opacity=".22"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></linearGradient></defs>${g}<path d="${area}" fill="url(#${gid})"/><path d="${d}" fill="none" stroke="${c}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>${dots}<circle cx="${X(lp.x)}" cy="${Y(lp.y)}" r="5" fill="${c}" stroke="var(--surface)" stroke-width="2.5"/><line class="xh" x1="0" x2="0" y1="${P.t}" y2="${H - P.b}" stroke="var(--ink-3)" stroke-width="1" visibility="hidden"/><circle class="xp" r="5" fill="${c}" stroke="var(--surface)" stroke-width="2.5" visibility="hidden"/></svg>`
    + `<template>${JSON.stringify(pts.map(p => [+X(p.x).toFixed(1), +Y(p.y).toFixed(1)]))}</template>`;
}
function svgBars(spec, W) {
  const H = spec.h || 180, P = {l: 42, r: 8, t: 12, b: 26};
  const bars = spec.bars; if (!bars.length) return "";
  const hi = Math.max(1, spec.ref || 0, ...bars.map(b => b.v)); const ticks = niceTicks(0, hi, 3); const y1 = ticks[ticks.length - 1];
  const Y = v => P.t + (1 - v / y1) * (H - P.t - P.b);
  const bw = (W - P.l - P.r) / bars.length; const gap = Math.max(2, bw * 0.28);
  let g = "";
  ticks.forEach(t => { g += `<line x1="${P.l}" x2="${W - P.r}" y1="${Y(t)}" y2="${Y(t)}" stroke="var(--line)" ${t === 0 ? "" : 'stroke-dasharray="2 4"'}/><text x="${P.l - 8}" y="${Y(t) + 4}" text-anchor="end">${shortNum(t)}</text>`; });
  const every = Math.ceil(bars.length / Math.max(1, Math.floor((W - P.l) / 34)));
  bars.forEach((b, i) => {
    const x = P.l + i * bw + gap / 2, w = Math.max(1, bw - gap), y = Y(b.v), h = H - P.b - y;
    if (b.v > 0) { const r = Math.min(4, w / 2, h); g += `<path d="M${x},${H - P.b}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${H - P.b}Z" fill="${b.c || spec.color || "var(--s1)"}" ${b.dim ? 'opacity=".45"' : ""}/>`; }
    if (i % every === 0 || i === bars.length - 1 && (bars.length - 1) % every > every / 2) g += `<text x="${x + w / 2}" y="${H - 7}" text-anchor="middle">${esc(b.l)}</text>`;
  });
  if (spec.ref) g += `<line x1="${P.l}" x2="${W - P.r}" y1="${Y(spec.ref)}" y2="${Y(spec.ref)}" stroke="var(--ink-2)" stroke-width="1.5" stroke-dasharray="5 4"/><text x="${P.l + 4}" y="${Y(spec.ref) - 5}" text-anchor="start" style="fill:var(--ink-2);font-weight:600;paint-order:stroke;stroke:var(--surface);stroke-width:3px">Goal</text>`;
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${g}<rect class="hl" x="0" y="${P.t}" width="${bw}" height="${H - P.t - P.b}" fill="var(--ink)" opacity=".06" visibility="hidden"/></svg>`;
}
function svgGroup(spec, W) {
  const H = spec.h || 190, P = {l: 46, r: 8, t: 12, b: 26};
  const gs = spec.groups; const hi = Math.max(1, ...gs.flatMap(g => [g.a, g.b])); const ticks = niceTicks(0, hi, 3); const y1 = ticks[ticks.length - 1];
  const Y = v => P.t + (1 - v / y1) * (H - P.t - P.b);
  const gw = (W - P.l - P.r) / gs.length; const inner = Math.min(22, (gw - 12) / 2);
  let g = "";
  ticks.forEach(t => { g += `<line x1="${P.l}" x2="${W - P.r}" y1="${Y(t)}" y2="${Y(t)}" stroke="var(--line)" ${t === 0 ? "" : 'stroke-dasharray="2 4"'}/><text x="${P.l - 8}" y="${Y(t) + 4}" text-anchor="end">${shortNum(t)}</text>`; });
  const bar = (x, v, c) => { if (v <= 0) return ""; const y = Y(v), h = H - P.b - y, r = Math.min(4, inner / 2, h); return `<path d="M${x},${H - P.b}V${y + r}Q${x},${y} ${x + r},${y}H${x + inner - r}Q${x + inner},${y} ${x + inner},${y + r}V${H - P.b}Z" fill="${c}"/>`; };
  gs.forEach((d, i) => { const cx = P.l + i * gw + gw / 2; g += bar(cx - inner - 1, d.a, "var(--s1)") + bar(cx + 1, d.b, "var(--s2)"); g += `<text x="${cx}" y="${H - 7}" text-anchor="middle">${esc(d.l)}</text>`; });
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${g}<rect class="hl" x="0" y="${P.t}" width="${gw}" height="${H - P.t - P.b}" fill="var(--ink)" opacity=".06" visibility="hidden"/></svg>`;
}
function chartHover(el, ev) {
  const spec = el._spec; if (!spec || spec.spark) return;
  const r = el.getBoundingClientRect(); const x = ev.clientX - r.left; const tip = $("#tip"); let html = "", px = 0;
  if (spec.type === "bars" || spec.type === "group") {
    const n = spec.type === "bars" ? spec.bars.length : spec.groups.length; const P = spec.type === "bars" ? 42 : 46;
    const w = (el._W - P - 8) / n; const i = Math.floor((x - P) / w); if (i < 0 || i >= n) return hideTip(el);
    const hl = el.querySelector(".hl"); hl.setAttribute("x", P + i * w); hl.setAttribute("visibility", "visible");
    html = spec.type === "bars" ? spec.bars[i].tip : spec.groups[i].tip; px = r.left + P + i * w + w / 2;
  } else {
    const t = el.querySelector("template"); if (!t) return; const xy = JSON.parse(t.innerHTML);
    let bi = 0, bd = 1e9; xy.forEach(([px2], i) => { const d = Math.abs(px2 - x); if (d < bd) { bd = d; bi = i; } });
    const [cx, cy] = xy[bi]; const xh = el.querySelector(".xh"), xp = el.querySelector(".xp");
    xh.setAttribute("x1", cx); xh.setAttribute("x2", cx); xh.setAttribute("visibility", "visible");
    xp.setAttribute("cx", cx); xp.setAttribute("cy", cy); xp.setAttribute("visibility", "visible");
    html = spec.points[bi].tip; px = r.left + cx;
  }
  tip.innerHTML = html; tip.hidden = false;
  const tw = tip.offsetWidth; tip.style.left = Math.max(8, Math.min(innerWidth - tw - 8, px - tw / 2)) + "px"; tip.style.top = (r.top - tip.offsetHeight - 6 < 8 ? r.bottom + 6 : r.top - tip.offsetHeight - 6) + "px";
}
function hideTip(el) { $("#tip").hidden = true; if (el) el.querySelectorAll(".xh,.xp,.hl").forEach(n => n.setAttribute("visibility", "hidden")); }
function multiRing(items, size) {
  const sw = items.length > 4 ? 11 : 13, gap = items.length > 4 ? 3 : 4; let g = "";
  items.forEach((it, i) => {
    const r = size / 2 - sw / 2 - i * (sw + gap); const C = 2 * Math.PI * r; const p = Math.max(0, Math.min(1, it.p || 0));
    g += `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${it.c}" stroke-opacity=".16" stroke-width="${sw}"/>`;
    if (p > 0) g += `<circle class="rp" style="--len:${C}" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${it.c}" stroke-width="${sw}" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - p)}" transform="rotate(-90 ${size / 2} ${size / 2})"/>`;
  });
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="${esc(items.map(i => `${i.k} ${Math.round((i.p || 0) * 100)}%`).join(", "))}">${g}</svg>`;
}
function ring(p, c, size = 46) {
  const r = (size - 8) / 2, C = 2 * Math.PI * r;
  return `<svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--surface-2)" stroke-width="6"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${c}" stroke-width="6" stroke-linecap="round" stroke-dasharray="${C * Math.min(1, p)} ${C}" transform="rotate(-90 ${size / 2} ${size / 2})"/></svg>`;
}

/* ---------- chrome ---------- */
const TABCOL = {today: "var(--accent)", habits: "var(--c-habit)", tasks: "var(--c-task)", food: "var(--c-food)", money: "var(--c-money)", train: "var(--c-train)", quests: "var(--c-quest)", town: "var(--c-town)"};
const tabIcon = k => k === "today" && gameOn() ? "hero" : k;
let popSel = "", popAt = 0;
function renderChrome() {
  document.body.dataset.view = ui.tab;
  const tabs = tabList();
  const nav = tabs.map(([k, l]) => `<button class="navbtn" style="--m:${TABCOL[k]}" data-tab="${k}" aria-current="${ui.tab === k ? "page" : "false"}">${icon(tabIcon(k), 20)}${l}</button>`).join("");
  $("#sidenav").innerHTML = nav;
  $("#tabbar").innerHTML = tabs.map(([k, l]) => `<button style="--m:${TABCOL[k]}" data-tab="${k}" aria-current="${ui.tab === k ? "page" : "false"}"><span class="ic">${icon(tabIcon(k), 22)}</span>${l}</button>`).join("");
  $$("[data-icon]").forEach(e => e.innerHTML = icon(e.dataset.icon, 20));
  $("#syncSide").innerHTML = syncBadge();
  const sm = $("#syncMobile"); if (sm) sm.innerHTML = syncBadge();
}
function syncBadge() {
  const [cls, txt] = dbState === "synced" ? ["ok", "Synced across devices"] : dbState === "connecting" ? ["wait", "Connecting…"] : dbState === "offline" ? ["wait", "Offline, will sync later"] : dbState === "error" ? ["", "Can't sync right now"] : ["", "Saved on this device"];
  return `<span class="syncdot ${cls}"><i></i>${txt}</span>`;
}
let rq = false;
function scheduleRender() { if (rq) return; rq = true; requestAnimationFrame(() => { rq = false; render(); }); }
// Night (dark and gold) is the design; Leyndell is its light twin. "auto" follows the device.
const THEMES = [["night", "Night"], ["leyndell", "Leyndell"], ["auto", "Match device"]];
function themePick() { let t = S.settings && S.settings.theme; if (!t) try { t = localStorage.getItem("daybook-theme"); } catch {} return THEMES.some(x => x[0] === t) ? t : "night"; }
function applyTheme() {
  const t = themePick(), el = document.documentElement;
  if (t === "auto") delete el.dataset.theme; else el.dataset.theme = t === "leyndell" ? "light" : "dark";
  try { localStorage.setItem("daybook-theme", t); } catch {}
}
function render() {
  applyTheme();
  const main = $("#view"); const ae = document.activeElement;
  const fid = ae && ae.id && main.contains(ae) ? ae.id : null;
  const sel = fid && typeof ae.selectionStart === "number" ? [ae.selectionStart, ae.selectionEnd] : null;
  for (const k in chartSpecs) delete chartSpecs[k];
  fixTab();
  main.innerHTML = VIEWS[ui.tab]();
  renderChrome();
  if (fid) { const el = document.getElementById(fid); if (el) { el.focus({preventScroll: true}); if (sel) try { el.setSelectionRange(sel[0], sel[1]); } catch {} } }
  const top = stack[stack.length - 1]; if (top && top.live) paintSheet();
  drawCharts(); tickTimers();
  if (popSel && Date.now() - popAt < 700) { try { $$(popSel).forEach(el => el.classList.add("pop")); } catch {} popSel = ""; }
  gameFeedback(); scheduleReconcile();
}
function go(tab) { ui.tab = tab; fixTab(); saveUi(); hideTip(); enterAnim(); render(); window.scrollTo(0, 0); try { history.replaceState(null, "", "#" + tab); } catch {} }
let toastT = 0;
function toast(msg) { const t = $("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, 2800); }

let enterT = 0;
function enterAnim() { const m = $("#view"); m.classList.add("enter"); clearTimeout(enterT); enterT = setTimeout(() => m.classList.remove("enter"), 1200); }
/* ---------- sheets ---------- */
const stack = [];
function openSheet(fn, live) { stack.push({fn, live}); paintSheet(true); }
function paintSheet(fresh) {
  const sh = $("#sheet"), top = stack[stack.length - 1];
  if (!top) { sh.hidden = true; $("#scrim").hidden = true; document.body.classList.remove("lock"); sh.innerHTML = ""; return; }
  const st = sh.scrollTop;
  for (const k in chartSpecs) if (k.startsWith("s")) delete chartSpecs[k];
  sh.innerHTML = `<div class="grab"></div>` + top.fn();
  sh.hidden = false; $("#scrim").hidden = false; document.body.classList.add("lock");
  if (fresh) sh.scrollTop = 0; else sh.scrollTop = st;
  drawCharts();
  if (fresh && matchMedia("(min-width:700px)").matches) { const f = sh.querySelector("[autofocus]"); if (f) f.focus(); }
}
function closeSheet() { stack.pop(); paintSheet(true); }
function closeAll() { stack.length = 0; paintSheet(); }
const sheetHead = (title, extra = "") => `<div class="sh-h"><h2>${esc(title)}</h2><div class="row">${extra}<button class="ibtn" data-act="close" aria-label="Close">${icon("x")}</button></div></div>`;

/* ---------- views ---------- */
// On phones a view can swap its slogan for the plain section name (short), which also hides the eyebrow.
const header = (eyebrow, title, actions = "", short = "") => `<header class="vh${short ? " vh-short" : ""}"><div><div class="eyebrow">${eyebrow}</div><h1>${short ? `<span class="h-full">${title}</span><span class="h-short">${short}</span>` : title}</h1></div><div class="actions">${actions}<button class="ibtn m-only" data-act="settings" aria-label="Settings">${icon("gear")}</button></div></header>`;
const hdrBtn = (act, label, attrs = "") => `<button class="btn pri hdr-pri" data-act="${act}" ${attrs}>${icon("plus", 18)}<span>${label}</span></button>`;
const fab = (act, label, attrs = "") => `<button class="fab" data-act="${act}" ${attrs} aria-label="${label}">${icon("plus", 26, 2.4)}</button>`;
// One rule for budget color everywhere: red over, amber from 85% or when ahead of the month's pace, green otherwise.
const budgetTone = (p, elapsed = 1) => p > 1 ? "bad" : p >= .85 || p > elapsed + .1 ? "warn" : "good";

// Habits that count today: daily ones scheduled for today, and every times-per-week habit.
const habitsToday = t => habitList().filter(h => h.freq === "weekly" || scheduledOn(h, t));
function ringsCard(t) {
  const hs = habitsToday(t); const hDoneN = hs.filter(h => hDone(h, t)).length;
  const wk = weekSessions().length, goal = +S.settings.weeklyWorkouts || 0;
  const FG = foodGoals(); const eaten = totals(dayEntries(t)).t.kcal; const ml = (S.water[t] || {}).ml || 0;
  const rings = [
    {k: "Habits", c: "var(--c-habit)", p: hs.length ? hDoneN / hs.length : 0, v: `${hDoneN}/${hs.length}`, s: "done today", tab: "habits"},
    {k: "Food", c: "var(--c-food)", p: eaten / FG.g.kcal, v: fmtInt(eaten), s: `of ${fmtInt(FG.g.kcal)} kcal`, tab: "food"},
    {k: "Water", c: "var(--s1)", p: ml / FG.water, v: `${n1(ml / 1000)} L`, s: `of ${n1(FG.water / 1000)} L`, tab: "food"},
    {k: "Steps", c: "var(--c-steps)", p: stepsOn(t) / stepGoal(), v: fmtInt(stepsOn(t)), s: `of ${fmtInt(stepGoal())}`, train: "steps"},
    {k: "Workouts", c: "var(--c-train)", p: goal ? wk / goal : 0, v: `${wk}${goal ? "/" + goal : ""}`, s: "this week", tab: "train"},
  ];
  return `<section class="card hero">${multiRing(rings, 172)}<div class="legend-rows">${rings.map(r => `<button class="lr" ${r.train ? `data-act="train-tab" data-v="${r.train}"` : `data-tab="${r.tab}"`}><i style="--c:${r.c}"></i><span><span class="ll">${r.k}</span><br><span class="ls">${r.s}</span></span><span class="lv">${r.v}</span></button>`).join("")}</div></section>`;
}
function spentCard() {
  const mk = mkey(); const spent = sumTx(mk, "expense"); const budget = +S.settings.budget || 0;
  return `<button class="tile" style="--tc:var(--c-money)" data-tab="money"><span class="k"><i class="dot" style="--c:var(--c-money)"></i>Spent</span><span class="v">${money(spent, true)}</span><span class="s">${budget ? `of ${money(budget, true)} budget` : "this month"}</span>${budget ? `<div class="meter"><i style="width:${Math.min(100, spent / budget * 100)}%;--c:var(--${budgetTone(spent / budget, monthElapsed(mk))})"></i></div>` : ""}</button>`;
}
function vToday() {
  if (gameOn()) return vHero();
  const t = today(), now = new Date();
  const hs = habitsToday(t);
  const due = dueToday();
  const hr = now.getHours(); const greet = hr < 5 ? "Late night" : hr < 12 ? "Good morning" : hr < 18 ? "Good afternoon" : "Good evening";
  const isEmpty = !habitList().length && !Object.keys(S.tasks).length && !Object.keys(S.tx).length && !Object.keys(S.splits).length && !Object.keys(S.food).length;
  const dateStr = now.toLocaleDateString(undefined, {weekday: "long", day: "numeric", month: "long"});
  let h = header(dateStr, `${greet}${S.settings.name ? ", " + esc(S.settings.name) : ""}`);
  if (isEmpty) h += `<section class="card welcome stack" style="margin-bottom:14px"><div><h2 style="font-size:22px">Set up your Daybook</h2><p class="muted small" style="margin-top:4px">Three quick steps and your Today page fills itself in.</p></div>
    <button class="step" data-act="add-habit"><span class="n">1</span><span class="grow"><b>Add a habit</b><br><span class="muted small">Water, reading, stretching, anything you want to keep up</span></span>${icon("right")}</button>
    <button class="step" data-act="train-tab" data-v="splits"><span class="n">2</span><span class="grow"><b>Pick a workout split</b><br><span class="muted small">Start from Push / Pull / Legs or build your own</span></span>${icon("right")}</button>
    <button class="step" data-act="add-tx" data-type="expense"><span class="n">3</span><span class="grow"><b>Log an expense</b><br><span class="muted small">Set a monthly budget later in Money</span></span>${icon("right")}</button></section>`;
  h += inviteCard();
  h += ringsCard(t);
  h += `<div class="tiles" style="grid-template-columns:repeat(2,minmax(0,1fr));margin-bottom:14px">
    <button class="tile" style="--tc:var(--c-task)" data-tab="tasks"><span class="k"><i class="dot" style="--c:var(--c-task)"></i>Tasks</span><span class="v">${due.length}</span><span class="s">open for today</span></button>
    ${spentCard()}
  </div>`;
  h += `<div class="grid2">`;
  // habits card
  h += `<section class="card"><div class="card-h"><h2>Today's habits</h2><button class="linkbtn" data-act="add-habit">Add habit</button></div>`;
  h += hs.length ? `<div class="list">${hs.map(x => {
    const on = hDone(x, t); const sub = x.freq === "weekly" ? `${weekCount(x)}/${x.goal} this week` : habitStreak(x) ? `${habitStreak(x)}-day streak` : "Start a streak today";
    return `<div class="li ${on ? "done" : ""}"><button class="chk" style="--c:var(${x.color})" aria-pressed="${on}" data-act="toggle-habit" data-id="${x.id}" data-d="${t}" aria-label="Mark ${esc(x.name)} done">${icon("check", 16, 3)}</button><button class="li-main" data-act="habit-detail" data-id="${x.id}"><span class="t">${esc(x.name)}</span><span class="sub">${sub}</span></button></div>`;
  }).join("")}</div>` : `<div class="empty"><span>${habitList().length ? "No habits scheduled today." : "No habits yet."}</span><button class="btn sm" data-act="add-habit">${icon("plus", 16)}Add a habit</button></div>`;
  h += `</section>`;
  // tasks card
  h += `<section class="card"><div class="card-h"><h2>On your plate</h2><button class="linkbtn" data-act="add-task">Add task</button></div>`;
  h += due.length ? `<div class="list">${due.slice(0, 8).map(taskRow).join("")}</div>${due.length > 8 ? `<button class="linkbtn" data-tab="tasks" style="margin-top:8px">See all ${due.length}</button>` : ""}` : `<div class="empty"><span>Nothing due today.</span><button class="btn sm" data-act="add-task">${icon("plus", 16)}Add a task</button></div>`;
  h += `</section>`;
  // workout card
  h += workoutTeaser();
  h += `</div>`;
  h += fab("quick", "Quick add");
  return h;
}
const statTile = (k, v, s = "") => `<div class="tile" style="padding:10px 12px"><span class="k">${k}</span><span class="v">${v}</span>${s ? `<span class="s">${s}</span>` : ""}</div>`;

function workoutTeaser() {
  if (S.active) {
    const a = S.active; const done = sum(a.entries.map(e => e.sets.filter(s => s.done).length));
    return `<section class="card"><div class="card-h"><h2>Workout in progress</h2><span class="pill acc"><span class="timer" data-elapsed>${fmtClock(Date.now() - a.start)}</span></span></div><p class="muted" style="margin-bottom:12px">${esc(a.name)}, ${done} sets logged</p><button class="btn pri block" data-act="resume">${icon("play", 16)}Resume workout</button></section>`;
  }
  const sp = activeSplit(); const nd = nextDay(sp);
  if (!sp || !nd) return `<section class="card"><div class="card-h"><h2>Next workout</h2></div><div class="empty"><span>Pick a split and Daybook will line up your next session and suggest weights.</span><button class="btn sm" data-act="train-tab" data-v="splits">Choose a split</button></div></section>`;
  return `<section class="card"><div class="card-h"><h2>Next up: ${esc(nd.name)}</h2><span class="pill">${esc(sp.name)}</span></div>
    <div class="list">${nd.items.slice(0, 6).map(it => { const s = suggest(it.ex, it.repMin, it.repMax, it.sets); return `<div class="li" style="padding:8px 0"><span class="grow">${esc(exName(it.ex))}</span><span class="small mono muted">${s.w != null ? `${fmtW(s.w)} × ${s.reps[0]}` : `${it.sets} × ${it.repMin}–${it.repMax}`}</span></div>`; }).join("")}</div>
    <button class="btn pri block" style="margin-top:12px" data-act="start-day" data-split="${sp.id}" data-day="${nd.id}">${icon("play", 16)}Start ${esc(nd.name)}</button></section>`;
}
function bodyCard(compact) {
  const pts = Object.values(S.body).sort((a, b) => a.date.localeCompare(b.date));
  const recent = pts.filter(p => p.date >= dkey(addDays(new Date(), compact ? -60 : -365)));
  const last = pts[pts.length - 1];
  const monthAgo = pts.filter(p => p.date <= dkey(addDays(new Date(), -30))).pop();
  const chg = last && monthAgo ? last.kg - monthAgo.kg : null;
  const avg7 = pts.filter(p => p.date > dkey(addDays(new Date(), -7)));
  let h = `<section class="card"><div class="card-h"><h2>Body weight</h2>${last ? `<span class="pill">${fmtDate(last.date)}</span>` : ""}</div>`;
  if (last) {
    h += `<div class="row wrap" style="gap:18px;margin-bottom:8px"><div><div class="label">Latest</div><div class="mono" style="font-size:22px;font-weight:600">${fmtW(last.kg)}</div></div>${avg7.length ? `<div><div class="label">7-day avg</div><div class="mono" style="font-size:22px;font-weight:600">${n1(sum(avg7.map(p => p.kg)) / avg7.length)}</div></div>` : ""}${chg != null ? `<div><div class="label">30 days</div><div class="mono" style="font-size:22px;font-weight:600">${chg > 0 ? "+" : ""}${n1(chg)}</div></div>` : ""}</div>`;
    if (recent.length > 1) h += chart({type: "line", h: compact ? 90 : 190, spark: compact, color: "var(--s7)", label: "Body weight over time", points: recent.map(p => ({x: parseD(p.date).getTime(), y: +p.kg, xl: fmtDate(p.date), tip: `${fmtDate(p.date, {day: "numeric", month: "short", year: "numeric"})}<br><b>${fmtW(p.kg)}</b>`}))});
  } else h += `<p class="faint small" style="margin-bottom:10px">Log your weight to see the trend.</p>`;
  h += `<form class="inline-add" data-form="body" style="margin-top:10px"><input id="bw-${compact ? "t" : "p"}" name="kg" inputmode="decimal" placeholder="Today's weight (${U()})" aria-label="Body weight" autocomplete="off"><button class="btn">Log</button></form></section>`;
  return h;
}
const fmtClock = ms => { const s = Math.max(0, Math.floor(ms / 1000)); const h = Math.floor(s / 3600); return (h ? h + ":" + pad(Math.floor(s / 60) % 60) : Math.floor(s / 60)) + ":" + pad(s % 60); };

function taskRow(t) {
  const on = taskDone(t); const tday = today();
  const bits = [];
  if (t.kind !== "todo") bits.push(`<span class="pill">${t.kind === "daily" && t.days ? esc(daysText(t.days)) : cap(t.kind)}</span>`);
  if (t.kind === "daily" && !scheduledOn(t, tday)) bits.push(`<span class="faint">Not today</span>`);
  if (t.kind === "todo" && t.due) bits.push(`<span class="${!on && t.due < tday ? "pill bad" : "pill"}">${!on && t.due < tday ? "Overdue · " : ""}${relDay(t.due)}</span>`);
  if (t.priority === 2) bits.push(`<span class="pill warn">High</span>`);
  if (t.kind !== "todo") { const st = periodStreak(t); if (st > 1) bits.push(`<span>${st} ${t.kind === "daily" ? "days" : t.kind === "weekly" ? "weeks" : "months"} in a row</span>`); }
  if (t.notes) bits.push(`<span class="faint">${esc(t.notes.slice(0, 60))}</span>`);
  return `<div class="li ${on ? "done" : ""}"><button class="chk sq" style="--c:var(--c-task)" aria-pressed="${on}" data-act="toggle-task" data-id="${t.id}" aria-label="Complete ${esc(t.title)}">${icon("check", 16, 3)}</button><button class="li-main" data-act="edit-task" data-id="${t.id}"><span class="t">${esc(t.title)}</span>${bits.length ? `<span class="sub">${bits.join("")}</span>` : ""}</button></div>`;
}
function txRow(t) {
  const inc = t.type === "income";
  return `<button class="li" style="width:100%;text-align:left" data-act="edit-tx" data-id="${t.id}"><span class="li-main"><span class="t">${esc(t.note || t.cat)}</span><span class="sub">${t.note ? esc(t.cat) + " · " : ""}${relDay(t.date)}</span></span><span class="mono" style="font-weight:600;color:${inc ? "var(--good)" : "var(--ink)"}">${inc ? "+" : "−"}${money(t.amount)}</span></button>`;
}

const vHabits = () => header("Habits", "Keep the chain going", hdrBtn("add-habit", "Add habit"), "Habits") + habitsBody() + fab("add-habit", "Add habit");
function habitsBody() {
  const hs = habitList(); const t = today();
  const days = Array.from({length: 7}, (_, i) => addDays(new Date(), i - 6));
  let h = "";
  if (!hs.length) return h + `<section class="card"><div class="empty"><b>No habits yet</b><span>Add something small you want to do every day, or a few times a week.</span><button class="btn pri" data-act="add-habit">${icon("plus", 16)}Add your first habit</button></div></section>`;
  const allRate = hs.length ? sum(hs.map(habitRate)) / hs.length : 0;
  // Weekly streaks count weeks, so compare streaks by the days they span.
  const top = hs.map(x => ({x, n: habitStreak(x)})).filter(o => o.n).sort((a, b) => b.n * (b.x.freq === "weekly" ? 7 : 1) - a.n * (a.x.freq === "weekly" ? 7 : 1))[0];
  const hsT = habitsToday(t);
  h += `<div class="tiles t3" style="margin-bottom:14px">${statTile("Today", `${hsT.filter(x => hDone(x, t)).length}/${hsT.length}`)}${statTile("30-day rate", Math.round(allRate * 100) + "%")}${top ? statTile("Top streak", streakText(top.x, top.n), esc(top.x.name)) : statTile("Top streak", "–", "none yet")}</div>`;
  h += `<section class="card"><div class="list">`;
  h += hs.map(x => {
    const st = habitStreak(x);
    return `<div class="habit"><div class="stack" style="gap:4px;min-width:0"><button class="name" data-act="habit-detail" data-id="${x.id}"><i class="dot" style="--c:var(${x.color})"></i><span>${esc(x.name)}</span></button><span class="streak">${st ? `${st}-${x.freq === "weekly" ? "week" : "day"} streak` : "No streak yet"} · ${x.freq === "weekly" ? `${weekCount(x)}/${x.goal} this week` : Math.round(habitRate(x) * 100) + "% last 30 days"}${x.freq !== "weekly" && x.days ? ` · ${esc(daysText(x.days))}` : ""}</span></div>
    <div class="week" style="--c:var(${x.color})">${days.map(d => `<span class="dh">${d.toLocaleDateString(undefined, {weekday: "narrow"})}</span>`).join("")}${days.map(d => { const k = dkey(d); const on = hDone(x, k); return `<button class="day ${k === t ? "today" : ""}" aria-pressed="${on}" data-act="toggle-habit" data-id="${x.id}" data-d="${k}" aria-label="${esc(x.name)} on ${fmtDate(k, {weekday: "long", day: "numeric", month: "short"})}">${icon("check", 14, 3)}</button>`; }).join("")}</div></div>`;
  }).join("");
  h += `</div></section>`;
  return h;
}
const streakText = (x, n) => `${n} ${x.freq === "weekly" ? (n === 1 ? "week" : "weeks") : (n === 1 ? "day" : "days")}`;

const vTasks = () => tasksView() + fab("add-task", "Add task");
function tasksView(embedded) {
  const kinds = [["todo", "To-do"], ["daily", "Daily"], ["weekly", "Weekly"], ["monthly", "Monthly"]];
  const k = ui.taskTab; const all = Object.values(S.tasks);
  let h = embedded ? "" : header("Tasks", "What needs doing", hdrBtn("add-task", "Add task"), "Tasks");
  h += `<div class="seg" role="group" aria-label="Task type" style="margin-bottom:14px">${kinds.map(([v, l]) => { const n = all.filter(t => t.kind === v && !taskDone(t)).length; return `<button data-act="task-tab" data-v="${v}" aria-pressed="${k === v}">${l}${n ? ` <span class="faint mono">${n}</span>` : ""}</button>`; }).join("")}</div>`;
  h += `<form class="inline-add" data-form="quick-task" style="margin-bottom:14px"><input id="qtask" name="title" placeholder="${k === "todo" ? "Add a to-do" : `Add a ${k} task`}" autocomplete="off" aria-label="New task"><button class="btn ghost" aria-label="Add">${icon("plus", 18)}</button></form>`;
  const list = all.filter(t => t.kind === k);
  if (k === "todo") {
    const open = list.filter(t => !t.doneAt), done = list.filter(t => t.doneAt).sort((a, b) => b.doneAt - a.doneAt);
    const tday = today(); const weekEnd = dkey(addDays(new Date(), 7));
    const groups = [["Overdue", open.filter(t => t.due && t.due < tday)], ["Today", open.filter(t => t.due === tday)], ["Next 7 days", open.filter(t => t.due && t.due > tday && t.due <= weekEnd)], ["Later", open.filter(t => t.due && t.due > weekEnd)], ["No date", open.filter(t => !t.due)]];
    const sortT = a => a.sort((x, y) => (y.priority || 0) - (x.priority || 0) || (x.due || "").localeCompare(y.due || "") || x.created - y.created);
    if (!open.length && !done.length) return h + `<section class="card"><div class="empty"><b>Your list is clear</b><span>Add one-off to-dos with an optional due date and priority.</span></div></section>`;
    h += `<div class="stack">`;
    groups.filter(g => g[1].length).forEach(([l, a]) => { h += `<section class="card"><div class="card-h"><h2>${l}</h2><span class="faint mono small">${a.length}</span></div><div class="list">${sortT(a).map(taskRow).join("")}</div></section>`; });
    if (done.length) h += `<section class="card"><div class="card-h"><button class="row" data-act="toggle-done"><h2>Completed</h2><span class="faint mono small">${done.length}</span></button><div class="row">${ui.showDone ? `<button class="btn sm ghost" data-act="clear-done">Clear all</button>` : ""}<button class="linkbtn" data-act="toggle-done">${ui.showDone ? "Hide" : "Show"}</button></div></div>${ui.showDone ? `<div class="list">${done.map(taskRow).join("")}</div>` : ""}</section>`;
    h += `</div>`;
  } else {
    const label = {daily: "today", weekly: "this week", monthly: "this month"}[k];
    const doneN = list.filter(taskDone).length;
    const sched = k === "daily" ? list.filter(x => scheduledOn(x, today())) : list;
    if (!list.length) return h + `<section class="card"><div class="empty"><b>No ${k} tasks yet</b><span>${k === "daily" ? "Things you do every day, like making your bed or checking email." : k === "weekly" ? "Things you do once a week, like laundry or a weekly review." : "Things you do once a month, like paying rent or a deep clean."} They reset ${k === "daily" ? "every morning" : k === "weekly" ? "every Monday" : "on the 1st"}.</span></div></section>`;
    const sDone = sched.filter(taskDone).length;
    h += `<section class="card"><div class="card-h"><h2>${sDone} of ${sched.length} done ${label}</h2>${ring(sched.length ? sDone / sched.length : 0, "var(--c-task)", 34)}</div><div class="list">${list.sort((a, b) => taskDone(a) - taskDone(b) || (b.priority || 0) - (a.priority || 0) || a.created - b.created).map(taskRow).join("")}</div></section>`;
  }
  return h;
}

function vMoney() {
  const mk = ui.month; const inc = sumTx(mk, "income"), exp = sumTx(mk, "expense"), net = inc - exp;
  const cats = catTotals(mk); const budget = +S.settings.budget || 0; const B = S.settings.budgets || {};
  let h = header("Money", `<span style="display:inline-flex;align-items:center;gap:4px"><button class="ibtn sm" data-act="month" data-d="-1" aria-label="Previous month">${icon("left", 18)}</button><span class="m-long">${monthName(mk)}</span><span class="m-short">${monthShort(mk)}</span><button class="ibtn sm" data-act="month" data-d="1" aria-label="Next month" ${mk >= mkey() ? "disabled style='opacity:.3'" : ""}>${icon("right", 18)}</button></span>`, hdrBtn("add-tx", "Add expense", 'data-type="expense"'));
  h += `<div class="tiles t3" style="margin-bottom:14px">${statTile("Income", money(inc, true))}${statTile("Expenses", money(exp, true))}${statTile("Net", `<span style="color:${net >= 0 ? "var(--good)" : "var(--bad)"}">${net >= 0 ? "+" : "−"}${money(Math.abs(net), true)}</span>`, inc ? `${Math.round(Math.max(0, net) / inc * 100)}% saved` : "")}</div>`;
  h += `<div class="grid2">`;
  // budget
  const budgetCats = Object.keys(B).filter(c => +B[c] > 0);
  const dim = monthDays(mk); const elapsed = monthElapsed(mk);
  h += `<section class="card"><div class="card-h"><h2>Budget</h2><button class="linkbtn" data-act="budgets">Edit</button></div>`;
  if (!budget && !budgetCats.length) h += `<div class="empty"><span>Set a monthly limit to see how your spending tracks against it.</span><button class="btn sm" data-act="budgets">Set a budget</button></div>`;
  else {
    if (budget) { const p = exp / budget; const tone = budgetTone(p, elapsed); h += `<div class="stack" style="gap:8px;margin-bottom:14px"><div class="row between"><span class="mono" style="font-size:20px;font-weight:600">${money(exp, true)} <span class="faint" style="font-size:14px">/ ${money(budget, true)}</span></span><span class="pill ${tone}">${p > 1 ? `Over by ${money(exp - budget, true)}` : `${money(budget - exp, true)} left`}</span></div><div class="meter" style="height:10px;position:relative"><i style="width:${Math.min(100, p * 100)}%;--c:var(--${tone})"></i></div>${elapsed > 0 && elapsed < 1 ? `<span class="tiny faint">${Math.round(elapsed * 100)}% of the month gone, ${Math.round(p * 100)}% of budget used</span>` : ""}</div>`; }
    h += budgetCats.map(c => { const v = cats[c] || 0, b = +B[c]; const p = v / b; const tone = budgetTone(p, elapsed); return `<div class="stack" style="gap:5px;padding:7px 0"><div class="row between small"><span>${esc(c)}</span><span class="mono">${money(v, true)} <span class="faint">/ ${money(b, true)}</span></span></div><div class="meter"><i style="width:${Math.min(100, p * 100)}%;--c:var(--${tone})"></i></div></div>`; }).join("");
  }
  h += `</section>`;
  // categories
  const catArr = Object.entries(cats).sort((a, b) => b[1] - a[1]); const maxC = catArr.length ? catArr[0][1] : 1;
  h += `<section class="card"><div class="card-h"><h2>Where it went</h2></div>${catArr.length ? catArr.map(([c, v]) => `<div class="hbar"><span class="nm">${esc(c)}</span><span class="bar"><i style="width:${v / maxC * 100}%;--c:var(--s2)"></i></span><span class="val">${money(v, true)}</span></div>`).join("") + `<p class="tiny faint" style="margin-top:6px">${catArr.length} ${catArr.length === 1 ? "category" : "categories"}, largest is ${esc(catArr[0][0])} at ${Math.round(catArr[0][1] / exp * 100)}% of spending</p>` : `<p class="faint small">No expenses this month.</p>`}</section>`;
  // spending so far this month, against a straight line from zero to the budget
  const lastDay = mk === mkey() ? new Date().getDate() : mk < mkey() ? dim : 0;
  let run = 0; const cum = [];
  for (let i = 1; i <= lastDay; i++) { const k = `${mk}-${pad(i)}`; const v = sum(txIn(mk).filter(t => t.type === "expense" && t.date === k).map(t => t.amount)); run += v; cum.push({x: i, y: run, xl: fmtDate(k), tip: `${fmtDate(k, {weekday: "short", day: "numeric", month: "short"})}<br>Spent <b>${money(v)}</b><br>Month so far <b>${money(run, true)}</b>${budget ? `<br>Pace <b>${money(budget * i / dim, true)}</b>` : ""}`}); }
  const paceNote = budget && lastDay ? (() => { const d = run - budget * lastDay / dim; return Math.abs(d) < budget * .02 ? "on pace with your budget" : `${money(Math.abs(d), true)} ${d > 0 ? "ahead of" : "under"} budget pace`; })() : `avg ${money(exp / Math.max(1, lastDay || dim), true)} per day`;
  h += `<section class="card span2"><div class="card-h"><h2>Spending this month</h2><span class="small faint">${paceNote}</span></div>${exp && cum.length ? chart({type: "line", h: 180, color: "var(--s2)", zero: true, x0: 1, x1: dim, pace: budget ? {y0: 0, y1: budget, label: "Budget"} : null, points: cum, label: "Spending so far this month"}) + (budget ? `<div class="legend" style="margin-top:8px"><span><i style="--c:var(--s2)"></i>Spent so far</span><span><i style="--c:var(--ink-2);height:2px;border-radius:0"></i>Budget pace</span></div>` : "") : `<p class="faint small">Nothing spent this month yet.</p>`}</section>`;
  // six month trend
  const months = Array.from({length: 6}, (_, i) => shiftMonth(mk, i - 5));
  const groups = months.map(m => ({l: parseD(m + "-01").toLocaleDateString(undefined, {month: "short"}), a: sumTx(m, "income"), b: sumTx(m, "expense"), tip: `${monthName(m)}<br>Income <b>${money(sumTx(m, "income"), true)}</b><br>Expenses <b>${money(sumTx(m, "expense"), true)}</b>`}));
  h += `<section class="card span2"><div class="card-h"><h2>Last six months</h2><div class="legend"><span><i style="--c:var(--s1)"></i>Income</span><span><i style="--c:var(--s2)"></i>Expenses</span></div></div>${groups.some(g => g.a || g.b) ? chart({type: "group", h: 190, groups, label: "Income and expenses by month"}) : `<p class="faint small">Log some transactions to see the trend.</p>`}</section>`;
  // transactions
  const list = txIn(mk).sort((a, b) => b.date.localeCompare(a.date) || (b.created || 0) - (a.created || 0));
  h += `<section class="card span2"><div class="card-h"><h2>Transactions</h2><span class="faint mono small">${list.length}</span></div>`;
  if (!list.length) h += `<div class="empty"><span>No transactions in ${monthName(mk)}.</span><button class="btn sm" data-act="add-tx" data-type="expense">${icon("plus", 16)}Add one</button></div>`;
  else { let last = ""; h += `<div class="list">`; list.forEach(t => { if (t.date !== last) { h += `<div class="label" style="padding:14px 0 4px">${relDay(t.date)}</div>`; last = t.date; } h += txRow(t); }); h += `</div>`; }
  h += `</section></div>` + fab("add-tx", "Add expense", 'data-type="expense"');
  return h;
}

function vTrain() {
  const tabs = [["workout", "Workout"], ["steps", "Steps"], ["progress", "Progress"], ["splits", "Splits"], ["history", "History"], ["tools", "Tools"]];
  const live = S.active && ui.trainTab === "workout";
  let h = live ? header("Training", esc(S.active.name)) : header("Training", ui.trainTab === "steps" ? "Keep moving" : "Get stronger", "", "Training");
  h += `<div class="seg g3" role="group" aria-label="Training section" style="margin-bottom:14px">${tabs.map(([v, l]) => `<button data-act="train-tab" data-v="${v}" aria-pressed="${ui.trainTab === v}">${l}</button>`).join("")}</div>`;
  return h + ({workout: tWorkout, steps: tSteps, progress: tProgress, splits: tSplits, history: tHistory, tools: tTools}[ui.trainTab] || tWorkout)();
}
function tWorkout() {
  if (S.active) return activeView();
  const sp = activeSplit(); const nd = nextDay(sp);
  const ws = weekSessions(); const goal = +S.settings.weeklyWorkouts || 0;
  const allN = Object.keys(S.sessions).length;
  const stats = ws.length ? `<div class="tiles span2">${statTile("This week", `${ws.length}${goal ? "/" + goal : ""}`, "workouts")}${statTile("Sets", sum(ws.map(sessSets)), "this week")}${statTile("Volume", fmtVol(sum(ws.map(sessVol))), "this week")}${statTile("All time", allN, "workouts")}</div>`
    : `<p class="small muted span2">No workouts yet this week${goal ? `, goal ${goal}` : ""} · ${allN} all time</p>`;
  // dense flow: on desktop the muscle card fills the space beside the split, stats sit below both
  let h = `<div class="grid2" style="grid-auto-flow:row dense">`;
  if (sp && sp.days.length) {
    h += `<section class="card"><div class="card-h"><h2>${esc(sp.name)}</h2><button class="linkbtn" data-act="edit-split" data-id="${sp.id}">Edit</button></div><div class="stack" style="gap:10px">`;
    h += sp.days.map(d => `<div class="daycard" ${d.id === nd.id ? 'style="border-color:var(--c-train)"' : ""}><div class="row between"><div><div class="row" style="gap:8px"><b style="font-size:16px">${esc(d.name)}</b>${d.id === nd.id ? `<span class="pill" style="background:color-mix(in srgb,var(--c-train) 16%,transparent);color:var(--ink)">Up next</span>` : ""}</div><span class="small faint">${d.items.length} exercises · ${sum(d.items.map(i => +i.sets))} sets</span></div><button class="btn sm ${d.id === nd.id ? "pri" : ""}" data-act="start-day" data-split="${sp.id}" data-day="${d.id}">${icon("play", 14)}Start</button></div><span class="small muted">${d.items.map(i => esc(exName(i.ex))).join(", ")}</span></div>`).join("");
    h += `</div></section>`;
  } else {
    h += `<section class="card"><div class="card-h"><h2>No split yet</h2></div><p class="muted small" style="margin-bottom:12px">A split is your weekly plan, like Push / Pull / Legs. Start from a template and change anything you like.</p><div class="stack" style="gap:8px">${Object.keys(TEMPLATES).map(n => `<button class="btn block ghost" data-act="template" data-name="${esc(n)}" style="justify-content:space-between">${esc(n)}${icon("plus", 16)}</button>`).join("")}<button class="btn block" data-act="new-split">Build my own</button></div></section>`;
  }
  h += stats;
  const ms = muscleSets(ws); const mArr = MUSCLES.filter(m => ms[m]).map(m => [m, ms[m]]).sort((a, b) => b[1] - a[1]);
  const mx = Math.max(20, ...mArr.map(m => m[1]));
  h += `<section class="card"><div class="card-h"><h2>Sets per muscle this week</h2></div>${mArr.length ? mArr.map(([m, v]) => `<div class="hbar"><span class="nm">${m}</span><span class="bar"><span class="band" style="left:${10 / mx * 100}%;width:${10 / mx * 100}%"></span><i style="width:${v / mx * 100}%;--c:var(--c-train)"></i></span><span class="val">${v}</span></div>`).join("") + `<p class="tiny faint" style="margin-top:8px">Shaded band marks 10 to 20 hard sets, a common weekly target for growth.</p>` : `<p class="faint small">Finish a workout to see which muscles you trained.</p>`}
    <button class="btn block ghost" style="margin-top:12px" data-act="start-empty">${icon("plus", 16)}Start an empty workout</button></section>`;
  h += `</div>`;
  return h;
}
function activeView() {
  const a = S.active; const done = sum(a.entries.map(e => e.sets.filter(s => s.done).length)); const total = sum(a.entries.map(e => e.sets.length));
  let h = `<section class="card" style="margin-bottom:14px"><div class="row between wrap"><div class="row" style="gap:16px"><div><div class="label">Time</div><div class="mono" style="font-size:22px;font-weight:600" data-elapsed>${fmtClock(Date.now() - a.start)}</div></div><div><div class="label">Sets</div><div class="mono" style="font-size:22px;font-weight:600">${done}/${total}</div></div><div><div class="label">Volume</div><div class="mono" style="font-size:22px;font-weight:600">${fmtVol(sum(a.entries.flatMap(e => e.sets.filter(s => s.done)).map(s => (+s.w || 0) * (+s.r || 0))))}</div></div></div><div class="row"><button class="btn danger sm" data-act="discard" data-confirm="Tap again to discard">Discard</button><button class="btn pri" data-act="finish">${icon("check", 16)}Finish</button></div></div></section><div class="stack">`;
  a.entries.forEach((e, ei) => {
    const s = suggest(e.ex, e.repMin, e.repMax, e.sets.length || 3); const last = lastSetsText(e.ex);
    h += `<section class="card ex-card"><div class="row between"><div class="grow"><div class="exn">${esc(exName(e.ex))}</div><div class="small faint">${e.sets.length} × ${e.repMin}–${e.repMax} reps${last ? ` · last ${esc(last)}` : ""}</div></div><button class="ibtn sm" data-act="rm-entry" data-ei="${ei}" data-confirm="" aria-label="Remove exercise" title="Remove exercise">${icon("trash", 16)}</button></div>
      <div class="sugg ${s.kind}"><span class="arrow">${icon(s.kind === "up" ? "up" : s.kind === "down" ? "down" : "flat", 14, 2.4)}</span><span>${s.text}</span></div>
      <div class="sets"><span class="hd">Set</span><span class="hd">${U()}</span><span class="hd">Reps</span><span class="hd">RIR</span><span></span>`;
    e.sets.forEach((st, si) => {
      h += `<span class="sn">${si + 1}</span><span class="${st.done ? "setdone" : ""}"><input id="s-${ei}-${si}-w" data-set="${ei},${si},w" inputmode="decimal" value="${esc(st.w)}" placeholder="${s.w != null ? s.w : "–"}" aria-label="Set ${si + 1} weight"></span><span class="${st.done ? "setdone" : ""}"><input id="s-${ei}-${si}-r" data-set="${ei},${si},r" inputmode="numeric" value="${esc(st.r)}" placeholder="${s.reps[si] || e.repMax}" aria-label="Set ${si + 1} reps"></span><span class="${st.done ? "setdone" : ""}"><input id="s-${ei}-${si}-i" data-set="${ei},${si},rir" inputmode="numeric" value="${esc(st.rir ?? "")}" placeholder="–" aria-label="Set ${si + 1} reps in reserve"></span><button class="setchk" data-act="set-done" data-ei="${ei}" data-si="${si}" aria-pressed="${!!st.done}" aria-label="Complete set ${si + 1}">${icon("check", 18, 3)}</button>`;
    });
    h += `</div><div class="row" style="margin-top:10px"><button class="btn sm ghost" data-act="add-set" data-ei="${ei}">${icon("plus", 14)}Add set</button>${e.sets.length > 1 ? `<button class="btn sm ghost" data-act="rm-set" data-ei="${ei}">Remove last</button>` : ""}</div></section>`;
  });
  h += `<button class="btn block ghost" data-act="add-ex-active" style="min-height:52px">${icon("plus", 18)}Add exercise</button></div>`;
  h += `<p class="tiny faint" style="margin-top:12px">RIR is reps in reserve: how many more reps you could have done. Logging it sharpens the next suggestion.</p>`;
  return h;
}
function tProgress() {
  const withHist = exList().filter(e => exHistory(e.id).length);
  let h = `<div class="grid2">`;
  if (!withHist.length) h += `<section class="card"><div class="empty"><b>No lifts logged yet</b><span>Finish a workout and each exercise gets its own progress chart here.</span></div></section>`;
  else {
    if (!withHist.some(e => e.id === ui.progEx)) ui.progEx = withHist[0].id;
    const st = exStats(ui.progEx); const m = ui.progMetric;
    const metrics = [["e1rm", "Est. 1RM"], ["top", "Top weight"], ["vol", "Volume"], ["reps", "Best reps"]];
    const val = p => p[m]; const first = st[0], last = st[st.length - 1];
    const ch = first && val(first) ? (val(last) - val(first)) / val(first) : 0;
    const fmtM = v => m === "reps" ? `${v} reps` : m === "vol" ? fmtVol(v) : fmtW(n1(v));
    h += `<section class="card span2"><div class="row wrap between" style="margin-bottom:12px;gap:10px"><select id="progEx" data-change="progEx" aria-label="Exercise" style="max-width:320px;font-weight:600">${withHist.map(e => `<option value="${e.id}" ${e.id === ui.progEx ? "selected" : ""}>${esc(e.name)}</option>`).join("")}</select><div class="seg g2" role="group" aria-label="Metric">${metrics.map(([v, l]) => `<button data-act="prog-metric" data-v="${v}" aria-pressed="${m === v}">${l}</button>`).join("")}</div></div>
      <div class="tiles" style="margin-bottom:12px">${statTile("Best est. 1RM", fmtW(n1(Math.max(...st.map(p => p.e1rm)))))}${statTile("Heaviest", fmtW(Math.max(...st.map(p => p.top))))}${statTile("Sessions", st.length)}${statTile("Change", `<span style="color:${ch > 0 ? "var(--good)" : ch < 0 ? "var(--bad)" : "var(--ink)"}">${ch > 0 ? "+" : ""}${Math.round(ch * 100)}%</span>`, "since first session")}</div>
      ${st.length > 1 ? chart({type: "line", h: 220, color: "var(--c-train)", label: `${exName(ui.progEx)} progress`, zero: m === "vol" || m === "reps", points: st.map(p => ({x: p.t, y: m === "e1rm" ? n1(p.e1rm) : p[m], xl: fmtDate(p.date), tip: `${fmtDate(p.date, {day: "numeric", month: "short", year: "numeric"})}<br><b>${fmtM(p[m])}</b><br>${p.sets.map(s => `${+s.w}×${s.r}`).join(", ")}`}))}) : `<p class="faint small">One session so far. The chart appears after your second.</p>`}
      <p class="tiny faint" style="margin-top:8px">Estimated 1RM uses the Epley formula: weight × (1 + reps ÷ 30), best set per session.</p></section>`;
    h += `<section class="card span2"><div class="card-h"><h2>Recent sessions</h2></div><div class="tblwrap"><table class="tbl"><thead><tr><th>Date</th><th>Sets</th><th style="text-align:right">Est. 1RM</th></tr></thead><tbody>${st.slice(-8).reverse().map(p => `<tr><td class="num">${fmtDate(p.date)}</td><td class="mono small">${p.sets.map(s => `${+s.w}×${s.r}${s.rir !== "" && s.rir != null ? `<span class="faint">@${s.rir}</span>` : ""}`).join("  ")}</td><td class="num mono" style="text-align:right">${n1(p.e1rm)}</td></tr>`).join("")}</tbody></table></div></section>`;
  }
  h += `<div class="span2">${bodyCard(false)}</div></div>`;
  return h;
}
function tSplits() {
  const sps = Object.values(S.splits).sort((a, b) => a.created - b.created);
  let h = `<div class="grid2">`;
  h += `<section class="card span2"><div class="card-h"><h2>Your splits</h2><button class="btn sm pri" data-act="new-split">${icon("plus", 14)}New split</button></div>`;
  h += sps.length ? `<div class="list">${sps.map(s => `<div class="li"><button class="li-main" data-act="edit-split" data-id="${s.id}"><span class="t">${esc(s.name)}</span><span class="sub">${s.days.map(d => esc(d.name)).join(" · ") || "No days yet"}</span></button>${s.active ? `<span class="pill good">Active</span>` : `<button class="btn sm ghost" data-act="activate-split" data-id="${s.id}">Make active</button>`}</div>`).join("")}</div>` : `<p class="faint small">No splits yet. Pick a template below or build your own.</p>`;
  h += `</section><section class="card"><div class="card-h"><h2>Templates</h2></div><div class="stack" style="gap:8px">${Object.entries(TEMPLATES).map(([n, days]) => `<button class="pick" style="border-top:0;border-radius:12px;background:var(--surface-2);padding:12px" data-act="template" data-name="${esc(n)}"><span class="grow"><b>${esc(n)}</b><br><span class="small faint">${days.map(d => d[0]).join(" · ")}</span></span>${icon("plus", 18)}</button>`).join("")}</div></section>`;
  const ex = exList();
  h += `<section class="card"><div class="card-h"><h2>Exercise library</h2><button class="linkbtn" data-act="new-exercise">Add</button></div>${ex.length ? `<div class="list">${ex.map(e => `<button class="li" style="width:100%;text-align:left" data-act="edit-exercise" data-id="${e.id}"><span class="li-main"><span class="t">${esc(e.name)}</span><span class="sub">${esc(e.muscle)} · ${e.repMin}–${e.repMax} reps · +${e.inc} ${U()} steps</span></span>${icon("right", 16)}</button>`).join("")}</div>` : `<p class="faint small">Exercises you add or pull in from a template show up here.</p>`}</section></div>`;
  return h;
}
function tHistory() {
  const ss = sessionsSorted().reverse();
  if (!ss.length) return `<section class="card"><div class="empty"><b>No workouts yet</b><span>Finished workouts are listed here with their sets and volume.</span></div></section>`;
  const weeks = Array.from({length: 12}, (_, i) => { const s = addDays(startOfWeek(new Date()), (i - 11) * 7); const e = dkey(addDays(s, 6)); const n = Object.values(S.sessions).filter(x => x.date >= dkey(s) && x.date <= e); return {l: fmtDate(dkey(s), {day: "numeric", month: "numeric"}), v: n.length, tip: `Week of ${fmtDate(dkey(s))}<br><b>${n.length} workouts</b>, ${fmtVol(sum(n.map(sessVol)))}`}; });
  let h = `<section class="card" style="margin-bottom:14px"><div class="card-h"><h2>Workouts per week</h2><span class="small faint">last 12 weeks</span></div>${chart({type: "bars", h: 150, color: "var(--c-train)", bars: weeks, label: "Workouts per week"})}</section>`;
  h += `<section class="card"><div class="list">${ss.map(s => `<button class="li" style="width:100%;text-align:left" data-act="session" data-id="${s.id}"><span class="li-main"><span class="t">${esc(s.name)}</span><span class="sub">${relDay(s.date)} · ${fmtDur(s.end - s.start)} · ${sessSets(s)} sets · ${fmtVol(sessVol(s))}</span></span>${s.prs && s.prs.length ? `<span class="pill good">${s.prs.length} PR${s.prs.length > 1 ? "s" : ""}</span>` : ""}${icon("right", 16)}</button>`).join("")}</div></section>`;
  return h;
}
function tTools() {
  return `<div class="grid2"><section class="card"><div class="card-h"><h2>One-rep max</h2></div><div class="fgrid"><label class="field"><span>Weight (${U()})</span><input id="t-w" data-calc="1rm" inputmode="decimal" value="100"></label><label class="field"><span>Reps</span><input id="t-r" data-calc="1rm" inputmode="numeric" value="5"></label></div><div id="o-1rm" style="margin-top:14px">${calc1rm()}</div></section>
  <section class="card"><div class="card-h"><h2>Plate loader</h2></div><div class="fgrid"><label class="field"><span>Target (${U()})</span><input id="p-t" data-calc="plates" inputmode="decimal" value="102.5"></label><label class="field"><span>Bar (${U()})</span><input id="p-b" data-calc="plates" inputmode="decimal" value="${U() === "lb" ? 45 : 20}"></label></div><div id="o-plates" style="margin-top:14px">${calcPlates()}</div></section></div>`;
}
function calc1rm() {
  const w = parseFloat(($("#t-w") || {}).value ?? 100), r = parseInt(($("#t-r") || {}).value ?? 5);
  if (!(w > 0) || !(r > 0)) return `<p class="faint small">Enter a weight and reps.</p>`;
  const m = e1rm(w, r);
  return `<div class="mono" style="font-size:30px;font-weight:600">${fmtW(n1(m))}</div><p class="small faint" style="margin-bottom:10px">estimated one-rep max</p><table class="tbl"><thead><tr><th>% of max</th><th>Weight</th><th>About</th></tr></thead><tbody>${[95, 90, 85, 80, 75, 70, 65].map(p => `<tr><td class="num mono">${p}%</td><td class="num mono">${fmtW(round(m * p / 100, 0.5))}</td><td class="small muted">${Math.max(1, Math.round(30 * (100 / p - 1)))} reps</td></tr>`).join("")}</tbody></table>`;
}
function calcPlates() {
  const t = parseFloat(($("#p-t") || {}).value ?? 102.5), b = parseFloat(($("#p-b") || {}).value ?? 20);
  if (!(t > 0) || !(b >= 0)) return `<p class="faint small">Enter a target weight.</p>`;
  if (t < b) return `<p class="faint small">Target is lighter than the bar.</p>`;
  const plates = U() === "lb" ? [45, 35, 25, 10, 5, 2.5] : [25, 20, 15, 10, 5, 2.5, 1.25];
  let side = (t - b) / 2; const out = [];
  plates.forEach(p => { while (side >= p - 1e-9) { out.push(p); side = +(side - p).toFixed(4); } });
  const cols = {25: "var(--s8)", 20: "var(--s1)", 15: "var(--s4)", 10: "var(--s6)", 5: "var(--ink-2)", 2.5: "var(--ink-3)", 1.25: "var(--ink-3)", 45: "var(--s1)", 35: "var(--s4)"};
  return `<div class="row" style="gap:3px;align-items:center;height:92px;margin-bottom:10px"><span style="width:28px;height:10px;background:var(--ink-3);border-radius:3px"></span>${out.map(p => `<span title="${p}" style="width:${p >= 10 ? 16 : 11}px;height:${Math.min(90, 34 + p * 2.2)}px;background:${cols[p] || "var(--ink-2)"};border-radius:4px"></span>`).join("")}<span style="flex:1;max-width:120px;height:10px;background:var(--ink-3);border-radius:0 3px 3px 0"></span></div><p><b>Each side:</b> <span class="mono">${out.length ? out.join(" + ") : "nothing, just the bar"}</span></p>${side > 0.001 ? `<p class="small" style="color:var(--warn);margin-top:6px">Can't make exactly ${fmtW(t)}. Closest is ${fmtW(t - side * 2)}.</p>` : ""}`;
}
/* ---------- food & nutrition ---------- */
const NUT = [
  ["kcal","Calories","kcal"],["p","Protein","g"],["c","Carbs","g"],["f","Fat","g"],
  ["fib","Fiber","g"],["sug","Sugar","g"],["sat","Saturated fat","g"],["chol","Cholesterol","mg"],["na","Sodium","mg"],
  ["k","Potassium","mg"],["ca","Calcium","mg"],["fe","Iron","mg"],["mg","Magnesium","mg"],["zn","Zinc","mg"],
  ["vc","Vitamin C","mg"],["vd","Vitamin D","µg"],["va","Vitamin A","µg"],["b12","Vitamin B12","µg"],["fol","Folate","µg"],
  ["ve","Vitamin E","mg"],["vk","Vitamin K","µg"],["b6","Vitamin B6","mg"],
];
const NUTM = Object.fromEntries(NUT.map(n => [n[0], n]));
const LIMIT_KEYS = ["sug", "sat", "chol", "na"];
const MICRO_KEYS = ["fib", "sug", "sat", "chol", "na", "k", "ca", "fe", "mg", "zn", "vc", "vd", "va", "b12", "fol", "ve", "vk", "b6"];
const MEALS = [["breakfast", "Breakfast"], ["lunch", "Lunch"], ["dinner", "Dinner"], ["snacks", "Snacks"]];
const ACTIVITY = [["sedentary", "Not very active", 1.2, "Desk job, little walking"], ["light", "Lightly active", 1.375, "On your feet part of the day"], ["active", "Active", 1.55, "On your feet most of the day"], ["very", "Very active", 1.725, "Physical job or hard daily training"]];
const GOALS = [[-1, "Lose 1 kg a week"], [-0.75, "Lose 0.75 kg a week"], [-0.5, "Lose 0.5 kg a week"], [-0.25, "Lose 0.25 kg a week"], [0, "Maintain weight"], [0.25, "Gain 0.25 kg a week"], [0.5, "Gain 0.5 kg a week"]];
const ZX_URL = "https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js";
const DEF_NUTRI = {sex: "", birthYear: "", height: "", weight: "", activity: "light", goal: 0, macroMode: "bw", protPerKg: 1.8, pct: {p: 30, c: 40, f: 30}};
const nutri = () => ({...DEF_NUTRI, ...(S.settings.nutri || {})});
const r1 = v => Math.round(v * 10) / 10;
function currentKg() {
  const pts = Object.values(S.body).sort((a, b) => a.date.localeCompare(b.date)); const last = pts[pts.length - 1];
  const toKg = v => U() === "lb" ? v * 0.45359 : v;
  if (last) return {kg: toKg(+last.kg), from: "log", date: last.date};
  const w = +nutri().weight; return w > 0 ? {kg: toKg(w), from: "profile"} : null;
}
function foodGoals() {
  const p = nutri(); const w = currentKg(); const age = p.birthYear ? new Date().getFullYear() - +p.birthYear : 0;
  const ready = !!(p.sex && age > 12 && +p.height > 100 && w);
  const male = p.sex === "male";
  let bmr = 0, tdee = 0, kcal = 2000, act = ACTIVITY.find(a => a[0] === p.activity) || ACTIVITY[1], delta = 0, floorHit = false;
  if (ready) {
    bmr = 10 * w.kg + 6.25 * +p.height - 5 * age + (male ? 5 : -161);
    tdee = bmr * act[2]; delta = Math.round(+p.goal * 7700 / 7);
    kcal = Math.round((tdee + delta) / 10) * 10;
    const floor = male ? 1500 : 1200; if (kcal < floor) { kcal = floor; floorHit = true; }
  }
  let pg, cg, fg;
  if (ready && p.macroMode === "bw") { pg = Math.round(+p.protPerKg * w.kg); fg = Math.round(kcal * 0.3 / 9); cg = Math.max(0, Math.round((kcal - pg * 4 - fg * 9) / 4)); }
  else { const pc = p.macroMode === "custom" ? p.pct : {p: 20, c: 50, f: 30}; pg = Math.round(kcal * pc.p / 100 / 4); cg = Math.round(kcal * pc.c / 100 / 4); fg = Math.round(kcal * pc.f / 100 / 9); }
  const old = age >= 51, older = age >= 71;
  const g = {kcal, p: pg, c: cg, f: fg,
    fib: Math.round(14 * kcal / 1000), sug: Math.round(kcal * 0.1 / 4), sat: Math.round(kcal * 0.1 / 9), chol: 300, na: 2300,
    k: male ? 3400 : 2600, ca: older || (!male && old) ? 1200 : 1000, fe: male || old ? 8 : 18,
    mg: male ? (age >= 31 ? 420 : 400) : (age >= 31 ? 320 : 310), zn: male ? 11 : 8, vc: male ? 90 : 75, vd: older ? 20 : 15,
    va: male ? 900 : 700, b12: 2.4, fol: 400, ve: 15, vk: male ? 120 : 90, b6: old ? (male ? 1.7 : 1.5) : 1.3};
  const water = w ? Math.round(w.kg * 35 / 50) * 50 : 2500;
  return {g, ready, bmr, tdee, act, delta, age, w, water, floorHit, mode: ready ? p.macroMode : "mfp"};
}
const dayEntries = d => Object.values(S.food).filter(e => e.date === d).sort((a, b) => (a.created || 0) - (b.created || 0));
function totals(entries) {
  const t = {}, missing = {};
  NUT.forEach(([k]) => { t[k] = 0; missing[k] = 0; });
  entries.forEach(e => NUT.forEach(([k]) => { const v = e.n[k]; if (v == null) missing[k]++; else t[k] += v * e.g / 100; }));
  return {t, missing};
}
const kcalOf = e => (e.n.kcal || 0) * e.g / 100;
function foodTiles() {
  const {g} = foodGoals(); const eaten = totals(dayEntries(today())).t.kcal; const ml = (S.water[today()] || {}).ml || 0; const wg = foodGoals().water;
  return `<button class="tile" data-tab="food"><span class="k"><i class="dot" style="--c:var(--c-food)"></i>Food</span><span class="v">${fmtInt(eaten)}<span class="faint" style="font-size:14px"> / ${fmtInt(g.kcal)}</span></span><span class="s">kcal today</span><div class="meter"><i style="width:${Math.min(100, eaten / g.kcal * 100)}%;--c:${eaten > g.kcal * 1.05 ? "var(--warn)" : "var(--c-food)"}"></i></div></button>
    <button class="tile" data-tab="food"><span class="k"><i class="dot" style="--c:var(--s1)"></i>Water</span><span class="v">${n1(ml / 1000)}<span class="faint" style="font-size:14px"> / ${n1(wg / 1000)} L</span></span><span class="s">today</span><div class="meter"><i style="width:${Math.min(100, ml / wg * 100)}%;--c:var(--s1)"></i></div></button>`;
}

/* food database (USDA SR28, loaded on demand from foods.json) */
let FDB = null, fdbState = "idle";
async function loadFDB() {
  if (FDB || fdbState === "loading") return;
  fdbState = "loading";
  try { const r = await fetch("foods.json"); if (!r.ok) throw new Error(r.status); const j = await r.json(); j.foods.forEach(f => { f.lc = f[1].toLowerCase(); }); j.byId = new Map(j.foods.map(f => [f[0], f])); FDB = j; fdbState = "ready"; }
  catch (e) { console.warn("food db", e); fdbState = "error"; }
  const fr = $("#food-results"); if (fr) fr.innerHTML = foodResults();
  if (ui.tab === "food") scheduleRender();
}
function usdaFood(row) {
  const per = {}; FDB.keys.forEach((k, i) => { const v = row[3 + i]; if (v != null) per[k] = v; });
  const sv = row[3 + FDB.keys.length] || []; const servings = []; for (let i = 0; i < sv.length; i += 2) servings.push([sv[i], sv[i + 1]]);
  return {ref: "usda:" + row[0], name: row[1], per, servings, group: FDB.groups[row[2]]};
}
function myFood(f) { return {ref: "my:" + f.id, name: f.name + (f.brand ? ` (${f.brand})` : ""), per: f.per, servings: f.serving ? [[+f.serving, "serving"]] : [], mine: f}; }
function searchFoods(q) {
  const toks = q.toLowerCase().split(/[\s,]+/).filter(Boolean); if (!toks.length || !FDB) return [];
  const res = [];
  for (const f of FDB.foods) {
    const n = f.lc; let sc = 0, ok = true;
    for (let ti = 0; ti < toks.length; ti++) { const t = toks[ti]; const i = n.indexOf(t); if (i < 0) { ok = false; break; } sc += i === 0 ? 40 : (n[i - 1] === " " || n[i - 1] === ",") ? 14 : 2; if (ti === 0 && i > 0 && n.indexOf(",") < i) sc -= 6; }
    if (!ok) continue;
    sc -= n.length / 9 + (n.split(",").length - 1) * 2;
    if (/\braw\b/.test(n)) sc += 4; if (/\b(cooked|roasted|boiled|baked|grilled|broiled)\b/.test(n)) sc += 3;
    if (n.startsWith(toks[0] + ",")) sc += 10;
    if (/\bmeat only\b/.test(n)) sc += 5;
    if (/\b(fat-free|breaded|flavou?r|sliced|deli|luncheon|nuggets|patties|prepared|imitation|substitute)\b/.test(n)) sc -= 12;
    if (/[A-Z]{3,}/.test(f[1])) sc -= 10;
    res.push([sc, f]);
  }
  res.sort((a, b) => b[0] - a[0]); return res.slice(0, 40).map(r => usdaFood(r[1]));
}
function recentFoods() {
  const seen = new Map(); Object.values(S.food).sort((a, b) => (b.created || 0) - (a.created || 0)).forEach(e => { const k = e.ref || e.name; if (!seen.has(k)) seen.set(k, e); });
  return [...seen.values()].slice(0, 12);
}
const entryFood = e => ({ref: e.ref, name: e.name, per: e.n, servings: e.sv || [], estimate: e.est});
const mealLabel = m => (MEALS.find(x => x[0] === m) || [m, m])[1];

/* ---- Food view ---- */
function vFood() {
  loadFDB();
  const d = ui.foodDate || today(); const G = foodGoals(); const g = G.g;
  const entries = dayEntries(d); const {t, missing} = totals(entries);
  const left = g.kcal - t.kcal;
  const dayTitle = d === today() ? "Today" : relDay(d);
  let h = header("Food", `<span style="display:inline-flex;align-items:center;gap:4px"><button class="ibtn sm" data-act="food-day" data-d="-1" aria-label="Previous day">${icon("left", 18)}</button>${dayTitle}<button class="ibtn sm" data-act="food-day" data-d="1" aria-label="Next day" ${d >= today() ? "disabled style='opacity:.3'" : ""}>${icon("right", 18)}</button></span>`, hdrBtn("add-food", "Log food", `data-meal="${defaultMeal()}"`));
  if (!G.ready) h += `<section class="card" style="margin-bottom:14px;border-color:var(--c-food)"><div class="row between wrap"><div class="grow" style="min-width:220px"><b>Set your goals</b><p class="small muted" style="margin-top:2px">Add your sex, age and height and Daybook works out calories, macros and nutrients from your body weight. Until then it uses a standard 2,000 kcal day.</p></div><button class="btn pri sm" data-act="food-goals">Set up goals</button></div></section>`;
  // summary
  const pctK = Math.min(1, t.kcal / g.kcal);
  h += `<div class="grid2"><section class="card"><div class="row" style="gap:18px;align-items:center">
    <div style="position:relative;flex:none">${ring(pctK, t.kcal > g.kcal * 1.05 ? "var(--warn)" : "var(--c-food)", 116)}<div style="position:absolute;inset:0;display:grid;place-items:center;text-align:center"><div><div class="mono" style="font-size:22px;font-weight:600;line-height:1">${fmtInt(Math.abs(left))}</div><div class="tiny faint" style="margin-top:3px">${left >= 0 ? "kcal left" : "kcal over"}</div></div></div></div>
    <div class="grow stack" style="gap:9px">${[["p", "Protein", "--m-p"], ["c", "Carbs", "--m-c"], ["f", "Fat", "--m-f"]].map(([k, l, c]) => `<div><div class="row between small"><span>${l}</span><span class="mono">${Math.round(t[k])}<span class="faint"> / ${g[k]} g</span></span></div><div class="meter" style="margin-top:4px"><i style="width:${Math.min(100, t[k] / (g[k] || 1) * 100)}%;--c:var(${c})"></i></div></div>`).join("")}</div></div>
    <div class="row between small" style="margin-top:14px;padding-top:12px;border-top:1px solid var(--line)"><span class="muted">Eaten <b class="mono" style="color:var(--ink)">${fmtInt(t.kcal)}</b></span><span class="muted">Goal <b class="mono" style="color:var(--ink)">${fmtInt(g.kcal)}</b></span><button class="linkbtn" data-act="food-goals">Goals</button></div></section>`;
  // water
  const ml = (S.water[d] || {}).ml || 0;
  h += `<section class="card"><div class="card-h"><h2>Water</h2><span class="small faint">goal ${n1(G.water / 1000)} L, 35 ml per kg</span></div><div class="row" style="gap:14px;margin-bottom:12px"><span style="color:var(--s1)">${icon("drop", 30, 1.8)}</span><div class="grow"><div class="mono" style="font-size:22px;font-weight:600">${n1(ml / 1000)} L</div><div class="meter" style="margin-top:6px;height:8px"><i style="width:${Math.min(100, ml / G.water * 100)}%;--c:var(--s1)"></i></div></div></div><div class="row wrap"><button class="btn sm" data-act="water" data-v="250">+ Glass 250 ml</button><button class="btn sm" data-act="water" data-v="500">+ Bottle 500 ml</button><button class="btn sm ghost" data-act="water" data-v="-250" ${ml ? "" : "disabled"}>− 250 ml</button></div></section>`;
  // meals
  MEALS.forEach(([m, label]) => {
    const es = entries.filter(e => e.meal === m); const mk = sum(es.map(kcalOf));
    const yday = dkey(addDays(parseD(d), -1)); const yes = dayEntries(yday).filter(e => e.meal === m);
    h += `<section class="card"><div class="card-h"><h2>${label}</h2><span class="mono small ${mk ? "" : "faint"}">${fmtInt(mk)} kcal</span></div>`;
    h += es.length ? `<div class="list">${es.map(e => `<button class="li" style="width:100%;text-align:left" data-act="edit-entry" data-id="${e.id}"><span class="li-main"><span class="t">${esc(e.name)}</span><span class="sub">${r1(e.g)} g · P ${r1((e.n.p || 0) * e.g / 100)} · C ${r1((e.n.c || 0) * e.g / 100)} · F ${r1((e.n.f || 0) * e.g / 100)}${e.est ? ` <span class="pill warn">estimate</span>` : ""}</span></span><span class="mono" style="font-weight:600">${fmtInt(kcalOf(e))}</span></button>`).join("")}</div>` : "";
    h += `<div class="row wrap" style="margin-top:${es.length ? 10 : 0}px"><button class="btn sm ghost" data-act="add-food" data-meal="${m}">${icon("plus", 14)}Add food</button>${!es.length && yes.length ? `<button class="btn sm ghost" data-act="copy-meal" data-meal="${m}">Copy yesterday (${fmtInt(sum(yes.map(kcalOf)))} kcal)</button>` : ""}</div></section>`;
  });
  // nutrients
  const anyMissing = entries.length && MICRO_KEYS.some(k => missing[k]);
  h += `<section class="card span2"><div class="card-h"><h2>Nutrients</h2><span class="small faint">${entries.length ? `${entries.length} foods logged` : "log food to fill these in"}</span></div><div class="nutgrid">${MICRO_KEYS.map(k => {
    const [, l, u] = NUTM[k]; const v = t[k]; const goal = g[k]; const lim = LIMIT_KEYS.includes(k); const p = goal ? v / goal : 0;
    const col = lim ? (p > 1 ? "var(--bad)" : p > 0.85 ? "var(--warn)" : "var(--ink-3)") : (p >= 1 ? "var(--good)" : "var(--c-food)");
    return `<div class="nut"><div class="row between small"><span>${l}${missing[k] && entries.length ? `<span class="faint" title="Some foods don't list this nutrient"> *</span>` : ""}</span><span class="mono ${lim && p > 1 ? "" : ""}">${v >= 100 ? Math.round(v) : r1(v)}<span class="faint"> / ${lim ? "max " : ""}${goal} ${u}</span></span></div><div class="meter" style="margin-top:4px"><i style="width:${Math.min(100, p * 100)}%;--c:${col}"></i></div></div>`;
  }).join("")}</div><p class="tiny faint" style="margin-top:10px">Targets are adult daily reference intakes for your sex and age. Sugar, saturated fat, cholesterol and sodium are upper limits.${anyMissing ? " * Some foods you logged don't list this nutrient, so the real total is likely higher." : ""}</p></section>`;
  // trend
  const days = Array.from({length: 14}, (_, i) => dkey(addDays(new Date(), i - 13)));
  const bars = days.map(k => { const tt = totals(dayEntries(k)).t; return {l: fmtDate(k, {day: "numeric"}), v: Math.round(tt.kcal), c: tt.kcal > g.kcal * 1.05 ? "var(--warn)" : "var(--c-food)", tip: `${fmtDate(k, {weekday: "short", day: "numeric", month: "short"})}<br><b>${fmtInt(tt.kcal)} kcal</b> of ${fmtInt(g.kcal)}<br>P ${Math.round(tt.p)} · C ${Math.round(tt.c)} · F ${Math.round(tt.f)} g`}; });
  const logged = bars.filter(b => b.v > 0);
  h += `<section class="card span2"><div class="card-h"><h2>Last 14 days</h2><span class="small faint">${logged.length ? `avg ${fmtInt(sum(logged.map(b => b.v)) / logged.length)} kcal on logged days` : ""}</span></div>${logged.length ? chart({type: "bars", h: 160, bars, label: "Calories per day"}) : `<p class="faint small">Days you log show up here.</p>`}</section></div>`;
  h += fab("add-food", "Log food", `data-meal="${defaultMeal()}"`);
  return h;
}
function defaultMeal() { const hr = new Date().getHours(); return hr < 11 ? "breakfast" : hr < 16 ? "lunch" : hr < 21 ? "dinner" : "snacks"; }

/* ---- goals sheet ---- */
function sFoodGoals() {
  return () => {
    const p = nutri(); const G = foodGoals(); const w = G.w;
    const explain = G.ready ? `<section class="card" style="margin-top:6px"><div class="label" style="margin-bottom:8px">How your goal is worked out</div><table class="tbl"><tbody>
      <tr><td>BMR, Mifflin-St Jeor<br><span class="tiny faint">10 × ${n1(w.kg)} kg + 6.25 × ${p.height} cm − 5 × ${G.age} ${p.sex === "male" ? "+ 5" : "− 161"}</span></td><td class="num mono" style="text-align:right">${Math.round(G.bmr)}</td></tr>
      <tr><td>× ${G.act[2]} for ${G.act[1].toLowerCase()}</td><td class="num mono" style="text-align:right">${Math.round(G.tdee)}</td></tr>
      <tr><td>${G.delta ? `${G.delta > 0 ? "+" : "−"} ${Math.abs(G.delta)} for ${Math.abs(p.goal)} kg a week<br><span class="tiny faint">1 kg of body weight ≈ 7,700 kcal</span>` : "No change to maintain"}</td><td class="num mono" style="text-align:right">${G.delta ? (G.delta > 0 ? "+" : "−") + Math.abs(G.delta) : "0"}</td></tr>
      <tr><td><b>Daily calories</b>${G.floorHit ? `<br><span class="tiny" style="color:var(--warn)">Raised to the ${p.sex === "male" ? "1,500" : "1,200"} kcal minimum</span>` : ""}</td><td class="num mono" style="text-align:right"><b>${fmtInt(G.g.kcal)}</b></td></tr>
      <tr><td>Protein · carbs · fat</td><td class="num mono" style="text-align:right">${G.g.p} · ${G.g.c} · ${G.g.f} g</td></tr></tbody></table>
      <p class="tiny faint" style="margin-top:8px">Uses your latest weight${w.from === "log" ? ` from the body weight log (${fmtDate(w.date)})` : ""}, so goals update as your weight changes. This is the same method MyFitnessPal uses.</p></section>` : "";
    return sheetHead("Food goals") + `<form data-form="food-goals" class="stack">
      <div class="field"><span>Sex, for the BMR formula</span><div class="seg" role="group"><button type="button" data-act="radio" data-name="sex" data-v="male" aria-pressed="${p.sex === "male"}">Male</button><button type="button" data-act="radio" data-name="sex" data-v="female" aria-pressed="${p.sex === "female"}">Female</button></div><input type="hidden" name="sex" value="${p.sex}"></div>
      <div class="fgrid"><label class="field"><span>Year of birth</span><input name="birthYear" type="number" min="1920" max="${new Date().getFullYear() - 13}" value="${esc(p.birthYear)}" placeholder="e.g. 1998"></label>
      <label class="field"><span>Height (cm)</span><input name="height" type="number" min="120" max="230" value="${esc(p.height)}" placeholder="e.g. 182"></label>
      <label class="field full"><span>Weight (${U()})${w && w.from === "log" ? ` · using ${n1(U() === "lb" ? w.kg / 0.45359 : w.kg)} from your log` : ""}</span><input name="weight" inputmode="decimal" value="${esc(p.weight)}" placeholder="${w && w.from === "log" ? "Taken from your body weight log" : "e.g. 80"}" ${w && w.from === "log" ? "disabled" : ""}></label></div>
      <label class="field"><span>Activity outside workouts</span><select name="activity">${ACTIVITY.map(a => `<option value="${a[0]}" ${p.activity === a[0] ? "selected" : ""}>${a[1]}: ${a[3]}</option>`).join("")}</select></label>
      <label class="field"><span>Goal</span><select name="goal">${GOALS.map(o => `<option value="${o[0]}" ${+p.goal === o[0] ? "selected" : ""}>${o[1]}</option>`).join("")}</select></label>
      <div class="field"><span>Macros</span><div class="seg" role="group"><button type="button" data-act="radio" data-name="macroMode" data-v="bw" aria-pressed="${p.macroMode === "bw"}">By body weight</button><button type="button" data-act="radio" data-name="macroMode" data-v="mfp" aria-pressed="${p.macroMode === "mfp"}">50 / 20 / 30</button><button type="button" data-act="radio" data-name="macroMode" data-v="custom" aria-pressed="${p.macroMode === "custom"}">Custom</button></div><input type="hidden" name="macroMode" value="${p.macroMode}"></div>
      <label class="field" data-show="macroMode=bw" ${p.macroMode === "bw" ? "" : "hidden"}><span>Protein per kg of body weight (1.6 to 2.2 suits strength training)</span><input name="protPerKg" inputmode="decimal" value="${p.protPerKg}"></label>
      <p class="tiny faint" data-show="macroMode=bw" ${p.macroMode === "bw" ? "" : "hidden"}>Protein from your weight, 30% of calories from fat, the rest from carbs.</p>
      <p class="tiny faint" data-show="macroMode=mfp" ${p.macroMode === "mfp" ? "" : "hidden"}>MyFitnessPal's default: 50% carbs, 20% protein, 30% fat.</p>
      <div class="fgrid" data-show="macroMode=custom" ${p.macroMode === "custom" ? "" : "hidden"} style="grid-template-columns:repeat(3,minmax(0,1fr))"><label class="field"><span>Protein %</span><input name="pp" type="number" min="5" max="70" value="${p.pct.p}"></label><label class="field"><span>Carbs %</span><input name="pc" type="number" min="0" max="80" value="${p.pct.c}"></label><label class="field"><span>Fat %</span><input name="pf" type="number" min="10" max="80" value="${p.pct.f}"></label></div>
      <div class="sh-foot"><button class="btn pri">Save goals</button></div></form>${explain}`;
  };
}

/* ---- add food sheet ---- */
let foodQ = "", addMeal = "breakfast";
function foodResults() {
    const q = foodQ.trim(); const ql = q.toLowerCase();
    const mine = Object.values(S.foods).filter(f => !q || (f.name + " " + (f.brand || "")).toLowerCase().includes(ql)).sort((a, b) => a.name.localeCompare(b.name));
    let list = "";
    const row = (act, attrs, name, sub, kcal) => `<button class="pick" data-act="${act}" ${attrs}><span class="grow" style="min-width:0"><b style="display:block;overflow:hidden;text-overflow:ellipsis">${esc(name)}</b><span class="small faint">${sub}</span></span><span class="mono small muted" style="white-space:nowrap">${kcal != null ? fmtInt(kcal) + " kcal" : ""}</span></button>`;
    if (!q) {
      const rec = recentFoods();
      if (rec.length) list += `<div class="label" style="padding:10px 4px 4px">Recent</div>` + rec.map(e => row("pick-recent", `data-id="${e.id}"`, e.name, `${r1(e.g)} g last time`, kcalOf(e))).join("");
      if (mine.length) list += `<div class="label" style="padding:14px 4px 4px">My foods</div>` + mine.slice(0, 20).map(f => row("pick-my", `data-id="${f.id}"`, f.name + (f.brand ? ` (${f.brand})` : ""), `per 100 g${f.barcode ? " · barcode" : ""}`, f.per.kcal)).join("");
      if (!rec.length && !mine.length) list += `<p class="small muted" style="padding:10px 4px">Search ${FDB ? FDB.foods.length.toLocaleString() : "thousands of"} foods from the USDA database, like “chicken breast”, “rice cooked” or “banana”. Values are per 100 g, and you log the grams you ate.</p>`;
    } else {
      if (mine.length) list += `<div class="label" style="padding:10px 4px 4px">My foods</div>` + mine.map(f => row("pick-my", `data-id="${f.id}"`, f.name + (f.brand ? ` (${f.brand})` : ""), "per 100 g", f.per.kcal)).join("");
      if (fdbState === "loading" || fdbState === "idle") list += `<p class="small faint" style="padding:12px 4px">Loading the food database…</p>`;
      else if (fdbState === "error") list += `<p class="small" style="padding:12px 4px;color:var(--warn)">The food database didn't load. Check your connection and reopen this sheet.</p>`;
      else {
        const res = searchFoods(q);
        list += `<div class="label" style="padding:14px 4px 4px">USDA database · per 100 g</div>` + (res.length ? res.map(f => row("pick-usda", `data-id="${f.ref.slice(5)}"`, f.name, esc(f.group), f.per.kcal)).join("") : `<p class="small faint" style="padding:8px 4px">No matches. Try fewer or simpler words, like “beef ground” instead of “minced beef”.</p>`);
      }
      list += `<button class="btn block ghost" style="margin-top:12px" data-act="estimate-food">${icon("spark", 16)}Estimate “${esc(q)}” with Claude</button>`;
    }
    return list;
}
function sAddFood() {
  return () => sheetHead(`Add to ${mealLabel(addMeal).toLowerCase()}`) + `<div class="stack" style="gap:10px">
      <input id="foodsearch" placeholder="Search foods" value="${esc(foodQ)}" autocomplete="off" autofocus>
      <div class="row" style="gap:8px"><button class="btn sm grow" data-act="scan-open">${icon("barcode", 16)}Scan barcode</button><button class="btn sm grow" data-act="new-food">${icon("plus", 16)}Create food</button></div>
      <div class="chips">${MEALS.map(([m, l]) => `<button class="chip" data-act="add-meal" data-v="${m}" aria-pressed="${addMeal === m}">${l}</button>`).join("")}</div>
      <div id="food-results">${foodResults()}</div></div>`;
}

/* ---- portion sheet ---- */
let portion = null;
function openPortion(food, opts = {}) {
  const sv = food.servings || [];
  portion = {food, g: opts.g || (sv[0] && sv[0][1] === "serving" ? sv[0][0] : 100), unit: "g", amount: opts.g || (sv[0] && sv[0][1] === "serving" ? sv[0][0] : 100), meal: opts.meal || addMeal, editId: opts.editId || null, date: opts.date || ui.foodDate || today()};
  openSheet(sPortion());
}
function portionGrams() { const p = portion; const a = num(p.amount); if (!(a > 0)) return 0; if (p.unit === "g") return a; if (p.unit === "oz") return a * 28.35; const s = p.food.servings[+p.unit]; return s ? a * s[0] : a; }
function portionPreview() {
  const g = portionGrams(); const n = portion.food.per; const v = k => n[k] == null ? "–" : r1(n[k] * g / 100);
  return `<div class="tiles pv" style="grid-template-columns:repeat(4,minmax(0,1fr))">${statTile("kcal", n.kcal == null ? "–" : fmtInt(n.kcal * g / 100))}${statTile("Protein", v("p") + " g")}${statTile("Carbs", v("c") + " g")}${statTile("Fat", v("f") + " g")}</div>
    <p class="tiny faint" style="margin-top:8px">${Math.round(g)} g · per 100 g: ${n.kcal ?? "–"} kcal, fiber ${n.fib ?? "–"} g, sugar ${n.sug ?? "–"} g, sodium ${n.na ?? "–"} mg</p>`;
}
function sPortion() {
  return () => {
    const p = portion; const f = p.food;
    return sheetHead(p.editId ? "Edit entry" : "How much?") + `<div class="stack">
      <div><b style="font-size:17px">${esc(f.name)}</b>${f.estimate ? ` <span class="pill warn">Claude's estimate</span>` : ""}${f.group ? `<div class="small faint">${esc(f.group)} · USDA</div>` : ""}</div>
      <div class="fgrid"><label class="field"><span>Amount</span><input id="pt-amt" data-portion="amount" inputmode="decimal" value="${esc(p.amount)}" autocomplete="off"></label>
      <label class="field"><span>Unit</span><select id="pt-unit" data-portion="unit"><option value="g" ${p.unit === "g" ? "selected" : ""}>grams</option>${f.servings.map((s, i) => `<option value="${i}" ${p.unit === String(i) ? "selected" : ""}>${esc(s[1])} (${s[0]} g)</option>`).join("")}<option value="oz" ${p.unit === "oz" ? "selected" : ""}>ounces</option></select></label></div>
      <div class="chips">${MEALS.map(([m, l]) => `<button class="chip" data-act="pt-meal" data-v="${m}" aria-pressed="${p.meal === m}">${l}</button>`).join("")}</div>
      <div id="pt-prev">${portionPreview()}</div>
      <div class="sh-foot">${p.editId ? `<button class="btn danger" data-act="del-entry" data-id="${p.editId}" data-confirm="Tap again to remove">Remove</button>` : ""}<button class="btn pri" data-act="save-portion">${p.editId ? "Save" : "Add to " + mealLabel(p.meal).toLowerCase()}</button></div>
      ${f.estimate && !f.mine ? `<button class="btn block ghost sm" data-act="save-estimate">Save to my foods for next time</button>` : ""}${f.mine && S.foods[f.mine.id] ? `<button class="btn block ghost sm" data-act="edit-myfood" data-id="${f.mine.id}">Edit this food</button>` : ""}</div>`;
  };
}

/* ---- my food / product form ---- */
let foodDraft = null;
const FORM_KEYS = ["kcal", "p", "c", "sug", "f", "sat", "fib"];
function sMyFood() {
  return () => {
    const d = foodDraft; const per = d.per || {};
    const inp = (k, label) => `<label class="field"><span>${label}</span><input name="n_${k}" inputmode="decimal" value="${per[k] ?? ""}" placeholder="–"></label>`;
    return sheetHead(d.id && S.foods[d.id] ? "Edit food" : d.barcode ? "New product" : "Create food") + `<form data-form="myfood" class="stack">
      ${d.barcode && !S.foods[d.id] ? `<p class="small muted">Barcode <b class="mono">${esc(d.barcode)}</b> isn't in your foods yet. Take a photo of the nutrition label and Claude reads the values, or type them from the box. Daybook remembers this product for the next scan. You can also look it up on <a href="https://world.openfoodfacts.org/product/${encodeURIComponent(d.barcode)}" target="_blank" rel="noopener">Open Food Facts</a>.</p>` : ""}
      <label class="btn ${d.barcode ? "pri" : ""}" style="cursor:pointer">${icon("camera", 16)}Read values from a label photo<input type="file" accept="image/*" capture="environment" id="label-file" hidden></label>
      <div id="label-status" class="small faint" hidden></div>
      <div class="fgrid"><label class="field full"><span>Name</span><input name="name" required maxlength="80" value="${esc(d.name || "")}" placeholder="e.g. Chicken breast, grilled" autocomplete="off"></label>
      <label class="field"><span>Brand (optional)</span><input name="brand" maxlength="40" value="${esc(d.brand || "")}" autocomplete="off"></label>
      <label class="field"><span>Barcode (optional)</span><input name="barcode" inputmode="numeric" value="${esc(d.barcode || "")}" autocomplete="off"></label>
      <label class="field full"><span>Serving size in grams (optional)</span><input name="serving" inputmode="decimal" value="${d.serving ?? ""}" placeholder="e.g. 30"></label></div>
      <div class="label">Nutrition per 100 g</div>
      <div class="fgrid">${inp("kcal", "Calories (kcal)")}${inp("p", "Protein (g)")}${inp("c", "Carbs (g)")}${inp("sug", "of which sugar (g)")}${inp("f", "Fat (g)")}${inp("sat", "of which saturated (g)")}${inp("fib", "Fiber (g)")}<label class="field"><span>Salt (g)</span><input name="salt" inputmode="decimal" value="${per.na != null ? r1(per.na / 400 * 100) / 100 : ""}" placeholder="–"></label></div>
      <details ${MICRO_KEYS.some(k => !["fib", "sug", "sat", "na"].includes(k) && per[k] != null) ? "open" : ""}><summary class="small" style="cursor:pointer;font-weight:600;color:var(--ink-2);padding:6px 0">Vitamins and minerals (optional)</summary><div class="fgrid" style="margin-top:8px">${MICRO_KEYS.filter(k => !["fib", "sug", "sat", "na"].includes(k)).map(k => inp(k, `${NUTM[k][1]} (${NUTM[k][2]})`)).join("")}</div></details>
      <div class="sh-foot">${d.id && S.foods[d.id] ? `<button type="button" class="btn danger" data-act="del-myfood" data-id="${d.id}" data-confirm="Tap again to delete">Delete</button>` : ""}<button class="btn pri">${d.id && S.foods[d.id] ? "Save" : "Save and log"}</button></div></form>`;
  };
}

/* ---- barcode ---- */
function sScan() {
  return () => sheetHead("Scan barcode") + `<div class="stack">
    <p class="small muted">Take a clear photo of the barcode on the package. Products you've scanned before log straight away.</p>
    <label class="btn pri" style="cursor:pointer;min-height:52px">${icon("camera", 18)}Take a photo of the barcode<input type="file" accept="image/*" capture="environment" id="bc-file" hidden></label>
    <div id="bc-status" class="small" hidden></div>
    <form data-form="barcode" class="inline-add"><input id="bc-num" name="code" inputmode="numeric" placeholder="Or type the number under the barcode" autocomplete="off"><button class="btn">Look up</button></form>
    <p class="tiny faint">Daybook reads the barcode on your device. Product nutrition comes from what you save, since this page can't reach online product databases.</p></div>`;
}
const loadedScripts = {};
function loadScript(src) { return loadedScripts[src] || (loadedScripts[src] = new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = () => { delete loadedScripts[src]; rej(new Error("load")); }; document.head.appendChild(s); })); }
async function shrink(file, max = 1600) {
  const img = await createImageBitmap(file); const k = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); return c;
}
async function decodeBarcode(file) {
  let canvas = null; try { canvas = await shrink(file); } catch {}
  if ("BarcodeDetector" in window && canvas) {
    try { const bd = new BarcodeDetector({formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "qr_code"]}); const r = await bd.detect(canvas); if (r && r[0]) return r[0].rawValue; } catch {}
  }
  await loadScript(ZX_URL);
  const hints = new Map(); hints.set(ZXing.DecodeHintType.TRY_HARDER, true);
  const reader = new ZXing.BrowserMultiFormatReader(hints);
  const url = canvas ? canvas.toDataURL("image/jpeg", 0.92) : URL.createObjectURL(file);
  try { const res = await reader.decodeFromImageUrl(url); return res.getText(); } catch { return null; }
}
function lookupBarcode(code) {
  code = String(code).replace(/\D/g, "") || String(code).trim(); if (!code) return;
  const f = Object.values(S.foods).find(x => x.barcode && (x.barcode === code || x.barcode.replace(/^0+/, "") === code.replace(/^0+/, "")));
  stack.pop();
  if (f) { openPortion(myFood(f)); return; }
  foodDraft = {id: uid(), barcode: code, per: {}}; openSheet(sMyFood());
}

/* ---- Claude helpers (label photo, estimates) ---- */
const PER_SCHEMA = `"per": {"kcal": number, "p": protein g, "c": carbs g, "sug": sugars g, "f": fat g, "sat": saturated fat g, "fib": fiber g, "na": sodium mg, "chol": mg, "k": potassium mg, "ca": calcium mg, "fe": iron mg, "mg": magnesium mg, "zn": zinc mg, "vc": vitamin C mg, "vd": vitamin D µg, "va": vitamin A µg RAE, "b12": µg, "fol": folate µg, "ve": vitamin E mg, "vk": vitamin K µg, "b6": mg}`;
async function getSample(needImages) {
  let s = null; try { s = window.claude && await window.claude.use("sample"); } catch {}
  if (!s) return null;
  if (needImages) { const lim = await s.limits().catch(() => null); if (!lim || !lim.images) return null; }
  return s;
}
async function readLabel(file) {
  const st = $("#label-status"); const say = (t, c) => { if (st) { st.hidden = false; st.textContent = t; st.style.color = c || ""; } };
  const s = await getSample(true);
  if (!s) { say("Reading photos isn't available here. Type the values from the label instead.", "var(--warn)"); return; }
  say("Reading the label…");
  try {
    const canvas = await shrink(file, 1400); const blob = await new Promise(r => canvas.toBlob(r, "image/jpeg", 0.88));
    const data = await s.json(`The image is a photo of a food package's nutrition facts label. Read it and return only JSON: {"name": product name if visible else null, "brand": brand if visible else null, "serving_g": serving size in grams or null, ${PER_SCHEMA}}. All values must be per 100 g (or 100 ml). If the label only lists per serving, convert to per 100 g using the serving size. If energy is only in kJ, divide by 4.184. If the label gives salt in grams, sodium mg = salt g × 400. Use null for anything not on the label; never guess.`, {images: [blob], modelTier: "default"});
    const per = {}; for (const [k, v] of Object.entries((data && data.per) || {})) if (NUTM[k] && v != null && isFinite(+v)) per[k] = r1(+v);
    const f = $("#sheet form[data-form=myfood]"); if (!f) return;
    for (const [k, v] of Object.entries(per)) { const i = f.elements["n_" + k]; if (i) i.value = v; }
    if (per.na != null && f.salt) f.salt.value = Math.round(per.na / 400 * 100) / 100;
    if (data.name && !f.name.value) f.name.value = data.name; if (data.brand && !f.brand.value) f.brand.value = data.brand; if (data.serving_g && !f.serving.value) f.serving.value = data.serving_g;
    if (Object.keys(per).some(k => !["kcal", "p", "c", "sug", "f", "sat", "fib", "na"].includes(k))) { const det = f.querySelector("details"); if (det) det.open = true; }
    say(`Read ${Object.keys(per).length} values. Check them against the label, then save.`, "var(--good)");
  } catch (e) { say(e && e.code === "not_granted" ? "Photo reading was declined. Type the values instead." : "Couldn't read that photo. Try a sharper, closer shot of the label.", "var(--warn)"); }
}
async function estimateFood(q) {
  const s = await getSample(false);
  if (!s) { toast("Estimates aren't available here. Create the food with its label values instead."); return; }
  toast("Asking Claude for an estimate…");
  try {
    const data = await s.json(`Estimate the nutrition of this food or dish as a typical serving: "${q}". Base it on standard food composition data (such as USDA) and common recipes. Return only JSON: {"name": short name, "portion_g": typical portion in grams, ${PER_SCHEMA}} with every value per 100 g. Use null where you have no reasonable basis.`, {modelTier: "default"});
    const per = {}; for (const [k, v] of Object.entries((data && data.per) || {})) if (NUTM[k] && v != null && isFinite(+v)) per[k] = r1(+v);
    if (per.kcal == null) throw new Error("no kcal");
    stack.pop();
    openPortion({ref: "est:" + uid(), name: data.name || q, per, servings: data.portion_g ? [[+data.portion_g, "typical portion"]] : [], estimate: true}, {g: +data.portion_g || 100});
    portion.unit = data.portion_g ? "0" : "g"; portion.amount = data.portion_g ? 1 : 100; paintSheet();
  } catch (e) { toast(e && e.code === "not_granted" ? "Estimates were declined." : "Couldn't get an estimate. Try describing it differently."); }
}

function saveEntry() {
  const p = portion; const g = portionGrams(); if (!(g > 0)) { toast("Enter an amount above zero"); return; }
  const old = p.editId ? S.food[p.editId] : null; const f = p.food;
  const e = {id: p.editId || uid(), date: old ? old.date : p.date, meal: p.meal, name: f.name, ref: f.ref, g: r1(g), n: f.per, sv: f.servings || [], created: old ? old.created : Date.now()};
  if (f.estimate) e.est = 1;
  put("food", e); ui.foodMeal = p.meal; closeAll();
  toast(old ? "Saved" : `Added ${Math.round(g)} g ${f.name.split(",")[0].toLowerCase()}, ${fmtInt((f.per.kcal || 0) * g / 100)} kcal`);
}
const FOOD_ACTIONS = {
  "food-day": el => { const n = dkey(addDays(parseD(ui.foodDate || today()), +el.dataset.d)); if (n > today()) return; ui.foodDate = n; render(); },
  "food-goals": () => openSheet(sFoodGoals()),
  "add-food": el => { closeAll(); addMeal = el.dataset.meal || defaultMeal(); foodQ = ""; loadFDB(); if (ui.tab !== "food") ui.foodDate = today(); openSheet(sAddFood()); },
  "add-meal": el => { addMeal = el.dataset.v; paintSheet(); },
  "pick-recent": el => { const e = S.food[el.dataset.id]; if (e) openPortion(entryFood(e), {g: e.g}); },
  "pick-my": el => { const f = S.foods[el.dataset.id]; if (f) openPortion(myFood(f)); },
  "pick-usda": el => { const row = FDB && FDB.byId.get(+el.dataset.id); if (row) openPortion(usdaFood(row)); },
  "estimate-food": () => estimateFood(foodQ.trim()),
  "scan-open": () => openSheet(sScan()),
  "new-food": () => { foodDraft = {id: uid(), name: foodQ.trim(), per: {}}; openSheet(sMyFood()); },
  "edit-myfood": el => { foodDraft = clone(S.foods[el.dataset.id]); openSheet(sMyFood()); },
  "del-myfood": el => { del("foods", el.dataset.id); closeAll(); toast("Food deleted. Past entries keep their values."); },
  "pt-meal": el => { portion.meal = el.dataset.v; $$("#sheet [data-act=pt-meal]").forEach(b => b.setAttribute("aria-pressed", b === el)); const b = $("#sheet [data-act=save-portion]"); if (b && !portion.editId) b.textContent = "Add to " + mealLabel(portion.meal).toLowerCase(); },
  "save-portion": () => saveEntry(),
  "edit-entry": el => { const e = S.food[el.dataset.id]; if (e) openPortion(entryFood(e), {g: e.g, meal: e.meal, editId: e.id, date: e.date}); },
  "del-entry": el => { del("food", el.dataset.id); closeAll(); toast("Removed"); },
  "save-estimate": () => { const f = portion.food; const mf = {id: uid(), name: f.name, brand: "", barcode: "", serving: f.servings[0] ? f.servings[0][0] : "", per: f.per, src: "estimate", created: Date.now()}; put("foods", mf, true); portion.food = {...myFood(mf), estimate: true}; paintSheet(); toast("Saved to my foods"); },
  "copy-meal": el => { const d = ui.foodDate || today(); const y = dkey(addDays(parseD(d), -1)); const es = dayEntries(y).filter(e => e.meal === el.dataset.meal); es.forEach((e, i) => put("food", {...e, id: uid(), date: d, created: Date.now() + i})); toast(`Copied ${es.length} ${es.length === 1 ? "item" : "items"} from yesterday`); },
  water: el => { const d = ui.foodDate || today(); const cur = (S.water[d] || {}).ml || 0; put("water", {id: d, date: d, ml: Math.max(0, cur + +el.dataset.v)}); },
};
const FOOD_FORMS = {
  "food-goals": fd => {
    const cur = nutri(); const mode = fd.get("macroMode") || "bw";
    const pct = {p: +fd.get("pp") || 30, c: +fd.get("pc") || 40, f: +fd.get("pf") || 30};
    if (mode === "custom" && pct.p + pct.c + pct.f !== 100) { toast(`Macro percentages add up to ${pct.p + pct.c + pct.f}%. Make them 100%.`); return; }
    const w = fd.get("weight"); const ppk = num(fd.get("protPerKg"));
    setSettings({nutri: {...cur, sex: fd.get("sex") || "", birthYear: fd.get("birthYear") || "", height: fd.get("height") || "", weight: w === null ? cur.weight : (num(w) > 0 ? num(w) : ""), activity: fd.get("activity"), goal: +fd.get("goal"), macroMode: mode, protPerKg: ppk > 0 && ppk < 4 ? ppk : 1.8, pct}});
    toast("Goals updated"); paintSheet();
  },
  myfood: (fd) => {
    const d = foodDraft; const name = fd.get("name").trim(); if (!name) return;
    const per = {};
    NUT.forEach(([k]) => { const v = fd.get("n_" + k); if (v != null && String(v).trim() !== "" && num(v) >= 0) per[k] = r1(num(v)); });
    const salt = fd.get("salt"); if (salt && num(salt) >= 0) per.na = Math.round(num(salt) * 400); else if (d.per && d.per.na != null && !salt) delete per.na;
    if (per.kcal == null && (per.p != null || per.c != null || per.f != null)) per.kcal = Math.round((per.p || 0) * 4 + (per.c || 0) * 4 + (per.f || 0) * 9);
    if (per.kcal == null) { toast("Add at least the calories, or protein, carbs and fat"); return; }
    const existed = !!S.foods[d.id];
    const mf = {...d, name, brand: fd.get("brand").trim(), barcode: fd.get("barcode").replace(/\s/g, ""), serving: num(fd.get("serving")) > 0 ? num(fd.get("serving")) : "", per, src: d.src || "custom", created: d.created || Date.now()};
    put("foods", mf, true);
    if (existed) { closeSheet(); toast("Food saved"); return; }
    stack.pop();
    openPortion(myFood(mf)); toast("Saved to my foods");
  },
  barcode: fd => lookupBarcode(fd.get("code")),
};

/* ---------- steps ---------- */
const FFLATE_URL = "https://cdn.jsdelivr.net/npm/fflate@0.8.2/umd/index.js";
const stepGoal = () => Math.max(100, Math.round(+S.settings.stepGoal || 10000));
const stepsOn = d => (S.steps[d] || {}).n || 0;
const fmtInt = v => Math.round(v).toLocaleString();
const STEP_SRC = {manual: "Typed in", shortcut: "Pasted from the Shortcut", health: "From Apple Health", export: "From the Health export"};
function stepStats() {
  const g = stepGoal(), t = today(), all = Object.values(S.steps);
  const win = n => { const ks = []; for (let i = 0; i < n; i++) ks.push(dkey(addDays(new Date(), -i))); const v = ks.map(stepsOn).filter(x => x > 0); return v.length ? sum(v) / v.length : 0; };
  let streak = 0;
  for (let d = new Date(), i = 0; i < 3660; i++, d = addDays(d, -1)) { const k = dkey(d); if (stepsOn(k) >= g) streak++; else if (k !== t) break; }
  const best = all.reduce((b, e) => e.n > (b ? b.n : 0) ? e : b, null);
  const hit30 = [...Array(30)].map((_, i) => stepsOn(dkey(addDays(new Date(), -i)))).filter(n => n >= g).length;
  return {g, avg7: win(7), avg30: win(30), streak, best, hit30};
}
function stepEst(n) {
  const cm = +nutri().height || 170; const kg = (currentKg() || {kg: 70}).kg;
  return {km: n * cm * 0.415 / 100000, kcal: n * 0.04 * kg / 70};
}
function tSteps() {
  const t = today(), n = stepsOn(t), st = stepStats(), g = st.g, p = n / g, est = stepEst(n), c = "var(--c-steps)";
  let h = `<section class="card steps-hero"><div class="sring">${multiRing([{k: "Steps", c, p}], 150)}<div class="sc"><b>${Math.round(p * 100)}%</b><span>of goal</span></div></div>
    <div class="stack" style="gap:6px;min-width:0"><div class="label">Today</div><div class="snum">${fmtInt(n)}</div><div class="small muted" style="margin-top:-2px">of ${fmtInt(g)} steps</div>
    <p class="muted small">${n >= g ? `Goal reached${n > g ? `, ${fmtInt(n - g)} over` : ""}.` : `${fmtInt(g - n)} steps to go.`} About ${n1(est.km)} km and ${Math.round(est.kcal)} kcal (estimates).</p>
    <p class="faint small">${S.steps[t] ? (STEP_SRC[S.steps[t].src] || "Typed in") : "Nothing logged for today yet."}</p></div></section>`;
  h += `<div class="tiles" style="margin-bottom:14px">${statTile("7-day avg", fmtInt(st.avg7))}${statTile("30-day avg", fmtInt(st.avg30))}${statTile("Streak", st.streak + (st.streak === 1 ? " day" : " days"), "goal hit in a row")}${statTile("Best day", st.best ? fmtInt(st.best.n) : "–", st.best ? fmtDate(st.best.date) : "")}</div>`;
  h += `<div class="grid2">`;
  const days = [...Array(30)].map((_, i) => dkey(addDays(new Date(), i - 29)));
  h += `<section class="card span2"><div class="card-h"><h2>Last 30 days</h2><span class="pill">${st.hit30} of 30 days at goal</span></div>`
    + (days.some(d => stepsOn(d)) ? chart({type: "bars", h: 190, ref: g, label: "Steps per day, last 30 days", bars: days.map(d => { const v = stepsOn(d); return {v, l: String(parseD(d).getDate()), c: v >= g ? "var(--good)" : c, tip: `${fmtDate(d, {weekday: "short", day: "numeric", month: "short"})}<br><b>${fmtInt(v)}</b> steps`}; })}) : `<p class="faint small">Your daily steps show up here once you log or import them.</p>`)
    + `</section>`;
  h += `<section class="card"><div class="card-h"><h2>Log steps</h2></div>
    <form class="stack" data-form="steps" style="gap:10px"><div class="fgrid"><label class="field"><span>Day</span><input id="st-date" type="date" name="date" value="${t}" max="${t}"></label><label class="field"><span>Steps</span><input id="st-n" name="n" inputmode="numeric" placeholder="e.g. 8500" autocomplete="off"></label></div>
    <button class="btn pri">Save</button><p class="faint small">This sets the total for that day.</p></form></section>`;
  h += `<section class="card"><div class="card-h"><h2>Daily goal</h2><span class="pill">${fmtInt(g)} steps</span></div>
    <div class="row wrap" style="gap:8px;margin-bottom:10px">${[6000, 8000, 10000, 12000, 15000].map(v => `<button class="btn sm ${v === g ? "pri" : "ghost"}" data-act="step-goal" data-v="${v}">${fmtInt(v)}</button>`).join("")}</div>
    <form class="inline-add" data-form="step-goal"><input id="st-goal" name="goal" inputmode="numeric" placeholder="Custom goal" aria-label="Custom step goal" autocomplete="off"><button class="btn">Set</button></form></section>`;
  h += stepImportCard();
  const rec = Object.values(S.steps).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10);
  h += `<section class="card"><div class="card-h"><h2>Recent days</h2></div>${rec.length ? `<div class="list">${rec.map(e => `<div class="li" style="padding:8px 0"><span class="grow"><span class="t">${fmtDate(e.date, {weekday: "short", day: "numeric", month: "short"})}</span><br><span class="sub faint small">${STEP_SRC[e.src] || ""}</span></span><span class="mono ${e.n >= g ? "" : "muted"}" style="font-weight:600">${fmtInt(e.n)}</span><button class="ibtn" data-act="del-steps" data-id="${e.id}" aria-label="Delete steps for ${e.date}">${icon("trash", 18)}</button></div>`).join("")}</div>` : `<p class="faint small">No days logged yet.</p>`}</section>`;
  return h + `</div>`;
}
let healthMsg = null;
function stepImportCard() {
  return `<section class="card span2"><div class="card-h"><h2>Bring in Apple Health steps</h2></div>
    ${db ? `<div class="row wrap" style="gap:12px;margin-bottom:14px;align-items:center"><p class="small muted grow" style="min-width:220px">${healthInfo && healthInfo.last_used ? `Automatic sync is on. Last steps received ${esc(new Date(healthInfo.last_used).toLocaleString(undefined, {weekday: "short", hour: "2-digit", minute: "2-digit"}))}.` : "Set up a Shortcut once and your iPhone sends your steps here every evening."}</p><button class="btn ${healthInfo ? "ghost" : "pri"}" data-act="health-setup">${healthInfo ? "Shortcut setup" : "Set up automatic sync"}</button></div>` : ""}
    <p class="small muted" style="margin-bottom:12px">${db ? "You can also bring steps in by hand." : "Apple only lets apps installed on the iPhone read Health. These two routes get your steps in anyway."} Imported days replace what's already logged for them.</p>
    <div class="grid2" style="gap:14px">
      <div class="stack" style="gap:8px"><div class="label">1 · Paste from a Shortcut</div>
        <textarea id="step-paste" rows="4" placeholder="Paste what the Shortcut copied, e.g.&#10;2026-09-27 10432&#10;2026-09-28 6120" aria-label="Pasted steps"></textarea>
        <button class="btn ${db ? "" : "pri"}" data-act="steps-paste">Import pasted steps</button>
        <details><summary class="small" style="cursor:pointer;font-weight:600;color:var(--ink-2);padding:4px 0">How to make the Shortcut (one time, 2 minutes)</summary>
          <ol class="small muted howto">
            <li>Open the <b>Shortcuts</b> app, tap <b>+</b> and name it “Steps to Daybook”.</li>
            <li>Add <b>Find Health Samples</b>. Set Type to <b>Steps</b>, add the filter <b>Start Date is in the last 7 days</b>, and set <b>Group By</b> to <b>Day</b>.</li>
            <li>Add <b>Repeat with Each</b> on the Health Samples.</li>
            <li>Inside the repeat, add <b>Format Date</b> on Repeat Item's <b>Start Date</b>, with Date Format <b>Custom</b> and <b>yyyy-MM-dd</b>.</li>
            <li>Still inside, add a <b>Text</b> action containing <b>Formatted Date</b>, a space, then Repeat Item's <b>Value</b>.</li>
            <li>After End Repeat, add <b>Combine Text</b> (Repeat Results, with New Lines), then <b>Copy to Clipboard</b>.</li>
            <li>Optional: add <b>Open URLs</b> with Daybook's link so it jumps straight here.</li>
          </ol>
          <p class="small muted" style="margin-top:6px">Run it, come here, paste into the box and tap Import. It sends the last 7 days, so running it every few days keeps everything filled in. Grouping by day keeps iPhone and Apple Watch steps from being counted twice.</p></details>
      </div>
      <div class="stack" style="gap:8px"><div class="label">2 · Full Health export (history)</div>
        <p class="small muted">In the Health app tap your picture, then <b>Export All Health Data</b>, and save the zip to Files. Pick it here. It can take a minute for a big export, and nothing leaves your device except the daily totals.</p>
        <label class="btn" style="justify-content:center">${icon("down", 16)}Choose export.zip<input id="health-file" type="file" accept=".zip,.xml,application/zip,text/xml" hidden></label>
        <p id="health-status" class="small" ${healthMsg ? `style="color:${healthMsg.c}"` : "hidden"}>${healthMsg ? esc(healthMsg.t) : ""}</p>
      </div>
    </div></section>`;
}
function parseStepText(text) {
  const out = {}; let bare = null, lines = 0;
  for (const raw of String(text).split(/\r?\n|;/)) {
    let line = raw.trim(); if (!line) continue;
    let d = null, m;
    if ((m = line.match(/(\d{4})-(\d{1,2})-(\d{1,2})/))) d = `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;
    else if ((m = line.match(/(\d{1,2})[./](\d{1,2})[./](\d{4})/))) d = `${m[3]}-${pad(+m[2])}-${pad(+m[1])}`;
    if (m) line = line.replace(m[0], " ");
    line = line.replace(/\b\d{1,2}:\d{2}(:\d{2})?\b/g, " ");
    const nm = line.match(/\d[\d.,'\s  ]*/); if (!nm) continue;
    let s = nm[0].trim().replace(/[.,]\d{1,2}$/, ""); const n = parseInt(s.replace(/\D/g, ""), 10);
    if (!isFinite(n) || n < 0 || n > 200000) continue;
    if (d) { if (isNaN(parseD(d).getTime()) || d > today()) continue; out[d] = (out[d] || 0) + n; lines++; }
    else if (bare == null) bare = n;
  }
  if (!lines && bare != null) out[today()] = bare;
  for (const k in out) if (out[k] > 200000) delete out[k];
  return out;
}
function bucketWriteMany(path, items) {
  q(path, async () => {
    const ref = db.doc(path);
    try { await withRetry(() => ref.update({items})); }
    catch (e) {
      if (e && (e.code === "invalid_argument" || e.code === "transform_error")) {
        const s = await ref.get(); if (s.exists) throw e;
        await withRetry(() => ref.set({items}));
      } else throw e;
    }
  });
}
function importSteps(map, src) {
  const at = Date.now(), byP = {}; let n = 0;
  const m = {...S.steps};
  for (const [d, v] of Object.entries(map)) { const e = {id: d, date: d, n: Math.round(v), src, at}; m[d] = e; n++; if (db) { const p = bucketPath("steps", d); (byP[p] = byP[p] || {})[d] = e; } }
  S.steps = m; saveLocal(); scheduleRender();
  if (db) Object.entries(byP).forEach(([p, it]) => bucketWriteMany(p, it));
  return n;
}
function stepScanner() {
  const per = {}; let buf = "", recs = 0; const KEY = '"HKQuantityTypeIdentifierStepCount"';
  const attr = (s, k) => { const i = s.indexOf(" " + k + '="'); if (i < 0) return ""; const j = i + k.length + 3; return s.slice(j, s.indexOf('"', j)); };
  const take = rec => {
    const d = attr(rec, "startDate").slice(0, 10), v = parseFloat(attr(rec, "value")); if (!/^\d{4}-\d\d-\d\d$/.test(d) || !(v > 0)) return;
    const src = attr(rec, "sourceName") || "?"; const o = per[d] || (per[d] = {}); o[src] = (o[src] || 0) + v; recs++;
  };
  return {
    push(text) {
      buf += text; let i = 0;
      for (;;) { const j = buf.indexOf(KEY, i); if (j < 0) break; const s = buf.lastIndexOf("<", j), e = buf.indexOf(">", j); if (e < 0) { i = s; break; } take(buf.slice(s, e)); i = e; }
      buf = buf.slice(Math.max(i, buf.lastIndexOf("<")));
    },
    result() { const out = {}; const t = today(); for (const [d, o] of Object.entries(per)) if (d <= t) out[d] = Math.max(...Object.values(o)); return {days: out, recs}; },
  };
}
async function readHealthExport(file, onProg) {
  const sc = stepScanner(); const isZip = /\.zip$/i.test(file.name) || /zip/.test(file.type);
  const reader = file.stream().getReader(); let read = 0;
  if (!isZip) {
    const dec = new TextDecoder();
    for (;;) { const {value, done} = await reader.read(); if (done) break; read += value.length; sc.push(dec.decode(value, {stream: true})); onProg(read / file.size); }
    sc.push(dec.decode()); return sc.result();
  }
  await loadScript(FFLATE_URL); const ff = window.fflate;
  let found = false, err = null, finished = false; const dec = new TextDecoder();
  const uz = new ff.Unzip(); uz.register(ff.UnzipInflate);
  uz.onfile = f => {
    if (found || !/(^|\/)export\.xml$/i.test(f.name)) return;
    found = true;
    f.ondata = (e, chunk, fin) => { if (e) { err = e; return; } sc.push(dec.decode(chunk, {stream: !fin})); if (fin) finished = true; };
    f.start();
  };
  for (;;) {
    const {value, done} = await reader.read();
    if (done) { uz.push(new Uint8Array(0), true); break; }
    read += value.length; uz.push(value); onProg(read / file.size);
    if (err) throw err; if (finished) { try { reader.cancel(); } catch {} break; }
    if (read % (8 << 20) < value.length) await new Promise(r => setTimeout(r, 0));
  }
  if (err) throw err;
  if (!found) throw Object.assign(new Error("noxml"), {code: "noxml"});
  return sc.result();
}
async function onHealthFile(file) {
  const say = (t, c) => { healthMsg = {t, c: c || ""}; const s = $("#health-status"); if (s) { s.hidden = false; s.textContent = t; s.style.color = c || ""; } };
  say("Reading your Health export…");
  let last = 0;
  try {
    const r = await readHealthExport(file, p => { const now = Date.now(); if (now - last > 250) { last = now; say(`Reading your Health export… ${Math.min(99, Math.round(p * 100))}%`); } });
    const days = Object.keys(r.days).sort();
    if (!days.length) { say("No step data found in that file. Make sure it's the export.zip from the Health app.", "var(--warn)"); return; }
    const n = importSteps(r.days, "export");
    toast(`Imported steps for ${n} days`);
    say(`Imported ${fmtInt(n)} days of steps, ${fmtDate(days[0], {day: "numeric", month: "short", year: "numeric"})} to ${fmtDate(days[days.length - 1], {day: "numeric", month: "short", year: "numeric"})}.`, "var(--good)");
  } catch (e) {
    console.warn("health import", e);
    say(e && e.code === "noxml" ? "That zip has no export.xml inside. Pick the export.zip the Health app saved." : e && e.message === "load" ? "Couldn't load the unzip helper. Check your connection and try again." : "Couldn't read that file. Try exporting again from the Health app.", "var(--warn)");
  }
}
const STEP_ACTIONS = {
  "step-goal": el => { setSettings({stepGoal: +el.dataset.v}); toast(`Daily goal set to ${fmtInt(+el.dataset.v)} steps`); },
  "steps-paste": () => {
    const ta = $("#step-paste"); const map = parseStepText(ta ? ta.value : "");
    if (!Object.keys(map).length) { toast("Couldn't find any steps in that text. Each line needs a date and a number."); return; }
    const n = importSteps(map, "shortcut"); toast(`Imported steps for ${n} ${n === 1 ? "day" : "days"}`);
  },
  "del-steps": el => { del("steps", el.dataset.id); toast("Removed"); },
};
const STEP_FORMS = {
  steps: fd => {
    const d = fd.get("date") || today(); const n = parseInt(String(fd.get("n")).replace(/\D/g, ""), 10);
    if (!isFinite(n) || n > 200000) { toast("Enter a step count"); $("#st-n").focus(); return; }
    if (d > today()) { toast("That day hasn't happened yet"); return; }
    put("steps", {id: d, date: d, n, src: "manual", at: Date.now()}); toast(`Saved ${fmtInt(n)} steps for ${relDay(d).toLowerCase()}`);
  },
  "step-goal": fd => {
    const g = parseInt(String(fd.get("goal")).replace(/\D/g, ""), 10);
    if (!(g >= 500 && g <= 100000)) { toast("Pick a goal between 500 and 100,000"); return; }
    setSettings({stepGoal: g}); toast(`Daily goal set to ${fmtInt(g)} steps`);
  },
};

/* ---------- game: Hero, Quests and Town ---------- */
const ITEM = Object.fromEntries(CAT.items.map(i => [i.id, i]));
const SLOT_NAME = Object.fromEntries(CAT.slots.map(s => [s.id, s.name]));
const SET_OF = Object.fromEntries(CAT.sets.map(s => [s.id, s]));
const ORIGIN = Object.fromEntries(CAT.origins.map(o => [o.id, o]));
const BOSS = Object.fromEntries(CAT.bosses.map(b => [b.id, b]));
const AV_SLOTS = ["head", "chest", "arms", "legs", "weapon"];
const ALL_WD = [0, 1, 2, 3, 4, 5, 6];
const wdName = (i, style = "short") => new Date(2024, 0, 1 + i).toLocaleDateString(undefined, {weekday: style});
const daysText = d => !d || d.length === 7 ? "Every day" : d.length === 5 && d.every(i => i < 5) ? "Weekdays" : d.length === 2 && d.every(i => i > 4) ? "Weekends" : d.map(i => wdName(i)).join(", ");
const parseDays = v => [...new Set(String(v || "").split(",").filter(Boolean).map(Number).filter(n => n >= 0 && n < 7))].sort((a, b) => a - b);
const fv = (f, n) => { const el = f.elements.namedItem(n); return el ? el.value : ""; };
const multiDays = (name, days, label = "Days") => { const on = days || ALL_WD; return `<div class="multi wdays" role="group" aria-label="${label}"><input type="hidden" name="${name}" value="${on.join(",")}">${ALL_WD.map(i => `<button type="button" class="chip" data-act="multi" data-v="${i}" aria-pressed="${on.includes(i)}" aria-label="${wdName(i, "long")}">${wdName(i)}</button>`).join("")}</div>`; };
const coin = (s = 14) => `<span class="coin">${pixelIcon("rune", pxSize(s))}</span>`;
const goldAmt = (n, s = 14) => `<span class="gold">${coin(s)}${fmtInt(n)}<span class="sr"> Runes</span></span>`;
const seed = (s = 14) => `<svg class="coin" width="${s}" height="${s}" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.2c3.2 2.5 4.8 5.2 4.8 8a4.8 4.8 0 0 1-9.6 0c0-2.8 1.6-5.5 4.8-8z" fill="var(--gold)"/><path d="M8 5.2v7.4" stroke="var(--gold-ink)" stroke-opacity=".45" stroke-width="1.3"/></svg>`;
const seedAmt = (n, s = 14) => `<span class="gold">${seed(s)}${fmtInt(n)}<span class="sr"> ${CAT.currencies.essence}</span></span>`;
const rewardChip = (rw, on) => `<span class="rew${on ? " on" : ""}"><span class="rx">+${rw.xp} XP</span><span class="rg">${coin(12)}${rw.gold}<span class="sr"> Runes</span></span></span>`;
const heroDoc = () => ({name: "", look: {}, equip: {}, talismans: [], ...(S.hero || {})});
function heroEquip(equipIds) {
  const out = {};
  for (const [slot, id] of Object.entries(equipIds || heroDoc().equip || {})) { const it = ITEM[id]; if (it && AV_SLOTS.includes(slot)) out[slot] = {id, color: E.rarities[it.rarity].color, rarity: it.rarity, kind: it.kind}; }
  return out;
}
// Talismans worn: only ones you own, and only as many as your slots allow.
const talismanSlots = () => GE.talismanSlots(Object.keys(S.inv), CAT, E);
const heroTalismans = () => (heroDoc().talismans || []).filter(id => ITEM[id] && S.inv[id]).slice(0, talismanSlots());
const heroPerks = () => GE.talismanPerks(heroTalismans(), CAT, E);
const PERK_TEXT = {maxHp: v => `+${v} max HP`, heal: v => `+${v} HP per quest done`, dmgPct: v => `${v}% less day-end damage`, goldPct: v => `+${v}% Runes from quests`, xpPct: v => `+${v}% XP from quests`, streakRate: () => "Streak bonus builds twice as fast"};
const perkText = P => Object.entries(P || {}).filter(([, v]) => v).map(([k, v]) => PERK_TEXT[k] ? PERK_TEXT[k](v) : k).join(" · ");
// An origin's starter kit: its set's four pieces plus its weapon.
const originKit = o => [...CAT.items.filter(i => o.setId && i.setId === o.setId).map(i => i.id), o.weapon].filter(id => ITEM[id]);
const kitEquip = ids => Object.fromEntries(ids.map(id => [ITEM[id].slot, id]));
function grantOrigin(o) {
  const kit = originKit(o); const date = today(), at = Date.now();
  kit.forEach((id, i) => { if (!S.inv[id]) put("inv", {id, date, at: at + i, src: "origin"}, true); });
  setHero({origin: o.id, equip: {...(heroDoc().equip || {}), ...kitEquip(kit)}});
}
// Where a boss-only or boss-also item comes from, e.g. "Malenia, Blade of Miquella (level 70)".
const stableDoc = () => ({awakening: null, awakened: {}, summoned: null, periods: {}, ...(heroDoc().stable || {})});
const setStable = st => setHero({stable: st});
const STREAK_NAME = {steps: "Steps", workouts: "Workouts", learning: "Learning", discipline: "Discipline"};
const npcGoal = (n) => ({steps: `${n.days} days in a row at your step goal`, workouts: `${n.days} workout days in a row`, learning: `${n.days} learning days in a row`, discipline: `${n.days} days in a row with every habit and daily task done`})[n.streak];
const companion = () => { const it = ITEM[stableDoc().summoned]; return it && (it.type === "ash" ? stableDoc().awakened[it.id] : true) ? it : null; };
const bossSource = it => (it.source || []).filter(x => BOSS[x]).map(x => `${BOSS[x].name} (level ${E.bosses[x].level})`).join(", ");
const heroAvatar = (size, label = "") => avatarSvg({look: heroDoc().look, equip: heroEquip(), size, label});
const setGame = patch => setSettings({game: {...(S.settings.game || {}), ...patch}});

// Today's game state, derived from the trackers and the stored ledger. Memoized on the
// state objects it reads, which put() replaces rather than mutates.
function gameData() { return {habits: Object.values(S.habits), tasks: Object.values(S.tasks), steps: S.steps, sessions: Object.values(S.sessions), learn: Object.values(S.learn), stepGoal: stepGoal()}; }
let gMemo = null;
function gameState() {
  if (!gameOn()) return null;
  const key = [S.habits, S.tasks, S.steps, S.sessions, S.learn, S.ledger, S.gdays, S.settings, S.hero, S.inv, today()];
  if (gMemo && gMemo.key.every((v, i) => v === key[i])) return gMemo.r;
  const r = GE.simulate({data: gameData(), game: S.settings.game, ledger: S.ledger, days: S.gdays, now: new Date(), at: Date.now(), canWrite: false, E, C: CAT, perks: heroPerks(), stable: stableDoc()});
  gMemo = {key, r}; return r;
}
// The day-end job: pay what's earned and freeze finished days. It only writes once this
// device has the latest data, so a stale copy can never freeze or pay the wrong thing.
let recT = 0, recN = 0, recAt = 0;
function scheduleReconcile() { clearTimeout(recT); if (gameOn()) recT = setTimeout(reconcile, 900); }
// Fresh enough: synced, or a full load finished in the last few minutes (live updates can be blocked while loads work).
const dataFresh = () => !db || (!(db.busy && db.busy()) && (dbState === "synced" || (db.freshAt && db.freshAt() && Date.now() - db.freshAt() < 5 * 60e3)));
function reconcile() {
  if (!gameOn()) return;
  if (!dataFresh()) { if (db && db.busy && db.busy()) scheduleReconcile(); return; }
  const r = GE.simulate({data: gameData(), game: S.settings.game, ledger: S.ledger, days: S.gdays, now: new Date(), at: Date.now(), canWrite: true, E, C: CAT, perks: heroPerks(), stable: stableDoc()});
  if (!r.active || (!r.ledgerWrites.length && !r.dayWrites.length)) return;
  // A guard against a write loop: the job is idempotent, so a burst of rewrites means a bug.
  if (Date.now() - recAt > 10000) { recN = 0; recAt = Date.now(); }
  if (++recN > 6) { console.warn("game: too many rewrites, stopping", r.ledgerWrites); return; }
  if (r.ledgerWrites.length) putMany("ledger", r.ledgerWrites, true);
  if (r.dayWrites.length) putMany("gdays", r.dayWrites, true);
  scheduleRender();
}
// A small reward toast right after you complete something.
let gPrev = null, gWatch = 0;
function gameFeedback() {
  const s = gameState(); if (!s) { gPrev = null; return; }
  const npcs = Object.entries(GE.npcStatus(s.streaks, E)).filter(([, n]) => n.unlocked).map(([id]) => id);
  const p = gPrev; gPrev = {xp: s.xp, gold: s.gold, level: s.level, tut: s.tutorial.done, ready: !!(s.stable.awakening && s.stable.awakening.ready), npcs};
  if (!p) return;
  const fresh = npcs.find(id => !p.npcs.includes(id));
  if (fresh) { toast(`${ITEM[fresh].name} wants to join you. Summon them from Spirits in the Town`); return; }
  if (gPrev.ready && !p.ready) { toast(`${ITEM[s.stable.awakening.id].name} is ready to awaken. Open Spirits in the Town`); return; }
  if (Date.now() - gWatch > 2500) return;
  if (s.level > p.level) { gWatch = 0; toast(`Level ${s.level}! +${fmtInt(E.levelUp.gold * (s.level - p.level))} Runes and full HP`); return; }
  if (s.tutorial.done && !p.tut) { gWatch = 0; toast(`${CAT.tutorial.name} complete: +${E.earn.tutorial.xp} XP, +${E.earn.tutorial.gold} Runes`); return; }
  if (s.xp > p.xp) { gWatch = 0; toast(`+${s.xp - p.xp} XP, +${fmtInt(s.gold - p.gold)} Runes`); }
}
const reservedGold = except => sum(Object.values(S.rewards).filter(r => r.id !== except).map(r => +r.reserved || 0));
const spendable = (s, except) => Math.max(0, s.gold - reservedGold(except));
function canSpend() {
  if (db && (dbState === "connecting" || (db.busy && db.busy()))) { toast("Still syncing. Try again in a moment."); return false; }
  return true;
}

/* ---- quest rows ---- */
const QCAT = {steps: ["steps", "var(--c-steps)"], workout: ["train", "var(--c-train)"], learn: ["book", "var(--c-learn)"], habit: ["habits", "var(--c-habit)"], task: ["task1", "var(--c-task)"]};
const QGO = {steps: 'data-act="train-tab" data-v="steps"', workout: 'data-act="train-tab" data-v="workout"', learn: 'data-act="quest-tab" data-v="learning"'};
function questName(q) {
  if (q.cat === "steps") return `Walk ${fmtInt(q.progress.goal)} steps`;
  if (q.cat === "learn") return `Learn for ${q.progress.goal} min`;
  if (q.cat === "workout") { const nd = q.done ? null : nextDay(activeSplit()); return nd ? `Work out: ${esc(nd.name)}` : "Work out"; }
  return esc(q.name);
}
function questSub(q, k) {
  if (q.cat === "steps") return `${fmtInt(q.progress.v)} ${q.done ? "steps" : "so far"}`;
  if (q.cat === "learn") return `${q.progress.v} of ${q.progress.goal} min`;
  if (q.cat === "workout") { const ss = Object.values(S.sessions).filter(s => s.date === k); return ss.length ? ss.map(s => esc(s.name)).join(", ") : "Start it from Train"; }
  if (q.cat === "habit") { const h = S.habits[q.ref]; const n = h ? habitStreak(h) : 0; return n > 1 ? `${n}-day streak` : ""; }
  return "";
}
function questLead(q, k) {
  if (q.cat === "habit") { const h = S.habits[q.ref] || {}; return `<button class="chk" style="--c:var(${h.color || "--c-habit"})" aria-pressed="${q.done}" data-act="toggle-habit" data-id="${q.ref}" data-d="${k}" aria-label="Mark ${esc(q.name)} done">${icon("check", 16, 3)}</button>`; }
  if (q.cat === "task") return `<button class="chk sq" style="--c:var(--c-task)" aria-pressed="${q.done}" data-act="toggle-task" data-id="${q.ref}" data-d="${k}" aria-label="Complete ${esc(q.name)}">${icon("check", 16, 3)}</button>`;
  const [ic, c] = QCAT[q.cat]; const p = q.progress && q.progress.goal ? Math.min(1, q.progress.v / q.progress.goal) : 0;
  return `<span class="qic ${q.done ? "done" : ""}" style="--c:${c};--p:${p}" aria-hidden="true">${icon(q.done ? "check" : ic, 15, q.done ? 3 : 2)}</span>`;
}
function questRow(q, k, o = {}) {
  const flav = GE.flavor(CAT, q.cat, q.key + ":" + k);
  const go = q.cat === "habit" ? `data-act="habit-detail" data-id="${q.ref}"` : q.cat === "task" ? `data-act="edit-task" data-id="${q.ref}"` : QGO[q.cat];
  const sub = questSub(q, k);
  const lead = o.reorder ? `<span class="mv"><button class="ibtn sm" data-act="q-move" data-key="${esc(q.key)}" data-d="-1" aria-label="Move ${esc(q.name || q.cat)} up" ${o.i ? "" : "disabled"}>${icon("up", 15)}</button><button class="ibtn sm" data-act="q-move" data-key="${esc(q.key)}" data-d="1" aria-label="Move ${esc(q.name || q.cat)} down" ${o.i < o.n - 1 ? "" : "disabled"}>${icon("down", 15)}</button></span>` : questLead(q, k);
  const right = q.rewarded === false ? `<span class="rew none">No reward</span>` : rewardChip(q.reward, q.done);
  return `<div class="li qrow ${q.done ? "done" : ""}">${lead}<button class="li-main" ${go}><span class="t">${questName(q)}</span><span class="sub"><i class="qflav">${esc(flav)}</i>${sub ? `<span>${sub}</span>` : ""}${q.verified ? `<span class="vbadge">${icon("shield", 13)}Verified</span>` : ""}</span></button>${right}</div>`;
}
function boardCard(s, o = {}) {
  const r = s.board.today, k = s.today, qs = r.dailies;
  let h = `<section class="card board"><div class="card-h"><h2>Today's quests</h2>${qs.length ? `<span class="pill ${r.allClear ? "good" : ""}">${r.done} of ${r.sched}</span>` : ""}</div>`;
  if (!qs.length) h += `<div class="empty"><span>No quests today. Rest up, or add a habit to make one.</span><button class="btn sm" data-act="add-habit">${icon("plus", 16)}Add a habit</button></div>`;
  else {
    h += `<div class="list">`;
    qs.forEach((q, i) => { if (i === s.slots) h += `<div class="slotline"><span>Past ${s.slots}: streak and HP only</span></div>`; h += questRow(q, k, {reorder: o.reorder, i, n: qs.length}); });
    h += `</div><div class="allclear ${r.allClear ? "on" : ""}"><span class="qic ${r.allClear ? "done" : ""}" style="--c:var(--gold);--p:${r.done / r.sched}" aria-hidden="true">${icon(r.allClear ? "check" : "star", 15, r.allClear ? 3 : 2)}</span><span class="grow"><b>All clear</b><br><span class="small muted">${r.allClear ? "Every quest done today" : `Finish all ${r.sched} for a bonus`}</span></span>${rewardChip(r.allClearReward, r.allClear)}</div>`;
  }
  const canRest = o.manage && r.sched && !r.allClear && !r.rest && (s.held["item.scroll-of-grace"] || 0) > 0;
  if (o.manage) h += `<div class="row between board-foot">${qs.length > 1 ? `<button class="btn sm ${o.reorder ? "pri" : "ghost"}" data-act="reorder">${o.reorder ? "Done" : "Reorder"}</button>` : "<span></span>"}<span class="row" style="gap:14px">${canRest ? `<button class="linkbtn" data-act="rest" data-d="${k}" data-confirm="Rest today with a Scroll of Grace?">Rest today</button>` : ""}<button class="linkbtn" data-act="game-settings">Quest settings</button></span></div>`;
  if (o.manage && r.rest) h += `<p class="tiny faint" style="margin-top:8px">Today is a rest day: no HP lost and your streaks stay.</p>`;
  return h + `</section>`;
}
function yesterdayCard(s) {
  const r = s.board.yesterday; if (!r || !r.sched) return "";
  const open = r.dailies.filter(q => !q.done); if (!open.length) return "";
  const scrolls = s.held["item.scroll-of-grace"] || 0;
  const foot = r.rest ? `<p class="tiny faint" style="margin-top:8px">Rested with a Scroll of Grace: no HP lost and your streaks stay.</p>`
    : scrolls ? `<div class="row between board-foot"><span class="tiny faint">Missed them? Rest instead.</span><button class="btn sm ghost" data-act="rest" data-d="${s.yesterday}" data-confirm="Use a Scroll of Grace?">Use a Scroll of Grace (${scrolls})</button></div>` : "";
  return `<section class="card"><div class="card-h"><h2>Yesterday</h2><span class="pill ${r.rest ? "good" : "warn"}">${r.rest ? "Rest day" : `${open.length} open`}</span></div><p class="small muted" style="margin-bottom:4px">Did any of these? Check them off before today ends and they still count.</p><div class="list">${open.map(q => questRow(q, s.yesterday)).join("")}</div>${foot}</section>`;
}
function bountyCard(s) {
  const ps = s.board.periodic; const bs = s.bounties || []; if (!ps.length && !bs.length) return "";
  const brow = b => `<div class="li qrow ${b.done ? "done" : ""}"><span class="qic ${b.done ? "done" : ""}" style="--c:var(--gold);--p:${Math.min(1, b.v / b.n)}" aria-hidden="true">${icon(b.done ? "check" : "star", 15, b.done ? 3 : 2)}</span><div class="li-main"><span class="t">${esc(b.name)}</span><span class="sub"><span>${esc(b.text)}</span><span>${fmtInt(Math.min(b.v, b.n))} of ${fmtInt(b.n)}</span></span></div><span class="rew${b.done ? " on" : ""}"><span class="rx">+${b.reward.xp} XP</span><span class="rg">${coin(12)}${b.reward.gold}<span class="sr"> Runes</span></span><span class="rg">${seed(12)}${b.reward.essence}<span class="sr"> ${esc(CAT.currencies.essence)}</span></span></span></div>`;
  const rows = ps.map(p => {
    const kind = p.kind === "monthly" ? "Monthly" : "Weekly"; const flav = GE.flavor(CAT, "periodic", p.key + ":" + p.period);
    const lead = p.cat === "task" ? `<button class="chk sq" style="--c:var(--c-task)" aria-pressed="${p.done}" data-act="toggle-task" data-id="${p.ref}" aria-label="Complete ${esc(p.name)}">${icon("check", 16, 3)}</button>`
      : `<span class="qic ${p.done ? "done" : ""}" style="--c:var(--c-habit);--p:${Math.min(1, p.progress.v / p.progress.goal)}" aria-hidden="true">${icon(p.done ? "check" : "habits", 15, p.done ? 3 : 2)}</span>`;
    const go = p.cat === "task" ? `data-act="edit-task" data-id="${p.ref}"` : `data-act="habit-detail" data-id="${p.ref}"`;
    return `<div class="li qrow ${p.done ? "done" : ""}">${lead}<button class="li-main" ${go}><span class="t">${esc(p.name)}</span><span class="sub"><i class="qflav">${kind} ${esc(flav.toLowerCase())}</i>${p.progress ? `<span>${p.progress.v} of ${p.progress.goal} this week</span>` : ""}</span></button>${rewardChip(p.reward, p.done)}</div>`;
  }).join("");
  const all = [...bs, ...ps];
  return `<section class="card"><div class="card-h"><h2>This week</h2><span class="pill">${all.filter(p => p.done).length} of ${all.length}</span></div><div class="list">${bs.map(brow).join("")}${rows}</div></section>`;
}
function tutorialCard(s) {
  if (s.tutorial.done) return "";
  return `<section class="card tut"><div class="row" style="align-items:flex-start"><span class="qic" style="--c:var(--gold);--p:0" aria-hidden="true">${icon("star", 15)}</span><div class="grow"><div class="label">Your first quest</div><b class="tut-t">${esc(CAT.tutorial.name)}</b><div class="small muted">${esc(CAT.tutorial.text)}</div></div>${rewardChip(s.tutorial.reward, false)}</div></section>`;
}
function heroCard(s) {
  const hd = heroDoc(); const hpP = s.maxHp ? s.hp / s.maxHp : 0; const tone = hpP > .5 ? "good" : hpP > .25 ? "warn" : "bad";
  return `<section class="card herocard px-panel ornate">
    <button class="hc-av" data-act="town-tab" data-v="wardrobe" aria-label="Open the wardrobe">${heroAvatar(128)}${companion() ? `<span class="hc-pet">${itemArt(companion(), E.rarities[companion().rarity].color, 34)}</span>` : ""}${heroDoc().mount && ITEM[heroDoc().mount] ? `<span class="hc-mount">${itemArt(ITEM[heroDoc().mount], E.rarities[ITEM[heroDoc().mount].rarity].color, 30)}</span>` : ""}</button>
    <div class="hc-main">
      <div style="min-width:0"><div class="hc-name">${esc(hd.name || "Hero")}</div><div class="hc-lv">Level ${s.level}${ORIGIN[hd.origin] ? ` · ${esc(ORIGIN[hd.origin].name)}` : ""}</div></div>
      <div class="statbar"><div class="lab"><span>${icon("bolt", 13, 2.4)}XP</span><span class="mono">${s.max ? "Max level" : `${fmtInt(s.into)} / ${fmtInt(s.need)}`}</span></div><div class="meter" role="progressbar" aria-label="XP to next level" aria-valuenow="${s.into}" aria-valuemax="${s.need}"><i style="width:${s.max ? 100 : s.into / s.need * 100}%;--c:var(--xp)"></i></div></div>
      <div class="statbar"><div class="lab"><span>${icon("heart", 13, 2.4)}HP${s.hp < s.maxHp && s.held["item.flask-of-crimson-tears"] ? ` <button class="linkbtn flaskbtn" data-act="flask">Drink a flask (${s.held["item.flask-of-crimson-tears"]})</button>` : ""}</span><span class="mono">${s.hp} / ${s.maxHp}</span></div><div class="meter" role="progressbar" aria-label="HP" aria-valuenow="${s.hp}" aria-valuemax="${s.maxHp}"><i style="width:${hpP * 100}%;--c:var(--${tone})"></i></div></div>
      <div class="row wrap" style="gap:6px"><button class="goldpill" data-act="ledger" aria-label="Runes: ${fmtInt(s.gold)}. Open the log">${goldAmt(s.gold)}</button><span class="flame ${s.streak ? "on" : ""}">${icon("flame", 15)}${s.streak} day streak</span>${s.bonus ? `<span class="pill acc">+${Math.round(s.bonus * 100)}% rewards</span>` : ""}${companion() ? `<button class="pill" data-act="town-tab" data-v="spirits">${esc(companion().name)}${companion().type === "ash" && s.stable.bond[companion().id] ? ` +${s.stable.bond[companion().id].level}` : ""}</button>` : ""}</div>
    </div></section>`;
}
function rekindleCard(s) {
  const r = s.rekindle; if (!r) return "";
  const day = new Date(GE.parseKey(r.date)).toLocaleDateString(undefined, {weekday: "long"}); const enough = s.essence >= r.cost;
  const why = !r.ready ? `You can rekindle again ${fmtDate(r.next)}.` : !enough ? `You have ${s.essence} ${CAT.currencies.essence}. Weekly bounties give one each.` : "";
  return `<section class="card tut"><div class="row" style="align-items:flex-start"><span class="qic" style="--c:var(--gold);--p:0" aria-hidden="true">${icon("flame", 15)}</span><div class="grow"><b class="tut-t">Your ${r.streak}-day streak broke on ${day}</b><div class="small muted">Rekindle it for ${r.cost} ${esc(CAT.currencies.essence)} and it carries on as if ${day} counted. ${why}</div></div>${r.ready && enough ? `<button class="btn sm" data-act="rekindle" data-confirm="Spend ${r.cost}?">${seed(13)}${r.cost}</button>` : ""}</div></section>`;
}
function originCard() {
  if (heroDoc().origin) return "";
  return `<section class="card tut"><div class="row" style="align-items:flex-start"><span class="qic" style="--c:var(--gold);--p:0" aria-hidden="true">${icon("shield", 15)}</span><div class="grow"><div class="label">New</div><b class="tut-t">Choose your origin</b><div class="small muted">Pick where your Tarnished comes from and get that origin's starter gear. It's for looks and gives no stats.</div></div><button class="btn sm" data-act="pick-origin">Choose</button></div></section>`;
}
function downedCard(s) {
  if (!s.downedRisk) return "";
  return `<section class="card alert"><b>You're out of HP.</b> <span class="small">Check off anything you did yesterday. If yesterday stays as it is, you'll be Downed when today ends and lose ${Math.round(E.downed.goldLossPct * 100)}% of your Runes. Levels and gear are never lost.</span></section>`;
}

/* ---- Hero (Today when the game is on) ---- */
function vHero() {
  const s = gameState(); const now = new Date(); const t = s.today;
  const dateStr = now.toLocaleDateString(undefined, {weekday: "long", day: "numeric", month: "long"});
  const hr = now.getHours(); const greet = hr < 5 ? "Late night" : hr < 12 ? "Good morning" : hr < 18 ? "Good afternoon" : "Good evening";
  let h = header(dateStr, `${greet}${S.settings.name ? ", " + esc(S.settings.name) : ""}`);
  h += heroCard(s) + originCard() + rekindleCard(s) + downedCard(s) + tutorialCard(s);
  const plate = dueToday().filter(x => x.kind === "todo");
  h += `<div class="grid2">${boardCard(s)}<div class="stack">${yesterdayCard(s)}${bountyCard(s)}`;
  h += `<section class="card"><div class="card-h"><h2>On your plate</h2><button class="linkbtn" data-act="add-task" data-kind="todo">Add to-do</button></div>${plate.length ? `<div class="list">${plate.slice(0, 6).map(taskRow).join("")}</div>${plate.length > 6 ? `<button class="linkbtn" data-act="quest-tab" data-v="tasks" style="margin-top:8px">See all ${plate.length}</button>` : ""}` : `<p class="faint small">No to-dos due today.</p>`}</section>`;
  h += `</div></div>`;
  h += `<div style="margin-top:14px">${ringsCard(t)}</div>`;
  h += `<div class="grid2" style="align-items:start">${workoutTeaser()}${spentCard()}</div>`;
  return h + fab("quick", "Quick add");
}

/* ---- Quests ---- */
function vQuests() {
  const tabs = [["board", "Board"], ["habits", "Habits"], ["tasks", "Tasks"], ["learning", "Learning"]];
  const qt = tabs.some(x => x[0] === ui.questTab) ? ui.questTab : "board";
  const add = qt === "habits" ? hdrBtn("add-habit", "Add habit") : qt === "tasks" ? hdrBtn("add-task", "Add task") : qt === "board" ? hdrBtn("add-habit", "Add quest") : "";
  let h = header("Quests", qt === "learning" ? "Keep learning" : "Your quest board", add, "Quests");
  h += `<div class="seg" role="group" aria-label="Quest section" style="margin-bottom:14px">${tabs.map(([v, l]) => `<button data-act="quest-tab" data-v="${v}" aria-pressed="${qt === v}">${l}</button>`).join("")}</div>`;
  if (qt === "habits") return h + habitsBody() + fab("add-habit", "Add habit");
  if (qt === "tasks") return h + tasksView(true) + fab("add-task", "Add task");
  if (qt === "learning") return h + learnView();
  const s = gameState();
  h += tutorialCard(s) + downedCard(s);
  h += `<div class="grid2">${boardCard(s, {manage: true, reorder: ui.reorder})}<div class="stack">${yesterdayCard(s)}${bountyCard(s)}`;
  h += `<section class="card"><div class="card-h"><h2>How quests work</h2></div><ul class="small muted rules">
    <li>Habits, daily tasks, your step goal, workout days and learning are your daily quests.</li>
    <li>The first ${s.slots} in board order earn XP and Runes. Reorder to choose which.</li>
    <li>Finish them all for the all-clear bonus and to grow your streak. Each streak day adds ${Math.round(E.streakBonus.perDay * 100)}% to rewards, up to ${Math.round(E.streakBonus.cap * 100)}%.</li>
    <li>Each missed quest costs ${E.hp.missDamage} HP (${E.hp.dailyDamageCap} at most per day). Steps from Health and workouts logged live count as verified and earn ${Math.round((E.earn.verifiedMult - 1) * 100)}% more.</li>
    <li>Each week from your first Monday brings ${E.bounties.perWeek} bounties sized to your quests. Each pays ${E.bounties.reward.xp} XP, ${E.bounties.reward.gold} Runes and ${E.bounties.reward.essence} ${esc(CAT.currencies.essence.replace(/s$/, ""))}. Weekly and monthly tasks and times-per-week habits pay too.</li>
    <li>A Scroll of Grace from the Armory turns a missed day into a rest day, with no HP lost and no streak broken.</li></ul></section>`;
  return h + `</div></div>` + fab("add-habit", "Add quest");
}

/* ---- Learning ---- */
const FOCUS_KEY = "daybook:focus";
let focus = lsGet(FOCUS_KEY, null);
function learnView() {
  const g = S.settings.game || {}; const L = g.learn || {}; const goal = +L.goalMin || E.learning.defaultGoalMin; const t = today();
  const all = Object.values(S.learn).sort((a, b) => b.date.localeCompare(a.date) || (b.at || 0) - (a.at || 0));
  const minOn = k => sum(all.filter(e => e.date === k).map(e => e.min));
  const tMin = minOn(t); const wk = sum([...Array(7)].map((_, i) => minOn(GE.addKey(t, -i))));
  const on = !!L.on, schedToday = on && (!L.days || L.days.includes(GE.weekdayOf(t)));
  let h = `<div class="grid2">`;
  h += `<section class="card focus-card"><div class="card-h"><h2>Focus timer</h2>${focus ? `<span class="pill acc">Running</span>` : ""}</div>`;
  if (focus) h += `<div class="focus" data-focus>${fmtClock(Date.now() - focus.start)}</div>${focus.topic ? `<p class="muted small" style="margin-top:6px">${esc(focus.topic)}</p>` : ""}<div class="row" style="margin-top:14px"><button class="btn ghost" data-act="focus-cancel" data-confirm="Tap again to discard">Discard</button><button class="btn pri grow" data-act="focus-stop">${icon("check", 16)}Stop and log</button></div>`;
  else h += `<p class="small muted" style="margin-bottom:12px">Timed sessions count as verified learning. The timer keeps going if you switch apps.</p><div class="inline-add"><input id="fc-topic" placeholder="What are you studying?" maxlength="60" autocomplete="off" aria-label="Topic"><button class="btn pri" data-act="focus-start">${icon("play", 16)}Start</button></div>`;
  h += `</section>`;
  h += `<section class="card"><div class="card-h"><h2>Today</h2>${on ? `<span class="pill ${tMin >= goal ? "good" : ""}">${schedToday ? `goal ${goal} min` : "rest day"}</span>` : ""}</div><div class="row" style="gap:16px">${on && schedToday ? ring(tMin / goal, "var(--c-learn)", 56) : ""}<div><div class="snum">${tMin} <span class="faint">min</span></div><div class="small muted">${wk} min in the last 7 days</div></div></div>
    <form class="stack" data-form="learn" style="gap:10px;margin-top:14px"><div class="fgrid"><label class="field"><span>Minutes</span><input id="ln-min" name="min" inputmode="numeric" placeholder="e.g. 25" autocomplete="off"></label><label class="field"><span>Day</span><input name="date" type="date" value="${t}" max="${t}"></label><label class="field full"><span>Topic</span><input name="topic" maxlength="60" placeholder="Optional" autocomplete="off"></label></div><button class="btn">Log time by hand</button></form></section>`;
  h += `<section class="card"><div class="card-h"><h2>Learning quest</h2></div><form data-form="learn-goal" class="stack" style="gap:12px">
    <div class="seg" role="group" aria-label="Learning quest"><button type="button" data-act="radio" data-name="on" data-v="0" aria-pressed="${!on}">Off</button><button type="button" data-act="radio" data-name="on" data-v="1" aria-pressed="${on}">On</button></div><input type="hidden" name="on" value="${on ? 1 : 0}">
    <div class="stack" data-show="on=1" style="gap:12px" ${on ? "" : "hidden"}><div class="field"><span>Minutes a day</span><div class="chips">${[10, 15, 20, 30, 45, 60].map(m => `<button type="button" class="chip" data-act="radio" data-name="goalMin" data-v="${m}" aria-pressed="${m === goal}">${m} min</button>`).join("")}</div><input type="hidden" name="goalMin" value="${goal}"></div>
    <div class="field"><span>On these days</span>${multiDays("days", L.days, "Learning days")}</div></div>
    <button class="btn pri">Save</button></form></section>`;
  h += `<section class="card"><div class="card-h"><h2>Recent sessions</h2></div>${all.length ? `<div class="list">${all.slice(0, 12).map(e => `<div class="li" style="padding:9px 0"><span class="grow"><span class="t">${esc(e.topic || "Learning")}</span><br><span class="sub faint small">${relDay(e.date)}${e.timer ? " · timed" : ""}</span></span><span class="mono" style="font-weight:600">${e.min} min</span><button class="ibtn" data-act="del-learn" data-id="${e.id}" data-confirm="" aria-label="Delete this session">${icon("trash", 18)}</button></div>`).join("")}</div>` : `<p class="faint small">Sessions you time or log show up here.</p>`}</section>`;
  return h + `</div>`;
}

/* ---- Town ---- */
function vTown() {
  const s = gameState(); const tabs = [["armory", "Armory"], ["wardrobe", "Wardrobe"], ["spirits", "Spirits"], ["tavern", "Tavern"]];
  const tt = tabs.some(x => x[0] === ui.townTab) ? ui.townTab : "armory";
  let h = header("Town", "Roundtable Hold", `<button class="goldpill" data-act="ledger" aria-label="Runes: ${fmtInt(s.gold)}${s.essence ? `, ${CAT.currencies.essence}: ${s.essence}` : ""}. Open the log">${goldAmt(s.gold)}${s.essence ? seedAmt(s.essence) : ""}</button>`, "Town");
  h += `<div class="seg g4" role="group" aria-label="Town section" style="margin-bottom:14px">${tabs.map(([v, l]) => `<button data-act="town-tab" data-v="${v}" aria-pressed="${tt === v}">${l}</button>`).join("")}</div>`;
  return h + ({armory: armoryView, wardrobe: wardrobeView, spirits: spiritsView, tavern: tavernView}[tt])(s);
}
function armoryView(s) {
  const items = GE.armoryItems(CAT, E); const gold = spendable(s); const eq = heroDoc().equip || {}; const worn = new Set(heroTalismans());
  const tabs = [["armor", "Armor"], ["weapons", "Weapons"], ["talismans", "Talismans"], ["items", "Items"]];
  const at = tabs.some(x => x[0] === ui.armoryTab) ? ui.armoryTab : "armor";
  const pick = {armor: i => i.type === "gear" && i.slot !== "weapon", weapons: i => i.type === "gear" && i.slot === "weapon", talismans: i => i.type !== "gear"}[at];
  const res = reservedGold();
  let h = `<div class="seg g4" role="group" aria-label="Armory section" style="margin-bottom:12px">${tabs.map(([v, l]) => `<button data-act="armory-tab" data-v="${v}" aria-pressed="${at === v}">${l}</button>`).join("")}</div>`;
  if (at === "items") return h + itemsView(s, gold);
  if (res) h += `<p class="small muted" style="margin-bottom:12px">${fmtInt(res)} Runes are set aside for a Tavern reward, so you have ${goldAmt(gold, 13)} to spend here.</p>`;
  if (at === "talismans") h += `<p class="small muted" style="margin-bottom:12px">Talismans are the only gear with perks. You have ${talismanSlots()} talisman ${talismanSlots() === 1 ? "slot" : "slots"}; each pouch adds one, up to ${E.talismans.slotsMax}.</p>`;
  h += `<div class="stack">`;
  for (const rar of E.rarityOrder) {
    const group = items.filter(i => i.rarity === rar && pick(i)); if (!group.length) continue;
    const R = E.rarities[rar]; const set = at === "armor" ? SET_OF[group[0].setId] : null;
    const lvl = Math.min(...group.map(i => GE.itemPrice(i, E).level));
    h += `<section class="card" style="--r:var(--r-${rar})"><div class="card-h"><h2><span class="rdot"></span> ${esc(CAT.rarityNames[rar])}${set ? ` · ${esc(set.name)} set` : ""}</h2>${lvl > s.level ? `<span class="pill">${icon("lock", 12, 2.4)}Unlocks at level ${lvl}</span>` : ""}</div><div class="items">`;
    h += group.map(it => {
      const p = GE.itemPrice(it, E); const owned = !!S.inv[it.id]; const c = GE.canBuy(it, {level: s.level, gold, owned}, E);
      const on = it.type === "talisman" ? worn.has(it.id) : eq[it.slot] === it.id;
      const btn = owned ? `<span class="pill ${on ? "good" : ""}">${on ? "Equipped" : "Owned"}</span>`
        : c.ok ? `<button class="btn sm pri" data-act="buy" data-id="${it.id}" data-confirm="Buy for ${fmtInt(p.gold)}?">${coin(13)}${fmtInt(p.gold)}</button>`
        : c.reason === "level" ? `<span class="price-short" title="Unlocks at level ${c.need}">${icon("lock", 13, 2.4)}${fmtInt(p.gold)}</span>`
        : `<span class="price-short" title="${fmtInt(c.short)} more Runes needed">${coin(13)}${fmtInt(p.gold)}</span>`;
      const sub = it.type === "talisman" ? perkText(it.perk) : it.type === "pouch" ? "+1 talisman slot" : SLOT_NAME[it.slot];
      const boss = bossSource(it);
      return `<div class="item" style="--r:var(--r-${it.rarity})"><div class="art">${itemArt(it, R.color, 64)}</div><div class="nm">${esc(it.name)}</div><div class="tiny faint">${esc(sub)}</div>${boss ? `<div class="tiny drop">${icon("shield", 11, 2.4)}Also drops from ${esc(boss)}</div>` : ""}${btn}</div>`;
    }).join("");
    h += `</div></section>`;
  }
  if (at === "talismans") {
    const drops = CAT.items.filter(i => i.type === "pouch" && !i.purchasable);
    h += `<section class="card"><div class="card-h"><h2>Boss drops</h2></div><div class="list">${drops.map(i => `<div class="li" style="padding:9px 0"><span class="grow t">${esc(i.name)}</span><span class="small muted">${S.inv[i.id] ? "Owned" : esc(bossSource(i))}</span></div>`).join("")}</div><p class="tiny faint" style="margin-top:8px">Boss fights open from level ${Math.min(...Object.values(E.bosses).map(b => b.level))}.</p></section>`;
  }
  h += `<p class="tiny faint">Runes are earned only by completing quests. They can't be bought.</p>`;
  return h + `</div>`;
}
function itemsView(s, gold) {
  const list = CAT.items.filter(i => E.items[i.id]);
  let h = `<div class="stack"><section class="card"><div class="card-h"><h2>Apothecary</h2></div><p class="small muted" style="margin-bottom:10px">Mercy for hard days and a way to earn from more quests.</p><div class="items">`;
  h += list.map(it => {
    const cfg = E.items[it.id]; const held = s.held[it.id] || 0; const R = E.rarities[it.rarity]; const c = GE.canBuy(it, {level: s.level, gold, owned: held}, E);
    const btn = c.ok ? `<button class="btn sm pri" data-act="buy" data-id="${it.id}" data-confirm="Buy for ${fmtInt(cfg.gold)}?">${coin(13)}${fmtInt(cfg.gold)}</button>`
      : c.reason === "full" ? `<span class="pill">${it.type === "upgrade" ? "All used" : `Holding ${held}, the most`}</span>`
      : `<span class="price-short" title="${fmtInt(c.short || 0)} more Runes needed">${coin(13)}${fmtInt(cfg.gold)}</span>`;
    const text = it.kind === "flask" ? `Drink to restore ${cfg.hp} HP.` : it.text;
    const have = it.type === "upgrade" ? `${held} of ${cfg.hold} bought` : `You hold ${held} of ${cfg.hold}`;
    return `<div class="item" style="--r:var(--r-${it.rarity})"><div class="art">${itemArt(it, R.color, 64)}</div><div class="nm">${esc(it.name)}</div><div class="tiny faint">${esc(text)}</div><div class="tiny">${have}</div>${btn}</div>`;
  }).join("");
  h += `</div></section>`;
  h += `<section class="card"><div class="card-h"><h2>Rekindling</h2></div><p class="small muted">If your streak broke two days ago, the Hero page offers to rekindle it for ${E.rekindle.essence} ${esc(CAT.currencies.essence)}, once every ${E.rekindle.cooldownDays} days. You have ${seedAmt(s.essence, 13)}. Seeds come from weekly bounties and every ${E.levelUp.essenceEvery} levels.</p></section>`;
  return h + `</div>`;
}
function wardrobeView(s) {
  const hd = heroDoc(); const eq = hd.equip || {}; const owned = Object.keys(S.inv).map(id => ITEM[id]).filter(Boolean);
  const gear = owned.filter(i => i.type === "gear"); const tals = owned.filter(i => i.type === "talisman"); const worn = heroTalismans(); const n = talismanSlots();
  const og = ORIGIN[hd.origin];
  let h = `<div class="grid2" style="align-items:start"><section class="card ward"><div class="ward-av">${heroAvatar(150, "Your hero")}</div><div class="stack" style="gap:6px;min-width:0"><div class="hc-name">${esc(hd.name || "Tarnished")}</div><div class="small muted">Level ${s.level}${og ? ` ${esc(og.name)}` : ""} · ${gear.length} ${gear.length === 1 ? "piece" : "pieces"} of gear</div><button class="btn sm ghost" style="align-self:flex-start;margin-top:6px" data-act="edit-look">${icon("edit", 15)}Change look</button>${og ? "" : `<button class="btn sm" style="align-self:flex-start" data-act="pick-origin">Choose origin</button>`}</div></section>`;
  h += `<section class="card"><div class="card-h"><h2>Gear</h2></div>`;
  if (!gear.length) h += `<div class="empty"><span>You don't own any gear yet. The Armory sells it for Runes from quests.</span><button class="btn sm" data-act="town-tab" data-v="armory">Visit the Armory</button></div>`;
  else h += CAT.slots.filter(sl => gear.some(i => i.slot === sl.id)).map(sl => {
    const mine = gear.filter(i => i.slot === sl.id).sort((a, b) => E.rarityOrder.indexOf(a.rarity) - E.rarityOrder.indexOf(b.rarity));
    return `<div class="slotrow"><div class="row between"><b>${esc(sl.name)}</b><span class="small muted">${eq[sl.id] && ITEM[eq[sl.id]] ? esc(ITEM[eq[sl.id]].name) : "Nothing on"}</span></div><div class="wopts">
      <button class="wopt" data-act="equip" data-slot="${sl.id}" data-id="" aria-pressed="${!eq[sl.id]}"><span class="wnone">${icon("x", 18)}</span>None</button>
      ${mine.map(it => { const col = E.rarities[it.rarity].color; return `<button class="wopt" style="--r:var(--r-${it.rarity})" data-act="equip" data-slot="${sl.id}" data-id="${it.id}" aria-pressed="${eq[sl.id] === it.id}" aria-label="Wear ${esc(it.name)}, ${esc(CAT.rarityNames[it.rarity])}">${itemArt(it, col, 34)}<span>${esc(it.name)}</span></button>`; }).join("")}</div></div>`;
  }).join("");
  h += `</section>`;
  // Talismans: the slots you have, what's in them, and what you own.
  const P = heroPerks();
  h += `<section class="card"><div class="card-h"><h2>Talismans</h2><span class="small muted">${worn.length} of ${n} ${n === 1 ? "slot" : "slots"}</span></div>
    <div class="tslots">${Array.from({length: E.talismans.slotsMax}, (_, i) => { const it = ITEM[worn[i]]; return i >= n ? `<span class="tslot locked" title="Needs a talisman pouch">${icon("lock", 14, 2.4)}</span>` : it ? `<span class="tslot" style="--r:var(--r-${it.rarity})" title="${esc(it.name)}">${itemArt(it, E.rarities[it.rarity].color, 30)}</span>` : `<span class="tslot empty"></span>`; }).join("")}</div>
    <p class="small ${perkText(P) ? "" : "muted"}" style="margin:8px 0 4px">${perkText(P) || "No perks active."}</p>`;
  if (!tals.length) h += `<div class="empty"><span>Talismans give small perks, like more Runes or less day-end damage.</span><button class="btn sm" data-act="armory-tab" data-v="talismans">See talismans</button></div>`;
  else h += `<div class="wopts">${tals.map(it => { const col = E.rarities[it.rarity].color; const on = worn.includes(it.id); return `<button class="wopt" style="--r:var(--r-${it.rarity})" data-act="talisman" data-id="${it.id}" aria-pressed="${on}" aria-label="${on ? "Take off" : "Wear"} ${esc(it.name)}: ${esc(perkText(it.perk))}">${itemArt(it, col, 30)}<span>${esc(it.name)}</span></button>`; }).join("")}</div>`;
  return h + `</section></div>`;
}
const bar = (v, max, c) => `<div class="meter" role="progressbar" aria-valuenow="${v}" aria-valuemax="${max}"><i style="width:${max ? Math.min(100, v / max * 100) : 0}%;--c:${c}"></i></div>`;
function spiritsView(s) {
  const st = stableDoc(); const S2 = s.stable; const gold = spendable(s); const t = s.today;
  const owned = Object.keys(S.inv).map(id => ITEM[id]).filter(i => i && i.type === "ash").sort((a, b) => E.rarityOrder.indexOf(a.rarity) - E.rarityOrder.indexOf(b.rarity));
  const npc = GE.npcStatus(s.streaks, E); const comp = companion(); const col = it => E.rarities[it.rarity].color;
  let h = `<div class="grid2" style="align-items:start"><div class="stack">`;
  // Companion
  h += `<section class="card"><div class="card-h"><h2>Companion</h2>${comp ? `<button class="btn sm ghost" data-act="summon" data-id="">Dismiss</button>` : ""}</div>`;
  if (comp) {
    const b = S2.bond[comp.id];
    h += `<div class="row" style="gap:14px;align-items:center"><span class="pet-art" style="--r:var(--r-${comp.rarity})">${itemArt(comp, col(comp), 56)}</span><div class="grow stack" style="gap:6px;min-width:0"><b>${esc(comp.name)}${comp.type === "ash" && b ? ` +${b.level}` : ""}</b>`
      + (comp.type === "ash" && b ? (b.next ? `<div class="small muted">Bond ${b.points} of ${b.next} for +${b.level + 1}</div>${bar(b.points, b.next, "var(--c-quest)")}` : `<div class="small muted">Fully bonded</div>`) : `<div class="small muted">${esc(CAT.rarityNames[comp.rarity])} companion</div>`) + `</div></div>`;
  } else h += `<p class="small muted">No companion yet. Awaken a Spirit Ash, then summon it to walk beside you. It grows Bond from every quest you finish.</p>`;
  h += `</section>`;
  // Awakening
  const aw = S2.awakening;
  if (aw) {
    const it = ITEM[aw.id];
    h += `<section class="card" style="--r:var(--r-${it.rarity})"><div class="card-h"><h2>Awakening</h2><span class="small muted">${aw.progress} of ${aw.goal} quests</span></div><div class="row" style="gap:14px;align-items:center"><span class="pet-art dim">${itemArt(it, col(it), 48)}</span><div class="grow stack" style="gap:6px;min-width:0"><b>${esc(it.name)}</b>${bar(aw.progress, aw.goal, col(it))}<div class="small muted">${aw.ready ? "Ready. Awaken it to summon it." : "Every quest you finish brings it closer."}</div></div>${aw.ready ? `<button class="btn sm pri" data-act="awaken">Awaken</button>` : ""}</div></section>`;
  }
  // Your ashes
  if (owned.length) {
    h += `<section class="card"><div class="card-h"><h2>Your Spirit Ashes</h2></div><div class="list">` + owned.map(it => {
      const woke = !!st.awakened[it.id]; const on = st.summoned === it.id; const b = S2.bond[it.id];
      const act = on ? `<span class="pill good">Summoned</span>` : woke ? `<button class="btn sm" data-act="summon" data-id="${it.id}">Summon</button>`
        : aw && aw.id === it.id ? `<span class="pill">Awakening</span>` : `<button class="btn sm ghost" data-act="awaken-start" data-id="${it.id}"${aw ? ` data-confirm="Switch? ${esc(ITEM[aw.id].name)} loses its progress"` : ""}>Start awakening</button>`;
      return `<div class="li" style="padding:8px 0;gap:12px"><span class="pet-art sm${woke ? "" : " dim"}">${itemArt(it, col(it), 30)}</span><span class="grow t">${esc(it.name)}${woke && b ? ` +${b.level}` : ""}<br><span class="tiny faint">${esc(CAT.rarityNames[it.rarity])}${woke ? "" : " · dormant"}</span></span>${act}</div>`;
    }).join("") + `</div></section>`;
  }
  h += `</div><div class="stack">`;
  // Legends: NPC companions
  h += `<section class="card"><div class="card-h"><h2>Legends</h2></div><p class="small muted" style="margin-bottom:6px">They join you after a long streak of one kind of quest.</p><div class="list">` + Object.entries(npc).map(([id, n]) => {
    const it = ITEM[id]; const on = st.summoned === id;
    const act = !n.unlocked ? `<span class="pill">${icon("lock", 12, 2.4)}${n.best} / ${n.days}</span>` : on ? `<span class="pill good">Summoned</span>` : `<button class="btn sm" data-act="summon" data-id="${id}">Summon</button>`;
    return `<div class="li" style="padding:8px 0;gap:12px;align-items:flex-start"><span class="pet-art sm${n.unlocked ? "" : " dim"}" style="--r:var(--r-${it.rarity})">${itemArt(it, col(it), 30)}</span><span class="grow t">${esc(it.name)}<br><span class="tiny faint">${esc(npcGoal(n))}. ${n.cur ? `Now ${n.cur}, best ${n.best}.` : n.best ? `Best ${n.best}.` : ""}</span></span>${act}</div>`;
  }).join("") + `</div></section>`;
  // Torrent
  const tor = ITEM["mount.torrent"]; const torOk = s.level >= E.stable.torrent.level; const riding = heroDoc().mount === tor.id;
  h += `<section class="card"><div class="row" style="gap:12px;align-items:center"><span class="pet-art sm${torOk ? "" : " dim"}" style="--r:var(--r-${tor.rarity})">${itemArt(tor, col(tor), 30)}</span><span class="grow t"><b>${esc(tor.name)}</b><br><span class="tiny faint">${torOk ? "Your spectral steed" : `Joins you at level ${E.stable.torrent.level}`}</span></span>${torOk ? `<button class="btn sm${riding ? "" : " pri"}" data-act="ride">${riding ? "Dismount" : "Ride"}</button>` : `<span class="pill">${icon("lock", 12, 2.4)}Level ${E.stable.torrent.level}</span>`}</div></section>`;
  // Twin Maiden Husks: ashes for sale
  const sale = GE.shopItems(CAT, "ash", E);
  h += `<section class="card"><div class="card-h"><h2>Twin Maiden Husks</h2></div><div class="items">` + sale.map(it => {
    const p = GE.itemPrice(it, E); const own = !!S.inv[it.id]; const c = GE.canBuy(it, {level: s.level, gold, owned: own}, E);
    const btn = own ? `<span class="pill">Owned</span>` : c.ok ? `<button class="btn sm pri" data-act="buy" data-id="${it.id}" data-confirm="Buy for ${fmtInt(p.gold)}?">${coin(13)}${fmtInt(p.gold)}</button>`
      : c.reason === "level" ? `<span class="price-short">${icon("lock", 13, 2.4)}Level ${c.need}</span>` : `<span class="price-short" title="${fmtInt(c.short)} more Runes needed">${coin(13)}${fmtInt(p.gold)}</span>`;
    return `<div class="item" style="--r:var(--r-${it.rarity})"><div class="art">${itemArt(it, col(it), 64)}</div><div class="nm">${esc(it.name)}</div><div class="tiny faint">${esc(CAT.rarityNames[it.rarity])} · ${E.stable.awakenQuests[it.rarity]} quests to awaken</div>${btn}</div>`;
  }).join("") + `</div></section>`;
  return h + `</div></div>`;
}
function tavernView(s) {
  const rs = Object.values(S.rewards).sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || a.price - b.price || (a.created || 0) - (b.created || 0));
  const avg = GE.avgDailyGold(s.ledger, s.today, s.start, E); const res = reservedGold(); const free = spendable(s);
  const daysFor = n => avg > 0 ? Math.max(1, Math.ceil(n / avg)) : null;
  let h = `<div class="tiles t3" style="margin-bottom:14px">${statTile("Runes", fmtInt(s.gold))}${statTile("Set aside", fmtInt(Math.min(res, s.gold)))}${statTile("Per day", avg ? `≈ ${fmtInt(avg)}` : "–", avg ? `last ${E.tavern.avgDays} days` : "no quests yet")}</div>`;
  h += `<div class="grid2">`;
  const goal = rs.find(r => r.pinned);
  if (goal) {
    const have = Math.min(goal.price, spendable(s, goal.id)); const left = goal.price - have; const d = daysFor(left);
    h += `<section class="card goal span2"><div class="card-h"><h2>Saving for</h2><button class="linkbtn" data-act="edit-reward" data-id="${goal.id}">Edit</button></div>
      <div class="row"><span class="ticon lg" aria-hidden="true">${esc(goal.icon || "🎁")}</span><div class="grow"><b>${esc(goal.name)}</b><div class="small muted">${goldAmt(have, 13)} of ${goldAmt(goal.price, 13)}${left > 0 ? d ? ` · about ${d} more ${d === 1 ? "day" : "days"} of quests` : "" : " · ready to redeem"}</div></div></div>
      <div class="meter" role="progressbar" aria-label="Saved toward ${esc(goal.name)}" aria-valuenow="${have}" aria-valuemax="${goal.price}"><i style="width:${have / goal.price * 100}%;--c:var(--gold)"></i></div>
      <form class="inline-add" data-form="reserve" data-id="${goal.id}"><input id="rs-amt" name="amt" inputmode="numeric" placeholder="Runes to set aside" aria-label="Runes to set aside" autocomplete="off"><button class="btn">Set aside</button></form>
      <p class="tiny faint" style="margin-top:8px">${goal.reserved ? `${fmtInt(goal.reserved)} Runes are set aside, so the Armory and other rewards can't spend it. <button class="linkbtn" data-act="release" data-id="${goal.id}">Release it</button>` : "Runes you set aside can only go to this reward."}</p></section>`;
  }
  h += `<section class="card span2"><div class="card-h"><h2>Rewards</h2><button class="btn sm pri" data-act="new-reward">${icon("plus", 14)}New reward</button></div>`;
  if (!rs.length) h += `<p class="small muted" style="margin-bottom:6px">Name real-life treats and give each a price in Runes. When you've earned enough, redeem it and enjoy it.</p>`;
  else h += `<div class="list">${rs.map(r => {
    const c = GE.canRedeem(r, {gold: spendable(s, r.id), today: s.today}); const d = daysFor(r.price);
    const meta = [goldAmt(r.price, 13), d ? `≈ ${d} ${d === 1 ? "day" : "days"} of quests` : "", !r.repeatable ? "One time" : r.cooldownDays ? ({1: "Once a day", 7: "Once a week", 30: "Once a month"}[r.cooldownDays] || `Once every ${r.cooldownDays} days`) : ""].filter(Boolean).map(x => `<span>${x}</span>`).join("");
    const act = c.ok ? `<button class="btn sm pri" data-act="redeem" data-id="${r.id}" data-confirm="Redeem?">Redeem</button>`
      : c.reason === "used" ? `<span class="pill good">Redeemed</span>` : c.reason === "cooldown" ? `<span class="pill">Again ${fmtDate(c.until)}</span>` : `<span class="pill togo">${coin(12)}${fmtInt(c.short)} to go</span>`;
    return `<div class="li"><span class="ticon" aria-hidden="true">${esc(r.icon || "🎁")}</span><button class="li-main" data-act="edit-reward" data-id="${r.id}"><span class="t">${esc(r.name)}${r.pinned ? ` <span class="pill acc">Goal</span>` : ""}</span><span class="sub">${meta}</span></button>${act}</div>`;
  }).join("")}</div>`;
  const names = new Set(rs.map(r => r.name.toLowerCase()));
  const ideas = CAT.tavernStarters.filter(x => !names.has(x.name.toLowerCase()));
  if (ideas.length && rs.length < 6) h += `<div class="label" style="margin:14px 0 6px">Ideas</div><div class="list">${ideas.map(x => `<div class="li" style="padding:8px 0"><span class="ticon" aria-hidden="true">${x.icon}</span><span class="grow"><span class="t">${esc(x.name)}</span><br><span class="sub">${goldAmt(x.price, 13)}</span></span><button class="btn sm ghost" data-act="add-starter" data-id="${x.id}">${icon("plus", 14)}Add</button></div>`).join("")}</div>`;
  h += `</section>`;
  const rec = Object.values(s.ledger).filter(e => e.src === "tavern" && +e.amt).sort((a, b) => (b.at || 0) - (a.at || 0)).slice(0, 15);
  h += `<section class="card span2"><div class="card-h"><h2>Receipts</h2></div>${rec.length ? `<div class="list">${rec.map(e => `<div class="li" style="padding:9px 0"><span class="ticon" aria-hidden="true">${esc(e.icon || "🧾")}</span><span class="grow"><span class="t">${esc(e.name || "Reward")}</span><br><span class="sub faint small">${relDay(e.date)}${e.at ? ", " + new Date(e.at).toLocaleTimeString(undefined, {hour: "2-digit", minute: "2-digit"}) : ""}</span></span><span class="mono" style="font-weight:600">−${fmtInt(-e.amt)}</span></div>`).join("")}</div>` : `<p class="faint small">Rewards you redeem are listed here.</p>`}</section>`;
  return h + `</div>`;
}

/* ---- game sheets ---- */
function ledgerLabel(e) {
  const k = String(e.srcId || "");
  if (e.src === "quest") { if (k.startsWith("habit:")) return (S.habits[k.slice(6)] || {}).name || "Habit quest"; if (k.startsWith("task:")) return (S.tasks[k.slice(5)] || {}).title || "Task quest"; return {steps: "Steps quest", workout: "Workout quest", learn: "Learning quest"}[k] || "Quest"; }
  if (e.src === "periodic") { const id = k.split(":")[1]; return "Bounty: " + ((k.startsWith("habit:") ? (S.habits[id] || {}).name : (S.tasks[id] || {}).title) || "done"); }
  return {allclear: "All-clear bonus", tutorial: CAT.tutorial.name, levelup: `Reached level ${k}`, downed: "Downed", bounty: "Weekly bounty", rekindle: "Rekindled your streak", armory: `Bought ${(ITEM[k] || {}).name || "gear"}`, tavern: `Redeemed ${e.name || "a reward"}`}[e.src] || e.src;
}
function sLedger() {
  return () => {
    const s = gameState(); if (!s) return sheetHead("Runes") + `<p class="faint">The game is off.</p>`;
    const es = Object.values(s.ledger).filter(e => (e.cur === "gold" || e.cur === "essence") && +e.amt).sort((a, b) => b.date.localeCompare(a.date) || (b.at || 0) - (a.at || 0) || b.id.localeCompare(a.id)).slice(0, 100);
    let h = sheetHead("Runes") + `<div class="row between" style="margin-bottom:10px"><span class="snum">${goldAmt(s.gold, 22)}</span><span class="small muted">${s.essence ? `${seedAmt(s.essence, 16)} ${esc(CAT.currencies.essence)}` : ""}${reservedGold() ? ` · ${fmtInt(spendable(s))} Runes free to spend` : ""}</span></div><p class="small muted" style="margin-bottom:12px">Every change to your Runes and ${esc(CAT.currencies.essence)} is listed here.</p>`;
    let last = ""; h += `<div class="list">`;
    es.forEach(e => { if (e.date !== last) { h += `<div class="label" style="padding:14px 0 4px">${relDay(e.date)}</div>`; last = e.date; } h += `<div class="li" style="padding:9px 0"><span class="grow t">${esc(ledgerLabel(e))}</span><span class="mono" style="font-weight:600;display:inline-flex;align-items:center;gap:4px;color:${e.amt > 0 ? "var(--good-ink)" : "var(--ink)"}">${e.cur === "essence" ? seed(13) : ""}${e.amt > 0 ? "+" : "−"}${fmtInt(Math.abs(e.amt))}</span></div>`; });
    return h + (es.length ? "" : `<p class="faint small">Nothing yet. Complete a quest to start earning Runes.</p>`) + `</div>`;
  };
}
const lookFields = L => `<div class="field"><span>Skin</span><div class="swatches">${CAT.looks.skin.map(c => `<button type="button" class="sw" style="--c:${c}" data-act="look-pick" data-name="skin" data-v="${c}" aria-pressed="${c === L.skin}" aria-label="Skin tone"></button>`).join("")}</div><input type="hidden" name="skin" value="${L.skin}"></div>
  <div class="field"><span>Hair color</span><div class="swatches">${CAT.looks.hair.map(c => `<button type="button" class="sw" style="--c:${c}" data-act="look-pick" data-name="hair" data-v="${c}" aria-pressed="${c === L.hair}" aria-label="Hair color"></button>`).join("")}</div><input type="hidden" name="hair" value="${L.hair}"></div>
  <div class="field"><span>Hair style</span><div class="seg" role="group">${CAT.looks.hairStyle.map(o => `<button type="button" data-act="look-pick" data-name="hairStyle" data-v="${o.id}" aria-pressed="${o.id === L.hairStyle}">${esc(o.name)}</button>`).join("")}</div><input type="hidden" name="hairStyle" value="${L.hairStyle}"></div>
  <div class="field"><span>Build</span><div class="seg" role="group">${CAT.looks.body.map(o => `<button type="button" data-act="look-pick" data-name="body" data-v="${o.id}" aria-pressed="${o.id === L.body}">${esc(o.name)}</button>`).join("")}</div><input type="hidden" name="body" value="${L.body}"></div>`;
const originFields = sel => `<div class="field"><span>Origin</span><div class="stack" style="gap:8px" role="group" aria-label="Origin">${CAT.origins.map(o => `<button type="button" class="pickt origin" data-act="origin-pick" data-name="origin" data-v="${o.id}" aria-pressed="${o.id === sel}"><span class="og-av" aria-hidden="true">${avatarSvg({equip: heroEquip(kitEquip(originKit(o))), size: 64})}</span><span class="grow"><b>${esc(o.name)}</b><br><span class="small muted">${esc(o.text)}</span></span><span class="tick">${icon("check", 16, 3)}</span></button>`).join("")}<input type="hidden" name="origin" value="${sel}"></div></div>`;
function sOrigin() {
  const sel = CAT.origins[0].id;
  return () => sheetHead("Choose your origin") + `<form data-form="origin" class="stack"><div class="lookprev" data-look="1">${avatarSvg({look: heroDoc().look, equip: heroEquip(kitEquip(originKit(ORIGIN[sel]))), size: 128})}</div>
    ${originFields(sel)}<p class="tiny faint">You choose once. Starter gear gives no stats and stays in your Wardrobe next to anything you buy.</p>
    <div class="sh-foot"><button class="btn pri">Confirm origin</button></div></form>`;
}
const formLook = f => ({skin: fv(f, "skin"), hair: fv(f, "hair"), hairStyle: fv(f, "hairStyle"), body: fv(f, "body")});
function sLook() {
  const hd = heroDoc(); const L = {...DEFAULT_LOOK, ...hd.look};
  return () => sheetHead("Your hero") + `<form data-form="look" class="stack"><div class="lookprev" data-equip="1">${heroAvatar(132)}</div>
    <label class="field"><span>Name</span><input name="heroName" maxlength="24" value="${esc(hd.name)}" autocomplete="off"></label>${lookFields(L)}
    <div class="sh-foot"><button class="btn pri">Save</button></div></form>`;
}
function suggestWorkoutDays() {
  const n = Math.max(0, Math.min(7, Math.round(+S.settings.weeklyWorkouts || 3)));
  const cnt = [0, 0, 0, 0, 0, 0, 0]; const from = dkey(addDays(new Date(), -56));
  Object.values(S.sessions).forEach(s => { if (s.date >= from) cnt[GE.weekdayOf(s.date)]++; });
  if (sum(cnt) >= 4) return cnt.map((c, i) => [c, i]).filter(x => x[0] > 0).sort((a, b) => b[0] - a[0] || a[1] - b[1]).slice(0, n).map(x => x[1]).sort((a, b) => a - b);
  return {0: [], 1: [2], 2: [0, 3], 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 3, 4], 6: [0, 1, 2, 3, 4, 5], 7: ALL_WD}[n];
}
function sOnboard() {
  const t = today(); const base = GE.stepBaseline(S.steps, t, E); const cur = stepGoal();
  const goals = [...new Set([base, cur, 6000, 8000, 10000, 12000].filter(Boolean))].sort((a, b) => a - b);
  const sel = base || cur; const L = {...DEFAULT_LOOK}; const o0 = CAT.origins[0].id;
  const pre = new Set(["tavern.starter.coffee", "tavern.starter.episode", "tavern.starter.nightoff"]);
  const nh = habitList().filter(h => h.freq !== "weekly").length, nt = Object.values(S.tasks).filter(x => x.kind === "daily").length;
  return () => sheetHead("Create your hero") + `<form data-form="onboard" class="stack ob">
    <div class="ob-dots" aria-hidden="true"><i class="on"></i><i></i><i></i></div>
    <fieldset data-step="1" class="stack">
      <div class="lookprev">${avatarSvg({look: L, equip: heroEquip(kitEquip(originKit(ORIGIN[o0]))), size: 128})}</div>
      <label class="field"><span>Hero name</span><input name="heroName" maxlength="24" value="${esc(S.settings.name || "")}" placeholder="What should the Roundtable call you?" autocomplete="off"></label>
      ${originFields(o0)}
      <p class="tiny faint">Starter gear is for looks and gives no stats. You can change skin and hair later in the Wardrobe.</p>
      <div class="sh-foot"><button type="button" class="btn pri" data-act="ob-step" data-d="1">Next</button></div>
    </fieldset>
    <fieldset data-step="2" class="stack" hidden>
      <p class="small muted">${nh + nt ? `Your ${nh ? `${nh} daily ${nh === 1 ? "habit" : "habits"}` : ""}${nh && nt ? " and " : ""}${nt ? `${nt} daily ${nt === 1 ? "task" : "tasks"}` : ""} are already quests.` : "Habits and daily tasks you add become quests."} Pick the rest.</p>
      <div class="field"><span>Daily steps quest</span><div class="chips">${goals.map(v => `<button type="button" class="chip" data-act="radio" data-name="stepGoal" data-v="${v}" aria-pressed="${v === sel}">${fmtInt(v)}${v === base ? " (suggested)" : ""}</button>`).join("")}<button type="button" class="chip" data-act="radio" data-name="stepGoal" data-v="0" aria-pressed="false">No steps quest</button></div><input type="hidden" name="stepGoal" value="${sel}"></div>
      ${base ? `<p class="tiny faint" style="margin-top:-6px">Suggested from your last ${E.steps.baselineDays} days plus ${Math.round(E.steps.baselineBump * 100)}%.</p>` : ""}
      <div class="field"><span>Workout days</span>${multiDays("workoutDays", suggestWorkoutDays(), "Workout days")}</div>
      <div class="field"><span>Learning quest</span><div class="seg" role="group"><button type="button" data-act="radio" data-name="learnOn" data-v="0" aria-pressed="true">Not now</button><button type="button" data-act="radio" data-name="learnOn" data-v="1" aria-pressed="false">Every day</button></div><input type="hidden" name="learnOn" value="0"></div>
      <div class="field" data-show="learnOn=1" hidden><span>Minutes a day</span><div class="chips">${[10, 15, 20, 30, 45].map(m => `<button type="button" class="chip" data-act="radio" data-name="learnMin" data-v="${m}" aria-pressed="${m === E.learning.defaultGoalMin}">${m} min</button>`).join("")}</div><input type="hidden" name="learnMin" value="${E.learning.defaultGoalMin}"></div>
      <p class="tiny faint">Steps from the iPhone Shortcut or a Health export, workouts you log live and timed learning count as verified and earn ${Math.round((E.earn.verifiedMult - 1) * 100)}% more.</p>
      <div class="sh-foot"><button type="button" class="btn ghost" data-act="ob-step" data-d="-1">Back</button><button type="button" class="btn pri" data-act="ob-step" data-d="1">Next</button></div>
    </fieldset>
    <fieldset data-step="3" class="stack" hidden>
      <p class="small muted">Runes from quests buy real-life treats you choose, in the Tavern. Pick a few to start. You can change prices and add your own later.</p>
      <div class="multi stack" style="gap:8px" role="group" aria-label="Starter rewards"><input type="hidden" name="starters" value="${[...pre].join(",")}">
        ${CAT.tavernStarters.map(x => `<button type="button" class="pickt" data-act="multi" data-v="${x.id}" aria-pressed="${pre.has(x.id)}"><span class="ticon" aria-hidden="true">${x.icon}</span><span class="grow"><b>${esc(x.name)}</b><br>${goldAmt(x.price, 13)}</span><span class="tick">${icon("check", 16, 3)}</span></button>`).join("")}</div>
      <div class="sh-foot"><button type="button" class="btn ghost" data-act="ob-step" data-d="-1">Back</button><button class="btn pri">Begin the adventure</button></div>
    </fieldset></form>`;
}
function sGameSettings() {
  const g = S.settings.game || {}; const L = g.learn || {}; const goal = +L.goalMin || E.learning.defaultGoalMin;
  const dayEndLabel = v => v === "00:00" ? "Midnight" : new Date(2024, 0, 1, +v.slice(0, 2)).toLocaleTimeString(undefined, {hour: "numeric", minute: "2-digit"});
  return () => sheetHead("Quest settings") + `<form data-form="game-settings" class="stack">
    <label class="field"><span>A day ends at</span><select name="dayEnd">${E.dayEnd.choices.map(v => `<option value="${v}" ${v === (g.dayEnd || "00:00") ? "selected" : ""}>${dayEndLabel(v)}</option>`).join("")}</select></label>
    <p class="tiny faint" style="margin-top:-8px">Anything you do before this time counts toward the day before, for night owls.</p>
    <div class="field"><span>Steps quest (${fmtInt(stepGoal())} steps, change the goal in Train › Steps)</span><div class="seg" role="group"><button type="button" data-act="radio" data-name="stepsOn" data-v="1" aria-pressed="${g.steps !== false}">On</button><button type="button" data-act="radio" data-name="stepsOn" data-v="0" aria-pressed="${g.steps === false}">Off</button></div><input type="hidden" name="stepsOn" value="${g.steps === false ? 0 : 1}"></div>
    <div class="field"><span>Workout quest days</span>${multiDays("workoutDays", g.workoutDays || [], "Workout days")}</div>
    <div class="field"><span>Learning quest</span><div class="seg" role="group"><button type="button" data-act="radio" data-name="learnOn" data-v="1" aria-pressed="${!!L.on}">On</button><button type="button" data-act="radio" data-name="learnOn" data-v="0" aria-pressed="${!L.on}">Off</button></div><input type="hidden" name="learnOn" value="${L.on ? 1 : 0}"></div>
    <div class="stack" data-show="learnOn=1" style="gap:12px" ${L.on ? "" : "hidden"}><div class="field"><span>Minutes a day</span><div class="chips">${[10, 15, 20, 30, 45, 60].map(m => `<button type="button" class="chip" data-act="radio" data-name="learnMin" data-v="${m}" aria-pressed="${m === goal}">${m} min</button>`).join("")}</div><input type="hidden" name="learnMin" value="${goal}"></div>
    <div class="field"><span>Learning days</span>${multiDays("learnDays", L.days, "Learning days")}</div></div>
    <p class="tiny faint">Habits and daily tasks pick their own days in their edit screens.</p>
    <div class="sh-foot"><button class="btn pri">Save</button></div></form>
    <section class="card" style="margin-top:18px"><div class="card-h"><h2>Switch the game off</h2></div><p class="small muted" style="margin-bottom:12px">Your trackers keep working as before. Your hero, Runes and gear wait for you, and the days while it's off count as rest days.</p><button class="btn danger" data-act="game-off" data-confirm="Tap again to switch off">Switch off</button></section>`;
}
function sReward(id, starter) {
  const x = id ? S.rewards[id] : null; const d = x || starter || {};
  const icon0 = d.icon || "🎁", rep = x ? x.repeatable !== false : starter ? starter.repeatable : true, cd = +(d.cooldownDays || 0);
  return () => sheetHead(x ? "Edit reward" : "New reward") + `<form data-form="reward" data-id="${id || ""}" class="stack">
    <label class="field"><span>Reward</span><input name="name" required maxlength="60" value="${esc(d.name || "")}" placeholder="e.g. Cinema night" autocomplete="off" autofocus></label>
    <div class="field"><span>Icon</span><div class="chips emoji">${CAT.tavernIcons.map(c => `<button type="button" class="chip" data-act="radio" data-name="icon" data-v="${c}" aria-pressed="${c === icon0}">${c}</button>`).join("")}</div><input type="hidden" name="icon" value="${icon0}"></div>
    <label class="field"><span>Price in Runes</span><input id="rw-price" name="price" inputmode="numeric" required value="${d.price || ""}" placeholder="e.g. 150" autocomplete="off"></label>
    <div class="chips">${E.tavern.tiers.map(([l, v]) => `<button type="button" class="chip" data-act="fill" data-target="rw-price" data-v="${v}">${l} · ${fmtInt(v)}</button>`).join("")}</div>
    <div class="field"><span>How often</span><div class="seg" role="group"><button type="button" data-act="radio" data-name="repeatable" data-v="1" aria-pressed="${rep}">Again and again</button><button type="button" data-act="radio" data-name="repeatable" data-v="0" aria-pressed="${!rep}">One time</button></div><input type="hidden" name="repeatable" value="${rep ? 1 : 0}"></div>
    <label class="field" data-show="repeatable=1" ${rep ? "" : "hidden"}><span>Wait between redeems</span><select name="cooldown">${[[0, "No wait"], [1, "A day"], [7, "A week"], [30, "A month"]].map(([v, l]) => `<option value="${v}" ${v === cd ? "selected" : ""}>${l}</option>`).join("")}</select></label>
    <div class="field"><span>Savings goal</span><div class="seg" role="group"><button type="button" data-act="radio" data-name="pinned" data-v="0" aria-pressed="${!(x && x.pinned)}">No</button><button type="button" data-act="radio" data-name="pinned" data-v="1" aria-pressed="${!!(x && x.pinned)}">Pin as my goal</button></div><input type="hidden" name="pinned" value="${x && x.pinned ? 1 : 0}"></div>
    <div class="sh-foot">${x ? `<button type="button" class="btn danger" data-act="del-reward" data-id="${x.id}" data-confirm="Tap again to delete">Delete</button>` : ""}<button class="btn pri">${x ? "Save" : "Add reward"}</button></div></form>`;
}
function inviteCard() {
  const g = S.settings.game; if (g && g.start) return "";
  return `<section class="card invite"><div class="inv-av" aria-hidden="true">${avatarSvg({size: 64})}</div><div class="stack" style="gap:8px;min-width:0"><div class="label">New</div><h2>Turn your days into an adventure</h2><p class="small">Create a hero. Your habits, tasks, steps and workouts become quests that earn XP and Runes, and Runes buy gear and real-life treats you pick.</p><button class="btn" data-act="start-game">Create your hero</button></div></section>`;
}

const GAME_ACTIONS = {
  "start-game": () => { closeAll(); openSheet(sOnboard()); },
  "ob-step": el => {
    const f = el.closest("form"); const cur = f.querySelector("fieldset:not([hidden])"); const n = +cur.dataset.step + +el.dataset.d;
    const nx = f.querySelector(`fieldset[data-step="${n}"]`); if (!nx) return;
    cur.hidden = true; nx.hidden = false; f.querySelectorAll(".ob-dots i").forEach((d, i) => d.classList.toggle("on", i === n - 1)); $("#sheet").scrollTop = 0;
  },
  "origin-pick": el => {
    setRadio(el); const f = el.closest("form"); const p = f && f.querySelector(".lookprev"); const o = ORIGIN[el.dataset.v];
    if (p && o) p.innerHTML = avatarSvg({look: p.dataset.look ? heroDoc().look : DEFAULT_LOOK, equip: heroEquip(kitEquip(originKit(o))), size: 128});
  },
  "pick-origin": () => openSheet(sOrigin()),
  "look-pick": el => {
    setRadio(el); const f = el.closest("form"); const p = f && f.querySelector(".lookprev");
    if (p) p.innerHTML = avatarSvg({look: formLook(f), equip: p.dataset.equip ? heroEquip() : {}, size: 128});
  },
  multi: el => {
    el.setAttribute("aria-pressed", el.getAttribute("aria-pressed") === "true" ? "false" : "true");
    const box = el.closest(".multi"); box.querySelector("input[type=hidden]").value = [...box.querySelectorAll('[data-act="multi"][aria-pressed="true"]')].map(b => b.dataset.v).join(",");
  },
  "game-settings": () => openSheet(sGameSettings()),
  "game-off": () => { setGame({off: today()}); closeAll(); go("today"); toast("The game is off. Your trackers work as before."); },
  "game-on": () => {
    const g = S.settings.game || {}; const pauses = [...(g.pauses || [])];
    if (g.off) { const from = GE.addKey(g.off, 1), to = GE.addKey(today(), -1); if (from <= to) pauses.push({from, to}); }
    setGame({off: null, pauses}); closeAll(); go("today"); toast("Welcome back. The days away counted as rest days.");
  },
  "quest-tab": el => { ui.questTab = el.dataset.v; ui.reorder = false; saveUi(); if (ui.tab !== "quests") { closeAll(); go("quests"); } else render(); },
  "town-tab": el => { ui.townTab = el.dataset.v; saveUi(); if (ui.tab !== "town") { closeAll(); go("town"); } else { render(); window.scrollTo(0, 0); } },
  rest: el => {
    const s = gameState(); const d = el.dataset.d; if (!s || ![s.today, s.yesterday].includes(d)) return;
    const g = S.settings.game || {}; if ((g.rests || []).includes(d) || !(s.held["item.scroll-of-grace"] > 0)) return;
    setGame({rests: [...(g.rests || []), d]}); toast(d === s.today ? "Resting today. No HP lost and your streaks stay" : "Yesterday is now a rest day");
  },
  flask: () => {
    const s = gameState(); if (!s || !(s.held["item.flask-of-crimson-tears"] > 0) || s.hp >= s.maxHp) return;
    const g = S.settings.game || {}; setGame({flasks: [...(g.flasks || []), s.today]}); toast(`+${Math.min(E.items["item.flask-of-crimson-tears"].hp, s.maxHp - s.hp)} HP`);
  },
  rekindle: () => {
    const s = gameState(); const r = s && s.rekindle; if (!r || !r.ready || s.essence < r.cost || !canSpend()) return;
    const g = S.settings.game || {}; const at = Date.now();
    putMany("ledger", [{id: `rek:${r.date}:essence`, date: s.today, cur: "essence", amt: -r.cost, src: "rekindle", srcId: r.date, at}], true);
    setGame({rekindles: [...(g.rekindles || []), r.date]}); toast("Your streak burns again");
  },
  "awaken-start": el => { const id = el.dataset.id; if (!ITEM[id] || !S.inv[id]) return; setStable({...stableDoc(), awakening: {id, from: today()}}); toast(`${ITEM[id].name} is awakening. Finish ${E.stable.awakenQuests[ITEM[id].rarity]} quests`); },
  awaken: () => {
    const s = gameState(); const aw = s && s.stable.awakening; if (!aw || !aw.ready) return; const st = stableDoc(); const t = today();
    const next = {...st, awakening: null, awakened: {...st.awakened, [aw.id]: t}};
    setStable(companion() ? next : GE.summon(next, aw.id, t)); toast(`${ITEM[aw.id].name} has awakened${companion() ? "" : " and walks beside you"}`);
  },
  summon: el => {
    const id = el.dataset.id || null; const st = stableDoc(); const s = gameState();
    if (id && ITEM[id].type === "ash" && !st.awakened[id]) return;
    if (id && ITEM[id].type === "npc" && !(GE.npcStatus(s.streaks, E)[id] || {}).unlocked) return;
    setStable(GE.summon(st, id, today())); toast(id ? `${ITEM[id].name} walks beside you` : "Companion dismissed");
  },
  ride: () => { const on = heroDoc().mount === "mount.torrent"; setHero({mount: on ? null : "mount.torrent"}); toast(on ? "You dismount" : "Torrent carries you onward"); },
  "armory-tab": el => { ui.armoryTab = el.dataset.v; ui.townTab = "armory"; saveUi(); if (ui.tab !== "town") { closeAll(); go("town"); } else render(); },
  talisman: el => {
    const id = el.dataset.id; if (!ITEM[id] || !S.inv[id]) return; const worn = heroTalismans();
    if (worn.includes(id)) { setHero({talismans: worn.filter(x => x !== id)}); return; }
    const n = talismanSlots(); if (worn.length >= n) { toast(n === 1 ? "Your one slot is full. Take that talisman off first." : `All ${n} slots are full. Take one off first.`); return; }
    setHero({talismans: [...worn, id]}); toast(`${ITEM[id].name}: ${perkText(ITEM[id].perk)}`);
  },
  reorder: () => { ui.reorder = !ui.reorder; render(); },
  "q-move": el => {
    const s = gameState(); if (!s) return; const keys = s.board.today.dailies.map(q => q.key);
    const i = keys.indexOf(el.dataset.key), j = i + +el.dataset.d; if (i < 0 || j < 0 || j >= keys.length) return;
    [keys[i], keys[j]] = [keys[j], keys[i]];
    setGame({order: [...keys, ...(S.settings.game.order || []).filter(k => !keys.includes(k))]});
  },
  ledger: () => openSheet(sLedger(), true),
  "edit-look": () => openSheet(sLook()),
  equip: el => {
    if (el.dataset.id && !S.inv[el.dataset.id]) return;
    const eq = {...(heroDoc().equip || {})}; if (el.dataset.id) eq[el.dataset.slot] = el.dataset.id; else delete eq[el.dataset.slot];
    setHero({equip: eq});
  },
  buy: el => {
    const it = ITEM[el.dataset.id]; const s = gameState(); if (!it || !s || !canSpend()) return;
    if (E.items[it.id]) {
      const c = GE.canBuy(it, {level: s.level, gold: spendable(s), owned: s.held[it.id] || 0}, E);
      if (!c.ok) { toast(c.reason === "gold" ? `You need ${fmtInt(c.short)} more Runes` : c.reason === "full" ? "You can't hold more of these" : "Not for sale"); return; }
      const at = Date.now();
      putMany("ledger", [{id: `buy:${it.id}:${at.toString(36)}`, date: today(), cur: "gold", amt: -c.price.gold, src: "armory", srcId: it.id, bal: s.gold - c.price.gold, at}]);
      toast(it.type === "upgrade" ? `${it.name} used: ${s.slots + 1} daily quests now earn rewards` : `${it.name} added. Use it from the Hero page`); return;
    }
    const c = GE.canBuy(it, {level: s.level, gold: spendable(s), owned: !!S.inv[it.id]}, E);
    if (!c.ok) { toast(c.reason === "gold" ? `You need ${fmtInt(c.short)} more Runes` : c.reason === "level" ? `Unlocks at level ${c.need}` : "You already own this"); return; }
    const at = Date.now(), date = today(); const eq = heroDoc().equip || {};
    putMany("ledger", [{id: "buy:" + it.id, date, cur: "gold", amt: -c.price.gold, src: "armory", srcId: it.id, bal: s.gold - c.price.gold, at}], true);
    put("inv", {id: it.id, date, at, src: "armory"});
    if (it.type === "pouch") { toast(`${it.name} is yours. You now have ${talismanSlots()} talisman slots`); return; }
    if (it.type === "ash") {
      const st = stableDoc(); if (!st.awakening) { setStable({...st, awakening: {id: it.id, from: date}}); toast(`${it.name} is yours. Finish ${E.stable.awakenQuests[it.rarity]} quests to awaken it`); }
      else toast(`${it.name} is yours. Start awakening it once ${ITEM[st.awakening.id].name} wakes`);
      return;
    }
    if (it.type === "talisman") {
      const worn = heroTalismans(); const wear = worn.length < talismanSlots();
      if (wear) setHero({talismans: [...worn, it.id]});
      toast(wear ? `${it.name} is yours, and you're wearing it` : `${it.name} is yours. Your talisman slots are full, so swap it in from the Wardrobe`); return;
    }
    const wear = !eq[it.slot] || (ITEM[eq[it.slot]] || {}).rarity === "starter";
    if (wear) setHero({equip: {...eq, [it.slot]: it.id}});
    toast(wear ? `${it.name} is yours, and you're wearing it` : `${it.name} is yours. Wear it from the Wardrobe`);
  },
  "new-reward": () => openSheet(sReward()),
  "edit-reward": el => openSheet(sReward(el.dataset.id)),
  "add-starter": el => { const x = CAT.tavernStarters.find(t => t.id === el.dataset.id); if (!x) return; put("rewards", {id: uid(), name: x.name, icon: x.icon, price: x.price, repeatable: x.repeatable, cooldownDays: x.cooldownDays, created: Date.now(), count: 0, from: x.id}); toast(`Added ${x.name}`); },
  "del-reward": el => { del("rewards", el.dataset.id); closeAll(); toast("Reward deleted"); },
  redeem: el => {
    const r = S.rewards[el.dataset.id]; const s = gameState(); if (!r || !s || !canSpend()) return;
    const c = GE.canRedeem(r, {gold: spendable(s, r.id), today: s.today});
    if (!c.ok) { toast(c.reason === "gold" ? `You need ${fmtInt(c.short)} more Runes` : c.reason === "cooldown" ? `You can redeem this again ${fmtDate(c.until)}` : "Already redeemed"); return; }
    const at = Date.now();
    putMany("ledger", [{id: `tav:${r.id}:${at.toString(36)}`, date: s.today, cur: "gold", amt: -r.price, src: "tavern", srcId: r.id, bal: s.gold - r.price, at, name: r.name, icon: r.icon || "🎁"}], true);
    put("rewards", {...r, lastDate: s.today, count: (r.count || 0) + 1, redeemedAt: at, reserved: 0, pinned: r.repeatable ? !!r.pinned : false});
    toast(`Enjoy it: ${r.name}`);
  },
  release: el => { const r = S.rewards[el.dataset.id]; if (r) { put("rewards", {...r, reserved: 0}); toast("Released. Those Runes are free to spend."); } },
  "focus-start": () => { const i = $("#fc-topic"); focus = {start: Date.now(), topic: i ? i.value.trim() : ""}; lsSet(FOCUS_KEY, focus); render(); },
  "focus-stop": () => {
    if (!focus) return; const f = focus; focus = null; lsSet(FOCUS_KEY, null);
    const min = Math.min(E.learning.maxSessionMin, Math.round((Date.now() - f.start) / 60000));
    if (min < 1) { toast("Under a minute, so nothing was logged"); render(); return; }
    const g = S.settings.game; const date = g && g.dayEnd ? GE.gameDate(new Date(f.start), g.dayEnd) : dkey(new Date(f.start));
    gWatch = Date.now(); put("learn", {id: uid(), date, min, timer: true, topic: f.topic, at: Date.now()}); toast(`Logged ${min} min of focus`);
  },
  "focus-cancel": () => { focus = null; lsSet(FOCUS_KEY, null); render(); },
  "del-learn": el => { del("learn", el.dataset.id); toast("Removed"); },
};
const GAME_FORMS = {
  onboard: (fd, f) => {
    const cur = f.querySelector("fieldset:not([hidden])");
    if (cur && cur.dataset.step !== "3") { GAME_ACTIONS["ob-step"](cur.querySelector('[data-act="ob-step"][data-d="1"]')); return; }
    const start = today(); const sg = +fd.get("stepGoal") || 0;
    const game = {start, dayEnd: "00:00", workoutDays: parseDays(fd.get("workoutDays")), steps: sg > 0, learn: {on: fd.get("learnOn") === "1", goalMin: +fd.get("learnMin") || E.learning.defaultGoalMin, days: null}, order: [], pauses: []};
    game.seed = GE.seedStreak({...gameData(), stepGoal: sg || stepGoal()}, game, start, E);
    setSettings({game, ...(sg ? {stepGoal: sg} : {})});
    setHero({name: String(fd.get("heroName") || "").trim().slice(0, 24) || "Tarnished", look: {...DEFAULT_LOOK}, equip: {}, talismans: [], created: Date.now()});
    grantOrigin(ORIGIN[fd.get("origin")] || CAT.origins[0]);
    const picked = new Set(String(fd.get("starters") || "").split(",").filter(Boolean));
    CAT.tavernStarters.filter(x => picked.has(x.id)).forEach((x, i) => put("rewards", {id: uid() + i, name: x.name, icon: x.icon, price: x.price, repeatable: x.repeatable, cooldownDays: x.cooldownDays, created: Date.now() + i, count: 0, from: x.id}, true));
    closeAll(); go("today"); toast(`Your adventure begins. ${CAT.tutorial.text}`);
  },
  origin: fd => {
    const o = ORIGIN[fd.get("origin")]; if (!o) return;
    if (!heroDoc().origin) { grantOrigin(o); toast(`${o.name} it is. Your starter gear is on.`); }
    closeAll();
  },
  look: (fd, f) => { setHero({name: String(fd.get("heroName") || "").trim().slice(0, 24) || "Hero", look: formLook(f)}); closeAll(); toast("Looking good"); },
  "game-settings": fd => {
    const learnOn = fd.get("learnOn") === "1"; const ld = parseDays(fd.get("learnDays"));
    if (learnOn && !ld.length) { toast("Pick at least one day for learning"); return; }
    const g = S.settings.game || {};
    setGame({dayEnd: fd.get("dayEnd") || "00:00", steps: fd.get("stepsOn") === "1", workoutDays: parseDays(fd.get("workoutDays")), learn: {...(g.learn || {}), on: learnOn, goalMin: +fd.get("learnMin") || E.learning.defaultGoalMin, days: ld.length === 7 ? null : ld}});
    closeAll(); toast("Quest settings saved");
  },
  "learn-goal": fd => {
    const on = fd.get("on") === "1"; const d = parseDays(fd.get("days"));
    if (on && !d.length) { toast("Pick at least one day"); return; }
    const g = S.settings.game || {};
    setGame({learn: {...(g.learn || {}), on, goalMin: +fd.get("goalMin") || E.learning.defaultGoalMin, days: d.length === 7 ? null : d}}); toast(on ? "Learning quest saved" : "Learning quest off");
  },
  learn: (fd, f) => {
    const min = Math.round(num(fd.get("min"))); const d = fd.get("date") || today();
    if (!(min > 0 && min <= E.learning.maxSessionMin)) { toast(`Enter minutes between 1 and ${E.learning.maxSessionMin}`); $("#ln-min").focus(); return; }
    if (d > today()) { toast("That day hasn't happened yet"); return; }
    gWatch = Date.now(); put("learn", {id: uid(), date: d, min, timer: false, topic: String(fd.get("topic") || "").trim(), at: Date.now()}); f.reset(); toast(`Logged ${min} min`);
  },
  reward: (fd, f) => {
    const id = f.dataset.id; const x = id ? S.rewards[id] : null; const name = String(fd.get("name") || "").trim(); if (!name) return;
    const price = Math.round(num(fd.get("price"))); if (!(price > 0 && price <= E.tavern.maxPrice)) { toast("Enter a price in Runes"); $("#rw-price").focus(); return; }
    const repeatable = fd.get("repeatable") === "1", pinned = fd.get("pinned") === "1";
    if (pinned) Object.values(S.rewards).forEach(r => { if (r.pinned && r.id !== id) put("rewards", {...r, pinned: false, reserved: 0}, true); });
    put("rewards", {...(x || {id: uid(), created: Date.now(), count: 0}), name, icon: fd.get("icon") || "🎁", price, repeatable, cooldownDays: repeatable ? +fd.get("cooldown") || 0 : 0, pinned, reserved: pinned ? Math.min(+(x && x.reserved) || 0, price) : 0});
    closeAll(); toast(x ? "Saved" : "Reward added");
  },
  reserve: (fd, f) => {
    const r = S.rewards[f.dataset.id]; const s = gameState(); if (!r || !s) return;
    const n = Math.floor(num(fd.get("amt"))); if (!(n > 0)) { toast("Enter how many Runes to set aside"); return; }
    const add = Math.min(n, spendable(s), r.price - (+r.reserved || 0));
    if (add <= 0) { toast(spendable(s) <= 0 ? "No free Runes to set aside" : "This reward is already covered"); return; }
    put("rewards", {...r, reserved: (+r.reserved || 0) + add}); toast(`Set aside ${fmtInt(add)} Runes`);
  },
};

const VIEWS = {today: vToday, habits: vHabits, tasks: vTasks, food: vFood, money: vMoney, train: vTrain, quests: vQuests, town: vTown};

/* ---------- sheet contents ---------- */
function sHabit(id) {
  const x = id ? S.habits[id] : null; const color = x ? x.color : COLORS[habitList().length % COLORS.length]; const freq = x ? x.freq : "daily";
  const ideas = ["Drink 2 L of water", "Read 20 minutes", "Stretch", "Walk 8,000 steps", "No phone first hour", "Meditate", "Journal", "In bed by 23:00"];
  return () => sheetHead(x ? "Edit habit" : "New habit") + `<form data-form="habit" data-id="${id || ""}" class="stack">
    <label class="field"><span>Name</span><input id="h-name" name="name" required maxlength="60" value="${esc(x ? x.name : "")}" placeholder="e.g. Read 20 minutes" autocomplete="off" autofocus></label>
    ${x ? "" : `<div class="chips">${ideas.map(i => `<button type="button" class="chip" data-act="fill" data-target="h-name" data-v="${esc(i)}">${esc(i)}</button>`).join("")}</div>`}
    <div class="field"><span>How often</span><div class="seg" role="group"><button type="button" data-act="radio" data-name="freq" data-v="daily" aria-pressed="${freq === "daily"}">Every day</button><button type="button" data-act="radio" data-name="freq" data-v="weekly" aria-pressed="${freq === "weekly"}">Times per week</button></div><input type="hidden" name="freq" value="${freq}"></div>
    <label class="field" data-show="freq=weekly" ${freq === "weekly" ? "" : "hidden"}><span>Times per week</span><input name="goal" type="number" min="1" max="7" value="${x && x.goal ? x.goal : 3}"></label>
    <div class="field" data-show="freq=daily" ${freq === "daily" ? "" : "hidden"}><span>On these days</span>${multiDays("days", x && x.days, "Habit days")}</div>
    <div class="field"><span>Color</span><div class="swatches">${COLORS.map(c => `<button type="button" class="sw" style="--c:var(${c})" data-act="radio" data-name="color" data-v="${c}" aria-pressed="${c === color}" aria-label="Color ${c.slice(3)}"></button>`).join("")}</div><input type="hidden" name="color" value="${color}"></div>
    <div class="sh-foot">${x ? `<button type="button" class="btn danger" data-act="del-habit" data-id="${x.id}" data-confirm="Tap again to delete">Delete</button>` : ""}<button class="btn pri">${x ? "Save" : "Add habit"}</button></div></form>`;
}
function sHabitDetail(id) {
  return () => {
    const x = S.habits[id]; if (!x) return sheetHead("Habit") + `<p class="faint">This habit was deleted.</p>`;
    const weeks = 20; const start = addDays(startOfWeek(new Date()), -7 * (weeks - 1)); const t = today();
    let cells = ""; for (let i = 0; i < weeks * 7; i++) { const k = dkey(addDays(start, i)); cells += `<i class="${k > t ? "fut" : hDone(x, k) ? "on" : ""}" title="${fmtDate(k)}"></i>`; }
    const total = Object.keys(x.done || {}).length;
    return sheetHead(x.name, `<button class="ibtn" data-act="edit-habit" data-id="${id}" aria-label="Edit">${icon("edit")}</button>`) +
      `<div class="tiles" style="margin-bottom:14px">${statTile("Streak", habitStreak(x), x.freq === "weekly" ? "weeks" : "days")}${statTile("Best", habitBest(x), x.freq === "weekly" ? "weeks" : "days")}${statTile(x.freq === "weekly" ? "8-week rate" : "30-day rate", Math.round(habitRate(x) * 100) + "%")}${statTile("Total", total, "check-ins")}</div>
      <section class="card"><div class="card-h"><h2>Last 20 weeks</h2><span class="small faint">${x.freq === "weekly" ? `goal ${x.goal}× per week` : "every day"}</span></div><div class="heat" style="--c:var(${x.color})">${cells}</div></section>
      <button class="btn block ${hDone(x, t) ? "ghost" : "pri"}" style="margin-top:14px" data-act="toggle-habit" data-id="${id}" data-d="${t}">${hDone(x, t) ? "Undo today" : "Mark done today"}</button>`;
  };
}
function sTask(id, kind) {
  const x = id ? S.tasks[id] : null; const k = x ? x.kind : kind || (ui.taskTab || "todo"); const pr = x ? x.priority || 0 : 0;
  return () => sheetHead(x ? "Edit task" : "New task") + `<form data-form="task" data-id="${id || ""}" class="stack">
    <label class="field"><span>Task</span><input id="t-title" name="title" required maxlength="120" value="${esc(x ? x.title : "")}" placeholder="What needs doing?" autocomplete="off" autofocus></label>
    <div class="field"><span>Repeats</span><div class="seg" role="group">${[["todo", "Once"], ["daily", "Daily"], ["weekly", "Weekly"], ["monthly", "Monthly"]].map(([v, l]) => `<button type="button" data-act="radio" data-name="kind" data-v="${v}" aria-pressed="${k === v}">${l}</button>`).join("")}</div><input type="hidden" name="kind" value="${k}"></div>
    <label class="field" data-show="kind=todo" ${k === "todo" ? "" : "hidden"}><span>Due date</span><input name="due" type="date" value="${x && x.due ? x.due : ""}"></label>
    <div class="field" data-show="kind=daily" ${k === "daily" ? "" : "hidden"}><span>On these days</span>${multiDays("days", x && x.days, "Task days")}</div>
    <div class="field"><span>Priority</span><div class="seg" role="group">${[[0, "Normal"], [1, "Medium"], [2, "High"]].map(([v, l]) => `<button type="button" data-act="radio" data-name="priority" data-v="${v}" aria-pressed="${pr === v}">${l}</button>`).join("")}</div><input type="hidden" name="priority" value="${pr}"></div>
    <label class="field"><span>Notes</span><textarea name="notes" maxlength="500" placeholder="Optional">${esc(x ? x.notes || "" : "")}</textarea></label>
    <div class="sh-foot">${x ? `<button type="button" class="btn danger" data-act="del-task" data-id="${x.id}" data-confirm="Tap again to delete">Delete</button>` : ""}<button class="btn pri">${x ? "Save" : "Add task"}</button></div></form>`;
}
function sTx(id, type) {
  const x = id ? S.tx[id] : null; const ty = x ? x.type : type || "expense";
  return () => {
    const cats = ty === "income" ? S.settings.incomeCats : S.settings.expenseCats; const cat = x ? x.cat : cats[0];
    return sheetHead(x ? "Edit transaction" : ty === "income" ? "Add income" : "Add expense") + `<form data-form="tx" data-id="${id || ""}" class="stack">
    <div class="seg" role="group"><button type="button" data-act="tx-type" data-v="expense" aria-pressed="${ty === "expense"}">Expense</button><button type="button" data-act="tx-type" data-v="income" aria-pressed="${ty === "income"}">Income</button></div><input type="hidden" name="type" value="${ty}">
    <label class="field"><span>Amount (${esc(S.settings.currency)})</span><input id="tx-amt" class="amount" name="amount" inputmode="decimal" required value="${x ? x.amount : ""}" placeholder="0.00" autocomplete="off" autofocus></label>
    <div class="field"><span>Category</span><div class="chips">${cats.map(c => `<button type="button" class="chip" data-act="radio" data-name="cat" data-v="${esc(c)}" aria-pressed="${c === cat}">${esc(c)}</button>`).join("")}</div><input type="hidden" name="cat" value="${esc(cat)}"></div>
    <div class="fgrid"><label class="field"><span>Date</span><input name="date" type="date" required value="${x ? x.date : today()}"></label><label class="field"><span>Note</span><input name="note" maxlength="80" value="${esc(x ? x.note || "" : "")}" placeholder="Optional" autocomplete="off"></label></div>
    <div class="sh-foot">${x ? `<button type="button" class="btn danger" data-act="del-tx" data-id="${x.id}" data-confirm="Tap again to delete">Delete</button>` : ""}<button class="btn pri">${x ? "Save" : "Add"}</button></div></form>`;
  };
}
let txDraftType = null;
function sBudgets() {
  const B = S.settings.budgets || {};
  return () => sheetHead("Monthly budget") + `<form data-form="budgets" class="stack"><label class="field"><span>Total monthly limit (${esc(S.settings.currency)})</span><input name="budget" inputmode="decimal" value="${S.settings.budget || ""}" placeholder="e.g. 1500" autofocus></label>
    <div class="label" style="margin-top:6px">Per category (optional)</div><div class="fgrid">${S.settings.expenseCats.map((c, i) => `<label class="field"><span>${esc(c)}</span><input name="b${i}" inputmode="decimal" value="${B[c] || ""}" placeholder="–"></label>`).join("")}</div>
    <div class="sh-foot"><button class="btn pri">Save budget</button></div></form>`;
}
function sSettings() {
  const s = S.settings; const curs = ["EUR", "USD", "GBP", "CHF", "RSD", "BAM", "HUF", "PLN", "CZK", "SEK", "NOK", "DKK", "CAD", "AUD"];
  if (!curs.includes(s.currency)) curs.unshift(s.currency);
  return () => sheetHead("Settings") + `<form data-form="settings" class="stack">
    <label class="field"><span>Your name, for the greeting</span><input name="name" maxlength="40" value="${esc(s.name)}" autocomplete="off"></label>
    <div class="fgrid"><label class="field"><span>Currency</span><select name="currency">${curs.map(c => `<option ${c === s.currency ? "selected" : ""}>${c}</option>`).join("")}</select></label>
    <label class="field"><span>Weight unit</span><select name="unit"><option value="kg" ${s.unit === "kg" ? "selected" : ""}>kg</option><option value="lb" ${s.unit === "lb" ? "selected" : ""}>lb</option></select></label>
    <label class="field"><span>Rest timer (seconds)</span><input name="rest" type="number" min="15" max="600" step="15" value="${s.rest}"></label>
    <label class="field"><span>Workouts per week goal</span><input name="weeklyWorkouts" type="number" min="0" max="14" value="${s.weeklyWorkouts}"></label></div>
    <label class="field"><span>Expense categories, one per line</span><textarea name="expenseCats" rows="5">${esc(s.expenseCats.join("\n"))}</textarea></label>
    <label class="field"><span>Income categories, one per line</span><textarea name="incomeCats" rows="3">${esc(s.incomeCats.join("\n"))}</textarea></label>
    <div class="sh-foot" style="margin-top:4px"><button class="btn pri">Save settings</button></div></form>
    <section class="card" style="margin-top:18px"><div class="card-h"><h2>Look</h2></div><div class="seg g3" role="group" aria-label="Theme">${THEMES.map(([k, l]) => `<button type="button" data-act="theme" data-v="${k}" aria-pressed="${themePick() === k}">${l}</button>`).join("")}</div><p class="small muted" style="margin-top:10px">Night is dark stone and Erdtree gold. Leyndell is the same pieces in pale limestone.</p></section>
    <section class="card" style="margin-top:14px"><div class="card-h"><h2>Adventure</h2><span class="pill">${gameOn() ? "On" : s.game && s.game.start ? "Off" : "Not started"}</span></div><p class="small muted" style="margin-bottom:12px">${gameOn() ? "Your habits, tasks, steps and workouts are quests that earn XP and Runes." : s.game && s.game.start ? "Your hero, Runes and gear are waiting. The days while the game was off count as rest days." : "Create a hero and turn your habits, tasks, steps and workouts into quests."}</p>${gameOn() ? `<button class="btn" data-act="game-settings">Quest settings</button>` : s.game && s.game.start ? `<button class="btn pri" data-act="game-on">Switch the game back on</button>` : `<button class="btn pri" data-act="start-game">Create your hero</button>`}</section>
    <section class="card" style="margin-top:14px"><div class="card-h"><h2>Your data</h2>${syncBadge()}</div><p class="small muted" style="margin-bottom:12px">${db ? "Everything saves to your account, so it's the same on your phone and computer." : "This copy saves in this browser only."} Keep a backup file now and then. To move data from the old Daybook page, download a backup there and restore it here.</p><div class="row wrap"><button class="btn" data-act="export">Download backup</button><button class="btn ghost" data-act="import">Restore from backup</button></div></section>
    ${db ? `<section class="card" style="margin-top:14px"><div class="card-h"><h2>Apple Health</h2><span class="pill" id="hl-state">${healthInfo === undefined ? "Checking…" : healthInfo ? "Connected" : "Not set up"}</span></div><p class="small muted" style="margin-bottom:12px">${healthInfo && healthInfo.last_used ? `Last steps received ${esc(new Date(healthInfo.last_used).toLocaleString(undefined, {weekday: "short", hour: "2-digit", minute: "2-digit"}))}.` : "An iPhone Shortcut sends your steps from Apple Health every evening."}</p><button class="btn" data-act="health-setup">${healthInfo ? "Shortcut setup" : "Set up iPhone sync"}</button></section>
    <section class="card" style="margin-top:14px"><div class="card-h"><h2>Account</h2></div><p class="small muted" style="margin-bottom:12px">Signed in as ${esc((account.user && account.user.email) || "")}.</p><button class="btn ghost" data-act="sign-out" data-confirm="Tap again to sign out">Sign out</button></section>` : ""}`;
}
let healthInfo, healthToken = null, healthBusy = false;
async function refreshHealthInfo() { try { healthInfo = await healthTokenInfo() || null; } catch { healthInfo = null; } if (stack.length) paintSheet(); if (ui.tab === "train") scheduleRender(); }
function sHealth() {
  // The public app key rides in the address, so the Shortcut needs no headers.
  const ep = cloudConfig.url + "/rest/v1/rpc/ingest_health?apikey=" + encodeURIComponent(cloudConfig.key);
  const code = (id, v) => `<div class="row" style="gap:8px;align-items:stretch"><div class="health-code grow" id="${id}">${esc(v)}</div><button class="btn sm ghost" data-act="copy-text" data-src="${id}">Copy</button></div>`;
  return () => sheetHead("iPhone Health sync") + `<div class="stack" style="gap:16px">
    <p class="small muted">Apple only lets apps from the App Store read Health, so a Shortcut on your iPhone reads your steps and sends them here. You set it up once, then it runs by itself every evening.</p>
    <section class="stack" style="gap:8px"><div class="label">1 · Your personal key</div>
      ${healthToken ? `<p class="small">Copy it now. For your safety it's only shown this once.</p>${code("hk-token", healthToken)}`
        : `<p class="small muted">${healthInfo ? "A key already exists. Making a new one stops the old Shortcut until you paste the new key into it." : "The Shortcut uses this key to send steps to your account, and nothing else."}</p><button class="btn ${healthInfo ? "ghost" : "pri"}" data-act="health-token" ${healthBusy ? "disabled" : ""}>${healthInfo ? "Make a new key" : "Create my key"}</button>`}
    </section>
    <section class="stack" style="gap:8px"><div class="label">2 · The address for the Shortcut</div>
      ${code("hk-url", ep)}
    </section>
    <section class="stack" style="gap:8px"><div class="label">3 · Build the Shortcut</div>
      <ol class="small muted howto">
        <li>Open <b>Shortcuts</b>, tap <b>+</b> and name it “Daybook Health”.</li>
        <li>Add <b>Find Health Samples</b>. Set Type to <b>Steps</b>, add the filter <b>Start Date is in the last 7 days</b>, and set <b>Group By</b> to <b>Day</b>.</li>
        <li>Add <b>Repeat with Each</b> on the Health Samples.</li>
        <li>Inside the repeat, add <b>Format Date</b> on Repeat Item's <b>Start Date</b>, with Date Format <b>Custom</b> and <b>yyyy-MM-dd</b>.</li>
        <li>Still inside, add a <b>Text</b> action with <b>Formatted Date</b>, a space, then Repeat Item's <b>Value</b>.</li>
        <li>After End Repeat, add <b>Combine Text</b> on Repeat Results, with <b>New Lines</b>.</li>
        <li>Add <b>Get Contents of URL</b> with the address above. Tap the arrow and set Method to <b>POST</b>. Leave Headers empty. Set Request Body to <b>JSON</b> and add two Text fields: <b>p_token</b> with your personal key, and <b>p_text</b> with the Combined Text.</li>
        <li>Run it once. Your steps show up in Train › Steps within a few seconds.</li>
      </ol>
    </section>
    <section class="stack" style="gap:8px"><div class="label">4 · Make it automatic</div>
      <p class="small muted">In Shortcuts, open <b>Automation</b>, tap <b>+</b>, pick <b>Time of Day</b> (for example 21:30, daily), choose <b>Run Immediately</b>, and select “Daybook Health”. It sends the last 7 days each time, so a missed evening fills itself in the next day. Grouping by day keeps iPhone and Apple Watch steps from being counted twice.</p>
    </section>
    <p class="small ${healthInfo && healthInfo.last_used ? "" : "faint"}">${healthInfo && healthInfo.last_used ? `Last steps received ${esc(new Date(healthInfo.last_used).toLocaleString())}.` : "Nothing received yet."} <button class="linkbtn" data-act="health-refresh">Check again</button></p>
  </div>`;
}
function sImport() {
  return () => sheetHead("Restore from backup") + `<div class="stack"><p class="small muted">Pick a Daybook backup file (.json). Entries in the backup are added to what you have now; matching entries are replaced.</p><input type="file" id="imp-file" accept=".json,application/json"><label class="field"><span>Or paste the backup text</span><textarea id="imp-text" rows="5" placeholder="{ &quot;habits&quot;: … }"></textarea></label><button class="btn pri" data-act="do-import">Restore</button></div>`;
}
function sExportText(json) {
  return () => sheetHead("Backup") + `<p class="small muted" style="margin-bottom:10px">Saving files isn't available here. Copy this text and keep it somewhere safe.</p><textarea id="exp-text" rows="10" readonly>${esc(json)}</textarea><button class="btn pri block" style="margin-top:10px" data-act="copy-export">Copy</button>`;
}
let draft = null;
function sSplit() {
  return () => {
    const d = draft;
    return sheetHead(d.isNew ? "New split" : "Edit split") + `<div class="stack">
      <label class="field"><span>Split name</span><input id="sp-name" data-draft="name" value="${esc(d.name)}" placeholder="e.g. Push / Pull / Legs" autocomplete="off"></label>
      ${d.days.map((day, di) => `<div class="ed-day"><div class="row"><input id="sp-d${di}" data-draft="day,${di}" value="${esc(day.name)}" aria-label="Day name" style="font-weight:700"><button class="ibtn sm" data-act="d-rm-day" data-di="${di}" data-confirm="" aria-label="Remove day">${icon("trash", 16)}</button></div>
        ${day.items.length ? `<div class="ed-item tiny faint" style="font-weight:700;letter-spacing:.05em;text-transform:uppercase"><span>Exercise</span><span style="text-align:center">Sets</span><span style="text-align:center">Min</span><span style="text-align:center">Max</span><span style="width:64px"></span></div>` : ""}
        ${day.items.map((it, ii) => `<div class="ed-item"><span class="nm">${esc(exName(it.ex))}</span><input id="sp-${di}-${ii}-s" data-draft="item,${di},${ii},sets" inputmode="numeric" value="${it.sets}" aria-label="Sets"><input id="sp-${di}-${ii}-a" data-draft="item,${di},${ii},repMin" inputmode="numeric" value="${it.repMin}" aria-label="Min reps"><input id="sp-${di}-${ii}-b" data-draft="item,${di},${ii},repMax" inputmode="numeric" value="${it.repMax}" aria-label="Max reps"><span class="row" style="gap:0"><button class="ibtn sm" data-act="d-up" data-di="${di}" data-ii="${ii}" aria-label="Move up" ${ii ? "" : "disabled style='opacity:.3'"}>${icon("up", 14)}</button><button class="ibtn sm" data-act="d-rm-ex" data-di="${di}" data-ii="${ii}" aria-label="Remove">${icon("x", 14)}</button></span></div>`).join("")}
        <button class="btn sm ghost" data-act="d-add-ex" data-di="${di}">${icon("plus", 14)}Add exercise</button></div>`).join("")}
      <button class="btn ghost" data-act="d-add-day">${icon("plus", 16)}Add a day</button>
      <div class="sh-foot">${d.isNew ? "" : `<button class="btn danger" data-act="del-split" data-id="${d.id}" data-confirm="Tap again to delete">Delete</button>`}<button class="btn pri" data-act="save-split">Save split</button></div></div>`;
  };
}
let pickerCb = null, pickerQ = "", pickerM = "";
function sPicker() {
  return () => {
    const q = pickerQ.toLowerCase();
    const list = exList().filter(e => (!q || e.name.toLowerCase().includes(q)) && (!pickerM || e.muscle === pickerM));
    const libExtra = LIB.filter(l => !S.exercises || !Object.values(S.exercises).some(e => e.name === l[0])).filter(l => (!q || l[0].toLowerCase().includes(q)) && (!pickerM || l[1] === pickerM));
    return sheetHead("Choose exercise") + `<input id="exsearch" placeholder="Search exercises" value="${esc(pickerQ)}" autocomplete="off" autofocus style="margin-bottom:10px">
      <div class="chips" style="margin-bottom:10px"><button class="chip" data-act="pk-m" data-v="" aria-pressed="${!pickerM}">All</button>${MUSCLES.map(m => `<button class="chip" data-act="pk-m" data-v="${m}" aria-pressed="${pickerM === m}">${m}</button>`).join("")}</div>
      <div id="pk-list">${list.map(e => `<button class="pick" data-act="pick-ex" data-id="${e.id}"><span class="grow"><b>${esc(e.name)}</b><br><span class="small faint">${esc(e.muscle)} · ${e.repMin}–${e.repMax} reps</span></span>${icon("plus", 18)}</button>`).join("")}
      ${libExtra.length ? `<div class="label" style="padding:14px 4px 6px">From the library</div>` + libExtra.map(l => `<button class="pick" data-act="pick-lib" data-name="${esc(l[0])}"><span class="grow"><b>${esc(l[0])}</b><br><span class="small faint">${l[1]} · ${l[3]}–${l[4]} reps</span></span>${icon("plus", 18)}</button>`).join("") : ""}</div>
      ${pickerQ && !list.some(e => e.name.toLowerCase() === q) && !libExtra.some(l => l[0].toLowerCase() === q) ? `<button class="btn block pri" style="margin-top:10px" data-act="new-exercise" data-name="${esc(pickerQ)}">${icon("plus", 16)}Create “${esc(pickerQ)}”</button>` : `<button class="btn block ghost" style="margin-top:10px" data-act="new-exercise">${icon("plus", 16)}Create a new exercise</button>`}`;
  };
}
function sExercise(id, name) {
  const x = id ? S.exercises[id] : null;
  return () => sheetHead(x ? "Edit exercise" : "New exercise") + `<form data-form="exercise" data-id="${id || ""}" class="stack">
    <label class="field"><span>Name</span><input name="name" required maxlength="60" value="${esc(x ? x.name : name || "")}" autocomplete="off" autofocus></label>
    <label class="field"><span>Main muscle</span><select name="muscle">${MUSCLES.map(m => `<option ${(x ? x.muscle : "Chest") === m ? "selected" : ""}>${m}</option>`).join("")}</select></label>
    <div class="fgrid"><label class="field"><span>Rep range min</span><input name="repMin" type="number" min="1" max="50" value="${x ? x.repMin : 8}"></label><label class="field"><span>Rep range max</span><input name="repMax" type="number" min="1" max="100" value="${x ? x.repMax : 12}"></label>
    <label class="field full"><span>Weight step when you progress (${U()})</span><input name="inc" inputmode="decimal" value="${x ? x.inc : 2.5}"></label></div>
    <p class="tiny faint">When you hit the top of the rep range on every set, Daybook suggests adding one weight step.</p>
    <div class="sh-foot">${x ? `<button type="button" class="btn danger" data-act="del-exercise" data-id="${x.id}" data-confirm="Tap again to delete">Delete</button>` : ""}<button class="btn pri">${x ? "Save" : "Create"}</button></div></form>`;
}
function sSession(id) {
  return () => {
    const s = S.sessions[id]; if (!s) return sheetHead("Workout") + `<p class="faint">This workout was deleted.</p>`;
    return sheetHead(s.name) + `<p class="muted small" style="margin-bottom:12px">${fmtDate(s.date, {weekday: "long", day: "numeric", month: "long", year: "numeric"})}</p>
      <div class="tiles t3" style="margin-bottom:14px">${statTile("Time", fmtDur(s.end - s.start))}${statTile("Sets", sessSets(s))}${statTile("Volume", fmtVol(sessVol(s)))}</div>
      ${s.prs && s.prs.length ? `<div class="card" style="margin-bottom:12px;background:var(--good-soft);border-color:transparent"><b style="color:var(--good)">Personal records</b><div class="small" style="margin-top:4px">${s.prs.map(esc).join("<br>")}</div></div>` : ""}
      <div class="stack" style="gap:10px">${s.entries.map(e => `<div class="card" style="padding:12px 14px"><b>${esc(exName(e.ex))}</b><div class="mono small muted" style="margin-top:4px">${e.sets.map(x => `${+x.w} ${U()} × ${x.r}${x.rir !== "" && x.rir != null ? ` @${x.rir}` : ""}`).join("<br>")}</div></div>`).join("")}</div>
      <div class="sh-foot"><button class="btn danger" data-act="del-session" data-id="${id}" data-confirm="Tap again to delete">Delete workout</button></div>`;
  };
}
function sSummary(s) {
  return () => sheetHead("Workout saved") + `<div class="tiles t3" style="margin-bottom:14px">${statTile("Time", fmtDur(s.end - s.start))}${statTile("Sets", sessSets(s))}${statTile("Volume", fmtVol(sessVol(s)))}</div>
    ${s.prs.length ? `<div class="card" style="background:var(--good-soft);border-color:transparent;margin-bottom:12px"><b style="color:var(--good)">${s.prs.length} personal record${s.prs.length > 1 ? "s" : ""}</b><div class="small" style="margin-top:4px">${s.prs.map(esc).join("<br>")}</div></div>` : `<p class="muted small" style="margin-bottom:12px">No new records this time. Consistency is what moves the numbers.</p>`}
    <button class="btn pri block" data-act="close">Done</button>`;
}
function sQuick() {
  return () => sheetHead("Add") + `<div class="stack" style="gap:8px">
    <button class="pick" data-act="add-food"><span class="dot" style="--c:var(--c-food)"></span><span class="grow"><b>Food</b></span>${icon("right", 16)}</button>
    <button class="pick" data-act="add-tx" data-type="expense"><span class="dot" style="--c:var(--c-money)"></span><span class="grow"><b>Expense</b></span>${icon("right", 16)}</button>
    <button class="pick" data-act="add-tx" data-type="income"><span class="dot" style="--c:var(--c-money)"></span><span class="grow"><b>Income</b></span>${icon("right", 16)}</button>
    <button class="pick" data-act="add-task"><span class="dot" style="--c:var(--c-task)"></span><span class="grow"><b>Task</b></span>${icon("right", 16)}</button>
    <button class="pick" data-act="add-habit"><span class="dot" style="--c:var(--c-habit)"></span><span class="grow"><b>Habit</b></span>${icon("right", 16)}</button>
    <button class="pick" data-act="go-train"><span class="dot" style="--c:var(--c-train)"></span><span class="grow"><b>Workout</b></span>${icon("right", 16)}</button>
    <button class="pick" data-act="go-weight"><span class="dot" style="--c:var(--s7)"></span><span class="grow"><b>Body weight</b></span>${icon("right", 16)}</button></div>`;
}

/* ---------- workout actions ---------- */
function newEntry(exId, sets, rmin, rmax) {
  const s = suggest(exId, rmin, rmax, sets);
  return {ex: exId, repMin: rmin, repMax: rmax, sets: Array.from({length: sets}, (_, i) => ({w: s.w != null ? s.w : "", r: s.reps[i] || rmax, rir: "", done: false}))};
}
let wakeLock = null;
async function keepAwake() { try { if (navigator.wakeLock && !wakeLock) { wakeLock = await navigator.wakeLock.request("screen"); wakeLock.addEventListener("release", () => { wakeLock = null; }); } } catch {} }
function startWorkout(split, day) {
  if (S.active) { toast("Finish or discard your current workout first."); ui.tab = "train"; ui.trainTab = "workout"; saveUi(); render(); return; }
  const a = {id: uid(), start: Date.now(), splitId: split ? split.id : null, dayId: day ? day.id : null, name: day ? day.name : "Workout", entries: day ? day.items.map(it => newEntry(it.ex, +it.sets || 3, +it.repMin || 8, +it.repMax || 12)) : []};
  setActive(a, true); ui.tab = "train"; ui.trainTab = "workout"; saveUi(); closeAll(); render(); window.scrollTo(0, 0); keepAwake();
}
function finishWorkout() {
  const a = S.active; if (!a) return;
  const entries = a.entries.map(e => ({ex: e.ex, repMin: e.repMin, repMax: e.repMax, sets: e.sets.filter(s => s.done && (+s.r > 0)).map(s => ({w: +s.w || 0, r: +s.r, rir: s.rir === "" || s.rir == null ? "" : +s.rir}))})).filter(e => e.sets.length);
  if (!entries.length) { toast("Tick off at least one set, or discard the workout."); return; }
  const prs = [];
  entries.forEach(e => {
    const prev = exStats(e.ex); if (!prev.length) return;
    const best = Math.max(...prev.map(p => p.e1rm)), bestW = Math.max(...prev.map(p => p.top));
    const nb = Math.max(...e.sets.map(s => e1rm(s.w, s.r))), nw = Math.max(...e.sets.map(s => s.w));
    if (nw > bestW) prs.push(`${exName(e.ex)}: heaviest set, ${fmtW(nw)}`);
    else if (nb > best + 0.01) prs.push(`${exName(e.ex)}: est. 1RM ${fmtW(n1(nb))}`);
  });
  const s = {id: a.id, name: a.name, splitId: a.splitId, dayId: a.dayId, start: a.start, end: Date.now(), date: S.settings.game && S.settings.game.dayEnd ? GE.gameDate(new Date(a.start), S.settings.game.dayEnd) : dkey(new Date(a.start)), entries, prs};
  put("sessions", s); stopRest(); setActive(null, true);
  try { wakeLock && wakeLock.release(); } catch {}
  openSheet(sSummary(s));
}
let rest = null, restI = 0;
function startRest(sec) { rest = {end: Date.now() + sec * 1000, total: sec}; clearInterval(restI); restI = setInterval(paintRest, 250); paintRest(); }
function stopRest() { rest = null; clearInterval(restI); $("#restbar").hidden = true; }
function paintRest() {
  const bar = $("#restbar"); if (!rest) { bar.hidden = true; return; }
  const left = rest.end - Date.now();
  if (left <= 0) { try { navigator.vibrate && navigator.vibrate([200, 100, 200]); } catch {} bar.innerHTML = `<span class="grow"><span class="rl">Rest over</span><br><b>Next set</b></span><button data-act="rest-skip">Dismiss</button>`; clearInterval(restI); rest = null; setTimeout(() => { if (!rest) bar.hidden = true; }, 4000); return; }
  bar.hidden = false;
  bar.innerHTML = `<div class="grow"><div class="rl">Rest</div><div class="rt">${fmtClock(left + 999)}</div></div><button data-act="rest-add" data-v="-15">−15</button><button data-act="rest-add" data-v="15">+15</button><button data-act="rest-skip">Skip</button><span class="prog" style="width:${(1 - left / (rest.total * 1000)) * 100}%"></span>`;
}
function tickTimers() {
  const a = S.active; $$("[data-elapsed]").forEach(el => { if (a) el.textContent = fmtClock(Date.now() - a.start); });
  if (focus) $$("[data-focus]").forEach(el => { el.textContent = fmtClock(Date.now() - focus.start); });
}
setInterval(tickTimers, 1000);

/* ---------- actions ---------- */
function setRadio(el) {
  const form = el.closest("form, .stack, #sheet"); const name = el.dataset.name;
  el.parentElement.querySelectorAll(`[data-name="${name}"]`).forEach(b => b.setAttribute("aria-pressed", b === el ? "true" : "false"));
  const inp = form.querySelector(`input[type=hidden][name="${name}"]`); if (inp) inp.value = el.dataset.v;
  form.querySelectorAll("[data-show]").forEach(n => { const [k, v] = n.dataset.show.split("="); if (k === name) n.hidden = el.dataset.v !== v; });
}
const A = {
  close: () => closeSheet(),
  settings: () => { openSheet(sSettings(), true); if (db) refreshHealthInfo(); },
  theme: e => { setSettings({theme: e.dataset.v}); applyTheme(); paintSheet(); },
  "health-setup": () => { healthToken = null; openSheet(sHealth(), true); refreshHealthInfo(); },
  "health-refresh": () => refreshHealthInfo(),
  "health-token": async () => {
    healthBusy = true; paintSheet();
    try { healthToken = await createHealthToken(); await refreshHealthInfo(); }
    catch (e) { console.warn(e); toast("Couldn't create a key. Check your connection and try again."); }
    healthBusy = false; paintSheet();
  },
  "copy-text": async el => { const t = document.getElementById(el.dataset.src); if (!t) return; try { await navigator.clipboard.writeText(t.textContent); toast("Copied"); } catch { const r = document.createRange(); r.selectNodeContents(t); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); toast("Selected. Copy it with your keyboard or long-press."); } },
  "sign-out": async () => { try { if (db) await db.close(); } catch {} await signOut(); },
  quick: () => openSheet(sQuick()),
  "go-train": () => { closeAll(); ui.trainTab = "workout"; go("train"); },
  "go-weight": () => { closeAll(); ui.trainTab = "progress"; go("train"); const i = $("#bw-p"); if (i) { i.scrollIntoView({block: "center"}); i.focus({preventScroll: true}); } },
  fill: el => { const i = document.getElementById(el.dataset.target); if (i) { i.value = el.dataset.v; i.focus(); } },
  radio: el => setRadio(el),
  "add-habit": () => { closeAll(); openSheet(sHabit()); },
  "edit-habit": el => openSheet(sHabit(el.dataset.id)),
  "habit-detail": el => openSheet(sHabitDetail(el.dataset.id), true),
  "toggle-habit": el => toggleHabit(el.dataset.id, el.dataset.d),
  "del-habit": el => { del("habits", el.dataset.id); closeAll(); toast("Habit deleted"); },
  "add-task": el => { closeAll(); openSheet(sTask(null, el.dataset.kind || (ui.tab === "tasks" || (ui.tab === "quests" && ui.questTab === "tasks") ? ui.taskTab : "todo"))); },
  "edit-task": el => openSheet(sTask(el.dataset.id)),
  "toggle-task": el => toggleTask(el.dataset.id, el.dataset.d),
  "del-task": el => { del("tasks", el.dataset.id); closeAll(); toast("Task deleted"); },
  "task-tab": el => { ui.taskTab = el.dataset.v; saveUi(); render(); },
  "toggle-done": () => { ui.showDone = !ui.showDone; saveUi(); render(); },
  "clear-done": () => { Object.values(S.tasks).filter(t => t.kind === "todo" && t.doneAt).forEach(t => del("tasks", t.id)); toast("Cleared completed to-dos"); },
  "add-tx": el => { closeAll(); openSheet(sTx(null, el.dataset.type)); },
  "edit-tx": el => openSheet(sTx(el.dataset.id)),
  "tx-type": el => { const f = el.closest("form"); const amt = f.amount.value, date = f.date.value, note = f.note.value; const id = f.dataset.id; stack.pop(); openSheet(sTx(id || null, el.dataset.v)); const g = $("#sheet form"); g.amount.value = amt; g.date.value = date; g.note.value = note; },
  "del-tx": el => { del("tx", el.dataset.id); closeAll(); toast("Transaction deleted"); },
  month: el => { const n = shiftMonth(ui.month, +el.dataset.d); if (n > mkey()) return; ui.month = n; saveUi(); render(); },
  budgets: () => openSheet(sBudgets()),
  "train-tab": el => { const moved = ui.tab !== "train"; ui.tab = "train"; ui.trainTab = el.dataset.v; saveUi(); closeAll(); if (moved) enterAnim(); render(); window.scrollTo(0, 0); },
  "start-day": el => { const sp = S.splits[el.dataset.split]; const d = sp && sp.days.find(x => x.id === el.dataset.day); if (d) startWorkout(sp, d); },
  "start-empty": () => startWorkout(null, null),
  resume: () => { ui.trainTab = "workout"; go("train"); },
  "set-done": el => {
    const a = S.active; const e = a.entries[+el.dataset.ei]; const st = e.sets[+el.dataset.si];
    if (!st.done) {
      const s = suggest(e.ex, e.repMin, e.repMax, e.sets.length);
      if (st.w === "" && s.w != null) st.w = s.w;
      if (st.w === "") st.w = 0;
      if (st.r === "" || st.r == null) st.r = s.reps[+el.dataset.si] || e.repMax;
      st.done = true; startRest(+S.settings.rest || 120);
    } else st.done = false;
    setActive(a); render();
  },
  "add-set": el => { const e = S.active.entries[+el.dataset.ei]; const l = e.sets[e.sets.length - 1] || {w: "", r: e.repMax}; e.sets.push({w: l.w, r: l.r, rir: "", done: false}); setActive(S.active); render(); },
  "rm-set": el => { const e = S.active.entries[+el.dataset.ei]; if (e.sets.length > 1) e.sets.pop(); setActive(S.active); render(); },
  "rm-entry": el => { S.active.entries.splice(+el.dataset.ei, 1); setActive(S.active); render(); },
  "add-ex-active": () => { pickerQ = ""; pickerM = ""; pickerCb = id => { const x = S.exercises[id]; S.active.entries.push(newEntry(id, 3, +x.repMin || 8, +x.repMax || 12)); setActive(S.active); render(); }; openSheet(sPicker()); },
  finish: () => finishWorkout(),
  discard: () => { stopRest(); setActive(null, true); render(); toast("Workout discarded"); },
  "rest-add": el => { if (rest) { rest.end += +el.dataset.v * 1000; rest.total = Math.max(1, rest.total + +el.dataset.v); paintRest(); } },
  "rest-skip": () => stopRest(),
  template: el => applyTemplate(el.dataset.name),
  "activate-split": el => { Object.values(S.splits).forEach(s => { if (s.active && s.id !== el.dataset.id) put("splits", {...s, active: false}, true); }); put("splits", {...S.splits[el.dataset.id], active: true}); },
  "new-split": () => { draft = {id: uid(), isNew: true, name: "", created: Date.now(), active: !Object.keys(S.splits).length, days: [{id: uid(), name: "Day 1", items: []}]}; openSheet(sSplit()); },
  "edit-split": el => { draft = clone(S.splits[el.dataset.id]); openSheet(sSplit()); },
  "d-add-day": () => { draft.days.push({id: uid(), name: `Day ${draft.days.length + 1}`, items: []}); paintSheet(); },
  "d-rm-day": el => { draft.days.splice(+el.dataset.di, 1); paintSheet(); },
  "d-rm-ex": el => { draft.days[+el.dataset.di].items.splice(+el.dataset.ii, 1); paintSheet(); },
  "d-up": el => { const it = draft.days[+el.dataset.di].items; const i = +el.dataset.ii; if (i > 0) { [it[i - 1], it[i]] = [it[i], it[i - 1]]; paintSheet(); } },
  "d-add-ex": el => { const di = +el.dataset.di; pickerQ = ""; pickerM = ""; pickerCb = id => { const x = S.exercises[id]; draft.days[di].items.push({ex: id, sets: 3, repMin: +x.repMin || 8, repMax: +x.repMax || 12}); }; openSheet(sPicker()); },
  "save-split": () => {
    const d = draft; if (!d.name.trim()) { toast("Give the split a name"); $("#sp-name").focus(); return; }
    const {isNew, ...rest2} = d; rest2.name = d.name.trim(); rest2.days = d.days.filter(x => x.name.trim() || x.items.length).map(x => ({...x, name: x.name.trim() || "Day", items: x.items.map(i => ({ex: i.ex, sets: Math.max(1, +i.sets || 3), repMin: Math.max(1, +i.repMin || 8), repMax: Math.max(+i.repMin || 8, +i.repMax || 12)}))}));
    if (rest2.active || !Object.values(S.splits).some(s => s.active && s.id !== rest2.id)) { Object.values(S.splits).forEach(s => { if (s.active && s.id !== rest2.id) put("splits", {...s, active: false}, true); }); rest2.active = true; }
    put("splits", rest2); closeAll(); toast("Split saved");
  },
  "del-split": el => { del("splits", el.dataset.id); closeAll(); toast("Split deleted"); },
  "pk-m": el => { pickerM = el.dataset.v; paintSheet(); },
  "pick-ex": el => { const cb = pickerCb; closeSheet(); if (cb) cb(el.dataset.id); paintSheet(); },
  "pick-lib": el => { const id = ensureExercise(el.dataset.name); const cb = pickerCb; closeSheet(); if (cb) cb(id); paintSheet(); },
  "new-exercise": el => openSheet(sExercise(null, el.dataset.name)),
  "edit-exercise": el => openSheet(sExercise(el.dataset.id)),
  "del-exercise": el => { del("exercises", el.dataset.id); closeAll(); toast("Exercise deleted. Past workouts keep their sets."); },
  session: el => openSheet(sSession(el.dataset.id), true),
  "del-session": el => { del("sessions", el.dataset.id); closeAll(); toast("Workout deleted"); },
  "prog-metric": el => { ui.progMetric = el.dataset.v; saveUi(); render(); },
  export: async () => {
    const data = {app: "daybook", version: 2, exported: new Date().toISOString(), settings: S.settings, habits: S.habits, tasks: S.tasks, tx: S.tx, body: S.body, foods: S.foods, food: S.food, water: S.water, steps: S.steps, exercises: S.exercises, splits: S.splits, sessions: S.sessions, learn: S.learn, ledger: S.ledger, gdays: S.gdays, rewards: S.rewards, inv: S.inv, hero: S.hero};
    const json = JSON.stringify(data, null, 1);
    let dl = null; try { dl = window.claude && await window.claude.use("downloads"); } catch {}
    if (dl) { try { await dl.save({filename: `daybook-backup-${today()}.json`, data: json}); toast("Backup saved"); return; } catch (e) { if (e && e.code === "declined") return; } }
    else { try { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([json], {type: "application/json"})); a.download = `daybook-backup-${today()}.json`; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); toast("Backup downloaded"); return; } catch {} }
    openSheet(sExportText(json));
  },
  "copy-export": async () => { const t = $("#exp-text"); try { await navigator.clipboard.writeText(t.value); toast("Copied"); } catch { t.select(); toast("Selected. Copy it with your keyboard or long-press."); } },
  import: () => openSheet(sImport()),
  "do-import": async () => {
    let text = $("#imp-text").value.trim(); const f = $("#imp-file").files[0];
    if (!text && f) text = await f.text();
    if (!text) { toast("Choose a backup file or paste its text"); return; }
    let data; try { data = JSON.parse(text); } catch { toast("That isn't a valid backup file"); return; }
    if (!data || typeof data !== "object" || !("habits" in data || "tx" in data || "sessions" in data)) { toast("That file doesn't look like a Daybook backup"); return; }
    let n = 0;
    if (data.settings) setSettings({...data.settings});
    if (data.hero && typeof data.hero === "object") setHero(data.hero);
    for (const col of [...DOC_COLS]) for (const v of Object.values(data[col] || {})) { if (v && v.id) { put(col, v, true); n++; } }
    for (const col of Object.keys(BUCKETS)) {
      const items = Object.values(data[col] || {}).filter(v => v && v.id && v.date);
      items.forEach(v => { S[col] = {...S[col], [v.id]: v}; n++; });
      if (db) { const byM = {}; Object.values(S[col]).forEach(v => { const m = bucketPath(col, v.date); (byM[m] = byM[m] || {})[v.id] = clone(v); }); Object.entries(byM).forEach(([m, it]) => q(m, () => withRetry(() => db.doc(m).set({items: it})))); }
    }
    saveLocal(); closeAll(); render(); toast(`Restored ${n} entries`);
  },
};

/* ---------- forms ---------- */
const num = v => { const x = parseFloat(String(v).replace(",", ".")); return isFinite(x) ? x : NaN; };
const F = {
  habit: (fd, f) => {
    const id = f.dataset.id; const x = id ? S.habits[id] : null; const name = fd.get("name").trim(); if (!name) return;
    const days = parseDays(fd.get("days")); if (fd.get("freq") === "daily" && !days.length) { toast("Pick at least one day"); return; }
    put("habits", {...(x || {id: uid(), created: Date.now(), done: {}, order: Date.now()}), name, freq: fd.get("freq"), goal: Math.min(7, Math.max(1, +fd.get("goal") || 3)), color: fd.get("color"), days: fd.get("freq") === "daily" && days.length < 7 ? days : null});
    closeAll(); if (!x) toast("Habit added");
  },
  task: (fd, f) => {
    const id = f.dataset.id; const x = id ? S.tasks[id] : null; const title = fd.get("title").trim(); if (!title) return;
    const kind = fd.get("kind"); const days = parseDays(fd.get("days"));
    if (kind === "daily" && !days.length) { toast("Pick at least one day"); return; }
    put("tasks", {...(x || {id: uid(), created: Date.now(), done: {}, doneAt: null}), title, kind, due: kind === "todo" ? fd.get("due") || null : null, priority: +fd.get("priority") || 0, notes: fd.get("notes").trim(), days: kind === "daily" && days.length < 7 ? days : null});
    closeAll(); if (!x) toast("Task added");
  },
  "quick-task": (fd, f) => {
    const title = fd.get("title").trim(); if (!title) return;
    put("tasks", {id: uid(), created: Date.now(), title, kind: ui.taskTab, due: null, priority: 0, notes: "", done: {}, doneAt: null});
    f.reset(); setTimeout(() => { const i = $("#qtask"); if (i) i.focus(); }, 0);
  },
  tx: (fd, f) => {
    const id = f.dataset.id; const x = id ? S.tx[id] : null; const amount = num(fd.get("amount"));
    if (!(amount > 0)) { toast("Enter an amount above zero"); $("#tx-amt").focus(); return; }
    put("tx", {...(x || {id: uid(), created: Date.now()}), type: fd.get("type"), amount: Math.round(amount * 100) / 100, cat: fd.get("cat"), date: fd.get("date") || today(), note: fd.get("note").trim()});
    closeAll(); toast(x ? "Saved" : `${fd.get("type") === "income" ? "Income" : "Expense"} of ${money(amount)} added`);
  },
  budgets: fd => {
    const budgets = {}; S.settings.expenseCats.forEach((c, i) => { const v = num(fd.get("b" + i)); if (v > 0) budgets[c] = v; });
    const b = num(fd.get("budget")); setSettings({budget: b > 0 ? b : 0, budgets}); closeAll(); toast("Budget saved");
  },
  settings: fd => {
    const lines = v => [...new Set(String(v).split("\n").map(s => s.trim()).filter(Boolean))];
    const ec = lines(fd.get("expenseCats")), ic = lines(fd.get("incomeCats"));
    setSettings({name: fd.get("name").trim(), currency: fd.get("currency"), unit: fd.get("unit"), rest: Math.max(15, +fd.get("rest") || 120), weeklyWorkouts: Math.max(0, +fd.get("weeklyWorkouts") || 0), expenseCats: ec.length ? ec : EXP_CATS, incomeCats: ic.length ? ic : INC_CATS});
    closeAll(); toast("Settings saved");
  },
  exercise: (fd, f) => {
    const id = f.dataset.id; const x = id ? S.exercises[id] : null; const name = fd.get("name").trim(); if (!name) return;
    const rmin = Math.max(1, +fd.get("repMin") || 8);
    const ex = {...(x || {id: uid(), created: Date.now()}), name, muscle: fd.get("muscle"), repMin: rmin, repMax: Math.max(rmin, +fd.get("repMax") || 12), inc: num(fd.get("inc")) > 0 ? num(fd.get("inc")) : 2.5};
    put("exercises", ex);
    const cb = pickerCb;
    if (!x && cb && stack.length >= 2) { stack.pop(); stack.pop(); cb(ex.id); paintSheet(); } else closeSheet();
  },
  body: fd => {
    const kg = num(fd.get("kg")); if (!(kg > 0 && kg < 1000)) { toast("Enter your weight as a number"); return; }
    const d = today(); put("body", {id: d, date: d, kg: n1(kg)}); toast(`Logged ${fmtW(n1(kg))}`);
  },
};

Object.assign(A, FOOD_ACTIONS, STEP_ACTIONS, GAME_ACTIONS); Object.assign(F, FOOD_FORMS, STEP_FORMS, GAME_FORMS);

/* ---------- events ---------- */
document.addEventListener("click", e => {
  const t = e.target.closest("[data-act],[data-tab]"); if (!t || t.disabled) return;
  if (t.dataset.tab && !t.dataset.act) { closeAll(); go(t.dataset.tab); return; }
  if (t.dataset.confirm !== undefined && !t.dataset.armed) {
    t.dataset.armed = "1"; const old = t.innerHTML; if (t.dataset.confirm) t.textContent = t.dataset.confirm; else t.style.color = "var(--bad)";
    setTimeout(() => { if (t.isConnected) { delete t.dataset.armed; t.innerHTML = old; t.style.color = ""; } }, 3000); return;
  }
  if (/^toggle-(habit|task)$|^set-done$/.test(t.dataset.act)) { const q = (k, v) => v != null ? `[data-${k}="${CSS.escape(v)}"]` : ""; popSel = `[data-act="${t.dataset.act}"]${q("id", t.dataset.id)}${q("d", t.dataset.d)}${q("ei", t.dataset.ei)}${q("si", t.dataset.si)}`; popAt = Date.now(); }
  gWatch = Date.now();
  const fn = A[t.dataset.act]; if (fn) fn(t, e);
});
document.addEventListener("submit", e => { const f = e.target; if (f.dataset.form && F[f.dataset.form]) { e.preventDefault(); F[f.dataset.form](new FormData(f), f); } });
document.addEventListener("input", e => {
  const el = e.target;
  if (el.dataset.set && S.active) { const [ei, si, k] = el.dataset.set.split(","); const st = S.active.entries[+ei].sets[+si]; st[k] = el.value.replace(",", "."); setActive(S.active); }
  else if (el.dataset.draft && draft) { const p = el.dataset.draft.split(","); if (p[0] === "name") draft.name = el.value; else if (p[0] === "day") draft.days[+p[1]].name = el.value; else if (p[0] === "item") draft.days[+p[1]].items[+p[2]][p[3]] = el.value; }
  else if (el.id === "foodsearch") { foodQ = el.value; clearTimeout(fsT); fsT = setTimeout(() => { const fr = $("#food-results"); if (fr) fr.innerHTML = foodResults(); }, 120); }
  else if (el.dataset.portion && portion) { portion[el.dataset.portion] = el.value; if (el.dataset.portion === "unit") { const s0 = portion.food.servings[+el.value]; const a = $("#pt-amt"); if (el.value === "g") portion.amount = Math.round(portionGramsFromPrev || 100); else if (el.value === "oz") portion.amount = 3; else portion.amount = 1; if (a) a.value = portion.amount; } $("#pt-prev").innerHTML = portionPreview(); }
  else if (el.id === "exsearch") { pickerQ = el.value; paintSheet(); const i = $("#exsearch"); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
  else if (el.dataset.calc === "1rm") $("#o-1rm").innerHTML = calc1rm();
  else if (el.dataset.calc === "plates") $("#o-plates").innerHTML = calcPlates();
});
let fsT = 0, portionGramsFromPrev = 100;
document.addEventListener("focusin", e => { if (e.target.id === "pt-unit" && portion) portionGramsFromPrev = portionGrams() || 100; });
document.addEventListener("change", async e => {
  const el = e.target;
  if (el.id === "bc-file" && el.files[0]) {
    const st = $("#bc-status"); st.hidden = false; st.style.color = ""; st.textContent = "Reading the barcode…";
    let code = null; try { code = await decodeBarcode(el.files[0]); } catch {}
    el.value = "";
    if (code) lookupBarcode(code); else { st.textContent = "Couldn't find a barcode in that photo. Try again closer, with the lines straight and in focus, or type the number."; st.style.color = "var(--warn)"; }
    return;
  }
  if (el.id === "health-file" && el.files[0]) { const file = el.files[0]; el.value = ""; onHealthFile(file); return; }
  if (el.id === "label-file" && el.files[0]) { const file = el.files[0]; el.value = ""; readLabel(file); return; }
});
document.addEventListener("change", e => { const el = e.target; if (el.dataset.change === "progEx") { ui.progEx = el.value; saveUi(); render(); } });
document.addEventListener("keydown", e => { if (e.key === "Escape" && stack.length) closeSheet(); });
$("#scrim").addEventListener("click", () => closeSheet());
document.addEventListener("pointermove", e => { const c = e.target.closest && e.target.closest(".chart"); if (c) chartHover(c, e); else if (!$("#tip").hidden) { hideTip(); $$(".chart").forEach(x => hideTip(x)); } }, {passive: true});
document.addEventListener("pointerdown", e => { const c = e.target.closest && e.target.closest(".chart"); if (c) chartHover(c, e); }, {passive: true});
let rzT = 0; addEventListener("resize", () => { clearTimeout(rzT); rzT = setTimeout(drawCharts, 120); });
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") { scheduleRender(); if (S.active) keepAwake(); } });
let dayNow = today(); setInterval(() => { if (today() !== dayNow) { dayNow = today(); scheduleRender(); } }, 60000);

enterAnim();
render();
setTimeout(initDb, 0);
