export const TOPICS = [
  'zoning',
  'opposition',
  'environmental',
  'announcement',
  'government',
  'legal',
] as const

export type Topic = (typeof TOPICS)[number]

export const STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
  'DC',
] as const

export type State = (typeof STATES)[number]

export type ClipBucket = 'news_clip' | 'public_meeting'

export interface ClassificationResult {
  location: {
    city?: string
    county?: string
    state: State
    latitude?: number
    longitude?: number
  }
  companies: string[]
  govEntities: string[]
  topics: Topic[]
  importance: 'high' | 'medium' | 'low'
  summary: string
  relevanceScore: number
}
