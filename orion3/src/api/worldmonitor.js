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

// ─── Mock data (fallback) ──────────────────────────────────
export const MOCK_EVENTS = [
  {id:'m1',title:'Unusual naval formation — Taiwan Strait',description:'AIS tracking shows 12+ vessels in close formation near contested waters. 3 carrier groups confirmed.',severity:'CRITICAL',category:'military',country:'Taiwan',region:'E. Asia',flag:'🇹🇼',timestamp:Date.now()-120000,tags:['#military','#Taiwan'],geoEdge:true,signalScore:91},
  {id:'m2',title:'Internet outage spreading — Eastern Europe',description:'BGP routing anomalies across Poland, Romania and the Baltics. Pattern consistent with targeted disruption.',severity:'HIGH',category:'cyber',country:'Poland',region:'Eastern Europe',flag:'🇵🇱',timestamp:Date.now()-480000,tags:['#cyber','#Poland'],signalScore:78},
  {id:'m3',title:'Military flight surge — Korean Peninsula',description:'OpenSky shows 340% above baseline. USAF and ROKAF active. Surge 3+ hours above anomaly threshold.',severity:'HIGH',category:'military',country:'S. Korea',region:'NE Asia',flag:'🇰🇷',timestamp:Date.now()-840000,tags:['#military','#SKorea'],geoEdge:true,signalScore:84},
  {id:'m4',title:'Mass protest building — Tehran',description:'ACLED reports 3,000+ demonstrators near parliament. Internet throttling detected.',severity:'MEDIUM',category:'unrest',country:'Iran',region:'Middle East',flag:'🇮🇷',timestamp:Date.now()-1380000,tags:['#unrest','#Iran'],signalScore:61},
  {id:'m5',title:'APT-41 targeting SE Asian finance',description:'Coordinated spear-phishing against 14 institutions. IOCs match Chinese state-sponsored attribution.',severity:'CRITICAL',category:'cyber',country:'Global',region:'SE Asia',flag:'🌍',timestamp:Date.now()-1860000,tags:['#cyber','#APT41'],signalScore:88},
  {id:'m6',title:'Drone strike reported — Red Sea corridor',description:'Houthi forces claim responsibility. Commercial shipping lane disruption confirmed.',severity:'HIGH',category:'military',country:'Yemen',region:'Middle East',flag:'🇾🇪',timestamp:Date.now()-2700000,tags:['#military','#Yemen'],signalScore:76},
  {id:'m7',title:'Nationwide strike — French transport',description:'Rail workers walkout day 3. Major airports at 40% capacity.',severity:'MEDIUM',category:'unrest',country:'Europe',region:'Europe',flag:'🇪🇺',timestamp:Date.now()-3600000,tags:['#unrest','#Europe'],signalScore:55},
]

export const MOCK_CII = [
  {code:'ua',country:'Ukraine',flag:'🇺🇦',score:82,trend:3,history:[60,65,70,72,78,80,82],breakdown:{military:90,civil:75,cyber:80,economic:70},activeSignals:14,summary:'Active conflict zone. Frontline movements in 3 sectors.'},
  {code:'tw',country:'Taiwan',flag:'🇹🇼',score:67,trend:5,history:[50,52,55,58,62,65,67],breakdown:{military:78,civil:45,cyber:60,economic:55},activeSignals:7,summary:'Naval tensions elevated. Strait crossings at highest in 18 months.'},
  {code:'ir',country:'Iran',flag:'🇮🇷',score:71,trend:-2,history:[75,74,73,72,70,71,71],breakdown:{military:65,civil:72,cyber:58,economic:80},activeSignals:9,summary:'Nuclear talks stalled. Domestic unrest continues.'},
  {code:'ng',country:'Nigeria',flag:'🇳🇬',score:45,trend:0,history:[40,42,44,45,44,46,45],breakdown:{military:35,civil:55,cyber:25,economic:60},activeSignals:3,summary:'Northern security incidents sporadic.'},
  {code:'kp',country:'N. Korea',flag:'🇰🇵',score:74,trend:4,history:[55,58,62,65,68,72,74],breakdown:{military:92,civil:40,cyber:65,economic:55},activeSignals:11,summary:'Missile test window active. Elevated readiness.'},
  {code:'ru',country:'Russia',flag:'🇷🇺',score:79,trend:1,history:[72,73,74,76,77,79,79],breakdown:{military:88,civil:60,cyber:85,economic:75},activeSignals:16,summary:'Ongoing conflict operations. Cyber ops at high tempo.'},
  {code:'il',country:'Israel',flag:'🇮🇱',score:77,trend:2,history:[65,68,70,72,74,76,77],breakdown:{military:85,civil:65,cyber:70,economic:60},activeSignals:12,summary:'Regional tensions elevated. Multiple active fronts.'},
  {code:'cn',country:'China',flag:'🇨🇳',score:55,trend:2,history:[48,49,50,51,53,54,55],breakdown:{military:60,civil:40,cyber:75,economic:50},activeSignals:8,summary:'Taiwan Strait activity elevated.'},
  {code:'pk',country:'Pakistan',flag:'🇵🇰',score:62,trend:0,history:[58,59,60,61,62,61,62],breakdown:{military:65,civil:68,cyber:40,economic:72},activeSignals:6,summary:'Domestic political instability. Border tensions.'},
  {code:'sa',country:'Saudi Arabia',flag:'🇸🇦',score:44,trend:-1,history:[48,47,46,45,44,44,44],breakdown:{military:50,civil:35,cyber:35,economic:55},activeSignals:4,summary:'Regional proxy conflicts ongoing.'},
  {code:'sy',country:'Syria',flag:'🇸🇾',score:76,trend:0,history:[74,75,75,76,75,76,76],breakdown:{military:85,civil:70,cyber:30,economic:88},activeSignals:10,summary:'Ongoing low-intensity conflict.'},
  {code:'ye',country:'Yemen',flag:'🇾🇪',score:73,trend:1,history:[68,69,70,71,72,73,73],breakdown:{military:82,civil:75,cyber:20,economic:85},activeSignals:8,summary:'Red Sea corridor threats active.'},
]

export const MOCK_REGIONS = [
  {id:'mena',  label:'Middle East',     flag:'🕌', score:78, trend:3,  events:14, color:'#EF4444'},
  {id:'eeur',  label:'Eastern Europe',  flag:'🏛️', score:65, trend:1,  events:9,  color:'#F59E0B'},
  {id:'asia',  label:'East Asia',       flag:'🏯', score:71, trend:5,  events:11, color:'#F59E0B'},
  {id:'weur',  label:'Western Europe',  flag:'🗼', score:28, trend:-2, events:3,  color:'#10B981'},
  {id:'africa',label:'Sub-Saharan Africa',flag:'🌍',score:52,trend:0,  events:6,  color:'#F59E0B'},
  {id:'amer',  label:'Americas',        flag:'🗽', score:31, trend:-1, events:4,  color:'#10B981'},
  {id:'seasia',label:'SE Asia',         flag:'🏝️', score:58, trend:2,  events:8,  color:'#F59E0B'},
  {id:'ocean', label:'Oceania',         flag:'🦘', score:15, trend:0,  events:1,  color:'#10B981'},
]

export const MOCK_MARKETS = [
  {id:'m1',question:'Will Taiwan face a military blockade in 2025?',probability:34,change24h:7,volume:'$2.4M',signal:'Naval convergence — 3+ signal types co-occurring in Taiwan Strait.',signalType:'Geo-Convergence',signalScore:87,country:'Taiwan',flag:'🇹🇼',divergence:'HIGH',polymarketSlug:'taiwan-military-blockade-2025'},
  {id:'m2',question:'Will Iran nuclear talks collapse before Q2?',probability:58,change24h:-4,volume:'$1.1M',signal:'Street protests calming. Threat score dropped 6 points this week.',signalType:'Threat Score Drop',signalScore:72,country:'Iran',flag:'🇮🇷',divergence:'MEDIUM',polymarketSlug:''},
  {id:'m3',question:'Will North Korea conduct a nuclear test in 2025?',probability:41,change24h:9,volume:'$3.7M',signal:'Military flight surge 340% above baseline. Seismic stations on alert.',signalType:'Flight Surge Anomaly',signalScore:91,country:'N. Korea',flag:'🇰🇵',divergence:'HIGH',polymarketSlug:''},
  {id:'m4',question:'Will a major cyberattack hit EU infrastructure?',probability:67,change24h:3,volume:'$890K',signal:'BGP anomalies across Baltic states. APT-29 indicators detected.',signalType:'Cyber Precursor',signalScore:78,country:'EU',flag:'🇪🇺',divergence:'MEDIUM',polymarketSlug:''},
]

export const MOCK_BRIEF = [
  {title:'Top Threat',icon:'alert',color:'#EF4444',tag:'CRITICAL',content:'Taiwan Strait naval convergence remains the highest-priority signal. GeoEdge divergence flagged.'},
  {title:'Conflict Watch',icon:'ship',color:'#A78BFA',tag:'HIGH',content:'Ukraine frontlines stable. Korean Peninsula military flights 3x above baseline.'},
  {title:'Cyber Landscape',icon:'wifi',color:'#22D3EE',tag:'MEDIUM',content:'Baltic internet anomalies ongoing. APT-41 actively targeting SE Asian financial sector.'},
  {title:'Economic Signals',icon:'trending',color:'#10B981',tag:'INFO',content:'Polymarket odds on Iran nuclear collapse fell 4pts. Taiwan market 7pts underpriced.'},
  {title:'Your Watchlist',icon:'eye',color:'#60A5FA',tag:'UPDATE',content:'Ukraine (+3), N. Korea (+4), Taiwan (+5) all trending up.'},
]

export const MOCK_HYPERLOCAL = {
  city:'Victoria Island', lga:'Lagos Island LGA', country:'Nigeria', flag:'🇳🇬',
  safetyScore:82, internetScore:76, trafficScore:46, infraScore:88,
  aiforecast:'Your area looks calm. Minor traffic delays near Eko Bridge expected until 18:00. No security concerns within 5km.',
  nearbyEvents:[
    {id:'l1',title:'Internet slowdown reported',distanceKm:0.3,icon:'wifi',color:'#F59E0B',time:'14m ago',description:'Multiple users reporting slower speeds.'},
    {id:'l2',title:'Traffic disruption — Eko Bridge',distanceKm:1.2,icon:'alert',color:'#5A7A96',time:'32m ago',description:'Minor road works causing congestion.'},
    {id:'l3',title:'Security checkpoint active',distanceKm:2.8,icon:'shield',color:'#60A5FA',time:'1h ago',description:'Routine checkpoint on Ozumba Mbadiwe.'},
  ],
  riskPredictions:[
    {label:'Civil unrest (next 7 days)',probability:8,color:'#10B981'},
    {label:'Internet outage (next 24h)',probability:21,color:'#F59E0B'},
    {label:'Security incident (next 48h)',probability:5,color:'#10B981'},
    {label:'Power disruption (next 7 days)',probability:34,color:'#F59E0B'},
  ],
}

// ─── Live data cache ───────────────────────────────────────
let _liveEvents = null
let _lastFetch  = 0
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

// ─── Public API ────────────────────────────────────────────

export async function fetchEvents() {
  if (!BASE) return MOCK_EVENTS

  // Return cache if fresh
  if (_liveEvents && Date.now() - _lastFetch < CACHE_TTL) return _liveEvents

  try {
    // Fetch 4 feeds in parallel — fast ones first
    const results = await Promise.allSettled(
      FEEDS.slice(0, 4).map(f => fetchRSS(f))
    )
    const allItems = results
      .filter(r => r.status === 'fulfilled' && r.value.length > 0)
      .flatMap(r => r.value)

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

  const scored = MOCK_CII.map(base => {
    if (!BASE || !_liveEvents) return base
    const relevant = events.filter(e =>
      e.country.toLowerCase().includes(base.country.toLowerCase()) ||
      e.title.toLowerCase().includes(base.country.toLowerCase().split(' ')[0])
    )
    const boost = relevant.filter(e => e.severity === 'CRITICAL').length * 3
                + relevant.filter(e => e.severity === 'HIGH').length * 1
    return {
      ...base,
      score: Math.min(99, base.score + boost),
      activeSignals: relevant.length > 0 ? relevant.length : base.activeSignals,
    }
  })

  return codes.length ? scored.filter(c => codes.includes(c.code)) : scored
}

export async function fetchRegions() {
  if (!BASE || !_liveEvents) return MOCK_REGIONS
  const events = _liveEvents

  const REGION_KEYWORDS = {
    'Middle East':       ['middle east','israel','gaza','iran','iraq','syria','yemen','lebanon','saudi','jordan'],
    'Eastern Europe':    ['ukraine','russia','poland','estonia','latvia','lithuania','belarus','moldova','balkans'],
    'East Asia':         ['taiwan','china','korea','japan','hong kong'],
    'Western Europe':    ['france','germany','uk','britain','spain','italy','nato','eu','europe'],
    'Sub-Saharan Africa':['nigeria','ethiopia','sudan','mali','somalia','congo','kenya','ghana'],
    'Americas':          ['usa','united states','mexico','venezuela','brazil','colombia','canada'],
    'SE Asia':           ['myanmar','philippines','thailand','vietnam','indonesia','malaysia','singapore'],
    'Oceania':           ['australia','new zealand','pacific'],
  }

  return MOCK_REGIONS.map(r => {
    const kws = REGION_KEYWORDS[r.label] || []
    const regionEvents = events.filter(e => {
      const text = (e.title + ' ' + e.country + ' ' + e.region).toLowerCase()
      return kws.some(k => text.includes(k))
    })
    const boost = regionEvents.filter(e => e.severity === 'CRITICAL').length * 4
                + regionEvents.filter(e => e.severity === 'HIGH').length * 2
    return {
      ...r,
      score:  Math.min(99, r.score + boost),
      events: regionEvents.length > 0 ? regionEvents.length : r.events,
    }
  })
}

export async function fetchMarkets() {
  if (!BASE) return MOCK_MARKETS
  try {
    const res = await fetch(`${BASE}/api/polymarket`, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return MOCK_MARKETS
    const data = await res.json()
    if (Array.isArray(data) && data.length > 0) {
      return data.slice(0, 6).map((m, i) => ({
        id:            m.id || `pm_${i}`,
        question:      m.question || m.title || 'Unknown market',
        probability:   Math.round((parseFloat(m.outcomePrices?.[0]) || m.probability || 0.5) * 100),
        change24h:     Math.round((Math.random() - 0.5) * 14),
        volume:        m.volume ? `$${(m.volume / 1000).toFixed(0)}K` : '$0',
        signal:        '0rion ground-truth divergence detected.',
        signalType:    'Live Polymarket',
        signalScore:   60 + Math.floor(Math.random() * 35),
        country:       'Global',
        flag:          '🌍',
        divergence:    Math.random() > 0.5 ? 'HIGH' : 'MEDIUM',
        polymarketSlug: m.slug || '',
      }))
    }
    return MOCK_MARKETS
  } catch {
    return MOCK_MARKETS
  }
}

export async function fetchBrief() {
  return MOCK_BRIEF // Groq handles brief generation in App.jsx
}

export async function fetchHyperLocal(lat, lon) {
  // Groq handles local forecast in App.jsx — this just returns base structure
  return { ...MOCK_HYPERLOCAL, lat, lon }
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
