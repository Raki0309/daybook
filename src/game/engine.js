// Pure game rules for Daybook's RPG layer. Nothing here touches the DOM or storage:
// the app passes plain data in and writes out whatever comes back. Every number
// comes from the economy config (E) and every name from the catalog (C).
import { ECONOMY } from "./economy.js";

/* ---------- dates (local calendar, so daylight saving never shifts a day) ---------- */
const pad = n => String(n).padStart(2, "0");
export const keyOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseKey = k => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d || 1); };
export const addKey = (k, n) => { const d = parseKey(k); return keyOf(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)); };
export const weekdayOf = k => (parseKey(k).getDay() + 6) % 7; // 0 = Monday
export const monthOf = k => k.slice(0, 7);
export function weekOf(k) {
  const d = parseKey(k); const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return `${t.getUTCFullYear()}-W${pad(Math.ceil(((t - y0) / 864e5 + 1) / 7))}`;
}
const createdKey = ms => (ms ? keyOf(new Date(ms)) : "0000-00-00");
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

// The game day a moment belongs to. With dayEnd "03:00", 01:30 still counts as yesterday.
export function gameDate(now, dayEnd = "00:00") {
  const [h, m] = String(dayEnd).split(":").map(Number);
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (now.getHours() * 60 + now.getMinutes() < (h || 0) * 60 + (m || 0)) d.setDate(d.getDate() - 1);
  return keyOf(d);
}

/* ---------- levels, HP, rewards ---------- */
export const xpToNext = (level, E = ECONOMY) => Math.round(E.xp.base * level ** E.xp.exp);
export function levelInfo(xp, E = ECONOMY) {
  let level = 1, left = Math.max(0, xp || 0);
  while (level < E.xp.levelCap) {
    const need = xpToNext(level, E);
    if (left < need) return { level, into: left, need, max: false };
    left -= need; level++;
  }
  return { level, into: 0, need: 0, max: true };
}
// P is the talisman perk totals from talismanPerks(); every field is optional.
export const maxHp = (level, E = ECONOMY, P = {}) => E.hp.base + E.hp.perLevel * (level - 1) + (P.maxHp || 0);
export const streakBonus = (streak, E = ECONOMY, P = {}) => Math.min(E.streakBonus.cap, E.streakBonus.perDay * (1 + (P.streakRate || 0)) * Math.max(0, streak));
export function reward(base, { verified = false, bonus = 0 } = {}, E = ECONOMY, P = {}) {
  const m = (verified ? E.earn.verifiedMult : 1) * (1 + bonus);
  return { xp: Math.round(base.xp * m * (1 + (P.xpPct || 0) / 100)), gold: Math.round(base.gold * m * (1 + (P.goldPct || 0) / 100)) };
}
export const dayDamage = (missed, E = ECONOMY, P = {}) => Math.round(Math.min(E.hp.dailyDamageCap, E.hp.missDamage * missed) * (1 - (P.dmgPct || 0) / 100));

/* ---------- quests ---------- */
function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
export const flavor = (C, cat, seed) => { const list = (C && C.quests && C.quests[cat]) || []; return list.length ? list[hash(seed) % list.length] : ""; };

// Index tracker data once so each day's lookup is cheap.
export function indexData(data) {
  const sess = {}, learn = {};
  (data.sessions || []).forEach(s => { (sess[s.date] ||= []).push(s); });
  (data.learn || []).forEach(e => { const o = (learn[e.date] ||= { min: 0, timer: 0 }); o.min += +e.min || 0; if (e.timer) o.timer += +e.min || 0; });
  return { ...data, sess, learnBy: learn, habits: data.habits || [], tasks: data.tasks || [], steps: data.steps || {} };
}
const liveLogged = s => !!(s.start && s.end && s.end > s.start);

// The daily quests scheduled on day k, in board order.
export function dailiesOn(ix, G, k, E = ECONOMY) {
  const wd = weekdayOf(k); const out = [];
  const goal = +(ix.stepGoal || 0);
  if (G.steps !== false && goal > 0) {
    const e = ix.steps[k]; const n = e ? +e.n || 0 : 0;
    out.push({ key: "steps", cat: "steps", stat: "end", done: n >= goal, verified: !!e && n >= goal && E.verifiedStepSources.includes(e.src), progress: { v: n, goal } });
  }
  if ((G.workoutDays || []).includes(wd)) {
    const ss = ix.sess[k] || [];
    out.push({ key: "workout", cat: "workout", stat: "str", done: ss.length > 0, verified: ss.some(liveLogged), progress: { v: ss.length, goal: 1 } });
  }
  const L = G.learn || {};
  if (L.on && (L.days || ALL_DAYS).includes(wd)) {
    const g = +L.goalMin || E.learning.defaultGoalMin; const l = ix.learnBy[k] || { min: 0, timer: 0 };
    out.push({ key: "learn", cat: "learn", stat: "int", done: l.min >= g, verified: l.timer >= g, progress: { v: l.min, goal: g } });
  }
  for (const h of ix.habits) {
    if (h.archived || h.freq === "weekly" || createdKey(h.created) > k || !(h.days || ALL_DAYS).includes(wd)) continue;
    out.push({ key: "habit:" + h.id, cat: "habit", stat: "dis", ref: h.id, name: h.name, done: !!(h.done && h.done[k]), verified: false });
  }
  for (const t of ix.tasks) {
    if (t.kind !== "daily" || createdKey(t.created) > k || !(t.days || ALL_DAYS).includes(wd)) continue;
    out.push({ key: "task:" + t.id, cat: "task", stat: "dis", ref: t.id, name: t.title, done: !!(t.done && t.done[k]), verified: false });
  }
  const order = G.order || [];
  const rank = q => { const i = order.indexOf(q.key); return i < 0 ? order.length : i; };
  return out.map((q, i) => ({ q, i })).sort((a, b) => rank(a.q) - rank(b.q) || a.i - b.i).map(o => o.q);
}

// Weekly and monthly tasks and times-per-week habits, for the period that contains day k.
export function periodicOn(ix, k) {
  const out = []; const wk = weekOf(k), mo = monthOf(k);
  for (const t of ix.tasks) {
    if ((t.kind !== "weekly" && t.kind !== "monthly") || createdKey(t.created) > k) continue;
    const period = t.kind === "weekly" ? wk : mo;
    out.push({ key: "task:" + t.id, cat: "task", stat: "dis", ref: t.id, name: t.title, kind: t.kind, period, done: !!(t.done && t.done[period]) });
  }
  for (const h of ix.habits) {
    if (h.archived || h.freq !== "weekly" || createdKey(h.created) > k) continue;
    const s = parseKey(k); s.setDate(s.getDate() - weekdayOf(k)); const mon = keyOf(s);
    let n = 0; for (let i = 0; i < 7; i++) if (h.done && h.done[addKey(mon, i)]) n++;
    const goal = h.goal || 1;
    out.push({ key: "habit:" + h.id, cat: "habit", stat: "dis", ref: h.id, name: h.name, kind: "weekly", period: wk, done: n >= goal, progress: { v: n, goal } });
  }
  return out;
}

// The four quest streaks besides the overall one. Habits and daily tasks share "discipline".
export const STREAK_TYPES = ["steps", "workouts", "learning", "discipline"];
const TYPE_OF = { steps: "steps", workout: "workouts", learn: "learning", habit: "discipline", task: "discipline" };
// For each streak type scheduled that day: 1 if every quest of that type was done, else 0.
export function typeOutcome(dailies) {
  const o = {};
  for (const q of dailies) { const t = TYPE_OF[q.cat]; if (t) o[t] = (o[t] ?? 1) && (q.done ? 1 : 0); }
  return o;
}

export function outcome(dailies) {
  const sched = dailies.length, done = dailies.filter(q => q.done).length;
  return { sched, done, missed: sched - done, allClear: sched > 0 && done === sched };
}

/* ---------- ledger helpers ---------- */
export const ledgerSum = (entries, cur, upTo) => entries.reduce((s, e) => s + (e.cur === cur && (!upTo || e.date <= upTo) ? +e.amt || 0 : 0), 0);
// How many of a stackable item you hold: bought from the Armory, minus the ones used.
export function heldCount(id, ledger, G = {}) {
  const bought = Object.values(ledger || {}).filter(e => e.src === "armory" && e.srcId === id && +e.amt < 0).length;
  const used = id === "item.scroll-of-grace" ? (G.rests || []).length : id === "item.flask-of-crimson-tears" ? (G.flasks || []).length : 0;
  return Math.max(0, bought - used);
}
// Only quest income: one-off rewards (the tutorial, level-ups) would make a new player's days look richer than they are.
const EARN_SRC = new Set(["quest", "allclear", "periodic"]);

// Average Gold earned per day from quests over the recent window, for the Tavern's "≈ X days of quests" hint.
export function avgDailyGold(ledger, today, start, E = ECONOMY) {
  const from = addKey(today, -(E.tavern.avgDays - 1));
  const first = start && start > from ? start : from;
  const days = Math.max(1, Math.round((parseKey(today) - parseKey(first)) / 864e5) + 1);
  const g = Object.values(ledger).filter(e => e.cur === "gold" && EARN_SRC.has(e.src) && e.date >= first && e.date <= today).reduce((s, e) => s + (+e.amt || 0), 0);
  return g > 0 ? g / days : 0;
}

/* ---------- shop ---------- */
export function itemPrice(item, E = ECONOMY) {
  if (!item.purchasable) return null;
  if (item.type === "pouch") return { gold: E.talismans.pouch.gold, level: E.talismans.pouch.level };
  if (E.items[item.id]) return { gold: E.items[item.id].gold, level: E.items[item.id].level || 0 };
  const r = E.rarities[item.rarity];
  if (!r || r.gold == null) return null;
  const gold = Math.round(r.gold * (E.slotMult[item.slot] || 1) / 5) * 5;
  return { gold, level: r.level || 0 };
}
export function armoryItems(C, E = ECONOMY) {
  const max = E.rarityOrder.indexOf(E.armory.maxRarity);
  return C.items.filter(i => ["gear", "talisman", "pouch"].includes(i.type) && i.purchasable && itemPrice(i, E)
    && E.rarityOrder.indexOf(i.rarity) <= max && (E.armory.sellsWeapons || i.slot !== "weapon"));
}
// Perk totals from the equipped talismans, each kind stopped at its cap.
export function talismanPerks(ids, C, E = ECONOMY) {
  const out = {};
  for (const id of new Set(ids || [])) {
    const it = (C.items || []).find(i => i.id === id);
    if (it && it.type === "talisman") for (const [k, v] of Object.entries(it.perk || {})) out[k] = (out[k] || 0) + v;
  }
  for (const k of Object.keys(out)) out[k] = Math.min(out[k], E.talismans.caps[k] ?? out[k]);
  return out;
}
// Talisman slots: the starting slot plus one per pouch owned.
export function talismanSlots(ownedIds, C, E = ECONOMY) {
  const own = new Set(ownedIds || []);
  const pouches = (C.items || []).filter(i => i.type === "pouch" && own.has(i.id)).length;
  return Math.min(E.talismans.slotsMax, E.talismans.slotsStart + pouches);
}
// owned: true for one-of-a-kind items, or how many you hold of a stackable one.
export function canBuy(item, { level, gold, owned }, E = ECONOMY) {
  const p = itemPrice(item, E);
  if (!p) return { ok: false, reason: "not-sold" };
  const hold = E.items[item.id] && E.items[item.id].hold;
  if (hold ? +owned >= hold : owned) return { ok: false, reason: hold ? "full" : "owned", hold };
  if (level < p.level) return { ok: false, reason: "level", need: p.level };
  if (gold < p.gold) return { ok: false, reason: "gold", short: p.gold - gold };
  return { ok: true, price: p };
}
// A Tavern reward can be redeemed when it's affordable, not used up and off cooldown.
export function canRedeem(r, { gold, today }) {
  if (!r.repeatable && r.redeemedAt) return { ok: false, reason: "used" };
  if (r.cooldownDays && r.lastDate && addKey(r.lastDate, r.cooldownDays) > today) return { ok: false, reason: "cooldown", until: addKey(r.lastDate, r.cooldownDays) };
  if (gold < r.price) return { ok: false, reason: "gold", short: r.price - gold };
  return { ok: true };
}

/* ---------- weekly bounties ---------- */
// The week's bounties: the kinds your quests make possible, two picked per week (stable within
// the week), each scaled to your own schedule. recs are the simulate day records; from is the
// game's first day.
export function bountiesFor(ix, G, k, recs, E = ECONOMY, C = {}, from = "0000-00-00") {
  const mon = addKey(k, -weekdayOf(k)); const week = weekOf(k); const B = E.bounties;
  if (mon < from) return []; // bounties start with the first full week
  const days = Array.from({ length: 7 }, (_, i) => addKey(mon, i));
  const sched = days.map(d => (G.pauses || []).some(p => d >= p.from && d <= p.to) ? [] : dailiesOn(ix, G, d, E));
  const count = (cat) => sched.filter(ds => ds.some(q => q.cat === cat)).length;
  const pool = [];
  const goal = +(ix.stepGoal || 0);
  if (G.steps !== false && goal > 0) {
    const n = Math.max(B.steps.round, Math.round(goal * 7 * B.steps.ofGoalWeek / B.steps.round) * B.steps.round);
    pool.push({ key: "steps", n, v: days.reduce((a, d) => a + (ix.steps[d] ? +ix.steps[d].n || 0 : 0), 0) });
  }
  const wd = count("workout");
  if (wd) pool.push({ key: "workouts", n: wd, v: days.filter(d => (ix.sess[d] || []).length).length });
  const ld = Math.min(B.learning.days, count("learn"));
  if (ld) pool.push({ key: "learning", n: ld, v: days.filter((d, i) => sched[i].some(q => q.cat === "learn" && q.done)).length });
  const ad = Math.min(B.allclear.days, sched.filter(ds => ds.length).length);
  if (ad) pool.push({ key: "allclear", n: ad, v: days.filter(d => recs[d] && recs[d].allClear).length });
  const total = sched.reduce((a, ds) => a + ds.length, 0);
  if (total) pool.push({ key: "quests", n: Math.max(1, Math.round(total * B.quests.ofScheduled)), v: days.reduce((a, d, i) => a + (recs[d] ? recs[d].done || 0 : sched[i].filter(q => q.done).length), 0) });
  const names = (C.bounties && C.bounties.names) || [];
  return pool.sort((a, b) => hash(week + a.key) - hash(week + b.key)).slice(0, B.perWeek).map(b => ({
    ...b, week, id: `bty:${week}:${b.key}`, done: b.v >= b.n, name: names.length ? names[hash(week + b.key + "n") % names.length] : "Bounty",
    text: ((C.bounties && C.bounties.text && C.bounties.text[b.key]) || "{n}").replace("{n}", b.n.toLocaleString("en-US")),
    reward: B.reward,
  }));
}

/* ---------- the stable: Spirit Ashes, NPC companions, Torrent ---------- */
export function shopItems(C, type, E = ECONOMY) {
  return (C.items || []).filter(i => i.type === type && i.purchasable && itemPrice(i, E));
}
// st: { awakening: {id, from}, awakened: {id: date}, summoned: id, periods: {id: [[from, toExclusive|null]]} }
// Awakening counts quests completed from the day it started; Bond counts quests (and all-clears)
// on the days an ash was summoned. Both are derived from the day records, so nothing drifts.
export function stableState(st, recs, today, C = {}, E = ECONOMY) {
  st = st || {};
  const item = id => (C.items || []).find(i => i.id === id);
  const days = (from, to, f) => { let n = 0; for (let k = from; k <= to; k = addKey(k, 1)) if (recs[k]) n += f(recs[k]); return n; };
  let awakening = null;
  if (st.awakening && item(st.awakening.id)) {
    const it = item(st.awakening.id); const goal = E.stable.awakenQuests[it.rarity] || 0;
    const progress = days(st.awakening.from, today, r => r.done || 0);
    awakening = { id: it.id, progress: Math.min(goal, progress), goal, ready: progress >= goal };
  }
  const bond = {};
  for (const [id, list] of Object.entries(st.periods || {})) {
    let pts = 0;
    for (const [from, to] of list || []) pts += days(from, to ? addKey(to, -1) : today, r => (r.done || 0) * E.stable.bond.perQuest + (r.allClear ? E.stable.bond.allClear : 0));
    const lv = E.stable.bond.levels; const level = lv.filter(n => pts >= n).length;
    bond[id] = { points: pts, level, next: level < lv.length ? lv[level] : null };
  }
  return { awakening, bond };
}
// Which NPC companions your best type streaks have unlocked, with progress toward the rest.
export function npcStatus(streaks, E = ECONOMY) {
  return Object.fromEntries(Object.entries(E.stable.npcs).map(([id, n]) => {
    const s = (streaks && streaks[n.streak]) || { cur: 0, best: 0 };
    return [id, { streak: n.streak, days: n.days, cur: s.cur, best: s.best, unlocked: s.best >= n.days }];
  }));
}
// Closing the current summon and opening a new one, as a new stable doc. id null dismisses.
export function summon(st, id, today) {
  st = st || {}; const periods = Object.fromEntries(Object.entries(st.periods || {}).map(([k, v]) => [k, (v || []).map(p => [...p])]));
  if (st.summoned && periods[st.summoned]) {
    const list = periods[st.summoned]; const last = list[list.length - 1];
    if (last && last[1] == null) { if (last[0] >= today) list.pop(); else last[1] = today; }
  }
  if (id) (periods[id] ||= []).push([today, null]);
  return { ...st, periods, summoned: id || null };
}

/* ---------- onboarding ---------- */
export function stepBaseline(steps, today, E = ECONOMY) {
  const vals = [];
  for (let i = 1; i <= E.steps.baselineDays; i++) { const e = steps[addKey(today, -i)]; if (e && e.n > 0) vals.push(+e.n); }
  if (!vals.length) return null;
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  return Math.max(E.steps.round, Math.round(avg * (1 + E.steps.baselineBump) / E.steps.round) * E.steps.round);
}
// Overall streak your history already carries into day one (history pays nothing, it only seeds the streak).
// Only habits and daily tasks count: the step goal, workout days and learning are picked at the start,
// so the past could never have met them.
export function seedStreak(data, G, start, E = ECONOMY) {
  const ix = indexData(data); let run = 0, best = 0; const from = addKey(start, -E.historyDays);
  const past = { ...G, steps: false, workoutDays: [], learn: { on: false } };
  for (let k = from; k < start; k = addKey(k, 1)) {
    const o = outcome(dailiesOn(ix, past, k, E));
    if (!o.sched) continue;
    run = o.allClear ? run + 1 : 0; best = Math.max(best, run);
  }
  return { streak: run, best };
}

/* ---------- the day-end job and today's state ----------
 * input: { data, game, ledger: {id: entry}, days: {date: frozen record}, now: Date, at: ms, canWrite, E, C, perks, stable }
 * perks are the equipped talismans' totals; they apply to the days that are still open.
 * Days before yesterday are frozen: their record is stored once and never recomputed, so later
 * edits to habits or schedules can't rewrite history. Yesterday stays open until today ends, so a
 * forgotten check-off can still be fixed. Quest rewards are ledger entries with fixed ids, so
 * running this twice (or on two devices) never pays twice. */
export function simulate(input) {
  const E = input.E || ECONOMY, C = input.C || {};
  const G = input.game || {}; const now = input.now || new Date(); const P = input.perks || {};
  const today = gameDate(now, G.dayEnd || E.dayEnd.default); const yesterday = addKey(today, -1);
  // A start after today (the day boundary moved later) clamps to today.
  const start = G.start && G.start > today ? today : G.start;
  if (!start) return { active: false, today };
  const ix = indexData(input.data);
  const stored = input.ledger || {}; const frozen = input.days || {};
  const want = new Map(); // id -> entry this run expects to exist
  const slots = Math.min(E.slots.max, E.slots.start + (G.extraSlots || 0) + heldCount("item.memory-stone", input.ledger, G));
  // Rest days (a Scroll of Grace) keep streaks and cost no HP; a rekindled day keeps the overall streak.
  const rested = k => (G.rests || []).includes(k); const rekindled = k => (G.rekindles || []).includes(k);
  const payFrom = addKey(today, -E.backdateDays);
  const paused = k => (G.pauses || []).some(p => k >= p.from && k <= p.to);

  // 1. Outcomes and the overall streak, day by day from the first game day.
  const recs = {}; let run = (G.seed && G.seed.streak) || 0, best = Math.max(run, (G.seed && G.seed.best) || 0);
  const streakBefore = {};
  // Type streaks: a scheduled day either extends or breaks each type; today can only extend.
  // Days frozen before type streaks existed carry no types and are skipped.
  const trun = Object.fromEntries(STREAK_TYPES.map(t => [t, 0])), tbest = { ...trun };
  const addTypes = (types, k) => { for (const [t, met] of Object.entries(types || {})) { if (met) trun[t]++; else if (k !== today && !rested(k)) trun[t] = 0; tbest[t] = Math.max(tbest[t], trun[t]); } };
  for (let k = start; k <= today; k = addKey(k, 1)) {
    streakBefore[k] = run;
    if (frozen[k]) { recs[k] = { ...frozen[k], frozen: true }; run = rekindled(k) ? Math.max(run, frozen[k].streak ?? 0) : frozen[k].streak ?? run; best = Math.max(best, run); addTypes(frozen[k].types, k); continue; }
    // Days while the game was switched off count as rest days: no quests, no damage, streak kept.
    const off = paused(k); const dailies = off ? [] : dailiesOn(ix, G, k, E); const o = outcome(dailies);
    recs[k] = { ...o, date: k, dailies, paused: off, types: typeOutcome(dailies), rest: rested(k) };
    if (o.sched) { if (o.allClear) run++; else if (k !== today && !rested(k) && !rekindled(k)) run = 0; }
    recs[k].streak = run; best = Math.max(best, run); addTypes(recs[k].types, k);
  }

  // 2. Quest and all-clear rewards for days that aren't frozen yet.
  for (let k = start; k <= today; k = addKey(k, 1)) {
    const r = recs[k]; if (r.frozen) continue;
    const bonus = streakBonus(streakBefore[k], E, P); const inWindow = k >= payFrom;
    r.bonus = bonus;
    r.dailies.forEach((q, i) => {
      q.rewarded = i < slots;
      q.reward = reward(E.earn.daily, { verified: q.verified, bonus }, E, P);
      if (q.rewarded && q.done && (inWindow || q.verified)) {
        want.set(`q:${k}:${q.key}:xp`, { date: k, cur: "xp", amt: q.reward.xp, src: "quest", srcId: q.key });
        want.set(`q:${k}:${q.key}:gold`, { date: k, cur: "gold", amt: q.reward.gold, src: "quest", srcId: q.key });
      }
    });
    r.allClearReward = reward(E.earn.allClear, { bonus }, E, P);
    if (r.allClear && inWindow) {
      want.set(`ac:${k}:xp`, { date: k, cur: "xp", amt: r.allClearReward.xp, src: "allclear", srcId: k });
      want.set(`ac:${k}:gold`, { date: k, cur: "gold", amt: r.allClearReward.gold, src: "allclear", srcId: k });
    }
  }
  // Rewards that no longer apply (a check-off was undone) drop to zero, but only while the day can still be edited.
  for (const [id, e] of Object.entries(stored)) {
    if (!/^(q|ac):/.test(id) || want.has(id)) continue;
    const r = recs[e.date]; if (r && !r.frozen && e.date >= payFrom && (+e.amt || 0) !== 0) want.set(id, { ...e, amt: 0 });
  }

  // 3. Periodic quests for the current period (and yesterday's, if it just ended).
  const periodic = periodicOn(ix, today);
  const perKeys = new Set();
  for (const k of today === start ? [today] : [yesterday, today]) {
    if (paused(k)) continue;
    for (const p of periodicOn(ix, k)) {
      const id = `per:${p.key}:${p.period}`; if (perKeys.has(id)) continue; perKeys.add(id);
      const rw = reward(E.earn.periodic, {}, E, P); p.reward = rw;
      const old = stored[id + ":gold"];
      if (p.done) {
        const date = old && old.date ? old.date : today;
        want.set(id + ":xp", { date, cur: "xp", amt: rw.xp, src: "periodic", srcId: p.key });
        want.set(id + ":gold", { date, cur: "gold", amt: rw.gold, src: "periodic", srcId: p.key });
      } else if (old && +old.amt) {
        want.set(id + ":xp", { ...stored[id + ":xp"], amt: 0 }); want.set(id + ":gold", { ...old, amt: 0 });
      }
    }
  }
  periodic.forEach(p => { p.reward = reward(E.earn.periodic, {}, E, P); });

  // 3b. Weekly bounties: this week's, and last week's while yesterday (its last day) is still open.
  const CURS = ["xp", "gold", "essence"]; let bounties = [];
  for (const k of weekOf(yesterday) !== weekOf(today) && yesterday >= start ? [yesterday, today] : [today]) {
    const list = bountiesFor(ix, G, k, recs, E, C, start); if (k === today) bounties = list;
    for (const b of list) {
      const old = stored[b.id + ":gold"];
      if (b.done) { const date = old && old.date ? old.date : k; CURS.forEach(cur => want.set(`${b.id}:${cur}`, { date, cur, amt: b.reward[cur], src: "bounty", srcId: b.id })); }
      else if (old && +old.amt) CURS.forEach(cur => { if (stored[`${b.id}:${cur}`]) want.set(`${b.id}:${cur}`, { ...stored[`${b.id}:${cur}`], amt: 0 }); });
    }
  }

  // 4. The tutorial quest pays once, for the first quest completed after the game starts.
  const tutId = "tut:" + ((C.tutorial && C.tutorial.id) || "awakens");
  let firstDone = null;
  for (let k = start; k <= today && !firstDone; k = addKey(k, 1)) { const r = recs[k]; if (r.frozen ? r.done > 0 : r.dailies.some(q => q.done)) firstDone = k; }
  if (!firstDone && periodic.some(p => p.done)) firstDone = today;
  const tutDone = !!(stored[tutId + ":gold"] || firstDone);
  if (firstDone && !stored[tutId + ":gold"]) {
    want.set(tutId + ":xp", { date: firstDone, cur: "xp", amt: E.earn.tutorial.xp, src: "tutorial", srcId: tutId });
    want.set(tutId + ":gold", { date: firstDone, cur: "gold", amt: E.earn.tutorial.gold, src: "tutorial", srcId: tutId });
  }

  // 5. Merge, then level-up rewards from the XP history (never taken back).
  const merged = { ...stored }; for (const [id, e] of want) merged[id] = { ...stored[id], ...e, id };
  const xpEntries = Object.values(merged).filter(e => e.cur === "xp" && +e.amt).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const lvlDate = {}; let acc = 0, lvl = 1;
  for (const e of xpEntries) { acc += +e.amt; let li = levelInfo(acc, E).level; while (lvl < li) { lvl++; lvlDate[lvl] = e.date; } }
  const xpTotal = acc; const info = levelInfo(xpTotal, E);
  for (let L = 2; L <= info.level; L++) {
    const id = `lvl:${L}:gold`;
    if (!stored[id]) { const e = { date: lvlDate[L] || today, cur: "gold", amt: E.levelUp.gold, src: "levelup", srcId: String(L) }; want.set(id, e); merged[id] = { ...e, id }; }
    const eid = `lvl:${L}:essence`;
    if (E.levelUp.essenceEvery && L % E.levelUp.essenceEvery === 0 && !stored[eid]) { const e = { date: lvlDate[L] || today, cur: "essence", amt: 1, src: "levelup", srcId: String(L) }; want.set(eid, e); merged[eid] = { ...e, id: eid }; }
  }
  const levelAt = k => { let L = 1; for (let n = 2; n <= info.level; n++) if ((lvlDate[n] || today) <= k) L = n; return L; };

  // 6. HP, replayed from the first game day. Frozen days keep their stored ending HP.
  let hp = maxHp(levelAt(addKey(start, -1)), E, P); let downedRisk = false; const dayWrites = [];
  for (let k = start; k <= today; k = addKey(k, 1)) {
    const r = recs[k];
    if (r.frozen) { hp = r.hp; continue; }
    const L = levelAt(k), mx = maxHp(L, E, P);
    r.heal = (E.hp.healPerDaily + (P.heal || 0)) * r.done + (G.flasks || []).filter(f => f === k).length * E.items["item.flask-of-crimson-tears"].hp;
    hp = Math.min(mx, hp + r.heal);
    if (E.levelUp.fullHeal && L > levelAt(addKey(k, -1))) hp = mx;
    if (k === today) break;
    r.dmg = r.sched && !r.rest ? dayDamage(r.missed, E, P) : 0; hp -= r.dmg; r.downed = false;
    if (hp <= 0) {
      if (k < yesterday) {
        r.downed = true;
        const id = `down:${k}:gold`; const bal = ledgerSum(Object.values(merged).filter(e => e.id !== id), "gold", k);
        const e = stored[id] || { date: k, cur: "gold", amt: -Math.floor(Math.max(0, bal) * E.downed.goldLossPct), src: "downed", srcId: k };
        if (!stored[id]) { want.set(id, e); merged[id] = { ...e, id }; }
        hp = mx;
      } else { downedRisk = true; hp = 0; }
    }
    r.hp = hp;
    if (k < yesterday) dayWrites.push({ id: k, date: k, sched: r.sched, done: r.done, missed: r.missed, allClear: r.allClear, heal: r.heal, dmg: r.dmg, hp: r.hp, downed: r.downed, streak: r.streak, types: r.types, rest: r.rest, v: 2 });
  }

  // 7. What to write: only entries that differ from what's stored, each with the balance it leaves.
  const ledgerWrites = [];
  if (input.canWrite) {
    let bal = ledgerSum(Object.values(stored), "gold");
    for (const [id, e] of want) {
      const s = stored[id];
      if (s && s.date === e.date && s.cur === e.cur && +s.amt === +e.amt) continue;
      if (e.cur === "gold") bal += (+e.amt || 0) - (s ? +s.amt || 0 : 0);
      ledgerWrites.push({ ...e, id, bal: e.cur === "gold" ? bal : undefined, at: input.at || Date.now() });
    }
  }
  const all = Object.values(merged);
  const tr = recs[today];
  // A streak broken two days ago (now settled) can be rekindled with Golden Seeds, once a month.
  const lastRek = [...(G.rekindles || [])].sort().pop(); let rekindle = null;
  const rk = addKey(today, -E.rekindle.withinDays); const rr = recs[rk];
  if (rr && rr.sched && !rr.allClear && !rr.rest && !rekindled(rk) && streakBefore[rk] > 0) {
    const next = lastRek ? addKey(lastRek, E.rekindle.cooldownDays) : null;
    rekindle = { date: rk, streak: streakBefore[rk], cost: E.rekindle.essence, ready: !next || next <= today, next };
  }
  const streak = tr.sched && tr.allClear ? tr.streak : streakBefore[today];
  return {
    active: true, today, yesterday, start,
    xp: xpTotal, ...info, gold: ledgerSum(all, "gold"), essence: ledgerSum(all, "essence"),
    held: Object.fromEntries(Object.keys(E.items).map(id => [id, heldCount(id, stored, G)])), rekindle, bounties,
    hp: Math.max(0, hp), maxHp: maxHp(info.level, E, P), downedRisk, perks: P,
    streak, best: Math.max(best, streak), bonus: streakBonus(streakBefore[today], E, P),
    streaks: Object.fromEntries(STREAK_TYPES.map(t => [t, { cur: trun[t], best: tbest[t] }])),
    stable: stableState(input.stable, recs, today, C, E),
    slots, board: { today: recs[today], yesterday: recs[yesterday] && !recs[yesterday].frozen && yesterday >= start ? recs[yesterday] : null, periodic },
    tutorial: { done: tutDone, reward: E.earn.tutorial },
    ledger: merged,
    ledgerWrites: input.canWrite ? ledgerWrites : [],
    dayWrites: input.canWrite ? dayWrites : [],
  };
}
