// MOTHBALLED: entire file — LinkedIn draft API endpoint
// To restore, uncomment all code below

import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json({ error: 'LinkedIn drafts are disabled in v1' }, { status: 404 })
}

// import { NextRequest, NextResponse } from 'next/server'
// import { getServerSession } from 'next-auth'
// import { authOptions } from '@/lib/auth'
// import { db } from '@/lib/db'
// import { generateLinkedInDraft } from '@/lib/linkedin-draft'
//
// export async function POST(request: NextRequest) {
//   const session = await getServerSession(authOptions)
//   if (!session) {
//     return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
//   }
//
//   const { clipId } = await request.json()
//   if (!clipId) {
//     return NextResponse.json({ error: 'clipId required' }, { status: 400 })
//   }
//
//   const clip = await db.clip.findUnique({
//     where: { id: clipId },
//     include: { location: true },
//   })
//
//   if (!clip) {
//     return NextResponse.json({ error: 'Clip not found' }, { status: 404 })
//   }
//
//   const locationText = clip.location
//     ? [clip.location.city, clip.location.county, clip.location.state]
//         .filter(Boolean)
//         .join(', ')
//     : 'Unknown location'
//
//   const draftText = await generateLinkedInDraft({
//     title: clip.title,
//     summary: clip.summary,
//     transcript: clip.transcript,
//     locationText,
//     companies: clip.companies,
//     govEntities: clip.govEntities,
//     bucket: clip.bucket,
//     url: clip.url,
//   })
//
//   const post = await db.linkedInPost.create({
//     data: {
//       clipId: clip.id,
//       userId: session.user.id,
//       draftText,
//     },
//   })
//
//   return NextResponse.json({ post })
// }
