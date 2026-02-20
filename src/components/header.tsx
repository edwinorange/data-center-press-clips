'use client'

import { signOut, useSession } from 'next-auth/react'
import Link from 'next/link'

export function Header() {
  const { data: session } = useSession()

  return (
    <header className="bg-white border-b">
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold text-gray-900">
          Data Center Clips
        </Link>

        <nav className="flex items-center gap-6">
          <Link href="/" className="text-sm text-gray-600 hover:text-gray-900">
            Feed
          </Link>
          <Link href="/locations" className="text-sm text-gray-600 hover:text-gray-900">
            Locations
          </Link>
          <Link href="/starred" className="text-sm text-gray-600 hover:text-gray-900">
            Starred
          </Link>
          <Link href="/settings" className="text-sm text-gray-600 hover:text-gray-900">
            Settings
          </Link>
        </nav>

        {session && (
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{session.user.name}</span>
            <button
              onClick={() => signOut()}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
