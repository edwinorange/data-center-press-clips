# Data Center Press Clips — Design Document

## Overview

A web application for community organizers to monitor local US news about data center developments. The system continuously scans local news, YouTube, Bluesky, and government sources for clips related to data center projects, classifies them by topic and importance using AI, and surfaces them via a dashboard and email digests.

## Goals

- Track local (not national) news about data center developments across the entire US
- Auto-discover new localities through keyword scanning
- Surface high-priority items: zoning hearings, community opposition, environmental concerns, new announcements, government actions, and legal challenges
- Provide a shared dashboard for a small team of organizers
- Deliver periodic email digests with curated clips

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         VERCEL                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    Next.js App                            │  │
│  │  • Dashboard (browse/filter/search clips)                 │  │
│  │  • Auth (team login)                                      │  │
│  │  • API routes (read from DB, trigger manual refreshes)    │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     SHARED DATABASE                             │
│                  (Postgres on Railway)                          │
│  • clips, sources, locations, users, digest_preferences        │
└─────────────────────────────────────────────────────────────────┘
                              ▲
                              │
┌─────────────────────────────────────────────────────────────────┐
│                        RAILWAY                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌────────────────┐  │
│  │  Scraper Worker │  │  AI Classifier  │  │ Digest Mailer  │  │
│  │  (continuous)   │  │  (on new clips) │  │ (scheduled)    │  │
│  └─────────────────┘  └─────────────────┘  └────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Components

| Component | Purpose | Deployment |
|-----------|---------|------------|
| Next.js App | Dashboard, auth, API | Vercel |
| Scraper Worker | Polls sources continuously | Railway (Node.js) |
| AI Classifier | Tags topics, assigns importance | Railway (calls Claude API) |
| Digest Mailer | Sends daily/weekly email summaries | Railway (cron job) |
| Postgres | Stores all clips, metadata, user prefs | Railway |

## Data Sources

| Source | Method | Frequency |
|--------|--------|-----------|
| Local news sites | RSS feeds, Google News RSS, news aggregator APIs | Every 15 min |
| YouTube | Official API (search) | Every 15 min |
| Bluesky | AT Protocol firehose + search | Near real-time |
| Google News | RSS feed with search query | Every 15 min |
| Government sites | Web scraping (agendas, minutes) | Hourly |

### Discovery Strategy

Broad keyword scanning to auto-discover localities:

1. Search across sources: `"data center" + (zoning OR permit OR opposition OR protest OR megawatts OR hyperscale)`
2. Extract location (city, county, state) from each clip using NLP
3. Build dynamic locality list — new places become tracked automatically
4. Expand monitoring — once a locality is flagged, monitor its local news and government meeting agendas

### Sources NOT Included

- **Twitter/X** — API too expensive for this use case
- **Facebook** — no public API, scraping violates ToS

## Data Model

### clips

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| url | TEXT | Unique, dedupe key |
| title | TEXT | |
| summary | TEXT | AI-generated |
| content | TEXT | Full text if available |
| source_type | ENUM | news, youtube, bluesky, government |
| source_name | TEXT | e.g., "Richmond Times-Dispatch" |
| published_at | TIMESTAMP | |
| discovered_at | TIMESTAMP | |
| location_id | FK → locations | |
| importance | ENUM | high, medium, low |
| topics | TEXT[] | zoning, opposition, environmental, announcement, government, legal |
| raw_data | JSONB | Original API response / scraped data |

### locations

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| city | TEXT | |
| county | TEXT | |
| state | TEXT | 2-letter code |
| first_seen | TIMESTAMP | |
| clip_count | INT | Denormalized for quick stats |

### users

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| email | TEXT | |
| name | TEXT | |
| password_hash | TEXT | |
| created_at | TIMESTAMP | |

### digest_preferences

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| user_id | FK → users | |
| frequency | ENUM | daily, weekly |
| topics | TEXT[] | Filter to these topics, NULL = all |
| states | TEXT[] | Filter to these states, NULL = all |
| importance | ENUM | high_only, high_and_medium, all |

## AI Classification

For each new clip, the classifier:

1. **Extracts location** — city/county/state mentioned
2. **Assigns topics** — one or more from the six categories
3. **Sets importance** — high, medium, or low
4. **Generates summary** — 2-3 sentence plain-English summary

### Importance Scoring

| Level | Signals |
|-------|---------|
| High | Active opposition (protests, petitions), upcoming votes/hearings, new major announcements, lawsuits filed |
| Medium | General coverage of existing projects, routine permit updates, environmental studies released |
| Low | Passing mentions, opinion pieces, industry analysis without local specifics |

### Implementation

- Model: Claude API (Haiku for cost efficiency)
- Structured prompt returning JSON: `{ location, topics[], importance, summary }`
- Fallback: If API fails, save with `importance: medium`, `topics: ["unclassified"]`

### Cost Estimate

~500 clips/day at ~1,000 tokens each:
- Haiku: ~$4/month
- Sonnet: ~$45/month (if quality upgrade needed)

## Dashboard

### Views

1. **Feed View** (default) — reverse-chronological list with filters (topic, state, importance, date, source type) and full-text search
2. **Map View** — US map with markers for active localities, click to filter
3. **Locations View** — list of discovered localities, sortable by activity
4. **Saved/Starred** — team-shared starred clips

### Clip Display

Each clip shows: title, source, location, topic tags, importance indicator, time, AI summary. Expandable for full details and link to original.

### Team Features

- Email/password auth
- All members see same data
- Shared starred items
- Individual digest preferences

### Visual Style

Clean, utilitarian, text-focused. Fast loading, minimal chrome.

## Email Digests

### Format

```
Subject: Data Center Clips Digest — [Date] — [X] high-priority items

🔴 HIGH PRIORITY (3 items)
▸ Location — Headline
  Summary
  → [Read more]

🟡 MEDIUM PRIORITY (12 items)
▸ Location — Headline (truncated list)

📍 NEW LOCATIONS DISCOVERED (2)
▸ County, State — first clip seen [date]

[View Dashboard] [Manage Preferences]
```

### User Preferences

| Setting | Options |
|---------|---------|
| Frequency | Daily (7am ET) or Weekly (Monday 7am ET) |
| Topics | All or filtered |
| States | All or filtered |
| Importance | High only, High + Medium, or All |

### Delivery

React Email or MJML templates, sent via Resend/Postmark/SendGrid.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14+ (App Router), React, Tailwind CSS |
| Backend API | Next.js API routes |
| Database | PostgreSQL (Railway) |
| ORM | Prisma or Drizzle |
| Auth | NextAuth.js or Lucia |
| Workers | Node.js on Railway |
| AI | Claude API (Anthropic) |
| Email | React Email + Resend |
| Deployment | Vercel (web), Railway (workers, database) |

## Out of Scope (for now)

- Twitter/Facebook monitoring
- Public access (no login)
- Multi-organization tenancy
- Mobile app
- Real-time notifications/alerts
