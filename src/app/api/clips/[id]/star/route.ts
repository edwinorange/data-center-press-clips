import { NextRequest, NextResponse } from 'next/server'
// MOTHBALLED: auth — entire handler depends on session.user.id
// import { getServerSession } from 'next-auth'
// import { authOptions } from '@/lib/auth'
// import { db } from '@/lib/db'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // MOTHBALLED: auth — starring disabled without user sessions
  // const session = await getServerSession(authOptions)
  // if (!session) {
  //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  // }
  //
  // const { id } = await params
  //
  // const existing = await db.star.findUnique({
  //   where: {
  //     userId_clipId: {
  //       userId: session.user.id,
  //       clipId: id,
  //     },
  //   },
  // })
  //
  // if (existing) {
  //   await db.star.delete({
  //     where: { id: existing.id },
  //   })
  //   return NextResponse.json({ starred: false })
  // }
  //
  // await db.star.create({
  //   data: {
  //     userId: session.user.id,
  //     clipId: id,
  //   },
  // })
  //
  // return NextResponse.json({ starred: true })

  return NextResponse.json({ error: 'Starring is disabled' }, { status: 403 })
}
