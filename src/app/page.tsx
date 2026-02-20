import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { Header } from '@/components/header'
import { FilterSidebar } from '@/components/filter-sidebar'
import { SearchBar } from '@/components/search-bar'
import { ClipFeed } from '@/components/clip-feed'

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="mb-6">
          <SearchBar />
        </div>

        <div className="flex gap-6">
          <FilterSidebar />
          <div className="flex-1">
            <ClipFeed />
          </div>
        </div>
      </main>
    </div>
  )
}
