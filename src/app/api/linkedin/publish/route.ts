import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { postId, finalText } = await request.json()
  if (!postId) {
    return NextResponse.json({ error: 'postId required' }, { status: 400 })
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      linkedinAccessToken: true,
      linkedinTokenExpiry: true,
    },
  })

  if (!user?.linkedinAccessToken) {
    return NextResponse.json(
      { error: 'LinkedIn not connected' },
      { status: 400 }
    )
  }

  if (user.linkedinTokenExpiry && user.linkedinTokenExpiry < new Date()) {
    return NextResponse.json(
      { error: 'LinkedIn token expired — please reconnect' },
      { status: 400 }
    )
  }

  const post = await db.linkedInPost.findUnique({
    where: { id: postId },
    include: { clip: true },
  })

  if (!post) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  }

  const textToPost = finalText || post.draftText

  try {
    const profileResponse = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${user.linkedinAccessToken}` },
    })

    if (!profileResponse.ok) {
      throw new Error(`LinkedIn profile fetch failed: ${profileResponse.status}`)
    }

    const profile = await profileResponse.json()
    const personUrn = `urn:li:person:${profile.sub}`

    const shareResponse = await fetch('https://api.linkedin.com/v2/ugcPosts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${user.linkedinAccessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify({
        author: personUrn,
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: { text: textToPost },
            shareMediaCategory: 'ARTICLE',
            media: [
              {
                status: 'READY',
                originalUrl: post.clip.url,
                title: { text: post.clip.title },
                description: {
                  text: post.clip.summary || post.clip.title,
                },
              },
            ],
          },
        },
        visibility: {
          'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
        },
      }),
    })

    if (!shareResponse.ok) {
      const errorBody = await shareResponse.text()
      console.error('LinkedIn share failed:', errorBody)

      await db.linkedInPost.update({
        where: { id: postId },
        data: { status: 'failed', finalText: textToPost },
      })

      return NextResponse.json(
        { error: 'Failed to post to LinkedIn' },
        { status: 500 }
      )
    }

    const shareData = await shareResponse.json()

    await db.linkedInPost.update({
      where: { id: postId },
      data: {
        status: 'posted',
        finalText: textToPost,
        linkedInId: shareData.id,
        postedAt: new Date(),
      },
    })

    return NextResponse.json({ success: true, linkedInId: shareData.id })
  } catch (error) {
    console.error('LinkedIn publish error:', error)

    await db.linkedInPost.update({
      where: { id: postId },
      data: { status: 'failed', finalText: textToPost },
    })

    return NextResponse.json(
      { error: 'Failed to publish to LinkedIn' },
      { status: 500 }
    )
  }
}
