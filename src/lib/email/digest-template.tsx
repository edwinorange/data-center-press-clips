import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Link,
  Hr,
} from '@react-email/components'
import { Clip, Location } from '@prisma/client'

type ClipWithLocation = Clip & { location: Location | null }

interface DigestEmailProps {
  highPriorityClips: ClipWithLocation[]
  mediumPriorityClips: ClipWithLocation[]
  newLocations: Location[]
  dashboardUrl: string
}

export function DigestEmail({
  highPriorityClips,
  mediumPriorityClips,
  newLocations,
  dashboardUrl,
}: DigestEmailProps) {
  const formatLocation = (clip: ClipWithLocation) => {
    if (!clip.location) return 'Unknown'
    return [clip.location.city, clip.location.county, clip.location.state]
      .filter(Boolean)
      .join(', ')
  }

  return (
    <Html>
      <Head />
      <Body style={{ fontFamily: 'system-ui, sans-serif', padding: '20px' }}>
        <Container style={{ maxWidth: '600px' }}>
          <Text style={{ fontSize: '24px', fontWeight: 'bold' }}>
            Data Center Clips Digest
          </Text>
          <Text style={{ color: '#666' }}>
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </Text>

          {highPriorityClips.length > 0 && (
            <Section>
              <Text style={{ fontSize: '18px', fontWeight: 'bold', color: '#dc2626' }}>
                🔴 HIGH PRIORITY ({highPriorityClips.length} items)
              </Text>
              {highPriorityClips.map((clip) => (
                <Section key={clip.id} style={{ marginBottom: '16px' }}>
                  <Text style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                    ▸ {formatLocation(clip)} — {clip.title}
                  </Text>
                  {clip.summary && (
                    <Text style={{ color: '#666', marginTop: '0' }}>
                      {clip.summary}
                    </Text>
                  )}
                  <Link href={clip.url} style={{ color: '#2563eb', fontSize: '14px' }}>
                    → Read more
                  </Link>
                </Section>
              ))}
            </Section>
          )}

          {mediumPriorityClips.length > 0 && (
            <Section>
              <Hr />
              <Text style={{ fontSize: '18px', fontWeight: 'bold', color: '#ca8a04' }}>
                🟡 MEDIUM PRIORITY ({mediumPriorityClips.length} items)
              </Text>
              {mediumPriorityClips.slice(0, 10).map((clip) => (
                <Text key={clip.id} style={{ marginBottom: '8px' }}>
                  ▸ {formatLocation(clip)} —{' '}
                  <Link href={clip.url} style={{ color: '#2563eb' }}>
                    {clip.title}
                  </Link>
                </Text>
              ))}
              {mediumPriorityClips.length > 10 && (
                <Text style={{ color: '#666', fontStyle: 'italic' }}>
                  + {mediumPriorityClips.length - 10} more items
                </Text>
              )}
            </Section>
          )}

          {newLocations.length > 0 && (
            <Section>
              <Hr />
              <Text style={{ fontSize: '18px', fontWeight: 'bold' }}>
                📍 NEW LOCATIONS DISCOVERED ({newLocations.length})
              </Text>
              {newLocations.map((loc) => (
                <Text key={loc.id}>
                  ▸ {[loc.county, loc.state].filter(Boolean).join(', ')} — first clip seen{' '}
                  {new Date(loc.firstSeen).toLocaleDateString()}
                </Text>
              ))}
            </Section>
          )}

          <Hr />
          <Section>
            <Link href={dashboardUrl} style={{ color: '#2563eb', marginRight: '16px' }}>
              View Dashboard
            </Link>
            <Link href={`${dashboardUrl}/settings`} style={{ color: '#2563eb' }}>
              Manage Preferences
            </Link>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}
