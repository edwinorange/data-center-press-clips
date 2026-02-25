import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { Header } from '@/components/header'
import { LinkedInPostCard } from '@/components/linkedin-post-card'

export default async function PostsPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }

  const posts = await db.linkedInPost.findMany({
    where: { userId: session.user.id },
    include: {
      clip: {
        select: {
          title: true,
          url: true,
          thumbnailPath: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          LinkedIn Posts
        </h1>

        {posts.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            No posts yet. Use the LinkedIn button on any clip to create a draft.
          </p>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <LinkedInPostCard
                key={post.id}
                post={{
                  ...post,
                  createdAt: post.createdAt.toISOString(),
                  postedAt: post.postedAt?.toISOString() || null,
                }}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
