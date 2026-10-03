// Cloudflare Turnstile for the sign-in screen. Supabase checks the token on sign-in,
// sign-up and demo sign-in once CAPTCHA protection is switched on in its Auth settings.
// Without a site key (local dev, tests) everything here is a no-op.
const SITE = (import.meta.env || {}).VITE_TURNSTILE_SITE_KEY;
export const captchaOn = !!SITE;

let widget = null, token = null, failed = false;
const waiters = [];
const settle = () => waiters.splice(0).forEach(w => w());

export function mountCaptcha(el) {
  if (!SITE || widget !== null || !el) return;
  const render = () => {
    widget = window.turnstile.render(el, {
      sitekey: SITE,
      appearance: "interaction-only",
      callback: t => { token = t; failed = false; settle(); },
      "expired-callback": () => { token = null; },
      "error-callback": () => { token = null; failed = true; settle(); },
    });
  };
  if (window.turnstile) return render();
  const s = document.createElement("script");
  s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
  s.async = true; s.onload = render; s.onerror = () => { failed = true; settle(); };
  document.head.appendChild(s);
}

// A fresh token for one auth call. Tokens work once, so the widget resets after each use.
export async function captchaToken(timeout = 20000) {
  if (!SITE) return undefined;
  if (!token && !failed) await new Promise(r => { waiters.push(r); setTimeout(r, timeout); });
  const t = token;
  resetCaptcha();
  if (!t) { const e = new Error("captcha"); e.code = "captcha"; throw e; }
  return t;
}

export function resetCaptcha() {
  token = null; failed = false;
  if (widget !== null && window.turnstile) window.turnstile.reset(widget);
}
