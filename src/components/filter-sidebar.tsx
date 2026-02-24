'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { TOPICS, STATES } from '@/lib/types'

const BUCKETS = [
  { value: 'news_clip', label: 'News Clips' },
  { value: 'public_meeting', label: 'Public Meetings' },
]

export function FilterSidebar() {
  const router = useRouter()
  const searchParams = useSearchParams()

  function updateFilter(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    params.delete('page')
    router.push(`/?${params.toString()}`)
  }

  const currentImportance = searchParams.get('importance')
  const currentTopic = searchParams.get('topic')
  const currentState = searchParams.get('state')
  const currentBucket = searchParams.get('bucket')

  return (
    <aside className="w-64 flex-shrink-0 space-y-6">
      <div>
        <h3 className="text-sm font-medium text-gray-900 mb-2">Type</h3>
        <div className="space-y-1">
          {BUCKETS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() =>
                updateFilter('bucket', currentBucket === value ? null : value)
              }
              className={`block w-full text-left px-3 py-1.5 text-sm rounded ${
                currentBucket === value
                  ? 'bg-blue-100 text-blue-700'
                  : 'hover:bg-gray-100'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-gray-900 mb-2">Importance</h3>
        <div className="space-y-1">
          {['high', 'medium', 'low'].map((imp) => (
            <button
              key={imp}
              onClick={() =>
                updateFilter('importance', currentImportance === imp ? null : imp)
              }
              className={`block w-full text-left px-3 py-1.5 text-sm rounded ${
                currentImportance === imp
                  ? 'bg-blue-100 text-blue-700'
                  : 'hover:bg-gray-100'
              }`}
            >
              {imp.charAt(0).toUpperCase() + imp.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-gray-900 mb-2">Topic</h3>
        <div className="space-y-1">
          {TOPICS.map((topic) => (
            <button
              key={topic}
              onClick={() =>
                updateFilter('topic', currentTopic === topic ? null : topic)
              }
              className={`block w-full text-left px-3 py-1.5 text-sm rounded ${
                currentTopic === topic
                  ? 'bg-blue-100 text-blue-700'
                  : 'hover:bg-gray-100'
              }`}
            >
              {topic.charAt(0).toUpperCase() + topic.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-gray-900 mb-2">State</h3>
        <select
          value={currentState || ''}
          onChange={(e) => updateFilter('state', e.target.value || null)}
          className="w-full border rounded px-2 py-1.5 text-sm"
        >
          <option value="">All states</option>
          {STATES.map((state) => (
            <option key={state} value={state}>
              {state}
            </option>
          ))}
        </select>
      </div>

      {(currentImportance || currentTopic || currentState || currentBucket) && (
        <button
          onClick={() => router.push('/')}
          className="text-sm text-blue-600 hover:underline"
        >
          Clear all filters
        </button>
      )}
    </aside>
  )
}
