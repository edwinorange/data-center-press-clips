import Geocodio from 'geocodio-library-node'

let client: InstanceType<typeof Geocodio> | null = null

function getClient(): InstanceType<typeof Geocodio> | null {
  if (client) return client
  const apiKey = process.env.GEOCODIO_API_KEY
  if (!apiKey) {
    console.warn('GEOCODIO_API_KEY not set — skipping geocoding')
    return null
  }
  client = new Geocodio(apiKey)
  return client
}

export async function geocodeLocation(
  city: string | undefined,
  county: string | undefined,
  state: string
): Promise<{ latitude: number; longitude: number } | null> {
  const geocodio = getClient()
  if (!geocodio) return null

  // Build query from available components
  let query: string
  if (city) {
    query = `${city}, ${state}`
  } else if (county) {
    query = `${county}, ${state}`
  } else {
    // State-level geocoding isn't useful for map pins
    return null
  }

  try {
    const response = await geocodio.geocode(query)

    if (
      !response ||
      !response.results ||
      response.results.length === 0
    ) {
      console.warn(`Geocodio returned no results for "${query}"`)
      return null
    }

    const { lat, lng } = response.results[0].location
    return { latitude: lat, longitude: lng }
  } catch (error) {
    console.warn(
      `Geocodio failed for "${query}":`,
      error instanceof Error ? error.message : error
    )
    return null
  }
}
