'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { ClipCard } from './clip-card'
import { Clip, Location } from '@prisma/client'

type ClipWithLocation = Clip & {
  location: Location | null
  isStarred: boolean
}

interface ClipsResponse {
  clips: ClipWithLocation[]
  total: number
  page: number
  totalPages: number
}

export function ClipFeed() {
  const searchParams = useSearchParams()
  const [data, setData] = useState<ClipsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchClips() {
      setLoading(true)
      setError(null)

      try {
        const response = await fetch(`/api/clips?${searchParams.toString()}`)
        if (!response.ok) {
          throw new Error('Failed to fetch clips')
        }
        const json = await response.json()
        setData(json)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    fetchClips()
  }, [searchParams])

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="border rounded-lg p-4 bg-white animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-8 text-red-600">
        Error: {error}
      </div>
    )
  }

  if (!data || data.clips.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No clips found. Try adjusting your filters.
      </div>
    )
  }

  return (
    <div>
      <div className="mb-4 text-sm text-gray-500">
        Showing {data.clips.length} of {data.total} clips
      </div>

      <div className="space-y-4">
        {data.clips.map((clip) => (
          <ClipCard key={clip.id} clip={clip} />
        ))}
      </div>

      {data.totalPages > 1 && (
        <Pagination
          currentPage={data.page}
          totalPages={data.totalPages}
        />
      )}
    </div>
  )
}

function Pagination({
  currentPage,
  totalPages,
}: {
  currentPage: number
  totalPages: number
}) {
  const searchParams = useSearchParams()

  function getPageUrl(page: number) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', page.toString())
    return `/?${params.toString()}`
  }

  return (
    <div className="flex justify-center gap-2 mt-6">
      {currentPage > 1 && (
        <a
          href={getPageUrl(currentPage - 1)}
          className="px-3 py-1 border rounded hover:bg-gray-50"
        >
          Previous
        </a>
      )}

      <span className="px-3 py-1 text-gray-600">
        Page {currentPage} of {totalPages}
      </span>

      {currentPage < totalPages && (
        <a
          href={getPageUrl(currentPage + 1)}
          className="px-3 py-1 border rounded hover:bg-gray-50"
        >
          Next
        </a>
      )}
    </div>
  )
}
