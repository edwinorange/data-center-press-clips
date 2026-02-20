'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useMemo } from 'react'

export function SearchBar() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const searchFromUrl = useMemo(() => searchParams.get('search') || '', [searchParams])
  const [query, setQuery] = useState(searchFromUrl)
  const [lastSyncedSearch, setLastSyncedSearch] = useState(searchFromUrl)

  // Sync local state when URL search param changes externally
  if (searchFromUrl !== lastSyncedSearch) {
    setQuery(searchFromUrl)
    setLastSyncedSearch(searchFromUrl)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const params = new URLSearchParams(searchParams.toString())
    if (query.trim()) {
      params.set('search', query.trim())
    } else {
      params.delete('search')
    }
    params.delete('page')
    router.push(`/?${params.toString()}`)
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search clips..."
        className="flex-1 border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <button
        type="submit"
        className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700"
      >
        Search
      </button>
    </form>
  )
}
