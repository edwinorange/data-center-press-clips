import { YoutubeTranscript } from 'youtube-transcript'

export async function fetchCaptions(videoId: string): Promise<string | null> {
  try {
    const segments = await YoutubeTranscript.fetchTranscript(videoId, {
      lang: 'en',
    })

    if (!segments || segments.length === 0) {
      console.warn(`No caption segments found for video ${videoId}`)
      return null
    }

    const fullText = segments.map((s) => s.text).join(' ')

    if (fullText.trim().length === 0) return null

    return fullText
  } catch (error) {
    console.warn(`Failed to fetch captions for video ${videoId}:`, error instanceof Error ? error.message : error)
    return null
  }
}
