import { Resend } from 'resend'
import { render } from '@react-email/components'
import { DigestEmail } from './digest-template'
import { db } from '../db'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendDigestEmail(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: { digestPreference: true },
  })

  if (!user || !user.digestPreference) {
    return
  }

  const pref = user.digestPreference
  const since = pref.frequency === 'daily'
    ? new Date(Date.now() - 24 * 60 * 60 * 1000)
    : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const whereClause: Record<string, unknown> = {
    discoveredAt: { gte: since },
  }

  if (pref.topics.length > 0) {
    whereClause.topics = { hasSome: pref.topics }
  }

  if (pref.states.length > 0) {
    whereClause.location = { state: { in: pref.states } }
  }

  const clips = await db.clip.findMany({
    where: whereClause,
    include: { location: true },
    orderBy: { discoveredAt: 'desc' },
  })

  const highPriority = clips.filter((c) => c.importance === 'high')
  const mediumPriority = clips.filter((c) => c.importance === 'medium')

  if (pref.importance === 'high_only' && highPriority.length === 0) {
    return // Nothing to send
  }

  const newLocations = await db.location.findMany({
    where: { firstSeen: { gte: since } },
    orderBy: { firstSeen: 'desc' },
  })

  const dashboardUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'

  const html = await render(
    DigestEmail({
      highPriorityClips: highPriority,
      mediumPriorityClips: pref.importance === 'high_only' ? [] : mediumPriority,
      newLocations,
      dashboardUrl,
    })
  )

  await resend.emails.send({
    from: 'Data Center Clips <noreply@yourdomain.com>',
    to: user.email,
    subject: `Data Center Clips Digest — ${new Date().toLocaleDateString()} — ${highPriority.length} high-priority items`,
    html,
  })
}
