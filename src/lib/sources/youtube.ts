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
    duration: string
    caption: string
  }
}

interface YouTubeVideosResponse {
  items?: YouTubeVideoItem[]
}

interface BucketConfig {
  bucket: ClipBucket
  query: string
  videoDurations: string[]
  minDurationSecs: number
  maxDurationSecs: number
}

const BUCKET_CONFIGS: BucketConfig[] = [
  {
    bucket: 'news_clip',
    query: '"data center"',
    videoDurations: ['short', 'medium'],
    minDurationSecs: 0,
    maxDurationSecs: 300,
  },
  {
    bucket: 'public_meeting',
    query: '"data center" public meeting OR hearing OR town hall OR council',
    videoDurations: ['long'],
    minDurationSecs: 3600,
    maxDurationSecs: Infinity,
  },
]

function parseDuration(iso8601: string): number {
  const match = iso8601.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return 0
  const hours = parseInt(match[1] || '0', 10)
  const minutes = parseInt(match[2] || '0', 10)
  const seconds = parseInt(match[3] || '0', 10)
  return hours * 3600 + minutes * 60 + seconds
}

function getPublishedAfter(): string {
  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000)
  return sixHoursAgo.toISOString()
}

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
          const videoIds = await searchYouTube(
            apiKey,
            config.query,
            videoDuration,
            publishedAfter
          )

          if (videoIds.length === 0) continue

          const newIds = videoIds.filter((id) => !seenIds.has(id))
          newIds.forEach((id) => seenIds.add(id))

          if (newIds.length === 0) continue

          const videos = await getVideoDetails(apiKey, newIds)

          for (const video of videos) {
            const durationSecs = parseDuration(video.contentDetails.duration)

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
