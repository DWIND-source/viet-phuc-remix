# Việt Phục Remix

**“Phối chất riêng – hiểu chất Việt.”** An interactive cultural-fashion styling prototype for Vietnamese traditional clothing (áo dài, áo ngũ thân, áo tứ thân).

## Live demo
**https://dwind-source.github.io/viet-phuc-remix/**

This is a static site served by GitHub Pages from the root of the `main` branch. It has no build step: push to `main` and Pages redeploys automatically within a minute or two.

## Run locally
```bash
python -m http.server 8000
# then open http://localhost:8000/
```
Opening `index.html` directly from disk also works. Use a local server if your browser blocks `fetch` on `file://` URLs.

## Accounts, synced Lookbook & analytics (Supabase)
The site works fully as a guest app. Fill in `config.js` with a Supabase project URL and its anon/publishable key to turn on:
- **Accounts:** email + password sign-up and sign-in, password reset, and self-service account deletion.
- **Lookbook sync:** saved looks are stored per account, so they show up on every device. Guest looks are merged in on first sign-in.
- **Usage analytics:** sent only after the visitor clicks *Accept* in the consent banner. No photos are ever collected.
- **Admin dashboard:** [`admin.html`](admin.html) shows KPIs, daily visits, top actions, garments and occasions, recent users, and CSV export.

Step-by-step setup (in Vietnamese): [`SETUP_SUPABASE.md`](SETUP_SUPABASE.md). The database schema and Row Level Security policies are in [`supabase/schema.sql`](supabase/schema.sql).

## Files
- `index.html`: the full prototype (Studio, Lookbook, Compare, Cultural Story, VI/EN).
- `support.js`: the runtime the page needs to run.
- `image-slot.js`: the image placeholder component, filled with cover photos from Wikimedia Commons.
- `config.js`: Supabase URL and public key. Leave both empty for guest-only mode.
- `cloud.js`: the only code that talks to Supabase (auth, Lookbook sync, consent-gated analytics).
- `admin.html`: the admin dashboard. Only accounts listed in the `admins` table can see data.
- `privacy.html`: the privacy policy (VI/EN).
- `supabase/schema.sql`: tables, Row Level Security, the sign-up trigger, and the admin and account-deletion functions.
- `.image-slots.state.json`: an empty state file for `image-slot`, so the page doesn't log a 404.
- `.nojekyll`: tells GitHub Pages to serve files as they are, including dotfiles.
- `REBUILD_PROMPT.md`: full context and a brief for rebuilding this as a Next.js production app.

## Features
- **Cultural rule engine:** deterministic, gives category labels only (no percentage scores).
- **Color harmony heuristic:** 0–100 styling score, labelled as a heuristic.
- **Weather-aware tips:** from Open-Meteo.
- **Image library & cover photos:** pulled live from Wikimedia Commons with author and licence credits. The covers are set in `COVER` in `index.html`.
- **AI Try-On:** open-source engines FitDiT, Leffa and IDM-VTON on Hugging Face Spaces, with automatic fallback, or FASHN.

## Notes
- An HF token (free) raises your GPU quota for Try-On. Enter it in Studio → AI Try-On → Settings. It is stored only in your browser's localStorage.
- The FASHN "direct key" mode is for development only. In production, keep the key on a server.
- Guests' Lookbook and settings stay in their own browser (localStorage). Signed-in users' looks are also stored in Supabase. Try-On keys (HF/FASHN) never leave the browser.
- Cultural sources are seed data and are pending review by a cultural editor.
