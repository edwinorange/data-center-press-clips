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

const bucketLabels: Record<string, string> = {
  news_clip: 'News Clip',
  public_meeting: 'Public Meeting',
}

const bucketColors: Record<string, string> = {
  news_clip: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  public_meeting: 'bg-violet-100 text-violet-800 border-violet-200',
}

const topicColors: Record<string, string> = {
  zoning: 'bg-purple-100 text-purple-700',
  opposition: 'bg-red-100 text-red-700',
  environmental: 'bg-green-100 text-green-700',
  announcement: 'bg-blue-100 text-blue-700',
  government: 'bg-indigo-100 text-indigo-700',
  legal: 'bg-orange-100 text-orange-700',
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return ''
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function ClipCard({ clip }: { clip: ClipWithLocation }) {
  const [isStarred, setIsStarred] = useState(clip.isStarred)
  const [expanded, setExpanded] = useState(false)
  const [drafting, setDrafting] = useState(false)

  async function toggleStar() {
    const response = await fetch(`/api/clips/${clip.id}/star`, {
      method: 'POST',
    })
    if (response.ok) {
      const data = await response.json()
      setIsStarred(data.starred)
    }
  }

  async function draftLinkedInPost() {
    setDrafting(true)
    try {
      const response = await fetch('/api/linkedin/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clipId: clip.id }),
      })
      if (response.ok) {
        window.location.href = '/posts'
      }
    } finally {
      setDrafting(false)
    }
  }

  const locationText = clip.location
    ? [clip.location.city, clip.location.county, clip.location.state]
        .filter(Boolean)
        .join(', ')
    : 'Unknown location'

  return (
    <article className="border rounded-lg bg-white shadow-sm overflow-hidden">
      <div className="flex">
        {clip.thumbnailPath && (
          <div className="flex-shrink-0 w-48">
            <img
              src={clip.thumbnailPath}
              alt={clip.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        <div className="flex-1 p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span
                  className={`px-2 py-0.5 text-xs font-medium rounded border ${bucketColors[clip.bucket] || ''}`}
                >
                  {bucketLabels[clip.bucket] || clip.bucket}
                </span>
                <span
                  className={`px-2 py-0.5 text-xs font-medium rounded border ${importanceColors[clip.importance]}`}
                >
                  {clip.importance}
                </span>
                {clip.durationSecs && (
                  <span className="text-xs text-gray-500">
                    {formatDuration(clip.durationSecs)}
                  </span>
                )}
                <span className="text-sm text-gray-500">{clip.sourceName}</span>
                <span className="text-sm text-gray-400">&middot;</span>
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

              <div className="flex items-center gap-2 flex-wrap mb-2">
                {clip.topics.map((topic) => (
                  <span
                    key={topic}
                    className={`px-2 py-0.5 text-xs rounded ${topicColors[topic] || 'bg-gray-100 text-gray-700'}`}
                  >
                    {topic}
                  </span>
                ))}
              </div>

              {clip.companies.length > 0 && (
                <div className="text-xs text-gray-500 mb-1">
                  Companies: {clip.companies.join(', ')}
                </div>
              )}

              {clip.govEntities.length > 0 && (
                <div className="text-xs text-gray-500 mb-1">
                  Gov: {clip.govEntities.join(', ')}
                </div>
              )}

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

              <button
                onClick={draftLinkedInPost}
                disabled={drafting}
                className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-blue-600"
                title="Draft LinkedIn Post"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
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
        </div>
      </div>
    </article>
  )
}
