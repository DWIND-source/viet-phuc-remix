# VIỆT PHỤC REMIX — Rebuild & Improve Brief

> Paste this whole file into another AI coding agent together with the `source/` folder.
> Goal: rebuild the prototype as a production Next.js app and improve the AI Try-On quality.

## 0. What you are receiving

- `source/Viet Phuc Remix v2.dc.html`: **the current working prototype, and the source of truth.** It is one HTML file: a template with inline styles, plus a logic class (`class Component extends DCLogic`) inside `<script data-dc-script>`. Everything is there: all data, the rule engines, the i18n strings, the Try-On clients and the Wikimedia library loader.
- `source/support.js`: the runtime for the prototype (React-like). **Do not port it.** It only exists so the HTML opens in a browser.
- `source/image-slot.js`: a drag-and-drop image placeholder used only in the prototype. Replace it with real licensed assets / `next/image`.
- `source/Viet Phuc Remix.dc.html`: the older v1. Ignore it unless you are curious.

How to read the prototype: open the v2 file and find `class Component`. Everything above the class is pure data and pure functions. Port it 1:1 into `data/*.ts` and `lib/*.ts`.

## 1. Product (unchanged from original spec)

Việt Phục Remix is an interactive cultural-fashion styling platform for Vietnamese traditional clothing (áo dài, áo ngũ thân, áo tứ thân), aimed at Gen Z.

- **Journey:** Explore → Occasion → Garment → Style/Palette/Accessories → Cultural Check → AI Try-On → Compare → Save to Lookbook → Cultural Story.
- **Philosophy:** "Creativity with cultural context." Always distinguish **Historically grounded / Modern adaptation / Creative interpretation**.
- Never give a numeric "cultural accuracy" score.
- Never let an LLM invent history. Facts come only from the curated dataset.
- Never fake AI output. A failed job must show as failed.

**Visual identity:** Vietnamese lacquer × editorial fashion.
- Palette: lacquer `#7C2837`, ivory `#F2ECE1`, ink `#181715`, jade `#5B7568`, indigo `#3E506B`, gold `#B79A65`, paper `#F8F4EC`.
- Fonts: Playfair Display (display), Be Vietnam Pro (UI), JetBrains Mono (labels).
- Radii 14–24px, very soft shadows, large photography. No gradients, glassmorphism or neon.

## 2. Current feature inventory (all working in the prototype)

| Area | What it does | Where in prototype |
|---|---|---|
| i18n VI/EN | Header toggle, persisted in `vpr_lang_v1`. `T` dict for UI. Data records use `field` / `field_en` pairs and are read via `tx(obj,'field')`. Strings inside the engines use `V(vi,en)`. | `T`, `V`, `tx`, `setLang` |
| Landing | Hero, 3 garment cards, explainer for the 3 interpretation levels | template top |
| Studio left | 01 Occasion (5) → 02 Garment (3, each with a fit badge per occasion) → 03 Style (6) → 04 Palette (6) → 05 Accessories (11, typed) → 06 Remix slider | `EVENTS, GARMENTS, STYLES, PALETTES, ACCS` |
| Occasion linkage | `FIT[event][garment]` sets the badge (3/2/1) and `FIT_WHY` gives the reason. `EV_REC[event]` marks recommended styles, palettes and accessories with ✦. The "Apply suggestion" button applies them all. | `FIT, FIT_WHY, EV_REC`, `applySuggest` |
| Presets | 12 looks (4 per garment), sorted with occasion matches first, plus Prev/Next | `PRESETS`, `recs()`, `stepLook()` |
| Cultural rule engine | Deterministic. Rules R01–R16 output: level, label, explanation, warnings{kind,text}, notes, preserved[], remixed[], ruleIds | `assessLook(sel)` |
| Color harmony | HSL heuristic giving a 0–100 score plus notes, labelled "heuristic" | `harmonyOf(pal)` |
| Weather | Open-Meteo geocoding + current weather (client-side), deterministic styling tips, "weather fit" used in Compare | `onWxQuery, loadWeather, weatherRecs, weatherFit` |
| Image library | 23 Wikimedia Commons files tagged by garment, events, kind (modern/archival/festival/museum) and tryon suitability (best/ok/no). Thumbs, credits and licence are fetched live from the Commons API. Filters: occasion fit, Try-On ready, archival, all. Each image can be used as the Try-On garment image. | `LIB`, `loadLibrary`, `useLibForTryon` |
| AI Try-On | 3 providers (see §4). Two upload steps: person and garment. Real status states, before/after slider, "New variation" (new seed), auto-fallback between engines | `runHf, runEngine, gradioCall, runFashn, startTryon, poll` |
| Compare | Current look vs auto-generated "Grounded alternative". 9 rows, no winner. | `compareCols, groundedAlt` |
| Lookbook | localStorage `vpr_lookbook_v1`: view / compare / duplicate / delete | `saveLook, writeSaved` |
| Story drawer | History, construction, misconceptions, modern notes, sources with verification status | `SRC`, `story` VM |
| Analytics | `window.vprAnalytics.push({name,data,t})`, with all events from the spec | `track()` |
| Responsive | ≥1180: 3 columns. 760–1180: 2 columns. <760: canvas first plus a sticky "Thử outfit" bar | `studioCols/Areas` |

## 3. Target architecture (Next.js App Router + TS)

```
app/ page.tsx  studio/page.tsx  lookbook/page.tsx
app/api/tryon/start/route.ts        POST {modelImage, garmentId|productImage, engine?, quality?, seed?} → {jobId}
app/api/tryon/status/[id]/route.ts  GET → {status:'queued'|'processing'|'completed'|'failed', stage?, queuePos?, outputUrl?, engine?, error?}
app/api/weather/route.ts            GET ?city= → normalized weather
app/api/library/route.ts            GET → LIB enriched with Commons thumbs/credits (cache 24h)
components/{landing,studio,culture,tryon,lookbook,common}/
lib/cultural-engine/assess.ts       ← port assessLook verbatim + unit tests
lib/color/harmony.ts                ← port harmonyOf
lib/weather/rules.ts                ← port weatherRecs/weatherFit
lib/tryon/{gradio.ts,fashn.ts,engines.ts,preprocess.ts,normalize.ts}
lib/i18n/{vi.ts,en.ts}              ← port T + *_en fields (consider next-intl)
data/{garments,events,styles,palettes,accessories,presets,fit,library,sources}.ts
store/studio.ts (Zustand)           ← state shape = prototype this.state
```

- **Validation:** Zod on every API input. Data URIs must be ≤10MB and image/* only. Reject arbitrary remote URLs to prevent SSRF. Allow only `upload.wikimedia.org` and your own storage.
- **Storage:** Supabase buckets: `user-uploads` (private, auto-delete after 24h) and `tryon-results` (private, signed URLs). Copy provider results into storage before saving to the Lookbook, because HF/FASHN URLs expire.
- **Env:** see `.env.example` below.

```
FASHN_API_KEY=
HF_TOKEN=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_DEMO_MODE=false
```

## 4. AI Try-On: current implementation (port to server)

### 4.1 Preprocessing (`padTo34`)
1. Both images are letterboxed to 3:4, at 1024–1536px tall.
2. The person image is padded with a blurred version of itself, so there are no hard bars. The garment image is padded with white.
3. Both are encoded as JPEG at 0.93 quality.

### 4.2 Raw Gradio protocol (no SDK; the `@gradio/client` ESM failed in the sandbox)
1. `GET {host}/config`: read `api_prefix` (Gradio 5 uses `/gradio_api`) and `dependencies[]`. Find the endpoint with `api_name === X`, and use its `id` as `fn_index`.
2. `POST {pre}/upload` with multipart `files[]`. The response is an array of server paths. Wrap each as `{path, url: pre+'/file='+path, orig_name, meta:{_type:'gradio.FileData'}}`.
3. `POST {pre}/queue/join` with `{data:[...], fn_index, session_hash, event_data:null, trigger_id:null}`.
4. `GET {pre}/queue/data?session_hash=` returns SSE. Messages:
   - `estimation`: has `rank`; that is the queue position.
   - `process_starts` / `progress`
   - `unexpected_error`
   - `process_completed`: carries `{success, output:{data|error}}`.
5. Pass `Authorization: Bearer HF_TOKEN` on every call to raise the ZeroGPU quota.

### 4.3 Engines and exact input order (verified against live `/config`)

| Engine | Host | Calls |
|---|---|---|
| **FitDiT** | `https://boyuanjiang-fitdit.hf.space` | **Step 1:** `generate_mask` with `[person, category('Upper-body'\|'Lower-body'\|'Dresses'), offset_top, offset_bottom, offset_left, offset_right]`; it returns `[mask, pose]`. **Step 2:** `process` with `[person, garment, mask, pose, steps(20\|30), guidance(2), seed, num_images(1), resolution('768x1024'\|'1152x1536')]`. |
| **Leffa** | `https://franciszzj-leffa.hf.space` | `leffa_predict_vt` with `[person, garment, ref_acceleration(false), steps(30\|50), guidance(2.5), seed, model_type('viton_hd'\|'dress_code'), garment_type('upper_body'\|'lower_body'\|'dresses'), repaint(false)]` |
| **IDM-VTON** | `https://yisol-idm-vton.hf.space` | `tryon` with `[{background:person,layers:[],composite:null}, garment, description, auto_mask(true), auto_crop(false), steps(30\|40), seed]` |

- **Category mapping:** `aodai` and `nguthan` use `Dresses` / `dress_code`. `tuthan` uses `upper`.
- **Auto order:**
  - Dress garments: FitDiT → Leffa → IDM.
  - Upper garments: FitDiT → IDM → Leffa.
  - On quota, error or empty output, the app falls back to the next engine and records each attempt.
- **Global timeout:** 5 minutes. **Result:** `pickUrl()` normalises string, `{url}`, `{path}`, `{image}` or array outputs.
- **CatVTON** (`zhengchong-catvton.hf.space`) returned 503 at last check. It is worth retrying as a 4th engine because it has good mask-free dress support.

### 4.4 FASHN Try-On Max
- `POST https://api.fashn.ai/v1/run` with `{model_name:'tryon-max', inputs:{model_image, product_image, generation_mode:'balanced', resolution:'1k'|'2k', num_images:1, output_format:'jpeg', return_base64:true}}`, returning `{id}`.
- Then `GET /v1/status/{id}` until the status is `completed` (`output[0]`) or `failed` (`error`).
- **Must be server-side only.** The prototype's "direct key" mode is dev-only.

### 4.5 UX states (keep all of them)
idle, validating, selected, invalid, submitting(stage), queued(stage, queuePos), processing(stage), completed(engine, elapsed, seed), failed(attempts[]), timeout. Plus: an `aria-live` status, Retry, a before/after clip-path slider, New variation, and the notice "AI visualization can alter garment details…".

## 5. IMPROVEMENT TASKS (priority order)

1. **Move all Try-On calls server-side.**
   - Implement a job queue: an in-memory Map, or Upstash/Redis.
   - `/start` returns a jobId. A server worker runs the Gradio/FASHN pipeline. `/status` streams stage, queuePos, attempts and the result.
   - HF_TOKEN and FASHN_API_KEY must never reach the client.
   - Add a rate limit of 5 jobs per IP per 10 minutes.
2. **Garment image quality (biggest quality lever).**
   - Run background removal on the garment image before Try-On. Options: `briaai/RMBG-1.4` or `ZhengPeng7/BiRefNet` via HF Space or transformers.js, or `@imgly/background-removal` in the browser.
   - For on-model library photos, extract the garment first with a human-parsing/segmentation model such as `mattmdjaga/segformer_b2_clothes` or SCHP, then crop.
   - Cache the cleaned product images per library item in storage.
3. **Person image checks** (replacing the aspect-ratio heuristic).
   - Use MediaPipe Pose (tasks-vision, client-side). Require shoulders, hips and knees to be visible for `Dresses`, and shoulders and hips for upper body. Warn on face-only or cropped images.
   - Auto-crop to the body bounding box plus 8% margin before padding to 3:4.
4. **Áo dài / ngũ thân length fidelity.**
   - Use FitDiT `Dresses` mode with `offset_bottom` raised (try 20–40) so the mask covers the full panel length.
   - Expose a "length" slider that maps to the mask offsets.
   - Run an A/B evaluation across engines on 10 test persons × 6 garments. Score with a small rubric: collar preserved, side slits, panel length, identity, artefacts.
5. **Multi-candidate generation.**
   - Run 2 seeds, or 2 engines in parallel, and show a candidate strip for the user to pick from. Optionally rank candidates automatically with a CLIP similarity score between the garment image and the masked output region.
6. **Post-processing.**
   - Optionally upscale and restore faces with Real-ESRGAN / CodeFormer (HF Spaces exist). Keep this as a toggle and label it clearly.
   - Copy the final output to Supabase before saving to the Lookbook.
7. **Artistic / editorial mode (optional, clearly labelled).**
   - After Try-On, offer an "Editorial background" pass that replaces only the background. Use SDXL inpainting with an inverted person mask and a prompt from the event and palette, for example "lacquer red studio backdrop, soft museum lighting". The garment and the person must stay untouched, so mask them out.
   - Label the result "Creative visualization". It never changes the cultural label.
8. **Library.**
   - Move `LIB` to the DB and add an admin review flag.
   - Add more Commons categories: `Category:Áo dài`, `Category:Áo tứ thân`, `Category:Nón quai thao`, `Category:Áo nhật bình`, `Category:Áo giao lĩnh`.
   - Keep `credit`, `licence` and `descriptionurl` mandatory. Store EXIF-free copies.
   - The Huế 1920s images are tagged `nguthan` but need verification by a cultural editor.
9. **Cultural data.** All `SRC` entries are seed data marked `review`. Add page citations, and add a `verified_by` and `verified_at` workflow.
10. **Tests (Vitest).**
    - Cultural engine:
      - `tuthan + street + sneakers + remix 80` must return Creative interpretation.
      - `nguthan + formal + [khanvan, hai] + remix 15` must return Historically grounded.
    - Weather: 33°C must produce the "reduce layering" tip.
    - Harmony bounds stay within 0–100.
    - Try-On status normalisation and the Gradio SSE parser, using recorded fixtures.
    - Zod validators.
11. **Accessibility and performance:** Lighthouse Performance >80 and Accessibility >90, using `next/image`. Lazy-load the library strip.

## 6. Non-negotiables (keep these)
- No fake AI output. Mock mode is allowed only with `NEXT_PUBLIC_DEMO_MODE=true` and a visible "Demo data" badge.
- The cultural classification is categorical, never a percentage. Weather advice never overrides cultural facts.
- The AI stylist text is rule-generated from the data. If an LLM rephrases it, the LLM must not add facts.
- Every image must have a visible credit. Every button must work; hide anything that is not implemented.

## 7. Acceptance criteria
`npm run build` and `npm test` pass. Real Try-On works with HF_TOKEN set, and the fallback works when one engine is down. Changing the occasion re-ranks the garments, styles, palettes, accessories, presets and library. VI/EN covers 100% of the UI. The mobile flow works end to end. No secrets appear in the client bundle.
