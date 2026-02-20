import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const pref = await db.digestPreference.findUnique({
    where: { userId: session.user.id },
  })

  return NextResponse.json({ preference: pref })
}

export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { frequency, topics, states, importance } = body

  const pref = await db.digestPreference.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      frequency: frequency || 'daily',
      topics: topics || [],
      states: states || [],
      importance: importance || 'high_and_medium',
    },
    update: {
      frequency,
      topics,
      states,
      importance,
    },
  })

  return NextResponse.json({ preference: pref })
}
