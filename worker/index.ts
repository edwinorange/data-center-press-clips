import { processNewClips } from '../src/lib/processor'
import {
  sendDailyDigests,
  sendWeeklyDigests,
  shouldSendDailyDigest,
  shouldSendWeeklyDigest,
} from './digest'

const POLL_INTERVAL_MS = 15 * 60 * 1000 // 15 minutes

let lastDailyDigest: string | null = null
let lastWeeklyDigest: string | null = null

async function runWorker() {
  console.log('Worker started')

  while (true) {
    try {
      // Process new clips
      console.log(`[${new Date().toISOString()}] Processing clips...`)
      const result = await processNewClips()
      console.log(
        `[${new Date().toISOString()}] Processed ${result.processed} clips, ${result.errors} errors`
      )

      // Check for digest sending
      const today = new Date().toISOString().split('T')[0]

      if (shouldSendDailyDigest() && lastDailyDigest !== today) {
        console.log(`[${new Date().toISOString()}] Sending daily digests...`)
        await sendDailyDigests()
        lastDailyDigest = today
      }

      if (shouldSendWeeklyDigest() && lastWeeklyDigest !== today) {
        console.log(`[${new Date().toISOString()}] Sending weekly digests...`)
        await sendWeeklyDigests()
        lastWeeklyDigest = today
      }
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
