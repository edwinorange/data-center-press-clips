import http from 'http'
import { processNewClips } from '../src/lib/processor'
// MOTHBALLED: digest functionality
// import {
//   sendDailyDigests,
//   sendWeeklyDigests,
//   shouldSendDailyDigest,
//   shouldSendWeeklyDigest,
// } from './digest'

const CHECK_INTERVAL_MS = 5 * 60 * 1000 // Check every 5 minutes
const RUN_HOURS_ET = [6, 12, 18, 0] // 6am, 12pm, 6pm, 12am ET

// MOTHBALLED: digest functionality
// let lastDailyDigest: string | null = null
// let lastWeeklyDigest: string | null = null
let lastRunHour: number | null = null

function getCurrentETHour(): number {
  const now = new Date()
  const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))
  return et.getHours()
}

function shouldRunNow(): boolean {
  const currentHour = getCurrentETHour()
  if (!RUN_HOURS_ET.includes(currentHour)) return false
  if (lastRunHour === currentHour) return false
  return true
}

// Health check server for Railway
const PORT = parseInt(process.env.PORT || '3000', 10)
http.createServer((_req, res) => {
  res.writeHead(200)
  res.end('ok')
}).listen(PORT, () => {
  console.log(`Health check server listening on port ${PORT}`)
})

async function runWorker() {
  console.log('Worker started — running every 6 hours (6am, 12pm, 6pm, 12am ET)')

  while (true) {
    try {
      if (shouldRunNow()) {
        const currentHour = getCurrentETHour()
        lastRunHour = currentHour

        // Process new clips
        console.log(`[${new Date().toISOString()}] Processing clips (${currentHour}:00 ET run)...`)
        const result = await processNewClips()
        console.log(
          `[${new Date().toISOString()}] Done: ${result.processed} stored, ` +
          `${result.skippedRelevance} low-relevance, ` +
          `${result.skippedDuplicate} duplicates, ` +
          `${result.errors} errors`
        )
      }

      // MOTHBALLED: digest functionality
      // const today = new Date().toISOString().split('T')[0]
      //
      // if (shouldSendDailyDigest() && lastDailyDigest !== today) {
      //   console.log(`[${new Date().toISOString()}] Sending daily digests...`)
      //   await sendDailyDigests()
      //   lastDailyDigest = today
      // }
      //
      // if (shouldSendWeeklyDigest() && lastWeeklyDigest !== today) {
      //   console.log(`[${new Date().toISOString()}] Sending weekly digests...`)
      //   await sendWeeklyDigests()
      //   lastWeeklyDigest = today
      // }
    } catch (error) {
      console.error('Worker error:', error)
    }

    await sleep(CHECK_INTERVAL_MS)
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

runWorker()
