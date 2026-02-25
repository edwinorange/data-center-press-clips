// MOTHBALLED: entire file — LinkedIn publish API endpoint
// To restore, uncomment all code below

import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json({ error: 'LinkedIn publishing is disabled in v1' }, { status: 404 })
}

// import { NextRequest, NextResponse } from 'next/server'
// import { getServerSession } from 'next-auth'
// import { authOptions } from '@/lib/auth'
// import { db } from '@/lib/db'
//
// export async function POST(request: NextRequest) {
//   ... full original code ...
// }
