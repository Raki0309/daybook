// Demo accounts: an anonymous sign-in gets about 30 days of example data, dated
// back from the day it's created, so streaks are alive and nothing reads as missed.
// buildDemo() is pure (same day + seed = same documents); seedDemo() writes them
// through the normal document store, so they're stored exactly like real data.
import { keyOf, parseKey, addKey, weekOf, weekdayOf } from "./game/engine.js";

export const DEMO_DAYS = 30;
export const DEMO_MARK = "meta/demo";

function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const r1 = v => Math.round(v * 10) / 10;
const r2 = v => Math.round(v * 100) / 100;
// A moment on day k at hh:mm local time.
const at = (k, hh, mm = 0) => { const d = parseKey(k); d.setHours(hh, mm, 0, 0); return d.getTime(); };

// Per 100 g: kcal, protein, carbs, fat, fibre, sugar, saturated fat, sodium (mg).
const FOODS = {
  oats:    ["Oats, rolled", { kcal: 379, p: 13.2, c: 67.7, f: 6.5, fib: 10.1, sug: 1, sat: 1.1, na: 6 }, [[40, "portion"]]],
  milk:    ["Milk, semi-skimmed", { kcal: 50, p: 3.4, c: 4.8, f: 1.9, sug: 4.8, sat: 1.2, na: 44 }, [[250, "glass"]]],
  banana:  ["Banana", { kcal: 89, p: 1.1, c: 22.8, f: 0.3, fib: 2.6, sug: 12.2, sat: 0.1, na: 1 }, [[118, "medium"]]],
  yogurt:  ["Greek yogurt, plain", { kcal: 97, p: 9, c: 3.9, f: 5, sug: 3.6, sat: 3.2, na: 35 }, [[170, "pot"]]],
  eggs:    ["Eggs, scrambled", { kcal: 149, p: 10, c: 1.6, f: 11, sug: 1.4, sat: 3.3, na: 145 }, [[120, "two eggs"]]],
  toast:   ["Wholemeal toast", { kcal: 252, p: 12.4, c: 42.7, f: 3.5, fib: 6, sug: 4.4, sat: 0.7, na: 450 }, [[35, "slice"]]],
  chicken: ["Chicken breast, grilled", { kcal: 165, p: 31, c: 0, f: 3.6, sat: 1, na: 74 }, [[150, "fillet"]]],
  rice:    ["Rice, white, cooked", { kcal: 130, p: 2.7, c: 28.2, f: 0.3, fib: 0.4, sug: 0.1, sat: 0.1, na: 1 }, [[180, "bowl"]]],
  salad:   ["Mixed salad", { kcal: 20, p: 1.5, c: 3.5, f: 0.2, fib: 1.8, sug: 1.9, na: 30 }, [[100, "side"]]],
  salmon:  ["Salmon, baked", { kcal: 206, p: 22, c: 0, f: 12.4, sat: 2.5, na: 61 }, [[140, "fillet"]]],
  potato:  ["Potatoes, boiled", { kcal: 87, p: 1.9, c: 20.1, f: 0.1, fib: 1.8, sug: 0.9, na: 4 }, [[200, "portion"]]],
  pasta:   ["Pasta with tomato sauce", { kcal: 140, p: 4.8, c: 24, f: 2.6, fib: 2, sug: 4, sat: 0.4, na: 230 }, [[300, "plate"]]],
  wrap:    ["Chicken wrap", { kcal: 218, p: 13, c: 22, f: 8.5, fib: 1.8, sug: 2.2, sat: 2.4, na: 520 }, [[220, "wrap"]]],
  apple:   ["Apple", { kcal: 52, p: 0.3, c: 13.8, f: 0.2, fib: 2.4, sug: 10.4, na: 1 }, [[180, "medium"]]],
  almonds: ["Almonds", { kcal: 579, p: 21.2, c: 21.6, f: 49.9, fib: 12.5, sug: 4.4, sat: 3.8, na: 1 }, [[30, "handful"]]],
  bar:     ["Protein bar", { kcal: 360, p: 33, c: 33, f: 11, fib: 6, sug: 4, sat: 5, na: 250 }, [[55, "bar"]]],
  pizza:   ["Pizza margherita", { kcal: 266, p: 11, c: 33, f: 10, fib: 2.3, sug: 3.6, sat: 4.5, na: 600 }, [[300, "half pizza"]]],
};
const MENU = {
  breakfast: [[["oats", 60], ["milk", 250], ["banana", 118]], [["yogurt", 170], ["oats", 40], ["apple", 180]], [["eggs", 120], ["toast", 70]]],
  lunch: [[["chicken", 150], ["rice", 180], ["salad", 100]], [["wrap", 220], ["apple", 180]], [["pasta", 320], ["salad", 100]]],
  dinner: [[["salmon", 140], ["potato", 220], ["salad", 120]], [["chicken", 160], ["potato", 200]], [["pasta", 300]], [["pizza", 300]]],
  snacks: [[["almonds", 30]], [["bar", 55]], [["yogurt", 170]], [["banana", 118]]],
};

const SPLIT = [
  ["Upper", [["Bench Press", "Chest", 2.5, 6, 10, 60], ["Barbell Row", "Back", 2.5, 6, 10, 55], ["Overhead Press", "Shoulders", 2.5, 6, 10, 37.5], ["Lat Pulldown", "Back", 2.5, 8, 12, 50], ["Barbell Curl", "Biceps", 1.25, 8, 12, 25]]],
  ["Lower", [["Back Squat", "Quads", 2.5, 5, 8, 80], ["Romanian Deadlift", "Hamstrings", 2.5, 8, 10, 70], ["Leg Press", "Quads", 5, 10, 15, 140], ["Standing Calf Raise", "Calves", 2.5, 10, 15, 60]]],
];

/** All demo documents for a demo created on day `today` (yyyy-mm-dd), as [path, data] pairs. */
export function buildDemo(today, seed = 7) {
  const R = rng(seed); const pick = a => a[Math.floor(R() * a.length)];
  const first = addKey(today, -(DEMO_DAYS - 1));
  const days = []; for (let k = first; k <= today; k = addKey(k, 1)) days.push(k);
  const ago = k => Math.round((parseKey(today) - parseKey(k)) / 864e5);
  const created = at(addKey(first, -1), 9);
  const out = [];
  const buckets = {};
  const bucket = (col, key, item) => { ((buckets[col + "/" + key] ||= {}))[item.id] = item; };

  out.push(["meta/settings", {
    name: "Alex", currency: "EUR", unit: "kg", rest: 120, weeklyWorkouts: 3, stepGoal: 8000,
    budget: 1500, budgets: { Groceries: 320, "Eating out": 120, Transport: 70, Entertainment: 60, Shopping: 100, Subscriptions: 30 },
    expenseCats: ["Groceries", "Eating out", "Rent", "Bills", "Transport", "Health", "Fitness", "Shopping", "Entertainment", "Subscriptions", "Travel", "Other"],
    incomeCats: ["Salary", "Freelance", "Gifts", "Refunds", "Other"],
    nutri: { sex: "male", birthYear: String(parseKey(today).getFullYear() - 29), height: "180", weight: "", activity: "light", goal: -0.25, macroMode: "bw", protPerKg: 1.8, pct: { p: 30, c: 40, f: 30 } },
  }]);

  // Habits. The last stretch is clean, so the streaks are alive; today is half done.
  const HABITS = [["Drink 2 L of water", "--s1", 0.85], ["Read 20 pages", "--s2", 0.7], ["Stretch 10 minutes", "--s3", 0.65], ["Lights out by 23:30", "--s4", 0.6]];
  const habits = HABITS.map(([name, color, rate], i) => {
    const done = {};
    for (const k of days) {
      const a = ago(k);
      if (a === 0 ? i < 2 : a <= 9 || R() < rate) done[k] = 1;
    }
    return { id: "demo-h" + (i + 1), name, freq: "daily", goal: 7, color, days: null, done, created: created + i, order: created + i };
  });
  const medDone = {}; for (const k of days) if (ago(k) > 0 && R() < 0.45) medDone[k] = 1;
  habits.push({ id: "demo-h5", name: "Meditate", freq: "weekly", goal: 3, color: "--s5", days: null, done: medDone, created: created + 4, order: created + 4 });
  habits.forEach(h => out.push(["habits/" + h.id, h]));

  // Tasks: a daily one in the same clean stretch, a weekly and a monthly chore, and a few to-dos.
  const planDone = {}; for (const k of days) if (ago(k) > 0 && (ago(k) <= 9 || R() < 0.7)) planDone[k] = 1;
  const lastWk = weekOf(addKey(today, -7)), mo = today.slice(0, 7);
  const tasks = [
    { id: "demo-t1", title: "Plan tomorrow", kind: "daily", days: null, done: planDone },
    { id: "demo-t2", title: "Clean the flat", kind: "weekly", done: { [lastWk]: 1 } },
    { id: "demo-t3", title: "Pay rent", kind: "monthly", done: { [mo]: 1 } },
    { id: "demo-t4", title: "Book a dentist appointment", kind: "todo", due: addKey(today, 3), priority: 2, doneAt: null },
    { id: "demo-t5", title: "Renew gym membership", kind: "todo", due: null, priority: 1, doneAt: at(addKey(today, -2), 12) },
    { id: "demo-t6", title: "Call grandma", kind: "todo", due: addKey(today, 1), priority: 0, doneAt: null },
  ];
  tasks.forEach((t, i) => out.push(["tasks/" + t.id, { notes: "", due: null, priority: 0, doneAt: null, done: {}, ...t, created: created + 10 + i }]));

  // Training: an upper/lower split, three sessions a week (Mon, Wed, Fri), slowly getting stronger.
  const exIds = {}; let exN = 0;
  const splitDays = SPLIT.map(([name, list], di) => ({
    id: "demo-sd" + (di + 1), name,
    items: list.map(([n, muscle, inc, repMin, repMax]) => {
      const id = exIds[n] ||= "demo-e" + (++exN);
      out.push(["exercises/" + id, { id, name: n, muscle, inc, repMin, repMax, created: created + exN }]);
      return { ex: id, sets: 3, repMin, repMax };
    }),
  }));
  out.push(["splits/demo-split", { id: "demo-split", name: "Upper / Lower", created, active: true, days: splitDays }]);
  let sn = 0;
  for (const k of days) {
    if (![0, 2, 4].includes(weekdayOf(k)) || ago(k) === 0) continue;
    const di = sn % 2; const [, list] = SPLIT[di]; const step = Math.floor(sn / 2); sn++;
    const start = at(k, 18, Math.floor(R() * 30));
    const entries = list.map(([n, , inc, repMin, repMax, w0]) => {
      const w = w0 + inc * Math.floor(step / 2); const base = repMin + (step % 2) * 2;
      return { ex: exIds[n], repMin, repMax, sets: [0, 1, 2].map(s => ({ w, r: Math.min(repMax, Math.max(repMin, base + (s === 0 ? 1 : 0) - (s === 2 ? 1 : 0))), rir: s === 2 ? 1 : 2 })) };
    });
    const id = "demo-s" + sn;
    out.push(["sessions/" + id, { id, name: SPLIT[di][0], splitId: "demo-split", dayId: splitDays[di].id, start, end: start + (52 + Math.floor(R() * 15)) * 60000, date: k, entries, prs: [] }]);
  }

  // Food, water, steps and body weight. A couple of days have no food logged, like real life.
  let fn = 0;
  for (const k of days) {
    const a = ago(k);
    if (a !== 0 && a % 11 === 5) continue;
    for (const meal of ["breakfast", "lunch", "dinner", "snacks"]) {
      if (a === 0 && meal !== "breakfast") break;
      if (meal === "snacks" && R() < 0.35) continue;
      pick(MENU[meal]).forEach(([ref, g]) => {
        const [name, n, sv] = FOODS[ref]; const id = "demo-f" + (++fn);
        bucket("foodw", weekOf(k), { id, date: k, meal, name, ref: "demo:" + ref, g: r1(g * (0.9 + R() * 0.2)), n, sv, created: at(k, { breakfast: 8, lunch: 13, dinner: 19, snacks: 16 }[meal], fn % 60) });
      });
    }
  }
  for (const k of days) {
    const a = ago(k); const mk = k.slice(0, 7);
    bucket("waterm", mk, { id: k, date: k, ml: a === 0 ? 750 : 1500 + Math.round(R() * 6) * 250 });
    const goalDay = a > 0 && (a <= 9 || R() < 0.65);
    const n = a === 0 ? 3200 + Math.round(R() * 1500) : goalDay ? 8100 + Math.round(R() * 5200) : 4200 + Math.round(R() * 3500);
    bucket("stepsm", mk, { id: k, date: k, n, src: "manual", at: at(k, 22) });
    if (a % 3 === 0) bucket("bodym", mk, { id: k, date: k, kg: r1(81.6 - (DEMO_DAYS - a) * 0.045 + (R() - 0.5) * 0.5) });
  }

  // Money: salary and rent on the 1st, groceries twice a week, and the usual small stuff.
  let tn = 0;
  const tx = (k, type, cat, amount, note = "") => { const id = "demo-x" + (++tn); bucket("txm", k.slice(0, 7), { id, type, amount: r2(amount), cat, date: k, note, created: at(k, 12, tn % 60) }); };
  for (const k of days) {
    const d = parseKey(k).getDate(); const wd = weekdayOf(k); const a = ago(k);
    if (d === 1) { tx(k, "income", "Salary", 2650, "Monthly pay"); tx(k, "expense", "Rent", 720); tx(k, "expense", "Bills", 85, "Electricity and internet"); }
    if (d === 3) tx(k, "expense", "Subscriptions", 12.99, "Music");
    if (d === 15) tx(k, "expense", "Fitness", 35, "Gym");
    if (wd === 1 || wd === 5) tx(k, "expense", "Groceries", 38 + R() * 34);
    if (wd === 4 && a > 0) tx(k, "expense", "Eating out", 18 + R() * 22, pick(["Burger night", "Sushi with friends", "Pizza"]));
    if (R() < 0.3 && a > 0) tx(k, "expense", "Transport", 2.4 + R() * 12, pick(["Bus", "Taxi", "Train"]));
    if (R() < 0.08 && a > 0) tx(k, "expense", "Entertainment", 9 + R() * 25, pick(["Cinema", "Concert", "Game"]));
    if (R() < 0.06 && a > 0) tx(k, "expense", "Shopping", 20 + R() * 45, pick(["Shoes", "T-shirt", "Books"]));
  }
  if (!days.some(k => parseKey(k).getDate() === 1)) tx(first, "income", "Salary", 2650, "Monthly pay");

  for (const [path, items] of Object.entries(buckets)) out.push([path, { items }]);
  out.push([DEMO_MARK, { day: today, at: at(today, 0) }]);
  return out;
}

const wait = ms => new Promise(r => setTimeout(r, ms));

/** Fills a demo account once. Waits for the first load so the server copy can't wipe the new data. */
export async function seedDemo(db, today = keyOf(new Date())) {
  for (let i = 0; i < 100 && !db.freshAt(); i++) await wait(100);
  if ((await db.doc(DEMO_MARK).get()).exists) return false;
  const docs = buildDemo(today);
  // The marker goes last, so an interrupted seed runs again next time.
  const mark = docs.pop();
  for (let i = 0; i < docs.length; i += 8) await Promise.all(docs.slice(i, i + 8).map(([path, data]) => db.doc(path).set(data)));
  await db.doc(mark[0]).set(mark[1]);
  return true;
}
