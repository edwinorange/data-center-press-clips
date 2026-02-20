import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const sortBy = searchParams.get('sortBy') || 'clipCount'
  const order = searchParams.get('order') || 'desc'

  const locations = await db.location.findMany({
    orderBy: {
      [sortBy]: order,
    },
    take: 100,
  })

  return NextResponse.json({ locations })
}
