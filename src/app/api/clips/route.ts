import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')
  const importance = searchParams.get('importance')
  const topic = searchParams.get('topic')
  const state = searchParams.get('state')
  const sourceType = searchParams.get('sourceType')
  const search = searchParams.get('search')

  const where: Prisma.ClipWhereInput = {}

  if (importance) {
    where.importance = importance as 'high' | 'medium' | 'low'
  }

  if (topic) {
    where.topics = { has: topic }
  }

  if (state) {
    where.location = { state }
  }

  if (sourceType) {
    where.sourceType = sourceType as 'news' | 'youtube' | 'bluesky' | 'government'
  }

  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { summary: { contains: search, mode: 'insensitive' } },
      { content: { contains: search, mode: 'insensitive' } },
    ]
  }

  const [clips, total] = await Promise.all([
    db.clip.findMany({
      where,
      include: {
        location: true,
        stars: {
          where: { userId: session.user.id },
          select: { id: true },
        },
      },
      orderBy: { discoveredAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.clip.count({ where }),
  ])

  return NextResponse.json({
    clips: clips.map((clip) => ({
      ...clip,
      isStarred: clip.stars.length > 0,
      stars: undefined,
    })),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  })
}
