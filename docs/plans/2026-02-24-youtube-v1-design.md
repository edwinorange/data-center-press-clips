# YouTube-Focused V1 Design

**Date:** 2026-02-24
**Status:** Approved

## Overview

Pivot the Data Center Press Clips product to YouTube as the sole data source for v1. Comment out Google News, Bluesky, and government sources. Add two-bucket search (news clips and public meetings), closed caption retrieval and AI-powered transcript summarization, video thumbnails, and a LinkedIn social posting mechanism.

## Architecture: Two-Pass Pipeline

**Pass 1 — Search + Filter:** YouTube search API with duration/caption filters, then batch `videos.list` call for exact duration verification. Discard non-qualifying videos before any expensive processing.

**Pass 2 — Deep Enrichment:** For qualifying videos only, fetch closed captions via YouTube Captions API, classify with Claude (title + description + transcript), download thumbnails, store in database.

## 1. Data Sources

### Commented Out (v1)
- Google News RSS (`src/lib/sources/google-news.ts`) — commented out in `src/lib/sources/index.ts`
- Bluesky API (`src/lib/sources/bluesky.ts`) — commented out in `src/lib/sources/index.ts`
- Government sources — not yet implemented, remains inactive

### Active: YouTube (Two Buckets)

#### Bucket 1: News Clips (<= 5 minutes)
- **Search query:** `"data center"`
- **API filters:** `type=video`, `videoCaption=closedCaption`, `regionCode=US`, `order=date`
- **Duration strategy:** Fetch with `videoDuration=short` (<4min) AND `videoDuration=medium` (4-20min). Post-filter via `videos.list` `contentDetails.duration` to keep only videos <= 5 minutes.
- **Pagination:** Follow `nextPageToken` to retrieve all results

#### Bucket 2: Public Meetings (>= 60 minutes)
- **Search query:** `"data center" public meeting OR hearing OR town hall OR council`
- **API filters:** `type=video`, `videoCaption=closedCaption`, `regionCode=US`, `order=date`, `videoDuration=long` (>20min)
- **Duration post-filter:** Keep only videos >= 60 minutes via `videos.list`
- **Pagination:** Follow `nextPageToken` to retrieve all results

### Schedule
- **Frequency:** 4 times daily — every 6 hours (6am, 12pm, 6pm, 12am ET)
- **Incremental:** Use `publishedAfter` parameter set to 6 hours prior to avoid re-fetching
- **Worker change:** Update `POLL_INTERVAL_MS` from 15 minutes to 6 hours, with time-of-day alignment

## 2. Caption Retrieval

- Use official YouTube Data API: `captions.list` to get caption track IDs, `captions.download` to fetch transcript text
- Parse SRT/TTML format into plain text
- Store full transcript in `Clip.transcript` field
- If captions are unavailable (despite search filter), skip the video gracefully

## 3. AI Classification (Enhanced)

### Classifier Prompt Changes

Send to Claude: title, description, channel name, and full caption transcript.

**Transcript limits:**
- Bucket 1 (news clips): truncate to ~8,000 characters
- Bucket 2 (public meetings): truncate to ~16,000 characters

### Classification Output Fields

```json
{
  "location": {
    "city": "string or null",
    "county": "string or null",
    "state": "two-letter state code",
    "latitude": "number or null",
    "longitude": "number or null"
  },
  "companies": ["array of company names mentioned"],
  "govEntities": ["array of government bodies mentioned"],
  "topics": ["zoning", "opposition", "environmental", "announcement", "government", "legal"],
  "importance": "high|medium|low",
  "summary": "2-3 sentences for news clips, 4-6 for meetings",
  "relevanceScore": 1-10
}
```

### Relevance Gating
- Only store clips with `relevanceScore >= 7`
- Score represents how specifically the content is about a US data center development
- Configurable threshold via environment variable `MIN_RELEVANCE_SCORE` (default: 7)

## 4. Database Schema Changes

### Location model — add coordinates
```prisma
model Location {
  // ...existing fields...
  latitude   Float?
  longitude  Float?
}
```

### Clip model — new fields
```prisma
model Clip {
  // ...existing fields...
  bucket         ClipBucket
  durationSecs   Int?
  transcript     String?
  thumbnailPath  String?
  relevanceScore Int?
  companies      String[]
  govEntities    String[]
  videoId        String?    @unique
  linkedInPosts  LinkedInPost[]
}

enum ClipBucket {
  news_clip
  public_meeting
}
```

### New LinkedInPost model
```prisma
model LinkedInPost {
  id          String     @id @default(uuid())
  clipId      String
  clip        Clip       @relation(fields: [clipId], references: [id], onDelete: Cascade)
  userId      String
  user        User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  draftText   String
  finalText   String?
  linkedInId  String?
  status      PostStatus @default(draft)
  createdAt   DateTime   @default(now())
  postedAt    DateTime?
}

enum PostStatus {
  draft
  posted
  failed
}
```

### User model — LinkedIn OAuth
```prisma
model User {
  // ...existing fields...
  linkedinAccessToken  String?
  linkedinTokenExpiry  DateTime?
  linkedInPosts        LinkedInPost[]
}
```

### SourceType enum
Keep all values (`news`, `youtube`, `bluesky`, `government`) for forward compatibility. Only `youtube` is actively used.

## 5. Thumbnail Storage

- Download YouTube-provided thumbnails (`high` or `maxres` quality) via direct URL
- Store locally at `public/thumbnails/{videoId}.jpg`
- Store relative path in `Clip.thumbnailPath`
- V2 consideration: migrate to S3-compatible storage

## 6. LinkedIn Integration

### LinkedIn Developer App Setup

1. Go to https://developer.linkedin.com/ and create a new app
2. Add products: "Share on LinkedIn" and "Sign In with LinkedIn using OpenID Connect"
3. Configure redirect URI: `{NEXTAUTH_URL}/api/auth/linkedin/callback`
4. Note the Client ID and Client Secret

### Environment Variables
```
LINKEDIN_CLIENT_ID=your-client-id
LINKEDIN_CLIENT_SECRET=your-client-secret
LINKEDIN_REDIRECT_URI=http://localhost:3000/api/auth/linkedin/callback
```

### OAuth Flow
1. "Connect LinkedIn" button in settings page
2. Redirect to LinkedIn authorization: `scope=w_member_social,openid,profile`
3. Callback handler at `/api/auth/linkedin/callback` exchanges code for access token
4. Store `linkedinAccessToken` + `linkedinTokenExpiry` on User record
5. Tokens expire in 60 days — UI shows warning when within 7 days of expiry

### Post Draft Generation
- "Draft LinkedIn Post" button on clip cards
- Sends clip data to Claude: title, summary, transcript excerpt, location, companies, thumbnail
- Claude generates ~150-word LinkedIn post: headline hook, key facts, location, hashtags
- Draft stored in `LinkedInPost` with status `draft`

### Review & Publish
- `/posts` page: list of all drafts and posted items
- Editable text area with AI draft, thumbnail preview
- "Post to LinkedIn" button calls `/api/linkedin/publish`
- Uses LinkedIn `ugcPosts` API to create share with text + image
- Updates `LinkedInPost` status and stores `linkedInId` on success

## 7. UI Changes

### Dashboard
- Filter sidebar: replace source type filter with Bucket filter (News Clips / Public Meetings / All)
- Clip cards: show thumbnail, bucket badge, duration, companies, government entities
- Clip cards: add "Draft LinkedIn Post" action button
- Remove UI references to non-YouTube sources

### New Pages
- `/posts` — LinkedIn post drafts management and publish interface

### Settings Page
- Add "Connect LinkedIn" section with OAuth connect/disconnect
- Show connection status and token expiry warning

### Unchanged
- Login page, layout, star system, search, digest preferences

## 8. API Quota Considerations

### YouTube Data API
- Default quota: 10,000 units/day
- `search.list` = 100 units per call
- `videos.list` = 1 unit per call (batches of 50)
- `captions.list` = 50 units per call
- `captions.download` = 200 units per call

**Estimated daily usage:** Depends on result volume. 4 runs/day with 2 bucket queries each = 8+ search calls minimum (800+ units) plus pagination. Caption downloads are the most expensive. May need a quota increase request for production.

### Anthropic API
- Classification calls scale with qualifying videos
- Transcript-based classification uses more tokens than title-only
- Budget ~2,000-4,000 tokens per Bucket 1 clip, ~8,000-16,000 per Bucket 2 clip

## 9. New Dependencies

- None required for YouTube (using native `fetch`)
- LinkedIn OAuth: native `fetch` (no SDK needed)
- SRT/TTML caption parsing: lightweight custom parser or `subtitle` npm package
