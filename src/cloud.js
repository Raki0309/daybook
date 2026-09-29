// Supabase connection plus a small document API that matches what the app
// used before (doc(path).get/set/update/delete/onSnapshot, collection(col).onSnapshot).
// Rows live in public.docs as (user_id, col, id, data). Writes apply locally
// first, go to Supabase, and wait in an outbox while the device is offline.
import { createClient } from "@supabase/supabase-js";

const env = import.meta.env || {};
const URL_ = env.VITE_SUPABASE_URL;
const KEY = env.VITE_SUPABASE_KEY;
export const cloudConfig = { url: URL_ || "", key: KEY || "" };
export const supabase = URL_ && KEY ? createClient(URL_, KEY, { auth: { persistSession: true, autoRefreshToken: true } }) : null;

export const account = { user: null };
let dbInstance = null;
export const cloudDb = () => dbInstance;

export function startDb(user) {
  account.user = user;
  dbInstance = supabase && user ? createDocStore(supabase, user.id) : null;
  return dbInstance;
}

const PAGE = 1000;
const isNetErr = e => !navigator.onLine || /fetch|network|Load failed|NetworkError|timed? ?out/i.test(String((e && (e.message || e.details)) || e));

// One level deep merge, same as public.jsonb_merge1 on the server.
export function merge1(a, b) {
  const out = { ...(a || {}) };
  for (const [k, v] of Object.entries(b || {})) {
    const o = out[k];
    out[k] = o && v && typeof o === "object" && typeof v === "object" && !Array.isArray(o) && !Array.isArray(v) ? { ...o, ...v } : v;
  }
  return out;
}

export function createDocStore(sb, uid) {
  const store = new Map();
  const colL = new Map(), docL = new Map();
  let loaded = false, freshAt = 0;
  const OUTBOX = "daybook:outbox:" + uid;
  let outbox = [];
  try { outbox = JSON.parse(localStorage.getItem(OUTBOX) || "[]"); } catch { outbox = []; }
  const saveOutbox = () => { try { localStorage.setItem(OUTBOX, JSON.stringify(outbox)); } catch {} };

  const split = p => { const i = p.indexOf("/"); return [p.slice(0, i), p.slice(i + 1)]; };
  const colMap = c => { let m = store.get(c); if (!m) store.set(c, m = new Map()); return m; };
  const snapCol = c => { const docs = [...colMap(c)].map(([id, d]) => ({ id, data: () => d })); return { docs, empty: !docs.length, metadata: { fromCache: !loaded } }; };
  const snapDoc = p => { const [c, id] = split(p); const d = colMap(c).get(id); return { exists: d !== undefined, data: () => d, metadata: { fromCache: !loaded } }; };

  const awaiting = new Map();
  const dirty = new Set(); let queued = false;
  function notify(c, id) {
    dirty.add(c + "/" + id);
    if (queued) return; queued = true;
    queueMicrotask(() => {
      queued = false; const cols = new Set();
      for (const p of dirty) { cols.add(split(p)[0]); (docL.get(p) || []).forEach(fn => fn(snapDoc(p))); }
      dirty.clear();
      cols.forEach(c => (colL.get(c) || []).forEach(fn => fn(snapCol(c))));
    });
  }
  function applyLocal(op) {
    const m = colMap(op.col);
    if (op.t === "set") m.set(op.id, op.data);
    else if (op.t === "merge") m.set(op.id, merge1(m.get(op.id), op.data));
    else m.delete(op.id);
    notify(op.col, op.id);
  }
  function applyRow(r) {
    if (!r || r.user_id !== uid) return;
    // A pending local change for this doc wins until it has been sent.
    if (outbox.some(o => o.col === r.col && o.id === r.id)) return;
    // Until the echo of our own latest write arrives, older echoes are stale.
    const k = r.col + "/" + r.id, w = awaiting.get(k);
    if (w) {
      if (Date.now() < w.until && JSON.stringify(r.deleted ? null : r.data) !== w.json) return;
      awaiting.delete(k);
    }
    const m = colMap(r.col);
    if (r.deleted) { if (!m.has(r.id)) return; m.delete(r.id); } else m.set(r.id, r.data);
    notify(r.col, r.id);
  }

  async function exec(op) {
    const now = new Date().toISOString();
    let res;
    if (op.t === "set") res = await sb.from("docs").upsert({ user_id: uid, col: op.col, id: op.id, data: op.data, deleted: false, updated_at: now });
    else if (op.t === "merge") res = await sb.rpc("doc_merge", { p_col: op.col, p_id: op.id, p_patch: op.data });
    else res = await sb.from("docs").update({ deleted: true, data: {}, updated_at: now }).match({ user_id: uid, col: op.col, id: op.id });
    if (res.error) throw res.error;
  }
  let flushing = null;
  function flush() {
    if (flushing) return flushing;
    flushing = (async () => {
      while (outbox.length) {
        try { await exec(outbox[0]); }
        catch (e) { if (isNetErr(e)) break; console.warn("dropped change", outbox[0], e); }
        outbox.shift(); saveOutbox();
      }
    })().finally(() => { flushing = null; });
    return flushing;
  }
  async function write(op) {
    applyLocal(op);
    const cur = colMap(op.col).get(op.id);
    awaiting.set(op.col + "/" + op.id, { json: JSON.stringify(cur === undefined ? null : cur), until: Date.now() + 5000 });
    if (outbox.length) { outbox.push(op); saveOutbox(); flush(); return; }
    try { await exec(op); }
    catch (e) {
      if (isNetErr(e)) { outbox.push(op); saveOutbox(); return; }
      const err = new Error(e.message || "save failed"); err.code = e.code === "42501" ? "not_granted" : "failed"; throw err;
    }
  }

  async function loadAll() {
    const next = new Map(); let from = 0;
    for (;;) {
      const { data, error } = await sb.from("docs").select("col,id,data").eq("deleted", false).order("col").order("id").range(from, from + PAGE - 1);
      if (error) throw error;
      data.forEach(r => { let m = next.get(r.col); if (!m) next.set(r.col, m = new Map()); m.set(r.id, r.data); });
      if (data.length < PAGE) break; from += PAGE;
    }
    const cols = new Set([...store.keys(), ...next.keys(), ...colL.keys()]);
    for (const c of cols) {
      const a = store.get(c) || new Map(), b = next.get(c) || new Map();
      store.set(c, b);
      for (const id of new Set([...a.keys(), ...b.keys()])) if (JSON.stringify(a.get(id)) !== JSON.stringify(b.get(id))) notify(c, id);
    }
    outbox.forEach(op => { const m = colMap(op.col); if (op.t === "set") m.set(op.id, op.data); else if (op.t === "merge") m.set(op.id, merge1(m.get(op.id), op.data)); else m.delete(op.id); });
    const first = !loaded; loaded = true; freshAt = Date.now();
    if (first) { colL.forEach((_, c) => notify(c, "")); docL.forEach((_, p) => { const [c, id] = split(p); notify(c, id); }); }
  }

  let status = "connecting";
  const statusL = new Set();
  const setStatus = s => { if (s === status) return; status = s; statusL.forEach(fn => fn(s)); };
  let lastReload = 0;
  let reloading = 0;
  async function reload() {
    if (Date.now() - lastReload < 3000) return; lastReload = Date.now();
    reloading++;
    try { await flush(); if (outbox.length && navigator.onLine) await flush(); await loadAll(); setStatus(outbox.length ? "offline" : "synced"); }
    catch (e) { console.warn("load", e); setStatus(isNetErr(e) ? "offline" : "error"); }
    finally { reloading--; }
  }
  const channel = sb.channel("docs:" + uid)
    .on("postgres_changes", { event: "*", schema: "public", table: "docs", filter: `user_id=eq.${uid}` }, p => applyRow(p.new))
    .subscribe(s => { if (s === "SUBSCRIBED") { lastReload = 0; reload(); } else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT") setStatus("offline"); });
  // Load right away too, so data arrives even when live updates can't connect.
  reload();
  addEventListener("online", () => { lastReload = 0; reload(); });
  addEventListener("offline", () => setStatus("offline"));
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") reload(); });
  const timer = setInterval(() => { if (outbox.length && navigator.onLine) flush().then(() => { if (!outbox.length) setStatus("synced"); }); }, 20000);

  return {
    doc(path) {
      const [c, id] = split(path);
      return {
        get: async () => snapDoc(path),
        set: data => write({ t: "set", col: c, id, data }),
        update: data => write({ t: "merge", col: c, id, data }),
        delete: () => write({ t: "del", col: c, id }),
        onSnapshot(fn) { let s = docL.get(path); if (!s) docL.set(path, s = new Set()); s.add(fn); if (loaded) queueMicrotask(() => fn(snapDoc(path))); return () => s.delete(fn); },
      };
    },
    collection(c) {
      return { onSnapshot(fn) { let s = colL.get(c); if (!s) colL.set(c, s = new Set()); s.add(fn); if (loaded) queueMicrotask(() => fn(snapCol(c))); return () => s.delete(fn); } };
    },
    onStatus(fn) { statusL.add(fn); fn(status); return () => statusL.delete(fn); },
    pending: () => outbox.length,
    // True while a full reload is in flight, so callers can wait for fresh data before deriving writes from it.
    busy: () => reloading > 0,
    // When the last full load from the server finished (0 = never), since live updates can be down while loads work.
    freshAt: () => freshAt,
    close() { clearInterval(timer); sb.removeChannel(channel); },
  };
}

export async function createHealthToken() {
  const { data, error } = await supabase.rpc("create_health_token");
  if (error) throw error;
  return data;
}
export async function healthTokenInfo() {
  const { data } = await supabase.from("health_tokens").select("created_at,last_used").maybeSingle();
  return data;
}
export async function signOut() { await supabase.auth.signOut(); }
