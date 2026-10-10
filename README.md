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

## Files
- `index.html`: the full prototype (Studio, Lookbook, Compare, Cultural Story, VI/EN).
- `support.js`: the runtime the page needs to run.
- `image-slot.js`: the image placeholder component, filled with cover photos from Wikimedia Commons.
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
- Lookbook and settings are saved in each visitor's own browser (localStorage). Nothing is stored on a server.
- Cultural sources are seed data and are pending review by a cultural editor.
