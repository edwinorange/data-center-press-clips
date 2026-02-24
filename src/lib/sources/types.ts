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
