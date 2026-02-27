# Full Transcripts & Geocodio Geocoding

## Problem

Two gaps in the clip processing pipeline:

1. **Transcripts are null for all clips.** The current `captions.ts` uses YouTube's undocumented `/api/timedtext` endpoint, which returns empty 200 responses from server contexts (no browser session/cookies). 35/35 caption fetches fail in production.

2. **Location coordinates are approximate.** Lat/long comes from Claude's AI reasoning during classification. We want precise coordinates from Geocodio for every location.

## Solution

### Feature 1: Fix transcript fetching & store full text

Replace the broken timedtext API calls with the `youtube-transcript` npm package, which uses YouTube's Innertube API and works reliably from servers.

**Changes:**
- `src/lib/captions.ts` — Gut the internals (remove `listCaptions`, `downloadCaptionText`, `parseTimedText`). Replace with `YoutubeTranscript.fetchTranscript()`. Keep the same `fetchCaptions(videoId): Promise<string | null>` export signature.
- `src/lib/processor.ts` — Store the full untruncated transcript in `clip.transcript`.
- `src/lib/classifier.ts` — Triple the truncation limits for classification context (8K→24K for news clips, 16K→48K for public meetings). The classifier still receives truncated text; the DB gets the full text.
- No schema changes — the existing `transcript String?` field is sufficient.

**New dependency:** `youtube-transcript`

### Feature 2: Geocodio for all locations

After classification extracts city/county/state, always call Geocodio to get precise lat/long.

**Changes:**
- New file `src/lib/geocodio.ts` — Uses `geocodio-library-node`. Single export: `geocodeLocation(city, county, state) → {latitude, longitude} | null`. Constructs query from available components.
- `src/lib/processor.ts` — After classification, call `geocodeLocation()`. Use Geocodio coordinates for the Location upsert. Fall back to Claude's coordinates if Geocodio fails.
- `.env.example` — Add `GEOCODIO_API_KEY`.

**New dependency:** `geocodio-library-node`

### Geocodio query construction

- City present: `"city, state"` (e.g. `"Arlington, VA"`)
- Only county: `"county, state"` (e.g. `"Loudoun County, VA"`)
- Neither city nor county: skip Geocodio (state-level isn't useful for map pins)

### Error handling

- **Transcript failures:** Log warning, continue. Clip stored with `transcript: null`.
- **Geocodio failures:** Fall back to Claude's lat/long. If Claude also didn't provide coordinates, location created with `null` lat/long. Log warning, don't block processing.
- **No backfill** for existing clips. New clips going forward get proper transcripts and Geocodio coordinates.

## Files changed

| File | Change |
|------|--------|
| `src/lib/captions.ts` | Replace timedtext with youtube-transcript package |
| `src/lib/geocodio.ts` | New file — Geocodio API wrapper |
| `src/lib/processor.ts` | Store full transcript, add Geocodio call |
| `src/lib/classifier.ts` | Triple transcript truncation limits |
| `.env.example` | Add GEOCODIO_API_KEY |
| `package.json` | Add youtube-transcript, geocodio-library-node |
