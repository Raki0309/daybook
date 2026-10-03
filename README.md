# Daybook

Habits, tasks, food, money, training and steps in one installable web app, backed by Supabase.

## Stack

- **Frontend:** plain JavaScript with Vite, installable as a PWA (add to the iPhone home screen from Safari's Share menu). The screens in `src/legacy/app.js` were moved over from the original single-file Daybook unchanged, apart from the storage layer, sign-in and Apple Health setup.
- **Backend:** Supabase (project `Daybook`, ref `yuilurluttfnwildzshx`, Frankfurt). Sign-in with email and password; every row is private to its owner through row level security.
- **Hosting:** Vercel (static build of `dist/`).

## Data

`public.docs` holds one row per document: `(user_id, col, id, data jsonb, deleted, updated_at)`. The app keeps the document paths it used before, e.g. `habits/<id>`, `meta/settings`, and month or week buckets such as `stepsm/2026-09` whose `data.items` maps day to entry. `src/cloud.js` gives the app the same small API it had (`doc().set/update/delete/onSnapshot`, `collection().onSnapshot`):

- writes apply locally first, then go to Supabase; `update` calls `doc_merge`, which merges one level deep so bucket items add up instead of replacing each other
- while offline, changes wait in a local outbox and are sent in order when the connection returns
- other devices' changes arrive live through Supabase Realtime, and a full reload runs on start, on reconnect and when the app comes back to the foreground

Deletes are soft (`deleted = true`) so Realtime can filter every change per user.

## Apple Health

A web app can't read HealthKit, so an iPhone Shortcut sends daily step totals to `POST /rest/v1/rpc/ingest_health?apikey=<publishable key>` (the key sits in the address so the Shortcut needs no headers) with a personal key (`p_token`) and lines like `2026-09-27 10432` (`p_text`). The key is created in Settings › Apple Health; only its SHA-256 hash is stored. The step-by-step Shortcut guide is inside the app. The function is callable without signing in on purpose (the Supabase security advisor flags it); it does nothing without a valid key.

## Demo and CAPTCHA

"Try the demo" on the sign-in screen signs in anonymously (Supabase anonymous sign-ins). `src/demo.js` fills the new account with 30 days of habits, tasks, workouts, food, water, money and steps, dated back from that day and written through the normal document store. Demo accounts can't create an Apple Health key or restore backups; `0003_demo.sql` enforces that in the database and caps a demo account at 400 documents of 64 KB each.

CAPTCHA is Cloudflare Turnstile. Put the public site key in `VITE_TURNSTILE_SITE_KEY` (`.env.production`) and the secret in Supabase under Authentication > Attack Protection. Without a site key the widget is skipped, so deploy the key before switching CAPTCHA on in Supabase.

## Develop

```sh
npm install
cp .env.example .env     # Supabase URL and publishable key
npm run dev
npm test                 # unit tests for the storage layer (node:test)
npm run build && npx vite preview --port 4173 &
PW=$(npm root -g)/playwright node e2e/app.e2e.cjs   # end-to-end run against a mocked Supabase
```

Database changes live in `supabase/migrations/`.

## Moving data from the old Daybook

In the old Daybook page open Settings › Download backup, then in the new app Settings › Restore from backup.
