'use client'

import { useEffect, useState } from 'react'
import { TOPICS, STATES } from '@/lib/types'

interface DigestPreference {
  frequency: 'daily' | 'weekly'
  topics: string[]
  states: string[]
  importance: 'high_only' | 'high_and_medium' | 'all'
}

export function DigestSettingsForm() {
  const [pref, setPref] = useState<DigestPreference>({
    frequency: 'daily',
    topics: [],
    states: [],
    importance: 'high_and_medium',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/settings/digest')
      .then((r) => r.json())
      .then((data) => {
        if (data.preference) {
          setPref(data.preference)
        }
        setLoading(false)
      })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSaved(false)

    await fetch('/api/settings/digest', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pref),
    })

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  function toggleTopic(topic: string) {
    setPref((p) => ({
      ...p,
      topics: p.topics.includes(topic)
        ? p.topics.filter((t) => t !== topic)
        : [...p.topics, topic],
    }))
  }

  function toggleState(state: string) {
    setPref((p) => ({
      ...p,
      states: p.states.includes(state)
        ? p.states.filter((s) => s !== state)
        : [...p.states, state],
    }))
  }

  if (loading) {
    return <div>Loading...</div>
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Digest Frequency
        </label>
        <select
          value={pref.frequency}
          onChange={(e) =>
            setPref((p) => ({ ...p, frequency: e.target.value as 'daily' | 'weekly' }))
          }
          className="border rounded px-3 py-2"
        >
          <option value="daily">Daily (7am ET)</option>
          <option value="weekly">Weekly (Monday 7am ET)</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Importance Level
        </label>
        <select
          value={pref.importance}
          onChange={(e) =>
            setPref((p) => ({
              ...p,
              importance: e.target.value as 'high_only' | 'high_and_medium' | 'all',
            }))
          }
          className="border rounded px-3 py-2"
        >
          <option value="high_only">High priority only</option>
          <option value="high_and_medium">High and medium priority</option>
          <option value="all">All clips</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Filter by Topics (leave empty for all)
        </label>
        <div className="flex flex-wrap gap-2">
          {TOPICS.map((topic) => (
            <button
              key={topic}
              type="button"
              onClick={() => toggleTopic(topic)}
              className={`px-3 py-1 rounded border ${
                pref.topics.includes(topic)
                  ? 'bg-blue-100 border-blue-300 text-blue-700'
                  : 'hover:bg-gray-50'
              }`}
            >
              {topic}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Filter by States (leave empty for all)
        </label>
        <div className="flex flex-wrap gap-1">
          {STATES.map((state) => (
            <button
              key={state}
              type="button"
              onClick={() => toggleState(state)}
              className={`px-2 py-1 text-xs rounded border ${
                pref.states.includes(state)
                  ? 'bg-blue-100 border-blue-300 text-blue-700'
                  : 'hover:bg-gray-50'
              }`}
            >
              {state}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Preferences'}
        </button>
        {saved && <span className="text-green-600">Saved!</span>}
      </div>
    </form>
  )
}
