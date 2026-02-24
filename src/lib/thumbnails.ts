import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

const THUMBNAILS_DIR = path.join(process.cwd(), 'public', 'thumbnails')

export async function downloadThumbnail(
  videoId: string,
  thumbnailUrl: string
): Promise<string | null> {
  if (!thumbnailUrl) return null

  try {
    if (!existsSync(THUMBNAILS_DIR)) {
      await mkdir(THUMBNAILS_DIR, { recursive: true })
    }

    const filename = `${videoId}.jpg`
    const filepath = path.join(THUMBNAILS_DIR, filename)

    if (existsSync(filepath)) {
      return `/thumbnails/${filename}`
    }

    const response = await fetch(thumbnailUrl)
    if (!response.ok) {
      console.error(`Thumbnail download failed for ${videoId}: ${response.status}`)
      return null
    }

    const buffer = Buffer.from(await response.arrayBuffer())
    await writeFile(filepath, buffer)

    return `/thumbnails/${filename}`
  } catch (error) {
    console.error(`Thumbnail download error for ${videoId}:`, error)
    return null
  }
}
