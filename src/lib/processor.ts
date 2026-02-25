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
