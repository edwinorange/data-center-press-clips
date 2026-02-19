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
