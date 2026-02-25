// MOTHBALLED: entire file — LinkedIn OAuth initiation
// To restore, uncomment all code below

import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({ error: 'LinkedIn OAuth is disabled in v1' }, { status: 404 })
}

// import { NextResponse } from 'next/server'
// import { getServerSession } from 'next-auth'
// import { authOptions } from '@/lib/auth'
//
// export async function GET() {
//   const session = await getServerSession(authOptions)
//   if (!session) {
//     return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
//   }
//
//   const clientId = process.env.LINKEDIN_CLIENT_ID
//   const redirectUri = process.env.LINKEDIN_REDIRECT_URI
//
//   if (!clientId || !redirectUri) {
//     return NextResponse.json(
//       { error: 'LinkedIn not configured' },
//       { status: 500 }
//     )
//   }
//
//   const params = new URLSearchParams({
//     response_type: 'code',
//     client_id: clientId,
//     redirect_uri: redirectUri,
//     scope: 'openid profile w_member_social',
//     state: session.user.id,
//   })
//
//   return NextResponse.redirect(
//     `https://www.linkedin.com/oauth/v2/authorization?${params}`
//   )
// }
