// MOTHBALLED: entire file — LinkedIn draft generation
// To restore, uncomment all code below

// import { anthropic } from './claude'
//
// interface DraftInput {
//   title: string
//   summary: string | null
//   transcript: string | null
//   locationText: string
//   companies: string[]
//   govEntities: string[]
//   bucket: string
//   url: string
// }
//
// const DRAFT_PROMPT = `Generate a professional LinkedIn post about this data center news. The post should:
//
// 1. Open with an attention-grabbing hook (1 sentence)
// 2. Summarize the key facts (2-3 sentences)
// 3. Mention the location and key entities involved
// 4. End with a question or call to action to drive engagement
// 5. Include 3-5 relevant hashtags
//
// Keep it under 150 words. Write in a professional but accessible tone.
//
// Video title: {{TITLE}}
// Summary: {{SUMMARY}}
// Location: {{LOCATION}}
// Companies: {{COMPANIES}}
// Government entities: {{GOV_ENTITIES}}
// Type: {{BUCKET}}
// Video URL: {{URL}}
//
// Transcript excerpt:
// {{TRANSCRIPT}}
//
// Respond with ONLY the LinkedIn post text (including hashtags). No additional formatting or explanation.`
//
// export async function generateLinkedInDraft(input: DraftInput): Promise<string> {
//   const prompt = DRAFT_PROMPT
//     .replace('{{TITLE}}', input.title)
//     .replace('{{SUMMARY}}', input.summary || 'No summary available')
//     .replace('{{LOCATION}}', input.locationText)
//     .replace('{{COMPANIES}}', input.companies.join(', ') || 'Not specified')
//     .replace('{{GOV_ENTITIES}}', input.govEntities.join(', ') || 'Not specified')
//     .replace('{{BUCKET}}', input.bucket === 'public_meeting' ? 'Public Meeting' : 'News Clip')
//     .replace('{{URL}}', input.url)
//     .replace('{{TRANSCRIPT}}', (input.transcript || '').slice(0, 2000))
//
//   const response = await anthropic.messages.create({
//     model: 'claude-3-haiku-20240307',
//     max_tokens: 512,
//     messages: [{ role: 'user', content: prompt }],
//   })
//
//   const text = response.content[0]
//   if (text.type !== 'text') {
//     throw new Error('Unexpected response type from Claude')
//   }
//
//   return text.text
// }
