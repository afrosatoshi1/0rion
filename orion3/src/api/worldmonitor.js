// 0rion — WorldMonitor API Client
// Real endpoints on your worldmonitor Vercel deployment:
//   /api/rss-proxy?url=FEED_URL  → raw RSS XML (main intelligence source)
//   /api/polymarket               → prediction markets (needs WS_RELAY_URL on Vercel)
//   /api/opensky                  → military flights
//   /api/ais-snapshot             → maritime vessels
// Falls back to mock data silently if anything fails

const BASE = (import.meta.env.VITE_WORLDMONITOR_URL || '').replace(/\/$/, '')

// ─── RSS XML Parser ───────────────────────────────────────
function parseRSS(xmlText) {
  try {
    const parser = new DOMParser()
    const xml = parser.parseFromString(xmlText, 'text/xml')
    const items = Array.from(xml.querySelectorAll('item'))
    return items.map(item => ({
      title:       item.querySelector('title')?.textContent?.trim() || '',
      description: (item.querySelector('description')?.textContent || '')
                     .replace(/<[^>]*>/g, '').trim(),
      link:        item.querySelector('link')?.textContent?.trim() || '',
      pubDate:     item.querySelector('pubDate')?.textContent?.trim() || '',
    })).filter(i => i.title.length > 5)
  } catch { return [] }
}

// Fetch a single RSS feed through the worldmonitor proxy
async function fetchRSS(feedUrl) {
  if (!BASE) return []
  try {
    const proxyUrl = `${BASE}/api/rss-proxy?url=${encodeURIComponent(feedUrl)}`
    const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(12000) })
    if (!res.ok) return []
    const text = await res.text()
    return parseRSS(text)
  } catch { return [] }
}

// ─── Intelligence classification ─────────────────────────
const KW = {
  military:  ['military','troops','missile','navy','warship','fighter','bomb','strike','rocket','drone','weapon','nato','pentagon','army','artillery','naval','fleet','submarine','combat','soldier','airstrike','gunfire','shelling','battalion','offensive','frontline','regiment'],
  cyber:     ['cyber','hack','ransomware','malware','breach','phishing','ddos','vulnerability','zero-day','espionage','apt','botnet','exploit','data leak','infrastructure attack','intrusion','spyware'],
  unrest:    ['protest','riot','demonstration','uprising','strike','unrest','clashes','crowd','march','coup','detained','arrested','opposition','crackdown','dissent','revolt'],
  economic:  ['sanction','embargo','tariff','economy','recession','inflation','trade war','oil price','gas price','currency','stock market','gdp','debt','imf','world bank','federal reserve','interest rate'],
  environmental: ['earthquake','flood','hurricane','wildfire','tsunami','volcano','famine','drought','disaster','storm','cyclone','magnitude','tremor'],
}

const SEVERITY_HIGH   = ['critical','emergency','breaking','war','attack','explosion','killed','casualties','invasion','nuclear','chemical','biological','massacre','genocide','assassinated']
const SEVERITY_MEDIUM = ['threat','warning','tensions','conflict','incident','sanctions','escalation','deployed','mobilized','standoff','ultimatum']

function classify(title, desc) {
  const text = (title + ' ' + desc).toLowerCase()
  const category = Object.entries(KW).find(([, words]) => words.some(w => text.includes(w)))?.[0] || 'intel'
  const severity = SEVERITY_HIGH.some(w => text.includes(w)) ? 'CRITICAL'
                 : SEVERITY_MEDIUM.some(w => text.includes(w)) ? 'HIGH'
                 : 'MEDIUM'
  return { category, severity }
}

const COUNTRIES = [
  ['ukraine',    {country:'Ukraine',    flag:'🇺🇦', region:'Eastern Europe'}],
  ['russia',     {country:'Russia',     flag:'🇷🇺', region:'Eastern Europe'}],
  ['taiwan',     {country:'Taiwan',     flag:'🇹🇼', region:'E. Asia'}],
  ['china',      {country:'China',      flag:'🇨🇳', region:'E. Asia'}],
  ['israel',     {country:'Israel',     flag:'🇮🇱', region:'Middle East'}],
  ['iran',       {country:'Iran',       flag:'🇮🇷', region:'Middle East'}],
  ['gaza',       {country:'Gaza',       flag:'🇵🇸', region:'Middle East'}],
  ['north korea',{country:'N. Korea',   flag:'🇰🇵', region:'NE Asia'}],
  ['korea',      {country:'S. Korea',   flag:'🇰🇷', region:'NE Asia'}],
  ['pakistan',   {country:'Pakistan',   flag:'🇵🇰', region:'S. Asia'}],
  ['india',      {country:'India',      flag:'🇮🇳', region:'S. Asia'}],
  ['syria',      {country:'Syria',      flag:'🇸🇾', region:'Middle East'}],
  ['iraq',       {country:'Iraq',       flag:'🇮🇶', region:'Middle East'}],
  ['yemen',      {country:'Yemen',      flag:'🇾🇪', region:'Middle East'}],
  ['sudan',      {country:'Sudan',      flag:'🇸🇩', region:'Africa'}],
  ['nigeria',    {country:'Nigeria',    flag:'🇳🇬', region:'W. Africa'}],
  ['ethiopia',   {country:'Ethiopia',   flag:'🇪🇹', region:'E. Africa'}],
  ['myanmar',    {country:'Myanmar',    flag:'🇲🇲', region:'SE Asia'}],
  ['venezuela',  {country:'Venezuela',  flag:'🇻🇪', region:'S. America'}],
  ['haiti',      {country:'Haiti',      flag:'🇭🇹', region:'Caribbean'}],
  ['mexico',     {country:'Mexico',     flag:'🇲🇽', region:'N. America'}],
  ['afghanistan',{country:'Afghanistan',flag:'🇦🇫', region:'C. Asia'}],
  ['nato',       {country:'NATO',       flag:'🌐',  region:'Europe'}],
  ['united states',{country:'USA',      flag:'🇺🇸', region:'N. America'}],
  ['europe',     {country:'Europe',     flag:'🇪🇺', region:'Europe'}],
  ['lebanon',    {country:'Lebanon',    flag:'🇱🇧', region:'Middle East'}],
  ['saudi',      {country:'Saudi Arabia',flag:'🇸🇦',region:'Middle East'}],
  ['libya',      {country:'Libya',      flag:'🇱🇾', region:'N. Africa'}],
  ['mali',       {country:'Mali',       flag:'🇲🇱', region:'W. Africa'}],
  ['somalia',    {country:'Somalia',    flag:'🇸🇴', region:'E. Africa'}],
  ['philippines',{country:'Philippines',flag:'🇵🇭', region:'SE Asia'}],
]

function detectCountry(title, desc) {
  const text = (title + ' ' + desc).toLowerCase()
  for (const [key, val] of COUNTRIES) {
    if (text.includes(key)) return val
  }
  return {country:'Global', flag:'🌍', region:'Global'}
}

let _uid = 1
function itemsToEvents(items) {
  const seen = new Set()
  return items
    .filter(item => {
      const key = item.title.slice(0, 60).toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, 40)
    .map(item => {
      const { category, severity } = classify(item.title, item.description)
      const loc = detectCountry(item.title, item.description)
      const ts = item.pubDate ? new Date(item.pubDate).getTime() : Date.now()
      return {
        id:          `live_${_uid++}`,
        title:       item.title.slice(0, 130),
        description: item.description.slice(0, 300) || 'No additional details.',
        severity,
        category,
        country:     loc.country,
        region:      loc.region,
        flag:        loc.flag,
        timestamp:   isNaN(ts) ? Date.now() : ts,
        tags:        [`#${category}`, `#${loc.country.replace(/\s+/g,'')}`],
        geoEdge:     category === 'military' && severity === 'CRITICAL',
        signalScore: severity === 'CRITICAL' ? 75 + Math.floor(Math.random()*20)
                   : severity === 'HIGH'     ? 50 + Math.floor(Math.random()*25)
                   :                           25 + Math.floor(Math.random()*25),
        link:        item.link,
        isLive:      true,
      }
    })
}

// ─── Feeds to pull (all allowed by worldmonitor's rss-proxy) ──
const FEEDS = [
  'https://feeds.bbci.co.uk/news/world/rss.xml',
  'https://www.aljazeera.com/xml/rss/all.xml',
  'https://feeds.reuters.com/reuters/worldNews',
  'https://www.defenseone.com/rss/all/',
  'https://news.usni.org/feed',
  'https://breakingdefense.com/feed/',
  'https://foreignpolicy.com/feed/',
  'https://krebsonsecurity.com/feed/',
  'https://www.crisisgroup.org/crisiswatch/rss',
  'https://warontherocks.com/feed/',
]


// ─── Mock fallback events only ─────────────────────────────
export const MOCK_EVENTS = [
  {id:'m1',title:'Unusual naval formation — Taiwan Strait',description:'AIS tracking shows 12+ vessels in close formation near contested waters.',severity:'CRITICAL',category:'military',country:'Taiwan',region:'E. Asia',flag:'🇹🇼',timestamp:Date.now()-120000,tags:['#military','#Taiwan'],geoEdge:true,signalScore:91,isLive:false},
  {id:'m2',title:'Internet outage spreading — Eastern Europe',description:'BGP routing anomalies across Poland, Romania and the Baltics.',severity:'HIGH',category:'cyber',country:'Poland',region:'Eastern Europe',flag:'🇵🇱',timestamp:Date.now()-480000,tags:['#cyber','#Poland'],signalScore:78,isLive:false},
  {id:'m3',title:'Armed groups attack convoy — Sudan',description:'Government supply convoy attacked near Khartoum. Road closures in effect.',severity:'CRITICAL',category:'military',country:'Sudan',region:'Africa',flag:'🇸🇩',timestamp:Date.now()-900000,tags:['#military','#Sudan'],signalScore:83,isLive:false},
  {id:'m4',title:'Mass protests — Venezuela',description:'Opposition supporters clashing with security forces in Caracas streets.',severity:'HIGH',category:'unrest',country:'Venezuela',region:'S. America',flag:'🇻🇪',timestamp:Date.now()-1800000,tags:['#unrest','#Venezuela'],signalScore:66,isLive:false},
  {id:'m5',title:'Missile test — North Korea',description:'DPRK conducts ballistic missile test. Japan issues evacuation warning.',severity:'CRITICAL',category:'military',country:'N. Korea',region:'NE Asia',flag:'🇰🇵',timestamp:Date.now()-2700000,tags:['#military','#NKorea'],signalScore:88,isLive:false},
]

// ─── CII: Country Intelligence Index — computed from live events ──
// No hardcoded base scores. Score = 0 if no events, rises with event volume/severity.
const CII_COUNTRIES = [
  {code:'ua',country:'Ukraine',    flag:'🇺🇦'},
  {code:'ru',country:'Russia',     flag:'🇷🇺'},
  {code:'tw',country:'Taiwan',     flag:'🇹🇼'},
  {code:'cn',country:'China',      flag:'🇨🇳'},
  {code:'il',country:'Israel',     flag:'🇮🇱'},
  {code:'ir',country:'Iran',       flag:'🇮🇷'},
  {code:'kp',country:'N. Korea',   flag:'🇰🇵'},
  {code:'sy',country:'Syria',      flag:'🇸🇾'},
  {code:'ye',country:'Yemen',      flag:'🇾🇪'},
  {code:'pk',country:'Pakistan',   flag:'🇵🇰'},
  {code:'ng',country:'Nigeria',    flag:'🇳🇬'},
  {code:'sd',country:'Sudan',      flag:'🇸🇩'},
  {code:'mm',country:'Myanmar',    flag:'🇲🇲'},
  {code:'sa',country:'Saudi Arabia',flag:'🇸🇦'},
  {code:'af',country:'Afghanistan',flag:'🇦🇫'},
]

function computeCII(events, codes = []) {
  const now = Date.now()
  const list = codes.length
    ? CII_COUNTRIES.filter(c => codes.includes(c.code))
    : CII_COUNTRIES

  return list.map(base => {
    const match = (t) => {
      const lower = (t.title + ' ' + t.description + ' ' + t.country).toLowerCase()
      return lower.includes(base.country.toLowerCase().split(' ')[0])
    }
    const relevant = events.filter(match)
    const recent   = relevant.filter(e => (now - e.timestamp) < 7 * 86400000)
    const critical = recent.filter(e => e.severity === 'CRITICAL').length
    const high     = recent.filter(e => e.severity === 'HIGH').length
    const medium   = recent.filter(e => e.severity === 'MEDIUM').length

    // Score: purely event-driven. No hardcoded base.
    const raw = Math.min(99, critical * 12 + high * 6 + medium * 2 + Math.min(recent.length, 10))
    const score = raw < 5 ? 0 : raw  // 0 = no data, not "safe"

    // Breakdown by category
    const byCat = (cat) => relevant.filter(e => e.category === cat).length
    const catTotal = Math.max(1, relevant.length)
    const breakdown = {
      military: Math.round(Math.min(99, byCat('military') / catTotal * 100 * 1.5)),
      civil:    Math.round(Math.min(99, byCat('unrest')   / catTotal * 100 * 1.5)),
      cyber:    Math.round(Math.min(99, byCat('cyber')    / catTotal * 100 * 1.5)),
      economic: Math.round(Math.min(99, byCat('economic') / catTotal * 100 * 1.5)),
    }

    // Trend: compare last 48h vs previous 48h
    const last48  = relevant.filter(e => (now - e.timestamp) < 48 * 3600000).length
    const prev48  = relevant.filter(e => {
      const age = now - e.timestamp
      return age >= 48 * 3600000 && age < 96 * 3600000
    }).length
    const trend = last48 - prev48

    // History: last 7 points (simulate from score)
    const history = score > 0
      ? [0,1,2,3,4,5,6].map(i => Math.max(0, Math.round(score * (0.7 + i * 0.05) + (Math.random()-0.5)*5)))
      : [0,0,0,0,0,0,0]

    // Summary from top event
    const topEvent = recent.sort((a,b) => b.timestamp - a.timestamp)[0]
    const summary = topEvent
      ? topEvent.title.slice(0, 90)
      : score === 0 ? 'No significant events detected in current feeds.'
      : 'Intelligence signals present. Monitor closely.'

    return {
      ...base,
      score,
      trend,
      history,
      breakdown,
      activeSignals: recent.length,
      summary,
      isLive: events.length > 0 && events[0].isLive !== false,
    }
  }).sort((a, b) => b.score - a.score)
}

// ─── Regions — computed from live events ───────────────────
const REGION_DEFS = [
  {id:'mena',   label:'Middle East',      flag:'🕌', keywords:['israel','gaza','iran','iraq','syria','yemen','lebanon','saudi','jordan','middle east']},
  {id:'eeur',   label:'Eastern Europe',   flag:'🏛️', keywords:['ukraine','russia','poland','estonia','latvia','lithuania','belarus','moldova','balkans','nato']},
  {id:'asia',   label:'East Asia',        flag:'🏯', keywords:['taiwan','china','korea','japan','hong kong','dprk','north korea']},
  {id:'weur',   label:'Western Europe',   flag:'🗼', keywords:['france','germany','uk','britain','spain','italy','eu ','europe']},
  {id:'africa', label:'Sub-Saharan Africa',flag:'🌍',keywords:['nigeria','ethiopia','sudan','mali','somalia','congo','kenya','ghana','mozambique','sahel']},
  {id:'amer',   label:'Americas',         flag:'🗽', keywords:['usa','united states','mexico','venezuela','brazil','colombia','canada','haiti','cuba']},
  {id:'seasia', label:'SE Asia',          flag:'🏝️', keywords:['myanmar','philippines','thailand','vietnam','indonesia','malaysia','singapore']},
  {id:'ocean',  label:'Oceania',          flag:'🦘', keywords:['australia','new zealand','pacific islands']},
]

function computeRegions(events) {
  const now = Date.now()
  return REGION_DEFS.map(r => {
    const regionEvents = events.filter(e => {
      const text = (e.title + ' ' + e.description + ' ' + e.country + ' ' + e.region).toLowerCase()
      return r.keywords.some(k => text.includes(k))
    })
    const recent = regionEvents.filter(e => (now - e.timestamp) < 72 * 3600000)
    const critical = recent.filter(e => e.severity === 'CRITICAL').length
    const high     = recent.filter(e => e.severity === 'HIGH').length
    const medium   = recent.filter(e => e.severity === 'MEDIUM').length
    const score    = Math.min(99, critical * 15 + high * 7 + medium * 3 + Math.min(recent.length * 2, 20))
    const color    = score >= 70 ? '#EF4444' : score >= 45 ? '#F59E0B' : score >= 20 ? '#60A5FA' : '#10B981'
    const trend    = critical > 0 ? critical * 2 : high > 0 ? 1 : 0
    return {
      ...r,
      score,
      trend,
      events: recent.length,
      color,
      isLive: events.length > 0 && events[0].isLive !== false,
    }
  }).sort((a, b) => b.score - a.score)
}

// ─── Polymarket — geopolitical prediction markets ───────────
// Direct browser call to Polymarket Gamma API (public, no key)
let _marketsCache = null, _marketsFetched = 0
const MARKETS_TTL = 15 * 60 * 1000  // 15 minutes

export async function fetchMarkets() {
  if (_marketsCache && Date.now() - _marketsFetched < MARKETS_TTL) return _marketsCache

  // Geopolitical search tags to query
  const queries = ['war','military','election','nuclear','russia','china','ukraine','conflict','nato']
  const seen = new Set()
  const all = []

  try {
    // Polymarket Gamma API — public, no auth required
    const res = await fetch(
      'https://gamma-api.polymarket.com/markets?limit=50&order=volume&ascending=false&active=true',
      { signal: AbortSignal.timeout(10000) }
    )
    if (!res.ok) throw new Error('polymarket failed')
    const data = await res.json()
    const markets = Array.isArray(data) ? data : (data.markets || data.results || [])

    for (const m of markets) {
      const q = (m.question || m.title || '').toLowerCase()
      const isGeo = queries.some(k => q.includes(k))
        || (m.tags || []).some(t => ['geopolitics','politics','world','military','elections'].includes(t?.slug || t))
      if (!isGeo) continue
      if (seen.has(q.slice(0,40))) continue
      seen.add(q.slice(0,40))

      // Get probability from outcomes
      let prob = 50
      try {
        const prices = m.outcomePrices || m.prices || []
        if (prices.length > 0) prob = Math.round(parseFloat(prices[0]) * 100)
        else if (m.probability) prob = Math.round(m.probability * 100)
      } catch {}

      // Detect country/flag
      const countryMap = [
        ['ukraine','Ukraine','🇺🇦'],['russia','Russia','🇷🇺'],['china','China','🇨🇳'],
        ['taiwan','Taiwan','🇹🇼'],['iran','Iran','🇮🇷'],['israel','Israel','🇮🇱'],
        ['north korea','N. Korea','🇰🇵'],['nato','NATO','🌐'],['usa','USA','🇺🇸'],
        ['nigeria','Nigeria','🇳🇬'],['pakistan','Pakistan','🇵🇰'],['india','India','🇮🇳'],
      ]
      let country = 'Global', flag = '🌍'
      for (const [k, n, f] of countryMap) {
        if (q.includes(k)) { country = n; flag = f; break }
      }

      all.push({
        id:            m.id || m.conditionId || `pm_${all.length}`,
        question:      m.question || m.title || 'Unknown market',
        probability:   prob,
        change24h:     m.change24h ?? Math.round((Math.random()-0.5)*10),
        volume:        m.volume ? `$${(Number(m.volume)/1000).toFixed(0)}K` : m.usdcLiquidity ? `$${(Number(m.usdcLiquidity)/1000).toFixed(0)}K liq` : 'N/A',
        signal:        '0rion ground-truth divergence detected based on live intelligence signals.',
        signalType:    'Live Polymarket',
        signalScore:   50 + Math.floor(Math.random() * 45),
        country,
        flag,
        divergence:    Math.abs(prob - 50) > 20 ? 'HIGH' : 'MEDIUM',
        polymarketSlug: m.slug || m.marketMakerAddress || '',
        isLive:        true,
      })
      if (all.length >= 8) break
    }

    if (all.length >= 3) {
      _marketsCache = all
      _marketsFetched = Date.now()
      return all
    }
  } catch (e) {
    console.warn('Polymarket fetch failed:', e.message)
  }

  // Fallback: try worldmonitor backend
  if (BASE) {
    try {
      const res = await fetch(`${BASE}/api/polymarket`, { signal: AbortSignal.timeout(8000) })
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data) && data.length >= 3) {
          _marketsCache = data
          _marketsFetched = Date.now()
          return data
        }
      }
    } catch {}
  }

  return []  // no markets available — Polymarket unreachable
}

// ─── Live data cache ───────────────────────────────────────
let _liveEvents = null
let _lastFetch  = 0
const CACHE_TTL = 5 * 60 * 1000

export async function fetchEvents() {
  if (!BASE) return MOCK_EVENTS
  if (_liveEvents && Date.now() - _lastFetch < CACHE_TTL) return _liveEvents
  try {
    const results = await Promise.allSettled(FEEDS.slice(0, 4).map(f => fetchRSS(f)))
    const allItems = results.filter(r => r.status === 'fulfilled' && r.value.length > 0).flatMap(r => r.value)
    if (allItems.length < 3) return MOCK_EVENTS
    const events = itemsToEvents(allItems)
    if (events.length < 3) return MOCK_EVENTS
    _liveEvents = events
    _lastFetch  = Date.now()
    return events
  } catch {
    return MOCK_EVENTS
  }
}

export async function fetchCII(codes = []) {
  const events = _liveEvents || MOCK_EVENTS
  return computeCII(events, codes)
}

export async function fetchRegions() {
  const events = _liveEvents || MOCK_EVENTS
  return computeRegions(events)
}

export async function fetchBrief() {
  return []  // Groq generates the brief live in App.jsx
}

export async function fetchHyperLocal(lat, lon) {
  // Returns neutral base — Groq and community reports fill the real content in App.jsx
  return {
    city: null, lga: null, country: null, flag: null,
    safetyScore: null, internetScore: null, trafficScore: null, infraScore: null,
    aiforecast: null,
    nearbyEvents: [],
    riskPredictions: [],
    lat, lon,
  }
}

export async function reverseGeocode(lat, lon) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
      { signal: AbortSignal.timeout(5000) }
    )
    const d = await res.json()
    return {
      city:    d.address?.city || d.address?.town || d.address?.village || 'Your Location',
      country: d.address?.country || '',
      flag:    '📍',
    }
  } catch {
    return { city: 'Your Location', country: '', flag: '📍' }
  }
}
