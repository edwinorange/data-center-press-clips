'use client'

import { useState } from 'react'

interface LinkedInPost {
  id: string
  draftText: string
  finalText: string | null
  status: string
  linkedInId: string | null
  createdAt: string
  postedAt: string | null
  clip: {
    title: string
    url: string
    thumbnailPath: string | null
  }
}

export function LinkedInPostCard({ post }: { post: LinkedInPost }) {
  const [text, setText] = useState(post.finalText || post.draftText)
  const [status, setStatus] = useState(post.status)
  const [publishing, setPublishing] = useState(false)

  async function handlePublish() {
    setPublishing(true)
    try {
      const response = await fetch('/api/linkedin/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: post.id, finalText: text }),
      })

      if (response.ok) {
        setStatus('posted')
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to publish')
        setStatus('failed')
      }
    } finally {
      setPublishing(false)
    }
  }

  return (
    <div className="border rounded-lg bg-white shadow-sm p-4">
      <div className="flex items-start gap-4">
        {post.clip.thumbnailPath && (
          <img
            src={post.clip.thumbnailPath}
            alt={post.clip.title}
            className="w-32 h-20 object-cover rounded"
          />
        )}

        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span
              className={`px-2 py-0.5 text-xs font-medium rounded ${
                status === 'posted'
                  ? 'bg-green-100 text-green-800'
                  : status === 'failed'
                  ? 'bg-red-100 text-red-800'
                  : 'bg-yellow-100 text-yellow-800'
              }`}
            >
              {status}
            </span>
            <a
              href={post.clip.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:underline truncate"
            >
              {post.clip.title}
            </a>
          </div>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={status === 'posted'}
            rows={6}
            className="w-full border rounded p-2 text-sm resize-y disabled:bg-gray-50 disabled:text-gray-500"
          />

          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-gray-400">
              {status === 'posted' && post.postedAt
                ? `Posted ${new Date(post.postedAt).toLocaleString()}`
                : `Created ${new Date(post.createdAt).toLocaleString()}`}
            </span>

            {status !== 'posted' && (
              <button
                onClick={handlePublish}
                disabled={publishing}
                className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {publishing ? 'Publishing...' : 'Post to LinkedIn'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
