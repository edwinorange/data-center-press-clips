// MOTHBALLED: entire file — digest preferences API
// To restore, uncomment all code below

import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({ error: 'Digest settings are disabled in v1' }, { status: 404 })
}

export async function PUT() {
  return NextResponse.json({ error: 'Digest settings are disabled in v1' }, { status: 404 })
}

// import { NextRequest, NextResponse } from 'next/server'
// import { getServerSession } from 'next-auth'
// import { authOptions } from '@/lib/auth'
// import { db } from '@/lib/db'
//
// export async function GET() {
//   const session = await getServerSession(authOptions)
//   if (!session) {
//     return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
//   }
//   const pref = await db.digestPreference.findUnique({
//     where: { userId: session.user.id },
//   })
//   return NextResponse.json({ preference: pref })
// }
//
// export async function PUT(request: NextRequest) {
//   ... full original code ...
// }
