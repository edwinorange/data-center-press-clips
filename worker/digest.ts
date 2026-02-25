// MOTHBALLED: entire file — digest email scheduling
// To restore, uncomment all code below

// import { db } from '../src/lib/db'
// import { sendDigestEmail } from '../src/lib/email/send'
//
// export async function sendDailyDigests() {
//   const users = await db.user.findMany({
//     where: { digestPreference: { frequency: 'daily' } },
//     select: { id: true },
//   })
//   console.log(`Sending daily digests to ${users.length} users`)
//   for (const user of users) {
//     try {
//       await sendDigestEmail(user.id)
//       console.log(`Sent daily digest to user ${user.id}`)
//     } catch (error) {
//       console.error(`Failed to send digest to user ${user.id}:`, error)
//     }
//   }
// }
//
// export async function sendWeeklyDigests() {
//   const users = await db.user.findMany({
//     where: { digestPreference: { frequency: 'weekly' } },
//     select: { id: true },
//   })
//   console.log(`Sending weekly digests to ${users.length} users`)
//   for (const user of users) {
//     try {
//       await sendDigestEmail(user.id)
//       console.log(`Sent weekly digest to user ${user.id}`)
//     } catch (error) {
//       console.error(`Failed to send digest to user ${user.id}:`, error)
//     }
//   }
// }
//
// export function shouldSendDailyDigest(): boolean {
//   const now = new Date()
//   const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))
//   return et.getHours() === 7 && et.getMinutes() < 15
// }
//
// export function shouldSendWeeklyDigest(): boolean {
//   const now = new Date()
//   const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))
//   return et.getDay() === 1 && et.getHours() === 7 && et.getMinutes() < 15
// }
