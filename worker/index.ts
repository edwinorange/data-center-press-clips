import { processNewClips } from '../src/lib/processor'

const POLL_INTERVAL_MS = 15 * 60 * 1000 // 15 minutes

async function runWorker() {
  console.log('Worker started')

  while (true) {
    try {
      console.log(`[${new Date().toISOString()}] Processing clips...`)
      const result = await processNewClips()
      console.log(
        `[${new Date().toISOString()}] Processed ${result.processed} clips, ${result.errors} errors`
      )
    } catch (error) {
      console.error('Worker error:', error)
    }

    await sleep(POLL_INTERVAL_MS)
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

runWorker()
