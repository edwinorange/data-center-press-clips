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

import { googleNewsFetcher } from './google-news'
import { youtubeFetcher } from './youtube'

registerSource(googleNewsFetcher)
registerSource(youtubeFetcher)
