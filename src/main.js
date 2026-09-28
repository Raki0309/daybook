import "./styles.css";
import { supabase, startDb } from "./cloud.js";

const $ = s => document.querySelector(s);
let mode = "signin";
let started = false;

function showAuth() {
  $("#auth").hidden = false;
  $(".app").hidden = true;
  paintMode();
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
  $("#auth").hidden = true;
  $(".app").hidden = false;
  startDb(user);
  await import("./legacy/app.js");
}

$("#auth-switch").addEventListener("click", () => { mode = mode === "signin" ? "signup" : "signin"; say(""); paintMode(); });
$("#auth-form").addEventListener("submit", async e => {
  e.preventDefault();
  const email = $("#auth-email").value.trim(), password = $("#auth-pass").value;
  if (!/^\S+@\S+\.\S+$/.test(email)) { say("Enter your email address.", "bad"); $("#auth-email").focus(); return; }
  if (password.length < 8) { say("Use a password of at least 8 characters.", "bad"); $("#auth-pass").focus(); return; }
  const btn = $("#auth-go"); btn.disabled = true; say(mode === "signup" ? "Creating your account…" : "Signing in…");
  try {
    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: location.origin } });
      if (error) throw error;
      if (data.session) return boot(data.session.user);
      say("Check your email and tap the confirmation link, then sign in here.", "good");
      mode = "signin"; paintMode();
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      boot(data.user);
    }
  } catch (err) {
    const msg = String(err.message || err);
    say(/invalid login/i.test(msg) ? "That email and password don't match. Check them and try again."
      : /not confirmed/i.test(msg) ? "Confirm your email first. The link is in the message we sent you."
      : /already registered/i.test(msg) ? "That email already has an account. Sign in instead."
      : /fetch|network/i.test(msg) ? "Can't reach the server. Check your connection and try again."
      : msg, "bad");
  } finally { btn.disabled = false; }
});

(async () => {
  if (!supabase) { await boot(null); return; }
  const { data } = await supabase.auth.getSession();
  if (data.session) boot(data.session.user); else showAuth();
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT") location.reload();
    else if (session && !started) boot(session.user);
  });
})();
