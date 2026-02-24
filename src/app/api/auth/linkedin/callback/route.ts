import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state') // userId
  const error = searchParams.get('error')

  if (error) {
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/settings?linkedin=error&message=${error}`
    )
  }

  if (!code || !state) {
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/settings?linkedin=error&message=missing_params`
    )
  }

  try {
    const tokenResponse = await fetch(
      'https://www.linkedin.com/oauth/v2/accessToken',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          client_id: process.env.LINKEDIN_CLIENT_ID!,
          client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
          redirect_uri: process.env.LINKEDIN_REDIRECT_URI!,
        }),
      }
    )

    if (!tokenResponse.ok) {
      const errorBody = await tokenResponse.text()
      console.error('LinkedIn token exchange failed:', errorBody)
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/settings?linkedin=error&message=token_exchange_failed`
      )
    }

    const tokenData = await tokenResponse.json()

    const expiresIn = tokenData.expires_in || 5184000
    const expiryDate = new Date(Date.now() + expiresIn * 1000)

    await db.user.update({
      where: { id: state },
      data: {
        linkedinAccessToken: tokenData.access_token,
        linkedinTokenExpiry: expiryDate,
      },
    })

    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/settings?linkedin=connected`
    )
  } catch (err) {
    console.error('LinkedIn OAuth callback error:', err)
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/settings?linkedin=error&message=server_error`
    )
  }
}
