import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { Header } from '@/components/header'
import { DigestSettingsForm } from '@/components/digest-settings-form'

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ linkedin?: string; message?: string }>
}) {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }

  const params = await searchParams

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      linkedinAccessToken: true,
      linkedinTokenExpiry: true,
    },
  })

  const isLinkedInConnected = !!user?.linkedinAccessToken
  const tokenExpiry = user?.linkedinTokenExpiry
  const isTokenExpiring =
    tokenExpiry && tokenExpiry.getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>

        {params.linkedin === 'connected' && (
          <div className="mb-4 p-3 bg-green-50 text-green-800 rounded border border-green-200 text-sm">
            LinkedIn connected successfully.
          </div>
        )}

        {params.linkedin === 'error' && (
          <div className="mb-4 p-3 bg-red-50 text-red-800 rounded border border-red-200 text-sm">
            LinkedIn connection failed: {params.message || 'Unknown error'}
          </div>
        )}

        <section className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">
            LinkedIn Connection
          </h2>

          {isLinkedInConnected ? (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-block w-2 h-2 bg-green-500 rounded-full"></span>
                <span className="text-sm text-gray-700">Connected</span>
              </div>
              {tokenExpiry && (
                <p className={`text-xs ${isTokenExpiring ? 'text-orange-600' : 'text-gray-500'}`}>
                  Token expires {tokenExpiry.toLocaleDateString()}
                  {isTokenExpiring && ' — reconnect soon to avoid interruption'}
                </p>
              )}
              <a
                href="/api/auth/linkedin"
                className="mt-3 inline-block px-4 py-2 text-sm border rounded hover:bg-gray-50"
              >
                Reconnect LinkedIn
              </a>
            </div>
          ) : (
            <div>
              <p className="text-sm text-gray-600 mb-3">
                Connect your LinkedIn account to draft and publish posts about data center clips.
              </p>
              <a
                href="/api/auth/linkedin"
                className="inline-block px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
              >
                Connect LinkedIn
              </a>
            </div>
          )}
        </section>

        <section className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">
            Email Digest Preferences
          </h2>
          <DigestSettingsForm />
        </section>
      </main>
    </div>
  )
}
