# YouTube-Focused V1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Pivot the product to YouTube-only with two-bucket search, caption-based AI classification, thumbnail storage, and LinkedIn social posting.

**Architecture:** Two-pass pipeline — Pass 1 searches YouTube and filters by duration/captions, Pass 2 fetches captions, classifies with Claude, downloads thumbnails, and stores qualifying clips. LinkedIn integration via OAuth with AI-generated draft posts and one-click publish.

**Tech Stack:** Next.js 16 / TypeScript / Prisma / PostgreSQL / YouTube Data API v3 / Anthropic Claude / LinkedIn API / Tailwind CSS 4

---

### Task 1: Database Schema Migration

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `.env.example`

**Step 1: Update the Prisma schema**

Add the new enums, fields, and models. Replace the entire contents of `prisma/schema.prisma` with:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum SourceType {
  news
  youtube
  bluesky
  government
}

enum Importance {
  high
  medium
  low
}

enum DigestFrequency {
  daily
  weekly
}

enum ImportanceFilter {
  high_only
  high_and_medium
  all
}

enum ClipBucket {
  news_clip
  public_meeting
}

enum PostStatus {
  draft
  posted
  failed
}

model Location {
  id        String   @id @default(uuid())
  city      String?
  county    String?
  state     String   @db.Char(2)
  latitude  Float?
  longitude Float?
  firstSeen DateTime @default(now())
  clipCount Int      @default(0)
  clips     Clip[]

  @@unique([city, county, state])
  @@index([state])
}

model Clip {
  id             String     @id @default(uuid())
  url            String     @unique
  title          String
  summary        String?
  content        String?
  sourceType     SourceType
  sourceName     String
  publishedAt    DateTime?
  discoveredAt   DateTime   @default(now())
  locationId     String?
  location       Location?  @relation(fields: [locationId], references: [id])
  importance     Importance @default(medium)
  topics         String[]
  rawData        Json?
  stars          Star[]
  bucket         ClipBucket @default(news_clip)
  durationSecs   Int?
  transcript     String?
  thumbnailPath  String?
  relevanceScore Int?
  companies      String[]
  govEntities    String[]
  videoId        String?    @unique
  linkedInPosts  LinkedInPost[]

  @@index([importance])
  @@index([discoveredAt])
  @@index([locationId])
  @@index([bucket])
}

model User {
  id                   String            @id @default(uuid())
  email                String            @unique
  name                 String
  passwordHash         String
  createdAt            DateTime          @default(now())
  digestPreference     DigestPreference?
  stars                Star[]
  linkedinAccessToken  String?
  linkedinTokenExpiry  DateTime?
  linkedInPosts        LinkedInPost[]
}

model DigestPreference {
  id         String           @id @default(uuid())
  userId     String           @unique
  user       User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  frequency  DigestFrequency  @default(daily)
  topics     String[]
  states     String[]
  importance ImportanceFilter @default(high_and_medium)
}

model Star {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  clipId    String
  clip      Clip     @relation(fields: [clipId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())

  @@unique([userId, clipId])
}

model LinkedInPost {
  id         String     @id @default(uuid())
  clipId     String
  clip       Clip       @relation(fields: [clipId], references: [id], onDelete: Cascade)
  userId     String
  user       User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  draftText  String
  finalText  String?
  linkedInId String?
  status     PostStatus @default(draft)
  createdAt  DateTime   @default(now())
  postedAt   DateTime?
}
```

**Step 2: Add LinkedIn env vars to .env.example**

Append to `.env.example`:

```
LINKEDIN_CLIENT_ID="your-linkedin-client-id"
LINKEDIN_CLIENT_SECRET="your-linkedin-client-secret"
LINKEDIN_REDIRECT_URI="http://localhost:3000/api/auth/linkedin/callback"

MIN_RELEVANCE_SCORE="7"
```

**Step 3: Generate and apply migration**

Run: `npx prisma migrate dev --name youtube_v1_schema`

Expected: Migration created and applied. Prisma Client regenerated.

**Step 4: Verify schema**

Run: `npx prisma db push --dry-run`

Expected: No changes needed (already in sync).

**Step 5: Commit**

```bash
git add prisma/schema.prisma .env.example prisma/migrations/
git commit -m "feat: add YouTube v1 schema — buckets, captions, LinkedIn, lat/long"
```

---

### Task 2: Update Types and Source Registration

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/sources/types.ts`
- Modify: `src/lib/sources/index.ts`

**Step 1: Extend ClassificationResult in `src/lib/types.ts`**

Replace the entire file with:

```typescript
export const TOPICS = [
  'zoning',
  'opposition',
  'environmental',
  'announcement',
  'government',
  'legal',
] as const

export type Topic = (typeof TOPICS)[number]

export const STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
  'DC',
] as const

export type State = (typeof STATES)[number]

export type ClipBucket = 'news_clip' | 'public_meeting'

export interface ClassificationResult {
  location: {
    city?: string
    county?: string
    state: State
    latitude?: number
    longitude?: number
  }
  companies: string[]
  govEntities: string[]
  topics: Topic[]
  importance: 'high' | 'medium' | 'low'
  summary: string
  relevanceScore: number
}
```

**Step 2: Update RawClip in `src/lib/sources/types.ts`**

Replace the entire file with:

```typescript
import { ClipBucket } from '../types'

export interface RawClip {
  url: string
  title: string
  content?: string
  sourceName: string
  publishedAt?: Date
  rawData?: Record<string, unknown>
  videoId?: string
  durationSecs?: number
  bucket?: ClipBucket
  thumbnailUrl?: string
}

export interface SourceFetcher {
  name: string
  sourceType: 'news' | 'youtube' | 'bluesky' | 'government'
  fetch(): Promise<RawClip[]>
}
```

**Step 3: Comment out non-YouTube sources in `src/lib/sources/index.ts`**

Replace the entire file with:

```typescript
import { SourceFetcher } from './types'

const sources: SourceFetcher[] = []

export function registerSource(source: SourceFetcher) {
  sources.push(source)
}

export function getSources(): SourceFetcher[] {
  return [...sources]
}

export async function fetchAllSources(): Promise<
  { source: SourceFetcher; clips: Awaited<ReturnType<SourceFetcher['fetch']>> }[]
> {
  const results = await Promise.allSettled(
    sources.map(async (source) => ({
      source,
      clips: await source.fetch(),
    }))
  )

  return results
    .filter((r): r is PromiseFulfilledResult<{ source: SourceFetcher; clips: Awaited<ReturnType<SourceFetcher['fetch']>> }> =>
      r.status === 'fulfilled'
    )
    .map((r) => r.value)
}

export * from './types'

// v1: YouTube only. Uncomment these for v2:
// import { googleNewsFetcher } from './google-news'
// import { blueskyFetcher } from './bluesky'
// registerSource(googleNewsFetcher)
// registerSource(blueskyFetcher)

import { youtubeFetcher } from './youtube'
registerSource(youtubeFetcher)
```

**Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

Expected: No errors (or only pre-existing ones from unchanged files).

**Step 5: Commit**

```bash
git add src/lib/types.ts src/lib/sources/types.ts src/lib/sources/index.ts
git commit -m "feat: update types for v1 — extended classification, comment out non-YouTube sources"
```

---

### Task 3: Rewrite YouTube Fetcher with Two-Bucket Search

**Files:**
- Modify: `src/lib/sources/youtube.ts`

**Step 1: Rewrite the YouTube fetcher**

Replace the entire contents of `src/lib/sources/youtube.ts` with:

```typescript
import { SourceFetcher, RawClip } from './types'
import { ClipBucket } from '../types'

interface YouTubeSearchItem {
  id: { videoId: string }
  snippet: {
    title: string
    description: string
    publishedAt: string
    channelTitle: string
  }
}

interface YouTubeSearchResponse {
  items?: YouTubeSearchItem[]
  nextPageToken?: string
}

interface YouTubeVideoItem {
  id: string
  snippet: {
    title: string
    description: string
    publishedAt: string
    channelTitle: string
    thumbnails: {
      high?: { url: string }
      maxres?: { url: string }
    }
  }
  contentDetails: {
    duration: string // ISO 8601 duration, e.g. "PT4M13S"
    caption: string  // "true" or "false"
  }
}

interface YouTubeVideosResponse {
  items?: YouTubeVideoItem[]
}

interface BucketConfig {
  bucket: ClipBucket
  query: string
  videoDurations: string[] // YouTube API videoDuration param values
  minDurationSecs: number
  maxDurationSecs: number
}

const BUCKET_CONFIGS: BucketConfig[] = [
  {
    bucket: 'news_clip',
    query: '"data center"',
    videoDurations: ['short', 'medium'],
    minDurationSecs: 0,
    maxDurationSecs: 300, // <= 5 minutes
  },
  {
    bucket: 'public_meeting',
    query: '"data center" public meeting OR hearing OR town hall OR council',
    videoDurations: ['long'],
    minDurationSecs: 3600, // >= 60 minutes
    maxDurationSecs: Infinity,
  },
]

/**
 * Parse ISO 8601 duration string (e.g. "PT1H2M3S") to seconds.
 */
function parseDuration(iso8601: string): number {
  const match = iso8601.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return 0
  const hours = parseInt(match[1] || '0', 10)
  const minutes = parseInt(match[2] || '0', 10)
  const seconds = parseInt(match[3] || '0', 10)
  return hours * 3600 + minutes * 60 + seconds
}

/**
 * Get the publishedAfter timestamp (6 hours ago) for incremental fetching.
 */
function getPublishedAfter(): string {
  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000)
  return sixHoursAgo.toISOString()
}

/**
 * Search YouTube with pagination, returning all video IDs.
 */
async function searchYouTube(
  apiKey: string,
  query: string,
  videoDuration: string,
  publishedAfter: string
): Promise<string[]> {
  const videoIds: string[] = []
  let pageToken: string | undefined

  do {
    const params = new URLSearchParams({
      part: 'id',
      q: query,
      type: 'video',
      videoCaption: 'closedCaption',
      videoDuration,
      regionCode: 'US',
      order: 'date',
      maxResults: '50',
      publishedAfter,
      key: apiKey,
    })

    if (pageToken) {
      params.set('pageToken', pageToken)
    }

    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/search?${params}`
    )

    if (!response.ok) {
      console.error(`YouTube search API error: ${response.status} for query "${query}" duration "${videoDuration}"`)
      break
    }

    const data: YouTubeSearchResponse = await response.json()

    if (data.items) {
      for (const item of data.items) {
        videoIds.push(item.id.videoId)
      }
    }

    pageToken = data.nextPageToken
  } while (pageToken)

  return videoIds
}

/**
 * Fetch video details in batches of 50.
 */
async function getVideoDetails(
  apiKey: string,
  videoIds: string[]
): Promise<YouTubeVideoItem[]> {
  const allItems: YouTubeVideoItem[] = []

  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50)
    const params = new URLSearchParams({
      part: 'snippet,contentDetails',
      id: batch.join(','),
      key: apiKey,
    })

    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?${params}`
    )

    if (!response.ok) {
      console.error(`YouTube videos API error: ${response.status}`)
      continue
    }

    const data: YouTubeVideosResponse = await response.json()
    if (data.items) {
      allItems.push(...data.items)
    }
  }

  return allItems
}

export const youtubeFetcher: SourceFetcher = {
  name: 'YouTube',
  sourceType: 'youtube',

  async fetch(): Promise<RawClip[]> {
    const apiKey = process.env.YOUTUBE_API_KEY
    if (!apiKey) {
      console.warn('YouTube API key not configured')
      return []
    }

    const allClips: RawClip[] = []
    const seenIds = new Set<string>()
    const publishedAfter = getPublishedAfter()

    for (const config of BUCKET_CONFIGS) {
      for (const videoDuration of config.videoDurations) {
        try {
          // Pass 1: Search for video IDs
          const videoIds = await searchYouTube(
            apiKey,
            config.query,
            videoDuration,
            publishedAfter
          )

          if (videoIds.length === 0) continue

          // Deduplicate across buckets
          const newIds = videoIds.filter((id) => !seenIds.has(id))
          newIds.forEach((id) => seenIds.add(id))

          if (newIds.length === 0) continue

          // Pass 1 continued: Get video details for duration filtering
          const videos = await getVideoDetails(apiKey, newIds)

          for (const video of videos) {
            const durationSecs = parseDuration(video.contentDetails.duration)

            // Apply exact duration filter
            if (
              durationSecs < config.minDurationSecs ||
              durationSecs > config.maxDurationSecs
            ) {
              continue
            }

            const thumbnailUrl =
              video.snippet.thumbnails.maxres?.url ||
              video.snippet.thumbnails.high?.url ||
              ''

            allClips.push({
              url: `https://www.youtube.com/watch?v=${video.id}`,
              title: video.snippet.title,
              content: video.snippet.description,
              sourceName: video.snippet.channelTitle,
              publishedAt: new Date(video.snippet.publishedAt),
              rawData: video as unknown as Record<string, unknown>,
              videoId: video.id,
              durationSecs,
              bucket: config.bucket,
              thumbnailUrl,
            })
          }
        } catch (error) {
          console.error(
            `Failed YouTube fetch for bucket "${config.bucket}" duration "${videoDuration}":`,
            error
          )
        }
      }
    }

    console.log(
      `YouTube fetcher: found ${allClips.length} qualifying videos ` +
      `(${allClips.filter((c) => c.bucket === 'news_clip').length} news, ` +
      `${allClips.filter((c) => c.bucket === 'public_meeting').length} meetings)`
    )

    return allClips
  },
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

Expected: No errors from this file.

**Step 3: Commit**

```bash
git add src/lib/sources/youtube.ts
git commit -m "feat: rewrite YouTube fetcher with two-bucket search and pagination"
```

---

### Task 4: Caption Fetching Module

**Files:**
- Create: `src/lib/captions.ts`

**Step 1: Create the captions fetcher**

Create `src/lib/captions.ts`:

```typescript
interface CaptionTrack {
  id: string
  snippet: {
    language: string
    trackKind: string
    name: string
  }
}

interface CaptionsListResponse {
  items?: CaptionTrack[]
}

/**
 * Fetch available caption tracks for a video.
 */
async function listCaptions(
  apiKey: string,
  videoId: string
): Promise<CaptionTrack[]> {
  const params = new URLSearchParams({
    part: 'snippet',
    videoId,
    key: apiKey,
  })

  const response = await fetch(
    `https://www.googleapis.com/youtube/v3/captions?${params}`
  )

  if (!response.ok) {
    console.error(`Captions list API error for ${videoId}: ${response.status}`)
    return []
  }

  const data: CaptionsListResponse = await response.json()
  return data.items || []
}

/**
 * Download caption track text. The YouTube captions.download endpoint
 * requires OAuth for third-party videos. For videos we don't own,
 * we fall back to the community-accessible timedtext endpoint.
 */
async function downloadCaptionText(
  videoId: string
): Promise<string | null> {
  // Use the publicly accessible timedtext endpoint for auto-generated captions
  const params = new URLSearchParams({
    v: videoId,
    lang: 'en',
    fmt: 'srv3', // XML format with text
  })

  const response = await fetch(
    `https://www.youtube.com/api/timedtext?${params}`
  )

  if (!response.ok) {
    // Try auto-generated captions
    params.set('kind', 'asr')
    const asrResponse = await fetch(
      `https://www.youtube.com/api/timedtext?${params}`
    )

    if (!asrResponse.ok) {
      return null
    }

    const xml = await asrResponse.text()
    return parseTimedText(xml)
  }

  const xml = await response.text()
  return parseTimedText(xml)
}

/**
 * Parse YouTube timedtext XML (srv3 format) into plain text.
 * Format: <transcript><text start="0" dur="5.2">Hello world</text>...</transcript>
 */
function parseTimedText(xml: string): string | null {
  if (!xml || xml.trim().length === 0) return null

  // Extract text content from <text> elements
  const textRegex = /<text[^>]*>([\s\S]*?)<\/text>/g
  const segments: string[] = []
  let match

  while ((match = textRegex.exec(xml)) !== null) {
    let text = match[1]
    // Decode HTML entities
    text = text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\n/g, ' ')
      .trim()

    if (text.length > 0) {
      segments.push(text)
    }
  }

  if (segments.length === 0) return null

  return segments.join(' ')
}

/**
 * Fetch closed captions for a YouTube video.
 * Returns the full transcript as plain text, or null if unavailable.
 */
export async function fetchCaptions(videoId: string): Promise<string | null> {
  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) return null

  try {
    // First check if captions exist via the API
    const tracks = await listCaptions(apiKey, videoId)
    const englishTrack = tracks.find(
      (t) => t.snippet.language === 'en' || t.snippet.language.startsWith('en')
    )

    if (!englishTrack && tracks.length === 0) {
      console.warn(`No caption tracks found for video ${videoId}`)
      return null
    }

    // Download the caption text
    const transcript = await downloadCaptionText(videoId)

    if (!transcript) {
      console.warn(`Failed to download captions for video ${videoId}`)
      return null
    }

    return transcript
  } catch (error) {
    console.error(`Caption fetch failed for video ${videoId}:`, error)
    return null
  }
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

Expected: No errors.

**Step 3: Commit**

```bash
git add src/lib/captions.ts
git commit -m "feat: add YouTube captions fetcher with timedtext parsing"
```

---

### Task 5: Enhanced AI Classifier

**Files:**
- Modify: `src/lib/classifier.ts`

**Step 1: Rewrite the classifier with enhanced prompt and validation**

Replace the entire contents of `src/lib/classifier.ts` with:

```typescript
import { anthropic } from './claude'
import { ClassificationResult, TOPICS, STATES, Topic, State, ClipBucket } from './types'

const CLASSIFICATION_PROMPT = `You are a news classifier for a data center monitoring service focused on US data center developments. Analyze the following video and extract structured data.

Classify based on ALL provided information: title, description, channel name, and closed caption transcript.

Extract the following:

1. **Location**: The US city, county, and state where this data center activity is happening. Include approximate latitude and longitude.
2. **Companies**: All companies mentioned (data center operators, developers, tech companies, utilities, etc.)
3. **Government Entities**: All government bodies mentioned (e.g., "Loudoun County Board of Supervisors", "Virginia DEQ", etc.)
4. **Topics**: One or more from: zoning, opposition, environmental, announcement, government, legal
5. **Importance**: high, medium, or low:
   - HIGH: Active opposition (protests, petitions), upcoming votes/hearings, new major announcements, lawsuits filed
   - MEDIUM: General coverage of existing projects, routine permit updates, environmental studies released
   - LOW: Passing mentions, opinion pieces, industry analysis without local specifics
6. **Summary**: {{SUMMARY_LENGTH}}
7. **Relevance Score**: 1-10 rating of how specifically this content is about a US data center development:
   - 9-10: Directly about a specific data center project in a specific US location
   - 7-8: About data center policy, zoning, or opposition in a specific US area
   - 5-6: About data centers generally but with some US location context
   - 3-4: Mentions data centers but primarily about something else
   - 1-2: Tangentially related or not really about data centers

Respond ONLY with valid JSON in this exact format:
{
  "location": {
    "city": "string or null",
    "county": "string or null",
    "state": "two-letter state code",
    "latitude": number or null,
    "longitude": number or null
  },
  "companies": ["company1", "company2"],
  "govEntities": ["entity1", "entity2"],
  "topics": ["topic1", "topic2"],
  "importance": "high|medium|low",
  "summary": "Summary text here",
  "relevanceScore": 7
}

Video title: {{TITLE}}
Channel: {{CHANNEL}}
Description: {{DESCRIPTION}}

Closed caption transcript:
{{TRANSCRIPT}}`

const TRANSCRIPT_LIMITS: Record<ClipBucket, number> = {
  news_clip: 8000,
  public_meeting: 16000,
}

const SUMMARY_LENGTHS: Record<ClipBucket, string> = {
  news_clip: 'A 2-3 sentence plain-English summary of the key points',
  public_meeting: 'A 4-6 sentence plain-English summary covering the main topics discussed, key decisions or proposals, and any opposition or public comments',
}

export async function classifyClip(
  title: string,
  description: string,
  channelName: string,
  transcript: string | null,
  bucket: ClipBucket
): Promise<ClassificationResult | null> {
  try {
    const transcriptLimit = TRANSCRIPT_LIMITS[bucket]
    const summaryLength = SUMMARY_LENGTHS[bucket]
    const truncatedTranscript = transcript
      ? transcript.slice(0, transcriptLimit)
      : 'No transcript available'

    const prompt = CLASSIFICATION_PROMPT
      .replace('{{TITLE}}', title)
      .replace('{{CHANNEL}}', channelName)
      .replace('{{DESCRIPTION}}', description.slice(0, 2000))
      .replace('{{TRANSCRIPT}}', truncatedTranscript)
      .replace('{{SUMMARY_LENGTH}}', summaryLength)

    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    })

    const text = response.content[0]
    if (text.type !== 'text') {
      return null
    }

    const result = JSON.parse(text.text) as ClassificationResult

    if (!isValidClassification(result)) {
      console.error('Invalid classification result:', result)
      return null
    }

    return result
  } catch (error) {
    console.error('Classification failed:', error)
    return null
  }
}

function isValidClassification(result: unknown): result is ClassificationResult {
  if (!result || typeof result !== 'object') return false

  const r = result as Record<string, unknown>

  // Check location
  if (!r.location || typeof r.location !== 'object') return false
  const loc = r.location as Record<string, unknown>
  if (typeof loc.state !== 'string' || !STATES.includes(loc.state as State)) return false

  // Check topics
  if (!Array.isArray(r.topics) || r.topics.length === 0) return false
  if (!r.topics.every((t) => TOPICS.includes(t as Topic))) return false

  // Check importance
  if (!['high', 'medium', 'low'].includes(r.importance as string)) return false

  // Check summary
  if (typeof r.summary !== 'string' || r.summary.length === 0) return false

  // Check relevance score
  if (typeof r.relevanceScore !== 'number' || r.relevanceScore < 1 || r.relevanceScore > 10) return false

  // Check arrays (can be empty)
  if (!Array.isArray(r.companies)) return false
  if (!Array.isArray(r.govEntities)) return false

  return true
}

export function getDefaultClassification(): Omit<ClassificationResult, 'location'> {
  return {
    topics: ['unclassified'] as unknown as Topic[],
    importance: 'medium',
    summary: 'Classification pending',
    relevanceScore: 0,
    companies: [],
    govEntities: [],
  }
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

Expected: No errors.

**Step 3: Commit**

```bash
git add src/lib/classifier.ts
git commit -m "feat: enhanced classifier with transcript, lat/long, companies, relevance score"
```

---

### Task 6: Thumbnail Downloader

**Files:**
- Create: `src/lib/thumbnails.ts`

**Step 1: Create the thumbnail download utility**

Create `src/lib/thumbnails.ts`:

```typescript
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

const THUMBNAILS_DIR = path.join(process.cwd(), 'public', 'thumbnails')

/**
 * Download a YouTube thumbnail and store it locally.
 * Returns the relative path for serving via Next.js public dir, or null on failure.
 */
export async function downloadThumbnail(
  videoId: string,
  thumbnailUrl: string
): Promise<string | null> {
  if (!thumbnailUrl) return null

  try {
    // Ensure thumbnails directory exists
    if (!existsSync(THUMBNAILS_DIR)) {
      await mkdir(THUMBNAILS_DIR, { recursive: true })
    }

    const filename = `${videoId}.jpg`
    const filepath = path.join(THUMBNAILS_DIR, filename)

    // Skip if already downloaded
    if (existsSync(filepath)) {
      return `/thumbnails/${filename}`
    }

    const response = await fetch(thumbnailUrl)
    if (!response.ok) {
      console.error(`Thumbnail download failed for ${videoId}: ${response.status}`)
      return null
    }

    const buffer = Buffer.from(await response.arrayBuffer())
    await writeFile(filepath, buffer)

    return `/thumbnails/${filename}`
  } catch (error) {
    console.error(`Thumbnail download error for ${videoId}:`, error)
    return null
  }
}
```

**Step 2: Create the thumbnails directory and add .gitkeep**

Run: `mkdir -p public/thumbnails && touch public/thumbnails/.gitkeep`

**Step 3: Add thumbnails to .gitignore (keep only .gitkeep)**

Add to `.gitignore`:

```
public/thumbnails/*
!public/thumbnails/.gitkeep
```

**Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

Expected: No errors.

**Step 5: Commit**

```bash
git add src/lib/thumbnails.ts public/thumbnails/.gitkeep .gitignore
git commit -m "feat: add thumbnail downloader for YouTube videos"
```

---

### Task 7: Rewrite Processor Pipeline

**Files:**
- Modify: `src/lib/processor.ts`

**Step 1: Rewrite the processor with two-pass pipeline, captions, thumbnails, and relevance gating**

Replace the entire contents of `src/lib/processor.ts` with:

```typescript
import { db } from './db'
import { classifyClip, getDefaultClassification } from './classifier'
import { RawClip, fetchAllSources } from './sources'
import { fetchCaptions } from './captions'
import { downloadThumbnail } from './thumbnails'
import { Prisma } from '@prisma/client'
import { ClipBucket } from './types'

const MIN_RELEVANCE_SCORE = parseInt(process.env.MIN_RELEVANCE_SCORE || '7', 10)

export async function processNewClips(): Promise<{
  processed: number
  skippedRelevance: number
  skippedDuplicate: number
  errors: number
}> {
  const results = await fetchAllSources()
  let processed = 0
  let skippedRelevance = 0
  let skippedDuplicate = 0
  let errors = 0

  for (const { source, clips } of results) {
    for (const rawClip of clips) {
      try {
        // Check if clip already exists (by URL or videoId)
        const existing = rawClip.videoId
          ? await db.clip.findFirst({
              where: {
                OR: [
                  { url: rawClip.url },
                  { videoId: rawClip.videoId },
                ],
              },
            })
          : await db.clip.findUnique({
              where: { url: rawClip.url },
            })

        if (existing) {
          skippedDuplicate++
          continue
        }

        const bucket: ClipBucket = rawClip.bucket || 'news_clip'

        // Pass 2: Fetch captions for qualifying videos
        let transcript: string | null = null
        if (rawClip.videoId) {
          transcript = await fetchCaptions(rawClip.videoId)
        }

        // Classify the clip with full context
        const classification = await classifyClip(
          rawClip.title,
          rawClip.content || '',
          rawClip.sourceName,
          transcript,
          bucket
        )

        // Relevance gating: skip clips below threshold
        if (!classification || classification.relevanceScore < MIN_RELEVANCE_SCORE) {
          console.log(
            `Skipping "${rawClip.title}" — relevance ${classification?.relevanceScore ?? 'null'} < ${MIN_RELEVANCE_SCORE}`
          )
          skippedRelevance++
          continue
        }

        // Download thumbnail
        let thumbnailPath: string | null = null
        if (rawClip.videoId && rawClip.thumbnailUrl) {
          thumbnailPath = await downloadThumbnail(rawClip.videoId, rawClip.thumbnailUrl)
        }

        // Find or create location
        let locationId: string | null = null
        if (classification.location) {
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
              latitude: classification.location.latitude,
              longitude: classification.location.longitude,
            },
            update: {
              clipCount: { increment: 1 },
              // Update lat/long if we didn't have it before
              ...(classification.location.latitude != null && {
                latitude: classification.location.latitude,
                longitude: classification.location.longitude,
              }),
            },
          })
          locationId = location.id
        }

        // Create the clip
        await db.clip.create({
          data: {
            url: rawClip.url,
            title: rawClip.title,
            content: rawClip.content,
            summary: classification.summary,
            sourceType: source.sourceType,
            sourceName: rawClip.sourceName,
            publishedAt: rawClip.publishedAt,
            locationId,
            importance: classification.importance,
            topics: classification.topics,
            rawData: rawClip.rawData as Prisma.JsonObject,
            bucket,
            durationSecs: rawClip.durationSecs,
            transcript,
            thumbnailPath,
            relevanceScore: classification.relevanceScore,
            companies: classification.companies,
            govEntities: classification.govEntities,
            videoId: rawClip.videoId,
          },
        })

        processed++
        console.log(
          `Processed: "${rawClip.title}" [${bucket}] relevance=${classification.relevanceScore}`
        )
      } catch (error) {
        console.error(`Failed to process clip ${rawClip.url}:`, error)
        errors++
      }
    }
  }

  return { processed, skippedRelevance, skippedDuplicate, errors }
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

Expected: No errors.

**Step 3: Commit**

```bash
git add src/lib/processor.ts
git commit -m "feat: rewrite processor with captions, thumbnails, relevance gating"
```

---

### Task 8: Update Worker Schedule

**Files:**
- Modify: `worker/index.ts`

**Step 1: Update the worker to run every 6 hours aligned to ET schedule**

Replace the entire contents of `worker/index.ts` with:

```typescript
import { processNewClips } from '../src/lib/processor'
import {
  sendDailyDigests,
  sendWeeklyDigests,
  shouldSendDailyDigest,
  shouldSendWeeklyDigest,
} from './digest'

const SIX_HOURS_MS = 6 * 60 * 60 * 1000
const CHECK_INTERVAL_MS = 5 * 60 * 1000 // Check every 5 minutes
const RUN_HOURS_ET = [6, 12, 18, 0] // 6am, 12pm, 6pm, 12am ET

let lastDailyDigest: string | null = null
let lastWeeklyDigest: string | null = null
let lastRunHour: number | null = null

function getCurrentETHour(): number {
  const now = new Date()
  const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))
  return et.getHours()
}

function shouldRunNow(): boolean {
  const currentHour = getCurrentETHour()
  if (!RUN_HOURS_ET.includes(currentHour)) return false
  if (lastRunHour === currentHour) return false
  return true
}

async function runWorker() {
  console.log('Worker started — running every 6 hours (6am, 12pm, 6pm, 12am ET)')

  while (true) {
    try {
      if (shouldRunNow()) {
        const currentHour = getCurrentETHour()
        lastRunHour = currentHour

        // Process new clips
        console.log(`[${new Date().toISOString()}] Processing clips (${currentHour}:00 ET run)...`)
        const result = await processNewClips()
        console.log(
          `[${new Date().toISOString()}] Done: ${result.processed} stored, ` +
          `${result.skippedRelevance} low-relevance, ` +
          `${result.skippedDuplicate} duplicates, ` +
          `${result.errors} errors`
        )
      }

      // Check for digest sending
      const today = new Date().toISOString().split('T')[0]

      if (shouldSendDailyDigest() && lastDailyDigest !== today) {
        console.log(`[${new Date().toISOString()}] Sending daily digests...`)
        await sendDailyDigests()
        lastDailyDigest = today
      }

      if (shouldSendWeeklyDigest() && lastWeeklyDigest !== today) {
        console.log(`[${new Date().toISOString()}] Sending weekly digests...`)
        await sendWeeklyDigests()
        lastWeeklyDigest = today
      }
    } catch (error) {
      console.error('Worker error:', error)
    }

    await sleep(CHECK_INTERVAL_MS)
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

runWorker()
```

**Step 2: Commit**

```bash
git add worker/index.ts
git commit -m "feat: update worker to 6-hour schedule aligned to ET"
```

---

### Task 9: Update Clips API with Bucket Filter

**Files:**
- Modify: `src/app/api/clips/route.ts`

**Step 1: Add bucket filter support to the clips API**

Replace the entire contents of `src/app/api/clips/route.ts` with:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')
  const importance = searchParams.get('importance')
  const topic = searchParams.get('topic')
  const state = searchParams.get('state')
  const bucket = searchParams.get('bucket')
  const search = searchParams.get('search')

  const where: Prisma.ClipWhereInput = {}

  if (importance) {
    where.importance = importance as 'high' | 'medium' | 'low'
  }

  if (topic) {
    where.topics = { has: topic }
  }

  if (state) {
    where.location = { state }
  }

  if (bucket) {
    where.bucket = bucket as 'news_clip' | 'public_meeting'
  }

  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { summary: { contains: search, mode: 'insensitive' } },
      { content: { contains: search, mode: 'insensitive' } },
    ]
  }

  const [clips, total] = await Promise.all([
    db.clip.findMany({
      where,
      include: {
        location: true,
        stars: {
          where: { userId: session.user.id },
          select: { id: true },
        },
      },
      orderBy: { discoveredAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.clip.count({ where }),
  ])

  return NextResponse.json({
    clips: clips.map((clip) => ({
      ...clip,
      isStarred: clip.stars.length > 0,
      stars: undefined,
    })),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  })
}
```

**Step 2: Commit**

```bash
git add src/app/api/clips/route.ts
git commit -m "feat: replace sourceType filter with bucket filter in clips API"
```

---

### Task 10: Update Filter Sidebar UI

**Files:**
- Modify: `src/components/filter-sidebar.tsx`

**Step 1: Replace source type filter with bucket filter**

Replace the entire contents of `src/components/filter-sidebar.tsx` with:

```typescript
'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { TOPICS, STATES } from '@/lib/types'

const BUCKETS = [
  { value: 'news_clip', label: 'News Clips' },
  { value: 'public_meeting', label: 'Public Meetings' },
]

export function FilterSidebar() {
  const router = useRouter()
  const searchParams = useSearchParams()

  function updateFilter(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    params.delete('page')
    router.push(`/?${params.toString()}`)
  }

  const currentImportance = searchParams.get('importance')
  const currentTopic = searchParams.get('topic')
  const currentState = searchParams.get('state')
  const currentBucket = searchParams.get('bucket')

  return (
    <aside className="w-64 flex-shrink-0 space-y-6">
      <div>
        <h3 className="text-sm font-medium text-gray-900 mb-2">Type</h3>
        <div className="space-y-1">
          {BUCKETS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() =>
                updateFilter('bucket', currentBucket === value ? null : value)
              }
              className={`block w-full text-left px-3 py-1.5 text-sm rounded ${
                currentBucket === value
                  ? 'bg-blue-100 text-blue-700'
                  : 'hover:bg-gray-100'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-gray-900 mb-2">Importance</h3>
        <div className="space-y-1">
          {['high', 'medium', 'low'].map((imp) => (
            <button
              key={imp}
              onClick={() =>
                updateFilter('importance', currentImportance === imp ? null : imp)
              }
              className={`block w-full text-left px-3 py-1.5 text-sm rounded ${
                currentImportance === imp
                  ? 'bg-blue-100 text-blue-700'
                  : 'hover:bg-gray-100'
              }`}
            >
              {imp.charAt(0).toUpperCase() + imp.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-gray-900 mb-2">Topic</h3>
        <div className="space-y-1">
          {TOPICS.map((topic) => (
            <button
              key={topic}
              onClick={() =>
                updateFilter('topic', currentTopic === topic ? null : topic)
              }
              className={`block w-full text-left px-3 py-1.5 text-sm rounded ${
                currentTopic === topic
                  ? 'bg-blue-100 text-blue-700'
                  : 'hover:bg-gray-100'
              }`}
            >
              {topic.charAt(0).toUpperCase() + topic.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-gray-900 mb-2">State</h3>
        <select
          value={currentState || ''}
          onChange={(e) => updateFilter('state', e.target.value || null)}
          className="w-full border rounded px-2 py-1.5 text-sm"
        >
          <option value="">All states</option>
          {STATES.map((state) => (
            <option key={state} value={state}>
              {state}
            </option>
          ))}
        </select>
      </div>

      {(currentImportance || currentTopic || currentState || currentBucket) && (
        <button
          onClick={() => router.push('/')}
          className="text-sm text-blue-600 hover:underline"
        >
          Clear all filters
        </button>
      )}
    </aside>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/filter-sidebar.tsx
git commit -m "feat: replace source type filter with bucket filter in sidebar"
```

---

### Task 11: Update Clip Card with Thumbnails, Bucket Badge, and LinkedIn Button

**Files:**
- Modify: `src/components/clip-card.tsx`

**Step 1: Update ClipCard to show thumbnails, bucket, duration, companies, gov entities, and LinkedIn draft button**

Replace the entire contents of `src/components/clip-card.tsx` with:

```typescript
'use client'

import { useState } from 'react'
import { Clip, Location } from '@prisma/client'

type ClipWithLocation = Clip & {
  location: Location | null
  isStarred: boolean
}

const importanceColors = {
  high: 'bg-red-100 text-red-800 border-red-200',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  low: 'bg-gray-100 text-gray-800 border-gray-200',
}

const bucketLabels: Record<string, string> = {
  news_clip: 'News Clip',
  public_meeting: 'Public Meeting',
}

const bucketColors: Record<string, string> = {
  news_clip: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  public_meeting: 'bg-violet-100 text-violet-800 border-violet-200',
}

const topicColors: Record<string, string> = {
  zoning: 'bg-purple-100 text-purple-700',
  opposition: 'bg-red-100 text-red-700',
  environmental: 'bg-green-100 text-green-700',
  announcement: 'bg-blue-100 text-blue-700',
  government: 'bg-indigo-100 text-indigo-700',
  legal: 'bg-orange-100 text-orange-700',
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return ''
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function ClipCard({ clip }: { clip: ClipWithLocation }) {
  const [isStarred, setIsStarred] = useState(clip.isStarred)
  const [expanded, setExpanded] = useState(false)
  const [drafting, setDrafting] = useState(false)

  async function toggleStar() {
    const response = await fetch(`/api/clips/${clip.id}/star`, {
      method: 'POST',
    })
    if (response.ok) {
      const data = await response.json()
      setIsStarred(data.starred)
    }
  }

  async function draftLinkedInPost() {
    setDrafting(true)
    try {
      const response = await fetch('/api/linkedin/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clipId: clip.id }),
      })
      if (response.ok) {
        window.location.href = '/posts'
      }
    } finally {
      setDrafting(false)
    }
  }

  const locationText = clip.location
    ? [clip.location.city, clip.location.county, clip.location.state]
        .filter(Boolean)
        .join(', ')
    : 'Unknown location'

  return (
    <article className="border rounded-lg bg-white shadow-sm overflow-hidden">
      <div className="flex">
        {clip.thumbnailPath && (
          <div className="flex-shrink-0 w-48">
            <img
              src={clip.thumbnailPath}
              alt={clip.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        <div className="flex-1 p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span
                  className={`px-2 py-0.5 text-xs font-medium rounded border ${bucketColors[clip.bucket] || ''}`}
                >
                  {bucketLabels[clip.bucket] || clip.bucket}
                </span>
                <span
                  className={`px-2 py-0.5 text-xs font-medium rounded border ${importanceColors[clip.importance]}`}
                >
                  {clip.importance}
                </span>
                {clip.durationSecs && (
                  <span className="text-xs text-gray-500">
                    {formatDuration(clip.durationSecs)}
                  </span>
                )}
                <span className="text-sm text-gray-500">{clip.sourceName}</span>
                <span className="text-sm text-gray-400">·</span>
                <span className="text-sm text-gray-500">{locationText}</span>
              </div>

              <h3 className="font-medium text-gray-900 mb-1">
                <a
                  href={clip.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                >
                  {clip.title}
                </a>
              </h3>

              {clip.summary && (
                <p className="text-sm text-gray-600 mb-2">{clip.summary}</p>
              )}

              <div className="flex items-center gap-2 flex-wrap mb-2">
                {clip.topics.map((topic) => (
                  <span
                    key={topic}
                    className={`px-2 py-0.5 text-xs rounded ${topicColors[topic] || 'bg-gray-100 text-gray-700'}`}
                  >
                    {topic}
                  </span>
                ))}
              </div>

              {clip.companies.length > 0 && (
                <div className="text-xs text-gray-500 mb-1">
                  Companies: {clip.companies.join(', ')}
                </div>
              )}

              {clip.govEntities.length > 0 && (
                <div className="text-xs text-gray-500 mb-1">
                  Gov: {clip.govEntities.join(', ')}
                </div>
              )}

              {expanded && clip.content && (
                <div className="mt-3 pt-3 border-t text-sm text-gray-600">
                  {clip.content}
                </div>
              )}
            </div>

            <div className="flex flex-col items-center gap-2">
              <button
                onClick={toggleStar}
                className={`p-1 rounded hover:bg-gray-100 ${isStarred ? 'text-yellow-500' : 'text-gray-300'}`}
                title={isStarred ? 'Unstar' : 'Star'}
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              </button>

              <button
                onClick={draftLinkedInPost}
                disabled={drafting}
                className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-blue-600"
                title="Draft LinkedIn Post"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
              </button>

              {clip.content && (
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  {expanded ? 'Less' : 'More'}
                </button>
              )}
            </div>
          </div>

          <div className="mt-2 text-xs text-gray-400">
            {clip.publishedAt
              ? new Date(clip.publishedAt).toLocaleDateString()
              : new Date(clip.discoveredAt).toLocaleDateString()}
          </div>
        </div>
      </div>
    </article>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/clip-card.tsx
git commit -m "feat: update clip card with thumbnail, bucket badge, duration, LinkedIn button"
```

---

### Task 12: LinkedIn Draft API Endpoint

**Files:**
- Create: `src/lib/linkedin-draft.ts`
- Create: `src/app/api/linkedin/draft/route.ts`

**Step 1: Create the LinkedIn post draft generator**

Create `src/lib/linkedin-draft.ts`:

```typescript
import { anthropic } from './claude'

interface DraftInput {
  title: string
  summary: string | null
  transcript: string | null
  locationText: string
  companies: string[]
  govEntities: string[]
  bucket: string
  url: string
}

const DRAFT_PROMPT = `Generate a professional LinkedIn post about this data center news. The post should:

1. Open with an attention-grabbing hook (1 sentence)
2. Summarize the key facts (2-3 sentences)
3. Mention the location and key entities involved
4. End with a question or call to action to drive engagement
5. Include 3-5 relevant hashtags

Keep it under 150 words. Write in a professional but accessible tone.

Video title: {{TITLE}}
Summary: {{SUMMARY}}
Location: {{LOCATION}}
Companies: {{COMPANIES}}
Government entities: {{GOV_ENTITIES}}
Type: {{BUCKET}}
Video URL: {{URL}}

Transcript excerpt:
{{TRANSCRIPT}}

Respond with ONLY the LinkedIn post text (including hashtags). No additional formatting or explanation.`

export async function generateLinkedInDraft(input: DraftInput): Promise<string> {
  const prompt = DRAFT_PROMPT
    .replace('{{TITLE}}', input.title)
    .replace('{{SUMMARY}}', input.summary || 'No summary available')
    .replace('{{LOCATION}}', input.locationText)
    .replace('{{COMPANIES}}', input.companies.join(', ') || 'Not specified')
    .replace('{{GOV_ENTITIES}}', input.govEntities.join(', ') || 'Not specified')
    .replace('{{BUCKET}}', input.bucket === 'public_meeting' ? 'Public Meeting' : 'News Clip')
    .replace('{{URL}}', input.url)
    .replace('{{TRANSCRIPT}}', (input.transcript || '').slice(0, 2000))

  const response = await anthropic.messages.create({
    model: 'claude-3-haiku-20240307',
    max_tokens: 512,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = response.content[0]
  if (text.type !== 'text') {
    throw new Error('Unexpected response type from Claude')
  }

  return text.text
}
```

**Step 2: Create the draft API route**

Create `src/app/api/linkedin/draft/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { generateLinkedInDraft } from '@/lib/linkedin-draft'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { clipId } = await request.json()
  if (!clipId) {
    return NextResponse.json({ error: 'clipId required' }, { status: 400 })
  }

  const clip = await db.clip.findUnique({
    where: { id: clipId },
    include: { location: true },
  })

  if (!clip) {
    return NextResponse.json({ error: 'Clip not found' }, { status: 404 })
  }

  const locationText = clip.location
    ? [clip.location.city, clip.location.county, clip.location.state]
        .filter(Boolean)
        .join(', ')
    : 'Unknown location'

  const draftText = await generateLinkedInDraft({
    title: clip.title,
    summary: clip.summary,
    transcript: clip.transcript,
    locationText,
    companies: clip.companies,
    govEntities: clip.govEntities,
    bucket: clip.bucket,
    url: clip.url,
  })

  const post = await db.linkedInPost.create({
    data: {
      clipId: clip.id,
      userId: session.user.id,
      draftText,
    },
  })

  return NextResponse.json({ post })
}
```

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

Expected: No errors.

**Step 4: Commit**

```bash
git add src/lib/linkedin-draft.ts src/app/api/linkedin/draft/route.ts
git commit -m "feat: add LinkedIn post draft generation API"
```

---

### Task 13: LinkedIn OAuth Flow

**Files:**
- Create: `src/app/api/auth/linkedin/route.ts`
- Create: `src/app/api/auth/linkedin/callback/route.ts`

**Step 1: Create the LinkedIn OAuth initiation route**

Create `src/app/api/auth/linkedin/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const clientId = process.env.LINKEDIN_CLIENT_ID
  const redirectUri = process.env.LINKEDIN_REDIRECT_URI

  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { error: 'LinkedIn not configured' },
      { status: 500 }
    )
  }

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'openid profile w_member_social',
    state: session.user.id,
  })

  return NextResponse.redirect(
    `https://www.linkedin.com/oauth/v2/authorization?${params}`
  )
}
```

**Step 2: Create the LinkedIn OAuth callback route**

Create `src/app/api/auth/linkedin/callback/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state') // userId
  const error = searchParams.get('error')

  if (error) {
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/settings?linkedin=error&message=${error}`
    )
  }

  if (!code || !state) {
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/settings?linkedin=error&message=missing_params`
    )
  }

  try {
    // Exchange code for access token
    const tokenResponse = await fetch(
      'https://www.linkedin.com/oauth/v2/accessToken',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          client_id: process.env.LINKEDIN_CLIENT_ID!,
          client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
          redirect_uri: process.env.LINKEDIN_REDIRECT_URI!,
        }),
      }
    )

    if (!tokenResponse.ok) {
      const errorBody = await tokenResponse.text()
      console.error('LinkedIn token exchange failed:', errorBody)
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/settings?linkedin=error&message=token_exchange_failed`
      )
    }

    const tokenData = await tokenResponse.json()

    // Store the token — LinkedIn tokens expire in 60 days
    const expiresIn = tokenData.expires_in || 5184000 // 60 days default
    const expiryDate = new Date(Date.now() + expiresIn * 1000)

    await db.user.update({
      where: { id: state },
      data: {
        linkedinAccessToken: tokenData.access_token,
        linkedinTokenExpiry: expiryDate,
      },
    })

    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/settings?linkedin=connected`
    )
  } catch (err) {
    console.error('LinkedIn OAuth callback error:', err)
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/settings?linkedin=error&message=server_error`
    )
  }
}
```

**Step 3: Commit**

```bash
git add src/app/api/auth/linkedin/route.ts src/app/api/auth/linkedin/callback/route.ts
git commit -m "feat: add LinkedIn OAuth connect and callback routes"
```

---

### Task 14: LinkedIn Publish API

**Files:**
- Create: `src/app/api/linkedin/publish/route.ts`

**Step 1: Create the LinkedIn publish endpoint**

Create `src/app/api/linkedin/publish/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { postId, finalText } = await request.json()
  if (!postId) {
    return NextResponse.json({ error: 'postId required' }, { status: 400 })
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      linkedinAccessToken: true,
      linkedinTokenExpiry: true,
    },
  })

  if (!user?.linkedinAccessToken) {
    return NextResponse.json(
      { error: 'LinkedIn not connected' },
      { status: 400 }
    )
  }

  if (user.linkedinTokenExpiry && user.linkedinTokenExpiry < new Date()) {
    return NextResponse.json(
      { error: 'LinkedIn token expired — please reconnect' },
      { status: 400 }
    )
  }

  const post = await db.linkedInPost.findUnique({
    where: { id: postId },
    include: { clip: true },
  })

  if (!post) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  }

  const textToPost = finalText || post.draftText

  try {
    // Get LinkedIn user profile ID (sub from userinfo)
    const profileResponse = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${user.linkedinAccessToken}` },
    })

    if (!profileResponse.ok) {
      throw new Error(`LinkedIn profile fetch failed: ${profileResponse.status}`)
    }

    const profile = await profileResponse.json()
    const personUrn = `urn:li:person:${profile.sub}`

    // Create the LinkedIn post
    const shareResponse = await fetch('https://api.linkedin.com/v2/ugcPosts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${user.linkedinAccessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify({
        author: personUrn,
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: { text: textToPost },
            shareMediaCategory: 'ARTICLE',
            media: [
              {
                status: 'READY',
                originalUrl: post.clip.url,
                title: { text: post.clip.title },
                description: {
                  text: post.clip.summary || post.clip.title,
                },
              },
            ],
          },
        },
        visibility: {
          'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
        },
      }),
    })

    if (!shareResponse.ok) {
      const errorBody = await shareResponse.text()
      console.error('LinkedIn share failed:', errorBody)

      await db.linkedInPost.update({
        where: { id: postId },
        data: { status: 'failed', finalText: textToPost },
      })

      return NextResponse.json(
        { error: 'Failed to post to LinkedIn' },
        { status: 500 }
      )
    }

    const shareData = await shareResponse.json()

    await db.linkedInPost.update({
      where: { id: postId },
      data: {
        status: 'posted',
        finalText: textToPost,
        linkedInId: shareData.id,
        postedAt: new Date(),
      },
    })

    return NextResponse.json({ success: true, linkedInId: shareData.id })
  } catch (error) {
    console.error('LinkedIn publish error:', error)

    await db.linkedInPost.update({
      where: { id: postId },
      data: { status: 'failed', finalText: textToPost },
    })

    return NextResponse.json(
      { error: 'Failed to publish to LinkedIn' },
      { status: 500 }
    )
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/linkedin/publish/route.ts
git commit -m "feat: add LinkedIn publish API endpoint"
```

---

### Task 15: LinkedIn Posts Page

**Files:**
- Create: `src/app/posts/page.tsx`
- Create: `src/components/linkedin-post-card.tsx`

**Step 1: Create the LinkedIn post card component**

Create `src/components/linkedin-post-card.tsx`:

```typescript
'use client'

import { useState } from 'react'

interface LinkedInPost {
  id: string
  draftText: string
  finalText: string | null
  status: string
  linkedInId: string | null
  createdAt: string
  postedAt: string | null
  clip: {
    title: string
    url: string
    thumbnailPath: string | null
  }
}

export function LinkedInPostCard({ post }: { post: LinkedInPost }) {
  const [text, setText] = useState(post.finalText || post.draftText)
  const [status, setStatus] = useState(post.status)
  const [publishing, setPublishing] = useState(false)

  async function handlePublish() {
    setPublishing(true)
    try {
      const response = await fetch('/api/linkedin/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: post.id, finalText: text }),
      })

      if (response.ok) {
        setStatus('posted')
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to publish')
        setStatus('failed')
      }
    } finally {
      setPublishing(false)
    }
  }

  return (
    <div className="border rounded-lg bg-white shadow-sm p-4">
      <div className="flex items-start gap-4">
        {post.clip.thumbnailPath && (
          <img
            src={post.clip.thumbnailPath}
            alt={post.clip.title}
            className="w-32 h-20 object-cover rounded"
          />
        )}

        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span
              className={`px-2 py-0.5 text-xs font-medium rounded ${
                status === 'posted'
                  ? 'bg-green-100 text-green-800'
                  : status === 'failed'
                  ? 'bg-red-100 text-red-800'
                  : 'bg-yellow-100 text-yellow-800'
              }`}
            >
              {status}
            </span>
            <a
              href={post.clip.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:underline truncate"
            >
              {post.clip.title}
            </a>
          </div>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={status === 'posted'}
            rows={6}
            className="w-full border rounded p-2 text-sm resize-y disabled:bg-gray-50 disabled:text-gray-500"
          />

          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-gray-400">
              {status === 'posted' && post.postedAt
                ? `Posted ${new Date(post.postedAt).toLocaleString()}`
                : `Created ${new Date(post.createdAt).toLocaleString()}`}
            </span>

            {status !== 'posted' && (
              <button
                onClick={handlePublish}
                disabled={publishing}
                className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {publishing ? 'Publishing...' : 'Post to LinkedIn'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
```

**Step 2: Create the posts page**

Create `src/app/posts/page.tsx`:

```typescript
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { Header } from '@/components/header'
import { LinkedInPostCard } from '@/components/linkedin-post-card'

export default async function PostsPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }

  const posts = await db.linkedInPost.findMany({
    where: { userId: session.user.id },
    include: {
      clip: {
        select: {
          title: true,
          url: true,
          thumbnailPath: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          LinkedIn Posts
        </h1>

        {posts.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            No posts yet. Use the LinkedIn button on any clip to create a draft.
          </p>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <LinkedInPostCard
                key={post.id}
                post={{
                  ...post,
                  createdAt: post.createdAt.toISOString(),
                  postedAt: post.postedAt?.toISOString() || null,
                }}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
```

**Step 3: Commit**

```bash
git add src/app/posts/page.tsx src/components/linkedin-post-card.tsx
git commit -m "feat: add LinkedIn posts page with draft editing and publishing"
```

---

### Task 16: Update Header Navigation and Settings Page

**Files:**
- Modify: `src/components/header.tsx`
- Modify: `src/app/settings/page.tsx`

**Step 1: Add Posts link to header navigation**

In `src/components/header.tsx`, add the Posts link after Starred. Replace lines 22-25 (the Starred link) with:

```typescript
          <Link href="/starred" className="text-sm text-gray-600 hover:text-gray-900">
            Starred
          </Link>
          <Link href="/posts" className="text-sm text-gray-600 hover:text-gray-900">
            Posts
          </Link>
```

**Step 2: Update settings page with LinkedIn connection section**

Replace the entire contents of `src/app/settings/page.tsx` with:

```typescript
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { Header } from '@/components/header'
import { DigestSettingsForm } from '@/components/digest-settings-form'

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ linkedin?: string; message?: string }>
}) {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }

  const params = await searchParams

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      linkedinAccessToken: true,
      linkedinTokenExpiry: true,
    },
  })

  const isLinkedInConnected = !!user?.linkedinAccessToken
  const tokenExpiry = user?.linkedinTokenExpiry
  const isTokenExpiring =
    tokenExpiry && tokenExpiry.getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>

        {params.linkedin === 'connected' && (
          <div className="mb-4 p-3 bg-green-50 text-green-800 rounded border border-green-200 text-sm">
            LinkedIn connected successfully.
          </div>
        )}

        {params.linkedin === 'error' && (
          <div className="mb-4 p-3 bg-red-50 text-red-800 rounded border border-red-200 text-sm">
            LinkedIn connection failed: {params.message || 'Unknown error'}
          </div>
        )}

        <section className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">
            LinkedIn Connection
          </h2>

          {isLinkedInConnected ? (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-block w-2 h-2 bg-green-500 rounded-full"></span>
                <span className="text-sm text-gray-700">Connected</span>
              </div>
              {tokenExpiry && (
                <p className={`text-xs ${isTokenExpiring ? 'text-orange-600' : 'text-gray-500'}`}>
                  Token expires {tokenExpiry.toLocaleDateString()}
                  {isTokenExpiring && ' — reconnect soon to avoid interruption'}
                </p>
              )}
              <a
                href="/api/auth/linkedin"
                className="mt-3 inline-block px-4 py-2 text-sm border rounded hover:bg-gray-50"
              >
                Reconnect LinkedIn
              </a>
            </div>
          ) : (
            <div>
              <p className="text-sm text-gray-600 mb-3">
                Connect your LinkedIn account to draft and publish posts about data center clips.
              </p>
              <a
                href="/api/auth/linkedin"
                className="inline-block px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
              >
                Connect LinkedIn
              </a>
            </div>
          )}
        </section>

        <section className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">
            Email Digest Preferences
          </h2>
          <DigestSettingsForm />
        </section>
      </main>
    </div>
  )
}
```

**Step 3: Commit**

```bash
git add src/components/header.tsx src/app/settings/page.tsx
git commit -m "feat: add Posts nav link and LinkedIn connection to settings page"
```

---

### Task 17: Build Verification

**Files:** None (verification only)

**Step 1: Run TypeScript type check**

Run: `npx tsc --noEmit`

Expected: No errors.

**Step 2: Run the linter**

Run: `npm run lint`

Expected: No errors (or only pre-existing warnings).

**Step 3: Run the build**

Run: `npm run build`

Expected: Build succeeds. All pages compile.

**Step 4: If any errors, fix them and commit**

Fix any type errors, import issues, or build failures. Commit fixes:

```bash
git add -A
git commit -m "fix: resolve build errors from v1 migration"
```

---

### Task 18: Update Seed Script and Documentation

**Files:**
- Modify: `prisma/seed.ts`
- Modify: `.env.example` (already updated in Task 1)

**Step 1: Check and update seed script for new required fields**

Read `prisma/seed.ts` and ensure any seed Clip data includes the new required `bucket` field. If the seed creates clips, add `bucket: 'news_clip'` to each.

**Step 2: Run the seed to verify**

Run: `npx prisma db seed`

Expected: Seed completes without errors.

**Step 3: Commit any seed changes**

```bash
git add prisma/seed.ts
git commit -m "chore: update seed script for new schema fields"
```

---

### Summary of All Tasks

| # | Task | Key Files |
|---|------|-----------|
| 1 | Database schema migration | `prisma/schema.prisma`, `.env.example` |
| 2 | Update types and source registration | `src/lib/types.ts`, `src/lib/sources/*` |
| 3 | Rewrite YouTube fetcher (two buckets) | `src/lib/sources/youtube.ts` |
| 4 | Caption fetching module | `src/lib/captions.ts` (new) |
| 5 | Enhanced AI classifier | `src/lib/classifier.ts` |
| 6 | Thumbnail downloader | `src/lib/thumbnails.ts` (new) |
| 7 | Rewrite processor pipeline | `src/lib/processor.ts` |
| 8 | Update worker schedule (6hr) | `worker/index.ts` |
| 9 | Update clips API (bucket filter) | `src/app/api/clips/route.ts` |
| 10 | Update filter sidebar UI | `src/components/filter-sidebar.tsx` |
| 11 | Update clip card (thumbnails, LinkedIn) | `src/components/clip-card.tsx` |
| 12 | LinkedIn draft API | `src/lib/linkedin-draft.ts`, `src/app/api/linkedin/draft/route.ts` (new) |
| 13 | LinkedIn OAuth flow | `src/app/api/auth/linkedin/route.ts`, `callback/route.ts` (new) |
| 14 | LinkedIn publish API | `src/app/api/linkedin/publish/route.ts` (new) |
| 15 | LinkedIn posts page | `src/app/posts/page.tsx`, `src/components/linkedin-post-card.tsx` (new) |
| 16 | Header nav + settings LinkedIn section | `src/components/header.tsx`, `src/app/settings/page.tsx` |
| 17 | Build verification | (no files — verification) |
| 18 | Update seed + docs | `prisma/seed.ts` |
