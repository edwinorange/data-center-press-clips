import { anthropic } from './claude'
import { ClassificationResult, TOPICS, STATES, Topic, State, ClipBucket } from './types'

const CLASSIFICATION_PROMPT = `You are a news classifier for a data center monitoring service focused on US data center developments. Analyze the following video and extract structured data.

Classify based on ALL provided information: title, description, channel name, and closed caption transcript.

Extract the following:

1. **Location**: The US city, county, and state where this data center activity is happening. Include approximate latitude and longitude.
2. **Companies**: All companies mentioned (data center operators, developers, tech companies, utilities, etc.)
3. **Government Entities**: All government bodies mentioned (e.g., "Loudoun County Board of Supervisors", "Virginia DEQ", etc.)
4. **Topics**: One or more from: zoning, opposition, environmental, announcement, government, legal
5. **Importance**: high, medium, or low:
   - HIGH: Active opposition (protests, petitions), upcoming votes/hearings, new major announcements, lawsuits filed
   - MEDIUM: General coverage of existing projects, routine permit updates, environmental studies released
   - LOW: Passing mentions, opinion pieces, industry analysis without local specifics
6. **Summary**: {{SUMMARY_LENGTH}}
7. **Relevance Score**: 1-10 rating of how specifically this content is about a US data center development:
   - 9-10: Directly about a specific data center project in a specific US location
   - 7-8: About data center policy, zoning, or opposition in a specific US area
   - 5-6: About data centers generally but with some US location context
   - 3-4: Mentions data centers but primarily about something else
   - 1-2: Tangentially related or not really about data centers

Respond ONLY with valid JSON in this exact format:
{
  "location": {
    "city": "string or null",
    "county": "string or null",
    "state": "two-letter state code",
    "latitude": number or null,
    "longitude": number or null
  },
  "companies": ["company1", "company2"],
  "govEntities": ["entity1", "entity2"],
  "topics": ["topic1", "topic2"],
  "importance": "high|medium|low",
  "summary": "Summary text here",
  "relevanceScore": 7
}

Video title: {{TITLE}}
Channel: {{CHANNEL}}
Description: {{DESCRIPTION}}

Closed caption transcript:
{{TRANSCRIPT}}`

const TRANSCRIPT_LIMITS: Record<ClipBucket, number> = {
  news_clip: 24000,
  public_meeting: 48000,
}

const SUMMARY_LENGTHS: Record<ClipBucket, string> = {
  news_clip: 'A 2-3 sentence plain-English summary of the key points',
  public_meeting: 'A 4-6 sentence plain-English summary covering the main topics discussed, key decisions or proposals, and any opposition or public comments',
}

export async function classifyClip(
  title: string,
  description: string,
  channelName: string,
  transcript: string | null,
  bucket: ClipBucket
): Promise<ClassificationResult | null> {
  try {
    const transcriptLimit = TRANSCRIPT_LIMITS[bucket]
    const summaryLength = SUMMARY_LENGTHS[bucket]
    const truncatedTranscript = transcript
      ? transcript.slice(0, transcriptLimit)
      : 'No transcript available'

    const prompt = CLASSIFICATION_PROMPT
      .replace('{{TITLE}}', title)
      .replace('{{CHANNEL}}', channelName)
      .replace('{{DESCRIPTION}}', description.slice(0, 2000))
      .replace('{{TRANSCRIPT}}', truncatedTranscript)
      .replace('{{SUMMARY_LENGTH}}', summaryLength)

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

  if (!r.location || typeof r.location !== 'object') return false
  const loc = r.location as Record<string, unknown>
  if (typeof loc.state !== 'string' || !STATES.includes(loc.state as State)) return false

  if (!Array.isArray(r.topics) || r.topics.length === 0) return false
  if (!r.topics.every((t) => TOPICS.includes(t as Topic))) return false

  if (!['high', 'medium', 'low'].includes(r.importance as string)) return false

  if (typeof r.summary !== 'string' || r.summary.length === 0) return false

  if (typeof r.relevanceScore !== 'number' || r.relevanceScore < 1 || r.relevanceScore > 10) return false

  if (!Array.isArray(r.companies)) return false
  if (!Array.isArray(r.govEntities)) return false

  return true
}

export function getDefaultClassification(): Omit<ClassificationResult, 'location'> {
  return {
    topics: ['unclassified'] as unknown as Topic[],
    importance: 'medium',
    summary: 'Classification pending',
    relevanceScore: 0,
    companies: [],
    govEntities: [],
  }
}
