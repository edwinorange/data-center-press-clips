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
