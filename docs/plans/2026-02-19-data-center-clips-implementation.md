# Data Center Press Clips Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a web application that monitors local US news about data center developments, classifies clips by topic/importance using AI, and surfaces them via dashboard and email digests.

**Architecture:** Monorepo with Next.js frontend (Vercel) + Node.js workers (Railway) sharing a PostgreSQL database. The scraper worker continuously polls sources, AI classifier processes new clips, and digest mailer sends scheduled emails.

**Tech Stack:** Next.js 14 (App Router), TypeScript, Prisma, PostgreSQL, Tailwind CSS, NextAuth.js, Claude API, React Email, Resend

---

## Phase 1: Project Foundation

### Task 1: Initialize Next.js Project

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.js`
- Create: `tailwind.config.ts`
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx`

**Step 1: Create Next.js project with TypeScript and Tailwind**

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --no-turbopack
```

Select defaults when prompted.

**Step 2: Verify project runs**

```bash
npm run dev
```

Expected: Server starts at http://localhost:3000, shows Next.js welcome page.

**Step 3: Stop dev server and commit**

```bash
git add -A
git commit -m "chore: initialize Next.js project with TypeScript and Tailwind"
```

---

### Task 2: Configure Prisma and Database Schema

**Files:**
- Create: `prisma/schema.prisma`
- Modify: `package.json` (add prisma deps)
- Create: `.env.example`
- Create: `.env` (local, gitignored)

**Step 1: Install Prisma**

```bash
npm install prisma @prisma/client
npx prisma init
```

**Step 2: Create .env.example**

```bash
# .env.example
DATABASE_URL="postgresql://user:password@localhost:5432/datacenter_clips"
```

**Step 3: Write the Prisma schema**

Replace `prisma/schema.prisma` with:

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

model Location {
  id        String   @id @default(uuid())
  city      String?
  county    String?
  state     String   @db.Char(2)
  firstSeen DateTime @default(now())
  clipCount Int      @default(0)
  clips     Clip[]

  @@unique([city, county, state])
  @@index([state])
}

model Clip {
  id           String     @id @default(uuid())
  url          String     @unique
  title        String
  summary      String?
  content      String?
  sourceType   SourceType
  sourceName   String
  publishedAt  DateTime?
  discoveredAt DateTime   @default(now())
  locationId   String?
  location     Location?  @relation(fields: [locationId], references: [id])
  importance   Importance @default(medium)
  topics       String[]
  rawData      Json?
  stars        Star[]

  @@index([importance])
  @@index([discoveredAt])
  @@index([locationId])
}

model User {
  id              String            @id @default(uuid())
  email           String            @unique
  name            String
  passwordHash    String
  createdAt       DateTime          @default(now())
  digestPreference DigestPreference?
  stars           Star[]
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
```

**Step 4: Generate Prisma client**

```bash
npx prisma generate
```

Expected: Prisma Client generated successfully.

**Step 5: Commit**

```bash
git add prisma/schema.prisma .env.example package.json package-lock.json
git commit -m "feat: add Prisma schema with clips, locations, users, and digest preferences"
```

---

### Task 3: Create Database Utility and Types

**Files:**
- Create: `src/lib/db.ts`
- Create: `src/lib/types.ts`

**Step 1: Create database client singleton**

Create `src/lib/db.ts`:

```typescript
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
```

**Step 2: Create shared types**

Create `src/lib/types.ts`:

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

export interface ClassificationResult {
  location: {
    city?: string
    county?: string
    state: State
  }
  topics: Topic[]
  importance: 'high' | 'medium' | 'low'
  summary: string
}
```

**Step 3: Commit**

```bash
git add src/lib/db.ts src/lib/types.ts
git commit -m "feat: add database client singleton and shared types"
```

---

## Phase 2: Authentication

### Task 4: Set Up NextAuth.js

**Files:**
- Create: `src/app/api/auth/[...nextauth]/route.ts`
- Create: `src/lib/auth.ts`
- Modify: `.env.example`

**Step 1: Install dependencies**

```bash
npm install next-auth bcryptjs
npm install -D @types/bcryptjs
```

**Step 2: Add auth env vars to .env.example**

Append to `.env.example`:

```bash
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key-change-in-production"
```

**Step 3: Create auth configuration**

Create `src/lib/auth.ts`:

```typescript
import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { db } from './db'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const user = await db.user.findUnique({
          where: { email: credentials.email },
        })

        if (!user) {
          return null
        }

        const isValid = await bcrypt.compare(credentials.password, user.passwordHash)

        if (!isValid) {
          return null
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
        }
      },
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
      }
      return session
    },
  },
}
```

**Step 4: Create auth route handler**

Create `src/app/api/auth/[...nextauth]/route.ts`:

```typescript
import NextAuth from 'next-auth'
import { authOptions } from '@/lib/auth'

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
```

**Step 5: Extend NextAuth types**

Create `src/types/next-auth.d.ts`:

```typescript
import 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name: string
    }
  }

  interface User {
    id: string
    email: string
    name: string
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
  }
}
```

**Step 6: Commit**

```bash
git add src/app/api/auth src/lib/auth.ts src/types/next-auth.d.ts .env.example package.json package-lock.json
git commit -m "feat: configure NextAuth.js with credentials provider"
```

---

### Task 5: Create Login Page

**Files:**
- Create: `src/app/login/page.tsx`
- Create: `src/components/login-form.tsx`

**Step 1: Create login form component**

Create `src/components/login-form.tsx`:

```typescript
'use client'

import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function LoginForm() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    const email = formData.get('email') as string
    const password = formData.get('password') as string

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    })

    setLoading(false)

    if (result?.error) {
      setError('Invalid email or password')
    } else {
      router.push('/')
      router.refresh()
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700">
          Email
        </label>
        <input
          type="email"
          id="email"
          name="email"
          required
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-700">
          Password
        </label>
        <input
          type="password"
          id="password"
          name="password"
          required
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-md bg-blue-600 px-4 py-2 text-white font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
      >
        {loading ? 'Signing in...' : 'Sign in'}
      </button>
    </form>
  )
}
```

**Step 2: Create login page**

Create `src/app/login/page.tsx`:

```typescript
import { LoginForm } from '@/components/login-form'

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow">
        <div>
          <h1 className="text-2xl font-bold text-center text-gray-900">
            Data Center Clips
          </h1>
          <p className="mt-2 text-center text-gray-600">
            Sign in to your account
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  )
}
```

**Step 3: Commit**

```bash
git add src/app/login/page.tsx src/components/login-form.tsx
git commit -m "feat: add login page with credentials form"
```

---

### Task 6: Create Session Provider

**Files:**
- Create: `src/components/providers.tsx`
- Modify: `src/app/layout.tsx`

**Step 1: Create session provider wrapper**

Create `src/components/providers.tsx`:

```typescript
'use client'

import { SessionProvider } from 'next-auth/react'

export function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>
}
```

**Step 2: Update root layout**

Modify `src/app/layout.tsx`:

```typescript
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/providers'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Data Center Clips',
  description: 'Monitor local news about data center developments',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
```

**Step 3: Commit**

```bash
git add src/components/providers.tsx src/app/layout.tsx
git commit -m "feat: add NextAuth session provider to app layout"
```

---

## Phase 3: AI Classification

### Task 7: Create Claude API Client

**Files:**
- Create: `src/lib/claude.ts`
- Modify: `.env.example`

**Step 1: Install Anthropic SDK**

```bash
npm install @anthropic-ai/sdk
```

**Step 2: Add API key to .env.example**

Append to `.env.example`:

```bash
ANTHROPIC_API_KEY="your-anthropic-api-key"
```

**Step 3: Create Claude client**

Create `src/lib/claude.ts`:

```typescript
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export { anthropic }
```

**Step 4: Commit**

```bash
git add src/lib/claude.ts .env.example package.json package-lock.json
git commit -m "feat: add Anthropic Claude SDK client"
```

---

### Task 8: Create Clip Classifier

**Files:**
- Create: `src/lib/classifier.ts`

**Step 1: Create the classifier module**

Create `src/lib/classifier.ts`:

```typescript
import { anthropic } from './claude'
import { ClassificationResult, TOPICS, STATES, Topic, State } from './types'

const CLASSIFICATION_PROMPT = `You are a news classifier for a data center monitoring service. Analyze the following news article and extract:

1. Location: The US city, county, and/or state where this data center activity is happening
2. Topics: One or more categories from: zoning, opposition, environmental, announcement, government, legal
3. Importance: high, medium, or low based on these criteria:
   - HIGH: Active opposition (protests, petitions), upcoming votes/hearings, new major announcements, lawsuits filed
   - MEDIUM: General coverage of existing projects, routine permit updates, environmental studies released
   - LOW: Passing mentions, opinion pieces, industry analysis without local specifics
4. Summary: A 2-3 sentence plain-English summary of the key points

Respond ONLY with valid JSON in this exact format:
{
  "location": {
    "city": "string or null",
    "county": "string or null",
    "state": "two-letter state code"
  },
  "topics": ["array", "of", "topics"],
  "importance": "high|medium|low",
  "summary": "Brief summary here"
}

Article title: {{TITLE}}

Article content:
{{CONTENT}}`

export async function classifyClip(
  title: string,
  content: string
): Promise<ClassificationResult | null> {
  try {
    const prompt = CLASSIFICATION_PROMPT
      .replace('{{TITLE}}', title)
      .replace('{{CONTENT}}', content.slice(0, 4000)) // Limit content length

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

    // Validate the result
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

  return true
}

export function getDefaultClassification(): Omit<ClassificationResult, 'location'> {
  return {
    topics: ['unclassified'] as unknown as Topic[],
    importance: 'medium',
    summary: 'Classification pending',
  }
}
```

**Step 2: Commit**

```bash
git add src/lib/classifier.ts
git commit -m "feat: add AI clip classifier using Claude Haiku"
```

---

## Phase 4: Data Sources

### Task 9: Create Source Fetcher Interface

**Files:**
- Create: `src/lib/sources/types.ts`
- Create: `src/lib/sources/index.ts`

**Step 1: Define source fetcher interface**

Create `src/lib/sources/types.ts`:

```typescript
export interface RawClip {
  url: string
  title: string
  content?: string
  sourceName: string
  publishedAt?: Date
  rawData?: Record<string, unknown>
}

export interface SourceFetcher {
  name: string
  sourceType: 'news' | 'youtube' | 'bluesky' | 'government'
  fetch(): Promise<RawClip[]>
}
```

**Step 2: Create source registry**

Create `src/lib/sources/index.ts`:

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
```

**Step 3: Commit**

```bash
git add src/lib/sources/types.ts src/lib/sources/index.ts
git commit -m "feat: add source fetcher interface and registry"
```

---

### Task 10: Create Google News RSS Fetcher

**Files:**
- Create: `src/lib/sources/google-news.ts`
- Modify: `src/lib/sources/index.ts`

**Step 1: Install RSS parser**

```bash
npm install rss-parser
```

**Step 2: Create Google News fetcher**

Create `src/lib/sources/google-news.ts`:

```typescript
import Parser from 'rss-parser'
import { SourceFetcher, RawClip } from './types'

const parser = new Parser()

const SEARCH_QUERIES = [
  'data center zoning',
  'data center permit',
  'data center opposition',
  'data center protest',
  'hyperscale data center',
  'data center construction',
  'data center environmental',
]

function buildGoogleNewsUrl(query: string): string {
  const encoded = encodeURIComponent(query)
  return `https://news.google.com/rss/search?q=${encoded}&hl=en-US&gl=US&ceid=US:en`
}

export const googleNewsFetcher: SourceFetcher = {
  name: 'Google News',
  sourceType: 'news',

  async fetch(): Promise<RawClip[]> {
    const allClips: RawClip[] = []
    const seenUrls = new Set<string>()

    for (const query of SEARCH_QUERIES) {
      try {
        const feed = await parser.parseURL(buildGoogleNewsUrl(query))

        for (const item of feed.items) {
          if (!item.link || seenUrls.has(item.link)) continue
          seenUrls.add(item.link)

          allClips.push({
            url: item.link,
            title: item.title || 'Untitled',
            content: item.contentSnippet || item.content,
            sourceName: item.source?.title || 'Google News',
            publishedAt: item.pubDate ? new Date(item.pubDate) : undefined,
            rawData: item as Record<string, unknown>,
          })
        }
      } catch (error) {
        console.error(`Failed to fetch Google News for query "${query}":`, error)
      }
    }

    return allClips
  },
}
```

**Step 3: Register the fetcher**

Modify `src/lib/sources/index.ts` to add at the end:

```typescript
import { googleNewsFetcher } from './google-news'

registerSource(googleNewsFetcher)
```

**Step 4: Commit**

```bash
git add src/lib/sources/google-news.ts src/lib/sources/index.ts package.json package-lock.json
git commit -m "feat: add Google News RSS fetcher"
```

---

### Task 11: Create YouTube API Fetcher

**Files:**
- Create: `src/lib/sources/youtube.ts`
- Modify: `src/lib/sources/index.ts`
- Modify: `.env.example`

**Step 1: Add YouTube API key to .env.example**

Append to `.env.example`:

```bash
YOUTUBE_API_KEY="your-youtube-api-key"
```

**Step 2: Create YouTube fetcher**

Create `src/lib/sources/youtube.ts`:

```typescript
import { SourceFetcher, RawClip } from './types'

const SEARCH_QUERIES = [
  'data center zoning hearing',
  'data center community opposition',
  'data center town hall',
  'data center environmental impact',
  'hyperscale data center announcement',
]

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
  items: YouTubeSearchItem[]
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

    for (const query of SEARCH_QUERIES) {
      try {
        const params = new URLSearchParams({
          part: 'snippet',
          q: query,
          type: 'video',
          maxResults: '10',
          order: 'date',
          regionCode: 'US',
          key: apiKey,
        })

        const response = await fetch(
          `https://www.googleapis.com/youtube/v3/search?${params}`
        )

        if (!response.ok) {
          console.error(`YouTube API error: ${response.status}`)
          continue
        }

        const data: YouTubeSearchResponse = await response.json()

        for (const item of data.items) {
          if (seenIds.has(item.id.videoId)) continue
          seenIds.add(item.id.videoId)

          allClips.push({
            url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
            title: item.snippet.title,
            content: item.snippet.description,
            sourceName: item.snippet.channelTitle,
            publishedAt: new Date(item.snippet.publishedAt),
            rawData: item as unknown as Record<string, unknown>,
          })
        }
      } catch (error) {
        console.error(`Failed to fetch YouTube for query "${query}":`, error)
      }
    }

    return allClips
  },
}
```

**Step 3: Register the fetcher**

Add to `src/lib/sources/index.ts`:

```typescript
import { youtubeFetcher } from './youtube'

registerSource(youtubeFetcher)
```

**Step 4: Commit**

```bash
git add src/lib/sources/youtube.ts src/lib/sources/index.ts .env.example
git commit -m "feat: add YouTube API fetcher"
```

---

### Task 12: Create Bluesky Fetcher

**Files:**
- Create: `src/lib/sources/bluesky.ts`
- Modify: `src/lib/sources/index.ts`

**Step 1: Install Bluesky SDK**

```bash
npm install @atproto/api
```

**Step 2: Create Bluesky fetcher**

Create `src/lib/sources/bluesky.ts`:

```typescript
import { SourceFetcher, RawClip } from './types'

const SEARCH_QUERIES = [
  'data center zoning',
  'data center opposition',
  'hyperscale data center',
  'data center protest',
]

interface BlueskyPost {
  uri: string
  cid: string
  author: {
    handle: string
    displayName?: string
  }
  record: {
    text: string
    createdAt: string
  }
}

interface BlueskySearchResponse {
  posts: BlueskyPost[]
}

export const blueskyFetcher: SourceFetcher = {
  name: 'Bluesky',
  sourceType: 'bluesky',

  async fetch(): Promise<RawClip[]> {
    const allClips: RawClip[] = []
    const seenUris = new Set<string>()

    for (const query of SEARCH_QUERIES) {
      try {
        const params = new URLSearchParams({
          q: query,
          limit: '25',
        })

        const response = await fetch(
          `https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts?${params}`
        )

        if (!response.ok) {
          console.error(`Bluesky API error: ${response.status}`)
          continue
        }

        const data: BlueskySearchResponse = await response.json()

        for (const post of data.posts) {
          if (seenUris.has(post.uri)) continue
          seenUris.add(post.uri)

          // Convert AT URI to web URL
          const [, , did, , rkey] = post.uri.split('/')
          const webUrl = `https://bsky.app/profile/${post.author.handle}/post/${rkey}`

          allClips.push({
            url: webUrl,
            title: post.record.text.slice(0, 100) + (post.record.text.length > 100 ? '...' : ''),
            content: post.record.text,
            sourceName: post.author.displayName || post.author.handle,
            publishedAt: new Date(post.record.createdAt),
            rawData: post as unknown as Record<string, unknown>,
          })
        }
      } catch (error) {
        console.error(`Failed to fetch Bluesky for query "${query}":`, error)
      }
    }

    return allClips
  },
}
```

**Step 3: Register the fetcher**

Add to `src/lib/sources/index.ts`:

```typescript
import { blueskyFetcher } from './bluesky'

registerSource(blueskyFetcher)
```

**Step 4: Commit**

```bash
git add src/lib/sources/bluesky.ts src/lib/sources/index.ts package.json package-lock.json
git commit -m "feat: add Bluesky fetcher using public API"
```

---

## Phase 5: Clip Processing Pipeline

### Task 13: Create Clip Processor

**Files:**
- Create: `src/lib/processor.ts`

**Step 1: Create the clip processor**

Create `src/lib/processor.ts`:

```typescript
import { db } from './db'
import { classifyClip, getDefaultClassification } from './classifier'
import { RawClip, fetchAllSources } from './sources'
import { Prisma } from '@prisma/client'

export async function processNewClips(): Promise<{ processed: number; errors: number }> {
  const results = await fetchAllSources()
  let processed = 0
  let errors = 0

  for (const { source, clips } of results) {
    for (const rawClip of clips) {
      try {
        // Check if clip already exists
        const existing = await db.clip.findUnique({
          where: { url: rawClip.url },
        })

        if (existing) {
          continue
        }

        // Classify the clip
        const classification = await classifyClip(
          rawClip.title,
          rawClip.content || rawClip.title
        )

        // Find or create location
        let locationId: string | null = null
        if (classification?.location) {
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
            },
            update: {
              clipCount: { increment: 1 },
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
            summary: classification?.summary || getDefaultClassification().summary,
            sourceType: source.sourceType,
            sourceName: rawClip.sourceName,
            publishedAt: rawClip.publishedAt,
            locationId,
            importance: classification?.importance || getDefaultClassification().importance,
            topics: classification?.topics || (getDefaultClassification().topics as string[]),
            rawData: rawClip.rawData as Prisma.JsonObject,
          },
        })

        processed++
      } catch (error) {
        console.error(`Failed to process clip ${rawClip.url}:`, error)
        errors++
      }
    }
  }

  return { processed, errors }
}
```

**Step 2: Commit**

```bash
git add src/lib/processor.ts
git commit -m "feat: add clip processor that fetches, classifies, and stores clips"
```

---

## Phase 6: Dashboard API

### Task 14: Create Clips API Route

**Files:**
- Create: `src/app/api/clips/route.ts`

**Step 1: Create clips API**

Create `src/app/api/clips/route.ts`:

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
  const sourceType = searchParams.get('sourceType')
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

  if (sourceType) {
    where.sourceType = sourceType as 'news' | 'youtube' | 'bluesky' | 'government'
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
git commit -m "feat: add clips API with filtering, search, and pagination"
```

---

### Task 15: Create Stars API Route

**Files:**
- Create: `src/app/api/clips/[id]/star/route.ts`

**Step 1: Create star toggle API**

Create `src/app/api/clips/[id]/star/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  const existing = await db.star.findUnique({
    where: {
      userId_clipId: {
        userId: session.user.id,
        clipId: id,
      },
    },
  })

  if (existing) {
    await db.star.delete({
      where: { id: existing.id },
    })
    return NextResponse.json({ starred: false })
  }

  await db.star.create({
    data: {
      userId: session.user.id,
      clipId: id,
    },
  })

  return NextResponse.json({ starred: true })
}
```

**Step 2: Commit**

```bash
git add src/app/api/clips/\[id\]/star/route.ts
git commit -m "feat: add star toggle API for clips"
```

---

### Task 16: Create Locations API Route

**Files:**
- Create: `src/app/api/locations/route.ts`

**Step 1: Create locations API**

Create `src/app/api/locations/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const sortBy = searchParams.get('sortBy') || 'clipCount'
  const order = searchParams.get('order') || 'desc'

  const locations = await db.location.findMany({
    orderBy: {
      [sortBy]: order,
    },
    take: 100,
  })

  return NextResponse.json({ locations })
}
```

**Step 2: Commit**

```bash
git add src/app/api/locations/route.ts
git commit -m "feat: add locations API with sorting"
```

---

## Phase 7: Dashboard UI Components

### Task 17: Create Clip Card Component

**Files:**
- Create: `src/components/clip-card.tsx`

**Step 1: Create clip card component**

Create `src/components/clip-card.tsx`:

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

const topicColors: Record<string, string> = {
  zoning: 'bg-purple-100 text-purple-700',
  opposition: 'bg-red-100 text-red-700',
  environmental: 'bg-green-100 text-green-700',
  announcement: 'bg-blue-100 text-blue-700',
  government: 'bg-indigo-100 text-indigo-700',
  legal: 'bg-orange-100 text-orange-700',
}

export function ClipCard({ clip }: { clip: ClipWithLocation }) {
  const [isStarred, setIsStarred] = useState(clip.isStarred)
  const [expanded, setExpanded] = useState(false)

  async function toggleStar() {
    const response = await fetch(`/api/clips/${clip.id}/star`, {
      method: 'POST',
    })
    if (response.ok) {
      const data = await response.json()
      setIsStarred(data.starred)
    }
  }

  const locationText = clip.location
    ? [clip.location.city, clip.location.county, clip.location.state]
        .filter(Boolean)
        .join(', ')
    : 'Unknown location'

  return (
    <article className="border rounded-lg p-4 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span
              className={`px-2 py-0.5 text-xs font-medium rounded border ${importanceColors[clip.importance]}`}
            >
              {clip.importance}
            </span>
            <span className="text-sm text-gray-500">{clip.sourceName}</span>
            <span className="text-sm text-gray-400">•</span>
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

          <div className="flex items-center gap-2 flex-wrap">
            {clip.topics.map((topic) => (
              <span
                key={topic}
                className={`px-2 py-0.5 text-xs rounded ${topicColors[topic] || 'bg-gray-100 text-gray-700'}`}
              >
                {topic}
              </span>
            ))}
          </div>

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
    </article>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/clip-card.tsx
git commit -m "feat: add clip card component with star toggle and expand"
```

---

### Task 18: Create Filter Sidebar Component

**Files:**
- Create: `src/components/filter-sidebar.tsx`

**Step 1: Create filter sidebar**

Create `src/components/filter-sidebar.tsx`:

```typescript
'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { TOPICS, STATES } from '@/lib/types'

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
  const currentSourceType = searchParams.get('sourceType')

  return (
    <aside className="w-64 flex-shrink-0 space-y-6">
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
        <h3 className="text-sm font-medium text-gray-900 mb-2">Source</h3>
        <div className="space-y-1">
          {['news', 'youtube', 'bluesky', 'government'].map((source) => (
            <button
              key={source}
              onClick={() =>
                updateFilter('sourceType', currentSourceType === source ? null : source)
              }
              className={`block w-full text-left px-3 py-1.5 text-sm rounded ${
                currentSourceType === source
                  ? 'bg-blue-100 text-blue-700'
                  : 'hover:bg-gray-100'
              }`}
            >
              {source.charAt(0).toUpperCase() + source.slice(1)}
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

      {(currentImportance || currentTopic || currentState || currentSourceType) && (
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
git commit -m "feat: add filter sidebar with importance, topic, source, and state filters"
```

---

### Task 19: Create Search Bar Component

**Files:**
- Create: `src/components/search-bar.tsx`

**Step 1: Create search bar**

Create `src/components/search-bar.tsx`:

```typescript
'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useEffect } from 'react'

export function SearchBar() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [query, setQuery] = useState(searchParams.get('search') || '')

  useEffect(() => {
    setQuery(searchParams.get('search') || '')
  }, [searchParams])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const params = new URLSearchParams(searchParams.toString())
    if (query.trim()) {
      params.set('search', query.trim())
    } else {
      params.delete('search')
    }
    params.delete('page')
    router.push(`/?${params.toString()}`)
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search clips..."
        className="flex-1 border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <button
        type="submit"
        className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700"
      >
        Search
      </button>
    </form>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/search-bar.tsx
git commit -m "feat: add search bar component"
```

---

### Task 20: Create Clip Feed Component

**Files:**
- Create: `src/components/clip-feed.tsx`

**Step 1: Create clip feed**

Create `src/components/clip-feed.tsx`:

```typescript
'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { ClipCard } from './clip-card'
import { Clip, Location } from '@prisma/client'

type ClipWithLocation = Clip & {
  location: Location | null
  isStarred: boolean
}

interface ClipsResponse {
  clips: ClipWithLocation[]
  total: number
  page: number
  totalPages: number
}

export function ClipFeed() {
  const searchParams = useSearchParams()
  const [data, setData] = useState<ClipsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchClips() {
      setLoading(true)
      setError(null)

      try {
        const response = await fetch(`/api/clips?${searchParams.toString()}`)
        if (!response.ok) {
          throw new Error('Failed to fetch clips')
        }
        const json = await response.json()
        setData(json)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    fetchClips()
  }, [searchParams])

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="border rounded-lg p-4 bg-white animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-8 text-red-600">
        Error: {error}
      </div>
    )
  }

  if (!data || data.clips.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No clips found. Try adjusting your filters.
      </div>
    )
  }

  return (
    <div>
      <div className="mb-4 text-sm text-gray-500">
        Showing {data.clips.length} of {data.total} clips
      </div>

      <div className="space-y-4">
        {data.clips.map((clip) => (
          <ClipCard key={clip.id} clip={clip} />
        ))}
      </div>

      {data.totalPages > 1 && (
        <Pagination
          currentPage={data.page}
          totalPages={data.totalPages}
        />
      )}
    </div>
  )
}

function Pagination({
  currentPage,
  totalPages,
}: {
  currentPage: number
  totalPages: number
}) {
  const searchParams = useSearchParams()

  function getPageUrl(page: number) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', page.toString())
    return `/?${params.toString()}`
  }

  return (
    <div className="flex justify-center gap-2 mt-6">
      {currentPage > 1 && (
        <a
          href={getPageUrl(currentPage - 1)}
          className="px-3 py-1 border rounded hover:bg-gray-50"
        >
          Previous
        </a>
      )}

      <span className="px-3 py-1 text-gray-600">
        Page {currentPage} of {totalPages}
      </span>

      {currentPage < totalPages && (
        <a
          href={getPageUrl(currentPage + 1)}
          className="px-3 py-1 border rounded hover:bg-gray-50"
        >
          Next
        </a>
      )}
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/clip-feed.tsx
git commit -m "feat: add clip feed component with loading states and pagination"
```

---

### Task 21: Create Dashboard Page

**Files:**
- Modify: `src/app/page.tsx`
- Create: `src/components/header.tsx`

**Step 1: Create header component**

Create `src/components/header.tsx`:

```typescript
'use client'

import { signOut, useSession } from 'next-auth/react'
import Link from 'next/link'

export function Header() {
  const { data: session } = useSession()

  return (
    <header className="bg-white border-b">
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold text-gray-900">
          Data Center Clips
        </Link>

        <nav className="flex items-center gap-6">
          <Link href="/" className="text-sm text-gray-600 hover:text-gray-900">
            Feed
          </Link>
          <Link href="/locations" className="text-sm text-gray-600 hover:text-gray-900">
            Locations
          </Link>
          <Link href="/starred" className="text-sm text-gray-600 hover:text-gray-900">
            Starred
          </Link>
          <Link href="/settings" className="text-sm text-gray-600 hover:text-gray-900">
            Settings
          </Link>
        </nav>

        {session && (
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{session.user.name}</span>
            <button
              onClick={() => signOut()}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
```

**Step 2: Update dashboard page**

Replace `src/app/page.tsx`:

```typescript
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { Header } from '@/components/header'
import { FilterSidebar } from '@/components/filter-sidebar'
import { SearchBar } from '@/components/search-bar'
import { ClipFeed } from '@/components/clip-feed'

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="mb-6">
          <SearchBar />
        </div>

        <div className="flex gap-6">
          <FilterSidebar />
          <div className="flex-1">
            <ClipFeed />
          </div>
        </div>
      </main>
    </div>
  )
}
```

**Step 3: Commit**

```bash
git add src/app/page.tsx src/components/header.tsx
git commit -m "feat: create dashboard page with header, filters, and clip feed"
```

---

## Phase 8: Worker Service

### Task 22: Create Worker Entry Point

**Files:**
- Create: `worker/index.ts`
- Create: `worker/package.json`
- Create: `worker/tsconfig.json`

**Step 1: Create worker package.json**

Create `worker/package.json`:

```json
{
  "name": "datacenter-clips-worker",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "start": "tsx index.ts",
    "dev": "tsx watch index.ts"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.24.0",
    "@prisma/client": "^5.0.0",
    "rss-parser": "^3.13.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.0.0"
  }
}
```

**Step 2: Create worker tsconfig**

Create `worker/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": ".",
    "resolveJsonModule": true,
    "paths": {
      "@/*": ["../src/*"]
    }
  },
  "include": ["*.ts", "../src/lib/**/*.ts"],
  "exclude": ["node_modules"]
}
```

**Step 3: Create worker entry point**

Create `worker/index.ts`:

```typescript
import { processNewClips } from '../src/lib/processor'

const POLL_INTERVAL_MS = 15 * 60 * 1000 // 15 minutes

async function runWorker() {
  console.log('Worker started')

  while (true) {
    try {
      console.log(`[${new Date().toISOString()}] Processing clips...`)
      const result = await processNewClips()
      console.log(
        `[${new Date().toISOString()}] Processed ${result.processed} clips, ${result.errors} errors`
      )
    } catch (error) {
      console.error('Worker error:', error)
    }

    await sleep(POLL_INTERVAL_MS)
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

runWorker()
```

**Step 4: Commit**

```bash
git add worker/
git commit -m "feat: add worker service with continuous polling"
```

---

## Phase 9: Email Digests

### Task 23: Create Email Templates

**Files:**
- Create: `src/lib/email/digest-template.tsx`
- Create: `src/lib/email/send.ts`

**Step 1: Install React Email and Resend**

```bash
npm install @react-email/components resend
```

**Step 2: Create digest email template**

Create `src/lib/email/digest-template.tsx`:

```typescript
import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Link,
  Hr,
} from '@react-email/components'
import { Clip, Location } from '@prisma/client'

type ClipWithLocation = Clip & { location: Location | null }

interface DigestEmailProps {
  highPriorityClips: ClipWithLocation[]
  mediumPriorityClips: ClipWithLocation[]
  newLocations: Location[]
  dashboardUrl: string
}

export function DigestEmail({
  highPriorityClips,
  mediumPriorityClips,
  newLocations,
  dashboardUrl,
}: DigestEmailProps) {
  const formatLocation = (clip: ClipWithLocation) => {
    if (!clip.location) return 'Unknown'
    return [clip.location.city, clip.location.county, clip.location.state]
      .filter(Boolean)
      .join(', ')
  }

  return (
    <Html>
      <Head />
      <Body style={{ fontFamily: 'system-ui, sans-serif', padding: '20px' }}>
        <Container style={{ maxWidth: '600px' }}>
          <Text style={{ fontSize: '24px', fontWeight: 'bold' }}>
            Data Center Clips Digest
          </Text>
          <Text style={{ color: '#666' }}>
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </Text>

          {highPriorityClips.length > 0 && (
            <Section>
              <Text style={{ fontSize: '18px', fontWeight: 'bold', color: '#dc2626' }}>
                🔴 HIGH PRIORITY ({highPriorityClips.length} items)
              </Text>
              {highPriorityClips.map((clip) => (
                <Section key={clip.id} style={{ marginBottom: '16px' }}>
                  <Text style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                    ▸ {formatLocation(clip)} — {clip.title}
                  </Text>
                  {clip.summary && (
                    <Text style={{ color: '#666', marginTop: '0' }}>
                      {clip.summary}
                    </Text>
                  )}
                  <Link href={clip.url} style={{ color: '#2563eb', fontSize: '14px' }}>
                    → Read more
                  </Link>
                </Section>
              ))}
            </Section>
          )}

          {mediumPriorityClips.length > 0 && (
            <Section>
              <Hr />
              <Text style={{ fontSize: '18px', fontWeight: 'bold', color: '#ca8a04' }}>
                🟡 MEDIUM PRIORITY ({mediumPriorityClips.length} items)
              </Text>
              {mediumPriorityClips.slice(0, 10).map((clip) => (
                <Text key={clip.id} style={{ marginBottom: '8px' }}>
                  ▸ {formatLocation(clip)} —{' '}
                  <Link href={clip.url} style={{ color: '#2563eb' }}>
                    {clip.title}
                  </Link>
                </Text>
              ))}
              {mediumPriorityClips.length > 10 && (
                <Text style={{ color: '#666', fontStyle: 'italic' }}>
                  + {mediumPriorityClips.length - 10} more items
                </Text>
              )}
            </Section>
          )}

          {newLocations.length > 0 && (
            <Section>
              <Hr />
              <Text style={{ fontSize: '18px', fontWeight: 'bold' }}>
                📍 NEW LOCATIONS DISCOVERED ({newLocations.length})
              </Text>
              {newLocations.map((loc) => (
                <Text key={loc.id}>
                  ▸ {[loc.county, loc.state].filter(Boolean).join(', ')} — first clip seen{' '}
                  {new Date(loc.firstSeen).toLocaleDateString()}
                </Text>
              ))}
            </Section>
          )}

          <Hr />
          <Section>
            <Link href={dashboardUrl} style={{ color: '#2563eb', marginRight: '16px' }}>
              View Dashboard
            </Link>
            <Link href={`${dashboardUrl}/settings`} style={{ color: '#2563eb' }}>
              Manage Preferences
            </Link>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}
```

**Step 3: Create email sending utility**

Create `src/lib/email/send.ts`:

```typescript
import { Resend } from 'resend'
import { render } from '@react-email/components'
import { DigestEmail } from './digest-template'
import { db } from '../db'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendDigestEmail(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: { digestPreference: true },
  })

  if (!user || !user.digestPreference) {
    return
  }

  const pref = user.digestPreference
  const since = pref.frequency === 'daily'
    ? new Date(Date.now() - 24 * 60 * 60 * 1000)
    : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const whereClause: Record<string, unknown> = {
    discoveredAt: { gte: since },
  }

  if (pref.topics.length > 0) {
    whereClause.topics = { hasSome: pref.topics }
  }

  if (pref.states.length > 0) {
    whereClause.location = { state: { in: pref.states } }
  }

  const clips = await db.clip.findMany({
    where: whereClause,
    include: { location: true },
    orderBy: { discoveredAt: 'desc' },
  })

  const highPriority = clips.filter((c) => c.importance === 'high')
  const mediumPriority = clips.filter((c) => c.importance === 'medium')

  if (pref.importance === 'high_only' && highPriority.length === 0) {
    return // Nothing to send
  }

  const newLocations = await db.location.findMany({
    where: { firstSeen: { gte: since } },
    orderBy: { firstSeen: 'desc' },
  })

  const dashboardUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'

  const html = await render(
    DigestEmail({
      highPriorityClips: highPriority,
      mediumPriorityClips: pref.importance === 'high_only' ? [] : mediumPriority,
      newLocations,
      dashboardUrl,
    })
  )

  await resend.emails.send({
    from: 'Data Center Clips <noreply@yourdomain.com>',
    to: user.email,
    subject: `Data Center Clips Digest — ${new Date().toLocaleDateString()} — ${highPriority.length} high-priority items`,
    html,
  })
}
```

**Step 4: Add Resend API key to .env.example**

Append to `.env.example`:

```bash
RESEND_API_KEY="your-resend-api-key"
```

**Step 5: Commit**

```bash
git add src/lib/email/ .env.example package.json package-lock.json
git commit -m "feat: add email digest templates and sending with React Email and Resend"
```

---

### Task 24: Create Digest Scheduler

**Files:**
- Create: `worker/digest.ts`

**Step 1: Create digest scheduler**

Create `worker/digest.ts`:

```typescript
import { db } from '../src/lib/db'
import { sendDigestEmail } from '../src/lib/email/send'

export async function sendDailyDigests() {
  const users = await db.user.findMany({
    where: {
      digestPreference: {
        frequency: 'daily',
      },
    },
    select: { id: true },
  })

  console.log(`Sending daily digests to ${users.length} users`)

  for (const user of users) {
    try {
      await sendDigestEmail(user.id)
      console.log(`Sent daily digest to user ${user.id}`)
    } catch (error) {
      console.error(`Failed to send digest to user ${user.id}:`, error)
    }
  }
}

export async function sendWeeklyDigests() {
  const users = await db.user.findMany({
    where: {
      digestPreference: {
        frequency: 'weekly',
      },
    },
    select: { id: true },
  })

  console.log(`Sending weekly digests to ${users.length} users`)

  for (const user of users) {
    try {
      await sendDigestEmail(user.id)
      console.log(`Sent weekly digest to user ${user.id}`)
    } catch (error) {
      console.error(`Failed to send digest to user ${user.id}:`, error)
    }
  }
}

// Check if it's time to send digests (7am ET)
export function shouldSendDailyDigest(): boolean {
  const now = new Date()
  const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))
  return et.getHours() === 7 && et.getMinutes() < 15
}

export function shouldSendWeeklyDigest(): boolean {
  const now = new Date()
  const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))
  return et.getDay() === 1 && et.getHours() === 7 && et.getMinutes() < 15
}
```

**Step 2: Update worker to include digest scheduling**

Update `worker/index.ts`:

```typescript
import { processNewClips } from '../src/lib/processor'
import {
  sendDailyDigests,
  sendWeeklyDigests,
  shouldSendDailyDigest,
  shouldSendWeeklyDigest,
} from './digest'

const POLL_INTERVAL_MS = 15 * 60 * 1000 // 15 minutes

let lastDailyDigest: string | null = null
let lastWeeklyDigest: string | null = null

async function runWorker() {
  console.log('Worker started')

  while (true) {
    try {
      // Process new clips
      console.log(`[${new Date().toISOString()}] Processing clips...`)
      const result = await processNewClips()
      console.log(
        `[${new Date().toISOString()}] Processed ${result.processed} clips, ${result.errors} errors`
      )

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

    await sleep(POLL_INTERVAL_MS)
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

runWorker()
```

**Step 3: Commit**

```bash
git add worker/digest.ts worker/index.ts
git commit -m "feat: add digest scheduler for daily and weekly emails"
```

---

## Phase 10: Settings Page

### Task 25: Create Digest Preferences API

**Files:**
- Create: `src/app/api/settings/digest/route.ts`

**Step 1: Create digest preferences API**

Create `src/app/api/settings/digest/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const pref = await db.digestPreference.findUnique({
    where: { userId: session.user.id },
  })

  return NextResponse.json({ preference: pref })
}

export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { frequency, topics, states, importance } = body

  const pref = await db.digestPreference.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      frequency: frequency || 'daily',
      topics: topics || [],
      states: states || [],
      importance: importance || 'high_and_medium',
    },
    update: {
      frequency,
      topics,
      states,
      importance,
    },
  })

  return NextResponse.json({ preference: pref })
}
```

**Step 2: Commit**

```bash
git add src/app/api/settings/digest/route.ts
git commit -m "feat: add digest preferences API"
```

---

### Task 26: Create Settings Page

**Files:**
- Create: `src/app/settings/page.tsx`
- Create: `src/components/digest-settings-form.tsx`

**Step 1: Create digest settings form**

Create `src/components/digest-settings-form.tsx`:

```typescript
'use client'

import { useEffect, useState } from 'react'
import { TOPICS, STATES } from '@/lib/types'

interface DigestPreference {
  frequency: 'daily' | 'weekly'
  topics: string[]
  states: string[]
  importance: 'high_only' | 'high_and_medium' | 'all'
}

export function DigestSettingsForm() {
  const [pref, setPref] = useState<DigestPreference>({
    frequency: 'daily',
    topics: [],
    states: [],
    importance: 'high_and_medium',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/settings/digest')
      .then((r) => r.json())
      .then((data) => {
        if (data.preference) {
          setPref(data.preference)
        }
        setLoading(false)
      })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSaved(false)

    await fetch('/api/settings/digest', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pref),
    })

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  function toggleTopic(topic: string) {
    setPref((p) => ({
      ...p,
      topics: p.topics.includes(topic)
        ? p.topics.filter((t) => t !== topic)
        : [...p.topics, topic],
    }))
  }

  function toggleState(state: string) {
    setPref((p) => ({
      ...p,
      states: p.states.includes(state)
        ? p.states.filter((s) => s !== state)
        : [...p.states, state],
    }))
  }

  if (loading) {
    return <div>Loading...</div>
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Digest Frequency
        </label>
        <select
          value={pref.frequency}
          onChange={(e) =>
            setPref((p) => ({ ...p, frequency: e.target.value as 'daily' | 'weekly' }))
          }
          className="border rounded px-3 py-2"
        >
          <option value="daily">Daily (7am ET)</option>
          <option value="weekly">Weekly (Monday 7am ET)</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Importance Level
        </label>
        <select
          value={pref.importance}
          onChange={(e) =>
            setPref((p) => ({
              ...p,
              importance: e.target.value as 'high_only' | 'high_and_medium' | 'all',
            }))
          }
          className="border rounded px-3 py-2"
        >
          <option value="high_only">High priority only</option>
          <option value="high_and_medium">High and medium priority</option>
          <option value="all">All clips</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Filter by Topics (leave empty for all)
        </label>
        <div className="flex flex-wrap gap-2">
          {TOPICS.map((topic) => (
            <button
              key={topic}
              type="button"
              onClick={() => toggleTopic(topic)}
              className={`px-3 py-1 rounded border ${
                pref.topics.includes(topic)
                  ? 'bg-blue-100 border-blue-300 text-blue-700'
                  : 'hover:bg-gray-50'
              }`}
            >
              {topic}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Filter by States (leave empty for all)
        </label>
        <div className="flex flex-wrap gap-1">
          {STATES.map((state) => (
            <button
              key={state}
              type="button"
              onClick={() => toggleState(state)}
              className={`px-2 py-1 text-xs rounded border ${
                pref.states.includes(state)
                  ? 'bg-blue-100 border-blue-300 text-blue-700'
                  : 'hover:bg-gray-50'
              }`}
            >
              {state}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Preferences'}
        </button>
        {saved && <span className="text-green-600">Saved!</span>}
      </div>
    </form>
  )
}
```

**Step 2: Create settings page**

Create `src/app/settings/page.tsx`:

```typescript
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { Header } from '@/components/header'
import { DigestSettingsForm } from '@/components/digest-settings-form'

export default async function SettingsPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>

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
git add src/app/settings/page.tsx src/components/digest-settings-form.tsx
git commit -m "feat: add settings page with digest preferences form"
```

---

## Phase 11: Deployment Configuration

### Task 27: Create Deployment Files

**Files:**
- Create: `vercel.json`
- Create: `railway.toml`
- Create: `Procfile`
- Update: `.gitignore`

**Step 1: Create Vercel config**

Create `vercel.json`:

```json
{
  "buildCommand": "npx prisma generate && npm run build",
  "framework": "nextjs"
}
```

**Step 2: Create Railway config for worker**

Create `railway.toml`:

```toml
[build]
builder = "nixpacks"
buildCommand = "cd worker && npm install && npx prisma generate --schema=../prisma/schema.prisma"

[deploy]
startCommand = "cd worker && npm start"
healthcheckPath = "/"
healthcheckTimeout = 300
restartPolicyType = "on_failure"
restartPolicyMaxRetries = 3
```

**Step 3: Create Procfile (alternative to railway.toml)**

Create `Procfile`:

```
worker: cd worker && npm start
```

**Step 4: Update .gitignore**

Append to `.gitignore` if not already present:

```
.env
.env.local
node_modules/
.next/
worker/node_modules/
```

**Step 5: Commit**

```bash
git add vercel.json railway.toml Procfile .gitignore
git commit -m "chore: add deployment configuration for Vercel and Railway"
```

---

### Task 28: Create Seed Script

**Files:**
- Create: `prisma/seed.ts`
- Modify: `package.json`

**Step 1: Create seed script**

Create `prisma/seed.ts`:

```typescript
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // Create a test user
  const passwordHash = await bcrypt.hash('password123', 10)

  const user = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      name: 'Admin User',
      passwordHash,
      digestPreference: {
        create: {
          frequency: 'daily',
          topics: [],
          states: [],
          importance: 'high_and_medium',
        },
      },
    },
  })

  console.log('Created user:', user.email)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
```

**Step 2: Add seed script to package.json**

Add to `package.json` in the "prisma" section:

```json
{
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  }
}
```

**Step 3: Run seed**

```bash
npx prisma db seed
```

**Step 4: Commit**

```bash
git add prisma/seed.ts package.json
git commit -m "feat: add database seed script with test user"
```

---

## Summary

This plan creates a complete data center news monitoring application with:

1. **Next.js frontend** on Vercel with dashboard, filtering, search, and authentication
2. **Node.js worker** on Railway that continuously polls Google News, YouTube, and Bluesky
3. **AI classification** using Claude Haiku to extract location, topics, importance, and generate summaries
4. **PostgreSQL database** on Railway storing clips, locations, users, and preferences
5. **Email digests** sent daily/weekly using React Email and Resend

The implementation follows TDD principles with bite-sized tasks, frequent commits, and clear file paths for each step.
