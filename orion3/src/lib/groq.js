// Groq AI — generates the daily intelligence brief
// Free tier: ~14,400 requests/day on llama-3.3-70b
// Get your key at console.groq.com (free, instant)

const GROQ_KEY = import.meta.env.VITE_GROQ_API_KEY || ''
const MODEL = 'llama-3.3-70b-versatile'

export const hasGroq = Boolean(GROQ_KEY)

// Generate full brief from live event data
export async function generateBrief(events = [], regions = [], watchlist = []) {
  if (!GROQ_KEY) return null

  const topEvents = events.slice(0, 8).map(e =>
    `[${e.severity}] ${e.title} — ${e.region} (Signal: ${e.signalScore || 'N/A'})`
  ).join('\n')

  const regionSummary = regions
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map(r => `${r.label}: ${r.score}/100 (${r.trend > 0 ? '+' : ''}${r.trend})`)
    .join(', ')

  const watchSummary = watchlist.length
    ? watchlist.map(c => `${c.country}: ${c.score}`).join(', ')
    : 'No countries tracked'

  const prompt = `You are 0rion, a geopolitical intelligence AI. Generate a concise morning intelligence brief with exactly 5 sections. Be direct, factual, analyst-style. No fluff.

LIVE EVENT DATA:
${topEvents || 'No events available'}

REGIONAL TENSION:
${regionSummary || 'Data unavailable'}

WATCHLIST:
${watchSummary}

TODAY: ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}

Return ONLY valid JSON (no markdown, no explanation):
{
  "sections": [
    { "title": "Top Threat", "icon": "alert", "color": "#EF4444", "tag": "CRITICAL", "content": "..." },
    { "title": "Conflict Watch", "icon": "ship", "color": "#A78BFA", "tag": "HIGH", "content": "..." },
    { "title": "Cyber Landscape", "icon": "wifi", "color": "#22D3EE", "tag": "MEDIUM", "content": "..." },
    { "title": "Market Signals", "icon": "trending", "color": "#10B981", "tag": "INFO", "content": "..." },
    { "title": "Your Watchlist", "icon": "eye", "color": "#60A5FA", "tag": "UPDATE", "content": "..." }
  ],
  "audioScript": "A single paragraph, 60 seconds when read aloud, covering the top 3 developments. Conversational but authoritative tone."
}`

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4,
        max_tokens: 1200,
        response_format: { type: 'json_object' },
      })
    })

    if (!res.ok) throw new Error(`Groq ${res.status}`)
    const data = await res.json()
    const parsed = JSON.parse(data.choices[0].message.content)
    return parsed
  } catch (e) {
    console.warn('Groq brief generation failed:', e)
    return null
  }
}

// Generate hyper-local AI forecast from location data
export async function generateLocalForecast(city, country, nearbyEvents = []) {
  if (!GROQ_KEY) return null

  const eventList = nearbyEvents.map(e => `- ${e.title} (${e.distanceKm}km away)`).join('\n')

  const prompt = `You are a local intelligence analyst for 0rion. Generate a brief, factual safety forecast for ${city}, ${country}.

Nearby events:
${eventList || 'No nearby events detected'}

Return ONLY valid JSON:
{
  "forecast": "2-3 sentences. Direct, practical, analyst tone. What matters for safety in the next 24 hours.",
  "safetyScore": <integer 0-100, 100 = safest>,
  "internetScore": <integer 0-100>,
  "trafficScore": <integer 0-100, 100 = most congested>,
  "infraScore": <integer 0-100, 100 = most stable>
}`

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant', // faster for local forecasts
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 300,
        response_format: { type: 'json_object' },
      })
    })
    if (!res.ok) throw new Error(`Groq ${res.status}`)
    const data = await res.json()
    return JSON.parse(data.choices[0].message.content)
  } catch (e) {
    console.warn('Groq local forecast failed:', e)
    return null
  }
}
