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
