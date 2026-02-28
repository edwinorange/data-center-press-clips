const INNERTUBE_BASE = 'https://www.youtube.com/youtubei/v1'
const TV_CLIENT = {
  clientName: 'TVHTML5_SIMPLY_EMBEDDED_PLAYER',
  clientVersion: '2.0',
  hl: 'en',
  gl: 'US',
}

interface CaptionTrack {
  baseUrl: string
  languageCode: string
  kind?: string // 'asr' for auto-generated
}

interface PlayerResponse {
  captions?: {
    playerCaptionsTracklistRenderer?: {
      captionTracks?: CaptionTrack[]
    }
  }
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
}

export async function fetchCaptions(videoId: string): Promise<string | null> {
  try {
    // Step 1: Get player response with caption tracks via Innertube TV client
    const playerResp = await fetch(`${INNERTUBE_BASE}/player`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        context: { client: TV_CLIENT },
        videoId,
      }),
    })

    if (!playerResp.ok) {
      console.warn(`Innertube player API returned ${playerResp.status} for ${videoId}`)
      return null
    }

    const player: PlayerResponse = await playerResp.json()
    const tracks = player.captions?.playerCaptionsTracklistRenderer?.captionTracks
    if (!tracks || tracks.length === 0) {
      console.warn(`No caption tracks found for video ${videoId}`)
      return null
    }

    // Step 2: Pick best track — prefer English, prefer manual over auto-generated
    const englishTracks = tracks.filter((t) => t.languageCode === 'en')
    const track =
      englishTracks.find((t) => t.kind !== 'asr') ||
      englishTracks[0] ||
      tracks.find((t) => t.kind !== 'asr') ||
      tracks[0]

    // Step 3: Fetch the caption XML
    const xmlResp = await fetch(track.baseUrl)
    if (!xmlResp.ok) {
      console.warn(`Caption XML fetch returned ${xmlResp.status} for ${videoId}`)
      return null
    }

    const xml = await xmlResp.text()
    if (!xml || xml.length === 0) {
      console.warn(`Empty caption response for video ${videoId}`)
      return null
    }

    // Step 4: Parse XML and extract text
    const segments = [...xml.matchAll(/<text[^>]*>([\s\S]*?)<\/text>/g)]
    if (segments.length === 0) {
      console.warn(`No text segments found in captions for ${videoId}`)
      return null
    }

    const fullText = segments
      .map((m) => decodeHtmlEntities(m[1]))
      .join(' ')
      .replace(/\n/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    if (fullText.length === 0) return null

    console.log(`Fetched transcript for ${videoId}: ${fullText.length} chars, ${segments.length} segments`)
    return fullText
  } catch (error) {
    console.warn(
      `Failed to fetch captions for video ${videoId}:`,
      error instanceof Error ? error.message : error
    )
    return null
  }
}
