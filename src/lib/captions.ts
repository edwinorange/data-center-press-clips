interface CaptionTrack {
  id: string
  snippet: {
    language: string
    trackKind: string
    name: string
  }
}

interface CaptionsListResponse {
  items?: CaptionTrack[]
}

async function listCaptions(
  apiKey: string,
  videoId: string
): Promise<CaptionTrack[]> {
  const params = new URLSearchParams({
    part: 'snippet',
    videoId,
    key: apiKey,
  })

  const response = await fetch(
    `https://www.googleapis.com/youtube/v3/captions?${params}`
  )

  if (!response.ok) {
    console.error(`Captions list API error for ${videoId}: ${response.status}`)
    return []
  }

  const data: CaptionsListResponse = await response.json()
  return data.items || []
}

async function downloadCaptionText(
  videoId: string
): Promise<string | null> {
  const params = new URLSearchParams({
    v: videoId,
    lang: 'en',
    fmt: 'srv3',
  })

  const response = await fetch(
    `https://www.youtube.com/api/timedtext?${params}`
  )

  if (!response.ok) {
    params.set('kind', 'asr')
    const asrResponse = await fetch(
      `https://www.youtube.com/api/timedtext?${params}`
    )

    if (!asrResponse.ok) {
      return null
    }

    const xml = await asrResponse.text()
    return parseTimedText(xml)
  }

  const xml = await response.text()
  return parseTimedText(xml)
}

function parseTimedText(xml: string): string | null {
  if (!xml || xml.trim().length === 0) return null

  const textRegex = /<text[^>]*>([\s\S]*?)<\/text>/g
  const segments: string[] = []
  let match

  while ((match = textRegex.exec(xml)) !== null) {
    let text = match[1]
    text = text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\n/g, ' ')
      .trim()

    if (text.length > 0) {
      segments.push(text)
    }
  }

  if (segments.length === 0) return null

  return segments.join(' ')
}

export async function fetchCaptions(videoId: string): Promise<string | null> {
  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) return null

  try {
    const tracks = await listCaptions(apiKey, videoId)
    const englishTrack = tracks.find(
      (t) => t.snippet.language === 'en' || t.snippet.language.startsWith('en')
    )

    if (!englishTrack && tracks.length === 0) {
      console.warn(`No caption tracks found for video ${videoId}`)
      return null
    }

    const transcript = await downloadCaptionText(videoId)

    if (!transcript) {
      console.warn(`Failed to download captions for video ${videoId}`)
      return null
    }

    return transcript
  } catch (error) {
    console.error(`Caption fetch failed for video ${videoId}:`, error)
    return null
  }
}
