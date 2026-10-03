import "./styles.css";
import "./ui/daybook-ui.css";
import "./ui/pixel.css";
import { supabase, startDb } from "./cloud.js";
import { seedDemo } from "./demo.js";
import { mountCaptcha, captchaToken } from "./captcha.js";

const $ = s => document.querySelector(s);
let mode = "signin";
try { if (sessionStorage.getItem("daybook:auth-mode") === "signup") mode = "signup"; sessionStorage.removeItem("daybook:auth-mode"); } catch {}
let started = false;

function showAuth() {
  $("#auth").hidden = false;
  $(".app").hidden = true;
  paintMode();
  mountCaptcha($("#auth-captcha"));
}
function paintMode() {
  const up = mode === "signup";
  $("#auth-title").textContent = up ? "Create your account" : "Sign in";
  $("#auth-go").textContent = up ? "Create account" : "Sign in";
  $("#auth-switch").textContent = up ? "Already have an account? Sign in" : "New here? Create an account";
  $("#auth-pass").autocomplete = up ? "new-password" : "current-password";
}
function say(text, tone) {
  const m = $("#auth-msg"); m.hidden = !text; m.textContent = text || "";
  m.style.color = tone === "bad" ? "var(--bad)" : tone === "good" ? "var(--good)" : "";
}

async function boot(user) {
  if (started) return;
  started = true;
  current = user;
  const db = startDb(user);
  // A demo account gets its example month before the app first draws.
  const mark = "daybook:demo-seeded:" + (user && user.id);
  let seeded = false; try { seeded = !!localStorage.getItem(mark); } catch {}
  if (db && user.is_anonymous && !seeded) {
    say("Filling the demo with a month of example data…");
    try { await seedDemo(db); localStorage.setItem(mark, "1"); } catch (e) { console.warn("demo seed", e); }
  }
  $("#auth").hidden = true;
  $(".app").hidden = false;
  await import("./legacy/app.js");
}
let current = null;
// Leaving the demo drops its local copy; the next visitor gets a fresh one.
function forgetDemo() {
  if (!current || !current.is_anonymous) return;
  try { for (const k of Object.keys(localStorage)) if (k.startsWith("daybook:") && k.includes(current.id)) localStorage.removeItem(k); } catch {}
}
const authError = msg =>
  /invalid login/i.test(msg) ? "That email and password don't match. Check them and try again."
  : /not confirmed/i.test(msg) ? "Confirm your email first. The link is in the message we sent you."
  : /already registered/i.test(msg) ? "That email already has an account. Sign in instead."
  : /captcha/i.test(msg) ? "We couldn't check that you're a person. Wait a moment and try again."
  : /anonymous sign-ins are disabled/i.test(msg) ? "The demo is switched off right now. Create an account instead."
  : /rate limit|too many/i.test(msg) ? "Too many tries from this network. Wait a few minutes and try again."
  : /fetch|network/i.test(msg) ? "Can't reach the server. Check your connection and try again."
  : msg;

$("#auth-switch").addEventListener("click", () => { mode = mode === "signin" ? "signup" : "signin"; say(""); paintMode(); });
$("#auth-form").addEventListener("submit", async e => {
  e.preventDefault();
  const email = $("#auth-email").value.trim(), password = $("#auth-pass").value;
  if (!/^\S+@\S+\.\S+$/.test(email)) { say("Enter your email address.", "bad"); $("#auth-email").focus(); return; }
  if (password.length < 8) { say("Use a password of at least 8 characters.", "bad"); $("#auth-pass").focus(); return; }
  const btn = $("#auth-go"); btn.disabled = true; say(mode === "signup" ? "Creating your account…" : "Signing in…");
  try {
    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: location.origin, captchaToken: await captchaToken() } });
      if (error) throw error;
      if (data.session) return boot(data.session.user);
      say("Check your email and tap the confirmation link, then sign in here.", "good");
      mode = "signin"; paintMode();
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password, options: { captchaToken: await captchaToken() } });
      if (error) throw error;
      boot(data.user);
    }
  } catch (err) {
    say(authError(String(err.message || err)), "bad");
  } finally { btn.disabled = false; }
});
$("#auth-demo").addEventListener("click", async () => {
  const btn = $("#auth-demo"); btn.disabled = true; say("Opening the demo…");
  try {
    const { data, error } = await supabase.auth.signInAnonymously({ options: { captchaToken: await captchaToken() } });
    if (error) throw error;
    await boot(data.user);
  } catch (err) {
    started = false;
    say(authError(String(err.message || err)), "bad");
  } finally { btn.disabled = false; }
});

(async () => {
  if (!supabase) { await boot(null); return; }
  const { data } = await supabase.auth.getSession();
  if (data.session) boot(data.session.user); else showAuth();
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT") { forgetDemo(); location.reload(); }
    else if (session && !started) boot(session.user);
  });
})();
