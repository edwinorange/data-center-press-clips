import { anthropic } from './claude'
import { ClassificationResult, TOPICS, STATES, Topic, State } from './types'

const CLASSIFICATION_PROMPT = `You are a news classifier for a data center monitoring service. Analyze the following news article and extract:

1. Location: The US city, county, and/or state where this data center activity is happening
2. Topics: One or more categories from: zoning, opposition, environmental, announcement, government, legal
3. Importance: high, medium, or low based on these criteria:
   - HIGH: Active opposition (protests, petitions), upcoming votes/hearings, new major announcements, lawsuits filed
   - MEDIUM: General coverage of existing projects, routine permit updates, environmental studies released
   - LOW: Passing mentions, opinion pieces, industry analysis without local specifics
4. Summary: A 2-3 sentence plain-English summary of the key points

Respond ONLY with valid JSON in this exact format:
{
  "location": {
    "city": "string or null",
    "county": "string or null",
    "state": "two-letter state code"
  },
  "topics": ["array", "of", "topics"],
  "importance": "high|medium|low",
  "summary": "Brief summary here"
}

Article title: {{TITLE}}

Article content:
{{CONTENT}}`

export async function classifyClip(
  title: string,
  content: string
): Promise<ClassificationResult | null> {
  try {
    const prompt = CLASSIFICATION_PROMPT
      .replace('{{TITLE}}', title)
      .replace('{{CONTENT}}', content.slice(0, 4000)) // Limit content length

    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    })

    const text = response.content[0]
    if (text.type !== 'text') {
      return null
    }

    const result = JSON.parse(text.text) as ClassificationResult

    // Validate the result
    if (!isValidClassification(result)) {
      console.error('Invalid classification result:', result)
      return null
    }

    return result
  } catch (error) {
    console.error('Classification failed:', error)
    return null
  }
}

function isValidClassification(result: unknown): result is ClassificationResult {
  if (!result || typeof result !== 'object') return false

  const r = result as Record<string, unknown>

  // Check location
  if (!r.location || typeof r.location !== 'object') return false
  const loc = r.location as Record<string, unknown>
  if (typeof loc.state !== 'string' || !STATES.includes(loc.state as State)) return false

  // Check topics
  if (!Array.isArray(r.topics) || r.topics.length === 0) return false
  if (!r.topics.every((t) => TOPICS.includes(t as Topic))) return false

  // Check importance
  if (!['high', 'medium', 'low'].includes(r.importance as string)) return false

  // Check summary
  if (typeof r.summary !== 'string' || r.summary.length === 0) return false

  return true
}

export function getDefaultClassification(): Omit<ClassificationResult, 'location'> {
  return {
    topics: ['unclassified'] as unknown as Topic[],
    importance: 'medium',
    summary: 'Classification pending',
  }
}
