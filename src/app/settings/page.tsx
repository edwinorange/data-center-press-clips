// MOTHBALLED: LinkedIn and digest settings
// import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
// MOTHBALLED: digest settings form
// import { DigestSettingsForm } from '@/components/digest-settings-form'
import { Header } from '@/components/header'

export default async function SettingsPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }

  // MOTHBALLED: LinkedIn connection status
  // const params = await searchParams
  // const user = await db.user.findUnique({
  //   where: { id: session.user.id },
  //   select: {
  //     linkedinAccessToken: true,
  //     linkedinTokenExpiry: true,
  //   },
  // })
  // const isLinkedInConnected = !!user?.linkedinAccessToken
  // const tokenExpiry = user?.linkedinTokenExpiry
  // const now = new Date()
  // const isTokenExpiring =
  //   tokenExpiry && tokenExpiry.getTime() - now.getTime() < 7 * 24 * 60 * 60 * 1000

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>

        {/* MOTHBALLED: LinkedIn connection section */}
        {/* <section className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">
            LinkedIn Connection
          </h2>
          ...
        </section> */}

        {/* MOTHBALLED: Email digest preferences section */}
        {/* <section className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">
            Email Digest Preferences
          </h2>
          <DigestSettingsForm />
        </section> */}

        <p className="text-sm text-gray-500">
          Settings page — LinkedIn and email digest features coming soon.
        </p>
      </main>
    </div>
  )
}
