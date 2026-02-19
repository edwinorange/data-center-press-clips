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
          // URI format: at://did:plc:xxx/app.bsky.feed.post/rkey
          const uriParts = post.uri.split('/')
          const rkey = uriParts[4]
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
