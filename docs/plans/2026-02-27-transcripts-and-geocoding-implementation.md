# Full Transcripts & Geocodio Geocoding Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix broken transcript fetching so clips get full closed-caption text, and add Geocodio geocoding so every location gets precise lat/long coordinates.

**Architecture:** Replace the broken YouTube timedtext API in `src/lib/captions.ts` with the `youtube-transcript` npm package (Innertube API). Add a new `src/lib/geocodio.ts` module that calls the Geocodio API after classification to get precise coordinates. Both integrate into the existing processor pipeline in `src/lib/processor.ts`.

**Tech Stack:** youtube-transcript (Innertube API), geocodio-library-node, existing Prisma/PostgreSQL schema (no migrations needed).

---

### Task 1: Install new dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install packages**

Run:
```bash
npm install youtube-transcript geocodio-library-node
```

**Step 2: Verify installation**

Run:
```bash
node -e "require('youtube-transcript'); console.log('youtube-transcript OK')"
node -e "require('geocodio-library-node'); console.log('geocodio OK')"
```

Expected: Both print OK without errors.

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add youtube-transcript and geocodio-library-node dependencies"
```

---

### Task 2: Replace captions module with youtube-transcript

**Files:**
- Rewrite: `src/lib/captions.ts`

**Step 1: Replace the entire file**

Replace `src/lib/captions.ts` with:

```typescript
import { YoutubeTranscript } from 'youtube-transcript'

export async function fetchCaptions(videoId: string): Promise<string | null> {
  try {
    const segments = await YoutubeTranscript.fetchTranscript(videoId, {
      lang: 'en',
    })

    if (!segments || segments.length === 0) {
      console.warn(`No caption segments found for video ${videoId}`)
      return null
    }

    const fullText = segments.map((s) => s.text).join(' ')

    if (fullText.trim().length === 0) return null

    return fullText
  } catch (error) {
    console.warn(`Failed to fetch captions for video ${videoId}:`, error instanceof Error ? error.message : error)
    return null
  }
}
```

Key changes from the old implementation:
- Removes all internal functions (`listCaptions`, `downloadCaptionText`, `parseTimedText`)
- Removes `CaptionTrack` and `CaptionsListResponse` interfaces
- No longer needs `YOUTUBE_API_KEY` — the youtube-transcript package uses Innertube (no API key required)
- Same export signature: `fetchCaptions(videoId): Promise<string | null>`
- Logs warning on failure (not error) since missing captions are expected for some videos

**Step 2: Verify the module compiles**

Run:
```bash
npx tsx -e "import { fetchCaptions } from './src/lib/captions'; console.log(typeof fetchCaptions)"
```

Expected: `function`

**Step 3: Smoke test with a real video**

Run:
```bash
npx tsx -e "
import { fetchCaptions } from './src/lib/captions'
fetchCaptions('nzjxXGFxvQc').then(t => {
  if (t) { console.log('OK, length:', t.length, 'preview:', t.slice(0, 100)) }
  else { console.log('null — no captions found') }
}).catch(e => console.error('ERROR:', e))
"
```

Expected: Prints transcript text with a length > 0 (this video ID previously failed with the old implementation).

**Step 4: Commit**

```bash
git add src/lib/captions.ts
git commit -m "fix: replace broken timedtext API with youtube-transcript package"
```

---

### Task 3: Triple classifier transcript limits

**Files:**
- Modify: `src/lib/classifier.ts:50-53`

**Step 1: Update the TRANSCRIPT_LIMITS constant**

In `src/lib/classifier.ts`, change lines 50-53 from:

```typescript
const TRANSCRIPT_LIMITS: Record<ClipBucket, number> = {
  news_clip: 8000,
  public_meeting: 16000,
}
```

To:

```typescript
const TRANSCRIPT_LIMITS: Record<ClipBucket, number> = {
  news_clip: 24000,
  public_meeting: 48000,
}
```

**Step 2: Commit**

```bash
git add src/lib/classifier.ts
git commit -m "feat: triple classifier transcript limits to 24K/48K"
```

---

### Task 4: Create Geocodio module

**Files:**
- Create: `src/lib/geocodio.ts`

**Step 1: Create the geocodio module**

Create `src/lib/geocodio.ts` with:

```typescript
import Geocodio from 'geocodio-library-node'

let client: InstanceType<typeof Geocodio> | null = null

function getClient(): InstanceType<typeof Geocodio> | null {
  if (client) return client
  const apiKey = process.env.GEOCODIO_API_KEY
  if (!apiKey) {
    console.warn('GEOCODIO_API_KEY not set — skipping geocoding')
    return null
  }
  client = new Geocodio(apiKey)
  return client
}

export async function geocodeLocation(
  city: string | undefined,
  county: string | undefined,
  state: string
): Promise<{ latitude: number; longitude: number } | null> {
  const geocodio = getClient()
  if (!geocodio) return null

  // Build query from available components
  let query: string
  if (city) {
    query = `${city}, ${state}`
  } else if (county) {
    query = `${county}, ${state}`
  } else {
    // State-level geocoding isn't useful for map pins
    return null
  }

  try {
    const response = await geocodio.geocode(query)

    if (
      !response ||
      !response.results ||
      response.results.length === 0
    ) {
      console.warn(`Geocodio returned no results for "${query}"`)
      return null
    }

    const { lat, lng } = response.results[0].location
    return { latitude: lat, longitude: lng }
  } catch (error) {
    console.warn(
      `Geocodio failed for "${query}":`,
      error instanceof Error ? error.message : error
    )
    return null
  }
}
```

**Step 2: Verify the module compiles**

Run:
```bash
npx tsx -e "import { geocodeLocation } from './src/lib/geocodio'; console.log(typeof geocodeLocation)"
```

Expected: `function`

**Step 3: Commit**

```bash
git add src/lib/geocodio.ts
git commit -m "feat: add Geocodio geocoding module"
```

---

### Task 5: Integrate into processor pipeline

**Files:**
- Modify: `src/lib/processor.ts`

**Step 1: Add geocodio import**

In `src/lib/processor.ts`, add after line 4 (`import { fetchCaptions } from './captions'`):

```typescript
import { geocodeLocation } from './geocodio'
```

**Step 2: Add Geocodio call to location upsert block**

Replace lines 77-104 (the entire "Find or create location" block) with:

```typescript
        // Find or create location
        let locationId: string | null = null
        if (classification.location) {
          // Geocode with Geocodio for precise coordinates
          const geocoded = await geocodeLocation(
            classification.location.city,
            classification.location.county,
            classification.location.state
          )
          const latitude = geocoded?.latitude ?? classification.location.latitude
          const longitude = geocoded?.longitude ?? classification.location.longitude

          const location = await db.location.upsert({
            where: {
              city_county_state: {
                city: classification.location.city || '',
                county: classification.location.county || '',
                state: classification.location.state,
              },
            },
            create: {
              city: classification.location.city,
              county: classification.location.county,
              state: classification.location.state,
              latitude,
              longitude,
            },
            update: {
              clipCount: { increment: 1 },
              ...(latitude != null && {
                latitude,
                longitude,
              }),
            },
          })
          locationId = location.id
        }
```

Key changes:
- Calls `geocodeLocation()` before the upsert
- Uses Geocodio coordinates if available, falls back to Claude's coordinates
- Both create and update paths use the same resolved coordinates

**Step 3: Verify the processor compiles**

Run:
```bash
npx tsx -e "import { processNewClips } from './src/lib/processor'; console.log(typeof processNewClips)"
```

Expected: `function`

**Step 4: Commit**

```bash
git add src/lib/processor.ts
git commit -m "feat: integrate Geocodio geocoding into clip processing pipeline"
```

---

### Task 6: Update environment configuration

**Files:**
- Modify: `.env.example`

**Step 1: Add GEOCODIO_API_KEY to .env.example**

Add after the `YOUTUBE_API_KEY` line (line 9):

```
GEOCODIO_API_KEY="your-geocodio-api-key"
```

**Step 2: Commit**

```bash
git add .env.example
git commit -m "chore: add GEOCODIO_API_KEY to .env.example"
```

---

### Task 7: Build verification and final commit

**Step 1: Verify Next.js build**

Run:
```bash
npx next build
```

Expected: Build completes successfully with no errors.

**Step 2: Verify prisma generate still works**

Run:
```bash
npx prisma generate
```

Expected: Prisma Client generated successfully.

**Step 3: Squash into a single feature commit and push**

```bash
git reset --soft HEAD~6
git commit -m "feat: fix transcript fetching and add Geocodio geocoding

Replace broken YouTube timedtext API with youtube-transcript package
(Innertube API) so transcripts are actually fetched and stored. Triple
classifier transcript limits to 24K/48K. Add Geocodio geocoding for
precise location coordinates with fallback to Claude estimates."
git push origin main
```

---

## Post-Deploy Verification

After Railway deploys:
1. Check worker logs — transcripts should be fetched successfully (no more "Failed to download captions" for most videos)
2. Check database — `transcript` column should have non-null values for new clips
3. Check database — `Location` rows should have precise lat/long from Geocodio
4. Verify `GEOCODIO_API_KEY` is set in Railway environment variables
