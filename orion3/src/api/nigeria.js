// 0rion Nigeria Data Layer
// Real Nigerian data sources — all RSS via worldmonitor proxy
// + live API sources for economy/government

const BASE = (import.meta.env.VITE_WORLDMONITOR_URL || '').replace(/\/$/, '')

// ─── RSS proxy ────────────────────────────────────────────
async function fetchRSS(feedUrl) {
  if (!BASE) return []
  try {
    const res = await fetch(`${BASE}/api/rss-proxy?url=${encodeURIComponent(feedUrl)}`, {
      signal: AbortSignal.timeout(12000)
    })
    if (!res.ok) return []
    const text = await res.text()
    const parser = new DOMParser()
    const xml = parser.parseFromString(text, 'text/xml')
    return Array.from(xml.querySelectorAll('item')).map(item => ({
      title:       item.querySelector('title')?.textContent?.trim() || '',
      description: (item.querySelector('description')?.textContent || '').replace(/<[^>]*>/g,'').trim(),
      link:        item.querySelector('link')?.textContent?.trim() || '',
      pubDate:     item.querySelector('pubDate')?.textContent?.trim() || '',
      source:      feedUrl.includes('premiumtimes') ? 'Premium Times'
                 : feedUrl.includes('vanguard') ? 'Vanguard'
                 : feedUrl.includes('channels') ? 'Channels TV'
                 : feedUrl.includes('dailytrust') ? 'Daily Trust'
                 : feedUrl.includes('thisdaylive') ? 'This Day'
                 : feedUrl.includes('businessday') ? 'Business Day'
                 : feedUrl.includes('punchng') ? 'The Punch'
                 : 'Nigerian News',
    })).filter(i => i.title.length > 5)
  } catch { return [] }
}

// ─── Nigerian news feeds (all in worldmonitor allowlist) ──
const NG_FEEDS = {
  security: [
    'https://www.premiumtimesng.com/news/headlines/feed',
    'https://dailytrust.com/feed/',
    'https://www.channelstv.com/feed/',
  ],
  government: [
    'https://www.premiumtimesng.com/government/feed',
    'https://www.thisdaylive.com/index.php/feed/',
    'https://www.vanguardngr.com/feed/',
  ],
  economy: [
    'https://www.vanguardngr.com/category/business/feed/',
    'https://www.premiumtimesng.com/business/feed',
  ],
  general: [
    'https://www.premiumtimesng.com/feed',
    'https://www.vanguardngr.com/feed/',
    'https://www.channelstv.com/feed/',
    'https://dailytrust.com/feed/',
    'https://www.thisdaylive.com/index.php/feed/',
  ],
}

// ─── Security classification ──────────────────────────────
const SECURITY_KW   = ['kidnap','bandit','attack','bomb','explosion','terrorist','boko haram','iswap','gunmen','shooting','killed','troops','military','police','arrest','robbery','cultist','massacre','ambush','abduct','ransom','insurgent','herdsmen','farmer','clash','violence','murder','assassination','niger delta','armed','security']
const GOVT_KW       = ['president','governor','minister','senate','house of rep','nass','national assembly','tinubu','bill','law','policy','budget','corruption','sack','appoint','inaugurat','election','inec','court','supreme','lawsuit','protest','strike','cbnn','central bank']
const ECONOMY_KW    = ['naira','dollar','exchange','inflation','fuel','petrol','subsidy','price','market','economy','gdp','revenue','tax','debt','imf','world bank','investment','unemployment','poverty','electricity','power','trading']
const AGRIC_KW      = ['farm','crop','harvest','food','rice','maize','cassava','yam','tomato','agric','livestock','cattle','fishery','irrigation','flood','drought','food security','hunger','famine']

function classifyNGEvent(title, desc) {
  const text = (title + ' ' + desc).toLowerCase()
  if (SECURITY_KW.some(k => text.includes(k)))  return 'security'
  if (GOVT_KW.some(k => text.includes(k)))       return 'government'
  if (ECONOMY_KW.some(k => text.includes(k)))    return 'economy'
  if (AGRIC_KW.some(k => text.includes(k)))      return 'agriculture'
  return 'general'
}

const STATES = ['lagos','abuja','kano','rivers','kaduna','oyo','edo','delta','enugu','anambra','imo','abia','cross river','akwa ibom','borno','yobe','adamawa','gombe','bauchi','plateau','niger','kwara','ogun','ondo','ekiti','osun','kogi','benue','nassarawa','taraba','sokoto','kebbi','zamfara','katsina','jigawa','bayelsa']

function detectState(title, desc) {
  const text = (title + ' ' + desc).toLowerCase()
  return STATES.find(s => text.includes(s)) || 'federal'
}

const SEVERITY_NG_HIGH = ['killed','kidnap','explosion','bomb','attack','massacre','dead','casualt','abduct','ransom','gunmen']
const SEVERITY_NG_MED  = ['arrest','clash','tension','protest','strike','warning','threat','unrest']

function severityNG(title, desc) {
  const text = (title + ' ' + desc).toLowerCase()
  if (SEVERITY_NG_HIGH.some(k => text.includes(k))) return 'CRITICAL'
  if (SEVERITY_NG_MED.some(k => text.includes(k)))  return 'HIGH'
  return 'MEDIUM'
}

let _ngUid = 1
function toNGEvents(items, maxItems = 30) {
  const seen = new Set()
  return items
    .filter(item => {
      const k = item.title.slice(0, 60).toLowerCase()
      if (seen.has(k)) return false
      seen.add(k); return true
    })
    .slice(0, maxItems)
    .map(item => ({
      id:          `ng_${_ngUid++}`,
      title:       item.title.slice(0, 130),
      description: item.description.slice(0, 300) || 'No details available.',
      category:    classifyNGEvent(item.title, item.description),
      severity:    severityNG(item.title, item.description),
      state:       detectState(item.title, item.description),
      source:      item.source,
      link:        item.link,
      timestamp:   item.pubDate ? new Date(item.pubDate).getTime() : Date.now(),
      isLive:      true,
    }))
}

// ─── Cache ────────────────────────────────────────────────
let _ngCache = null
let _ngFetched = 0
const TTL = 5 * 60 * 1000

// ─── MOCK DATA ────────────────────────────────────────────
export const MOCK_NG_EVENTS = [
  {id:'ng1',title:'Bandits abduct 12 travellers on Kaduna-Abuja highway',description:'Armed men stopped multiple vehicles and abducted passengers. Military operatives deployed.',category:'security',severity:'CRITICAL',state:'kaduna',source:'Premium Times',timestamp:Date.now()-900000,link:''},
  {id:'ng2',title:'Senate passes Electricity Act amendment — what it means for you',description:'The National Assembly has passed changes affecting electricity tariffs and distribution companies.',category:'government',severity:'MEDIUM',state:'federal',source:'Vanguard',timestamp:Date.now()-1800000,link:''},
  {id:'ng3',title:'Naira hits ₦1,580 to dollar at parallel market',description:'The naira continued its decline against the US dollar amid dollar scarcity concerns.',category:'economy',severity:'HIGH',state:'federal',source:'Business Day',timestamp:Date.now()-2700000,link:''},
  {id:'ng4',title:'Boko Haram kills 8 soldiers in Borno ambush',description:'Insurgents attacked a military convoy on the Damboa-Maiduguri road overnight.',category:'security',severity:'CRITICAL',state:'borno',source:'Daily Trust',timestamp:Date.now()-3600000,link:''},
  {id:'ng5',title:'Edo State governor approves new education budget',description:'₦48 billion allocated to rebuild 800 primary schools across all 18 LGAs.',category:'government',severity:'MEDIUM',state:'edo',source:'Channels TV',timestamp:Date.now()-5400000,link:''},
  {id:'ng6',title:'Fuel scarcity returns to Lagos as NNPC cuts allocation',description:'Long queues reported at filling stations across Lagos Island and mainland.',category:'economy',severity:'HIGH',state:'lagos',source:'The Punch',timestamp:Date.now()-7200000,link:''},
  {id:'ng7',title:'Farmers displaced as flood destroys crops in Kogi',description:'Over 400 farming families in Lokoja LGA displaced after River Niger overflows banks.',category:'agriculture',severity:'HIGH',state:'kogi',source:'Premium Times',timestamp:Date.now()-9000000,link:''},
  {id:'ng8',title:'EFCC arrests 47 in cybercrime sweep across Lagos',description:'Operation targets yahoo-yahoo hotspots in Ajah and Surulere. Laptops, phones seized.',category:'security',severity:'MEDIUM',state:'lagos',source:'Vanguard',timestamp:Date.now()-10800000,link:''},
  {id:'ng9',title:'INEC announces local government election dates for 2025',description:'18 states to conduct LGA polls between March and June. Voter registration opens next month.',category:'government',severity:'MEDIUM',state:'federal',source:'This Day',timestamp:Date.now()-14400000,link:''},
  {id:'ng10',title:'Rice price hits ₦120,000 per 50kg bag in Kano market',description:'Traders cite import restrictions and weak naira for soaring food prices.',category:'agriculture',severity:'HIGH',state:'kano',source:'Daily Trust',timestamp:Date.now()-18000000,link:''},
]

export const MOCK_PREDICTIONS = [
  {id:'p1',title:'Naira stability (next 60 days)',probability:28,direction:'bearish',confidence:'HIGH',what:'Naira likely to remain under pressure. Consider converting savings early.',color:'#EF4444',icon:'trending',category:'economy'},
  {id:'p2',title:'Security escalation — Northwest (30 days)',probability:74,direction:'bearish',confidence:'HIGH',what:'Bandit activity historically increases in dry season. Avoid travel on rural roads after dark.',color:'#EF4444',icon:'alert',category:'security'},
  {id:'p3',title:'Fuel price increase (next 30 days)',probability:61,direction:'bearish',confidence:'MEDIUM',what:'NNPC allocation cuts suggest another subsidy removal likely. Stock up on essentials.',color:'#F59E0B',icon:'fire',category:'economy'},
  {id:'p4',title:'Flood risk — South-South (60 days)',probability:82,direction:'bearish',confidence:'HIGH',what:'Rainy season patterns indicate high flood risk for Rivers, Delta, Bayelsa. Prepare early.',color:'#EF4444',icon:'signal',category:'environment'},
  {id:'p5',title:'Power supply improvement — Lagos (90 days)',probability:44,direction:'bullish',confidence:'LOW',what:'New Siemens transmission upgrades may improve hours by 2-3hrs/day. Low confidence.',color:'#F59E0B',icon:'bolt',category:'infrastructure'},
  {id:'p6',title:'Food price relief (next 60 days)',probability:31,direction:'bullish',confidence:'LOW',what:'Harvest season may reduce tomato and maize prices slightly in South-West markets.',color:'#10B981',icon:'fire',category:'agriculture'},
  {id:'p7',title:'Internet disruption nationwide (30 days)',probability:22,direction:'neutral',confidence:'MEDIUM',what:'Undersea cable maintenance scheduled. Short outages likely. Use alternatives.',color:'#F59E0B',icon:'wifi',category:'infrastructure'},
]

export const MOCK_CIVIC = [
  {id:'c1',title:'What does a Governor actually do?',category:'government',readTime:'3 min',emoji:'🏛️',content:`A governor is the head of your state government. They have the power to:
  
• Sign or reject state laws passed by the House of Assembly
• Control the state budget — how YOUR money is spent on roads, hospitals, schools
• Appoint commissioners and heads of state agencies
• Declare a state of emergency in your state
• Command the state security apparatus (police, vigilante liaison)

The governor serves a 4-year term and can only serve twice. If your governor is doing a bad job — misusing funds, ignoring security, neglecting infrastructure — you have the right to petition, protest peacefully, and most importantly VOTE them out.

What you can do: Attend town halls. Follow your governor's social media. Ask where the state allocation from Abuja is being spent.`},
  {id:'c2',title:'Your rights when arrested in Nigeria',category:'rights',readTime:'4 min',emoji:'⚖️',content:`Under the Nigerian Constitution and Administration of Criminal Justice Act (ACJA), when arrested you have the RIGHT to:

• Be told WHY you are being arrested immediately
• Remain silent — you do not have to answer any questions
• Call a lawyer — they cannot deny you this
• Be brought before a court within 24-48 hours (not held indefinitely)
• Be treated humanely — no torture or degrading treatment
• Know the specific charge against you

If police violate these rights:
• Memorize badge numbers and names
• Contact the Public Complaints Commission: 0800-PUBLIC
• Contact NHRC: 09-4613796
• Document everything — photos, witnesses

NEVER sign anything without a lawyer present.`},
  {id:'c3',title:'How the Federal Budget works — simply',category:'government',readTime:'5 min',emoji:'💰',content:`Every year, the President presents a budget to the National Assembly. Here is how it works:

1. FG collects revenue — mainly from oil sales, taxes, customs
2. This money goes into the Federation Account
3. It is shared between Federal (52%), States (26%), LGAs (21%)
4. Each state then shares its portion with its 36+ LGAs

The 2024 budget was ₦28.7 trillion. This means:
• About ₦14.9 trillion to federal government
• About ₦7.5 trillion to states
• About ₦6 trillion to LGAs

The problem: much of this money is unaccounted for. Your LGA chairman receives federal allocation every month — you can demand to see how it is spent at town hall meetings.

Your action: Visit BudgIT Nigeria (budgit.africa) to track your state and LGA spending.`},
  {id:'c4',title:'How to report a crime or incident',category:'safety',readTime:'2 min',emoji:'🚨',content:`When something happens in your community, here is who to contact:

EMERGENCY NUMBERS:
• Police Emergency: 112 or 199
• Nigeria Police: 07000-POLICE (07000-765423)
• Army: 193
• Fire Service: 199
• Ambulance: 199

FOR REPORTS (non-emergency):
• Go to your nearest police station — Divisional Police Officer (DPO)
• Write a formal statement — demand a copy
• Get an Incident Report Number — without this, your case can be buried

IF POLICE DO NOTHING:
• Report to the Commissioner of Police for your state
• Contact IPOB, SERAP, or civil society groups
• Use social media — public pressure works
• Contact journalists at Premium Times, Channels TV

REMEMBER: You can report anonymously to the DSS at report.dss.gov.ng`},
  {id:'c5',title:'What is INEC and how does your vote work?',category:'government',readTime:'3 min',emoji:'🗳️',content:`INEC — the Independent National Electoral Commission — is responsible for conducting elections in Nigeria.

HOW YOUR VOTE WORKS:
1. Register with INEC to get your Permanent Voter Card (PVC)
2. Check your polling unit (where you vote) on INEC website
3. On election day, go to your polling unit with your PVC
4. Vote is verified by BVAS (Bimodal Voter Accreditation System)
5. Results are uploaded directly to INEC Result Viewing Portal (IReV)

YOUR VOTE MATTERS:
• President is won by 25%+ votes in 24+ states — not just total votes
• Governorship uses same principle at LGA level
• You can serve as a polling agent for any party — free training available

PROTECT YOUR VOTE:
• Never sell your PVC or vote
• Know your rights — results must be announced at polling unit before being moved
• Document irregularities with photos and report to INEC or YIAGA Africa`},
  {id:'c6',title:'How to contribute to Nigeria\'s growth',category:'civic',readTime:'4 min',emoji:'🇳🇬',content:`Every single Nigerian can contribute positively — you do not need to be in government.

AT THE COMMUNITY LEVEL:
• Join or form a community development association
• Attend LGA town hall meetings — demand accountability
• Report infrastructure damage (roads, bridges) to your council
• Participate in community cleanups and security watch groups

AS A PROFESSIONAL:
• Pay your taxes — even informal traders should register with FIRS
• Hire locally — support Nigerian businesses and artisans
• Mentor a young person — skills transfer is nation building
• Use Made-in-Nigeria products where possible

AS A CITIZEN:
• Register to vote and actually vote
• Stay informed — share verified information, fight misinformation
• Hold your representatives accountable — call their offices
• Report corruption to EFCC (efccnigeria.org) or ICPC (icpc.gov.ng)

THE COLLECTIVE POWER:
200 million Nigerians each doing one small positive thing daily = unstoppable change. Corruption survives because citizens are disengaged. Your engagement is the solution.`},
]

export const MOCK_ECONOMY = {
  naira: { parallel: 1580, official: 1310, change24h: -12, trend: 'down' },
  fuel:  { pms: 617, ago: 1080, lpg: 1200, change: +28 },
  inflation: { rate: 33.2, food: 37.9, change: +1.2 },
  stocks: { ngx: 97845, change: +234, percent: +0.24 },
  crypto: { btcNaira: 148000000, change: +3.2 },
  commodities: [
    {item:'Rice (50kg)',price:'₦118,000',change:'+₦8,000',trend:'up'},
    {item:'Garri (bag)',price:'₦45,000',change:'+₦3,000',trend:'up'},
    {item:'Tomato (basket)',price:'₦28,000',change:'-₦2,000',trend:'down'},
    {item:'Palm oil (25L)',price:'₦32,000',change:'+₦1,500',trend:'up'},
    {item:'Yam (tuber)',price:'₦3,500',change:'stable',trend:'neutral'},
    {item:'Chicken (kg)',price:'₦4,800',change:'+₦300',trend:'up'},
  ],
}

// ─── Public API ────────────────────────────────────────────

export async function fetchNGEvents(category = 'all') {
  if (!BASE) return MOCK_NG_EVENTS

  if (_ngCache && Date.now() - _ngFetched < TTL) {
    return category === 'all' ? _ngCache : _ngCache.filter(e => e.category === category)
  }

  try {
    const feeds = category === 'security'    ? NG_FEEDS.security
                : category === 'government'  ? NG_FEEDS.government
                : category === 'economy'     ? NG_FEEDS.economy
                : NG_FEEDS.general

    const results = await Promise.allSettled(feeds.map(f => fetchRSS(f)))
    const items = results
      .filter(r => r.status === 'fulfilled')
      .flatMap(r => r.value)

    if (items.length < 3) return MOCK_NG_EVENTS

    const events = toNGEvents(items)
    _ngCache = events
    _ngFetched = Date.now()
    return category === 'all' ? events : events.filter(e => e.category === category)
  } catch {
    return MOCK_NG_EVENTS
  }
}

export async function fetchNGPredictions(events = [], groqFn = null) {
  if (!groqFn) return MOCK_PREDICTIONS
  try {
    const topEvents = events.slice(0, 10).map(e => `[${e.category}] ${e.title}`)
    const prompt = `You are 0rion Nigeria, an AI intelligence system. Based on these recent Nigerian events, generate 6 specific outcome predictions.

Recent events:
${topEvents.join('\n')}

Today: ${new Date().toLocaleDateString('en-NG', {weekday:'long',month:'long',day:'numeric',year:'numeric'})}

Return ONLY valid JSON (no markdown):
{
  "predictions": [
    {
      "title": "Short outcome title (max 8 words)",
      "probability": <integer 5-95>,
      "direction": "bearish|bullish|neutral",
      "confidence": "HIGH|MEDIUM|LOW",
      "what": "What Nigerians should do about this (1 practical sentence)",
      "color": "#EF4444|#F59E0B|#10B981",
      "icon": "alert|trending|bolt|shield|signal|fire|wifi",
      "category": "security|economy|government|agriculture|infrastructure|environment"
    }
  ]
}`

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${import.meta.env.VITE_GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4,
        max_tokens: 1200,
        response_format: { type: 'json_object' },
      })
    })
    if (!res.ok) return MOCK_PREDICTIONS
    const data = await res.json()
    const parsed = JSON.parse(data.choices[0].message.content)
    return parsed.predictions?.length >= 3 ? parsed.predictions : MOCK_PREDICTIONS
  } catch {
    return MOCK_PREDICTIONS
  }
}

export { MOCK_NG_EVENTS as default }
