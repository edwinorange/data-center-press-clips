'use client'

import { useState } from 'react'
import { Clip, Location } from '@prisma/client'

type ClipWithLocation = Clip & {
  location: Location | null
  isStarred: boolean
}

const importanceColors = {
  high: 'bg-red-100 text-red-800 border-red-200',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  low: 'bg-gray-100 text-gray-800 border-gray-200',
}

const topicColors: Record<string, string> = {
  zoning: 'bg-purple-100 text-purple-700',
  opposition: 'bg-red-100 text-red-700',
  environmental: 'bg-green-100 text-green-700',
  announcement: 'bg-blue-100 text-blue-700',
  government: 'bg-indigo-100 text-indigo-700',
  legal: 'bg-orange-100 text-orange-700',
}

export function ClipCard({ clip }: { clip: ClipWithLocation }) {
  const [isStarred, setIsStarred] = useState(clip.isStarred)
  const [expanded, setExpanded] = useState(false)

  async function toggleStar() {
    const response = await fetch(`/api/clips/${clip.id}/star`, {
      method: 'POST',
    })
    if (response.ok) {
      const data = await response.json()
      setIsStarred(data.starred)
    }
  }

  const locationText = clip.location
    ? [clip.location.city, clip.location.county, clip.location.state]
        .filter(Boolean)
        .join(', ')
    : 'Unknown location'

  return (
    <article className="border rounded-lg p-4 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span
              className={`px-2 py-0.5 text-xs font-medium rounded border ${importanceColors[clip.importance]}`}
            >
              {clip.importance}
            </span>
            <span className="text-sm text-gray-500">{clip.sourceName}</span>
            <span className="text-sm text-gray-400">•</span>
            <span className="text-sm text-gray-500">{locationText}</span>
          </div>

          <h3 className="font-medium text-gray-900 mb-1">
            <a
              href={clip.url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              {clip.title}
            </a>
          </h3>

          {clip.summary && (
            <p className="text-sm text-gray-600 mb-2">{clip.summary}</p>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            {clip.topics.map((topic) => (
              <span
                key={topic}
                className={`px-2 py-0.5 text-xs rounded ${topicColors[topic] || 'bg-gray-100 text-gray-700'}`}
              >
                {topic}
              </span>
            ))}
          </div>

          {expanded && clip.content && (
            <div className="mt-3 pt-3 border-t text-sm text-gray-600">
              {clip.content}
            </div>
          )}
        </div>

        <div className="flex flex-col items-center gap-2">
          <button
            onClick={toggleStar}
            className={`p-1 rounded hover:bg-gray-100 ${isStarred ? 'text-yellow-500' : 'text-gray-300'}`}
            title={isStarred ? 'Unstar' : 'Star'}
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          </button>

          {clip.content && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              {expanded ? 'Less' : 'More'}
            </button>
          )}
        </div>
      </div>

      <div className="mt-2 text-xs text-gray-400">
        {clip.publishedAt
          ? new Date(clip.publishedAt).toLocaleDateString()
          : new Date(clip.discoveredAt).toLocaleDateString()}
      </div>
    </article>
  )
}
