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
