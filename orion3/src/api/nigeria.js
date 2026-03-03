// 0rion Nigeria Data Layer
// RSS feeds via worldmonitor proxy + Groq AI predictions

const BASE = (import.meta.env.VITE_WORLDMONITOR_URL || '').replace(/\/$/, '')

// ─── RSS proxy ─────────────────────────────────────────────
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
                 : feedUrl.includes('vanguard')     ? 'Vanguard'
                 : feedUrl.includes('channels')     ? 'Channels TV'
                 : feedUrl.includes('dailytrust')   ? 'Daily Trust'
                 : feedUrl.includes('thisdaylive')  ? 'This Day'
                 : feedUrl.includes('punchng')      ? 'The Punch'
                 : 'Nigerian News',
    })).filter(i => i.title.length > 5)
  } catch { return [] }
}

const NG_FEEDS = {
  general: [
    'https://www.premiumtimesng.com/feed',
    'https://www.vanguardngr.com/feed/',
    'https://www.channelstv.com/feed/',
    'https://dailytrust.com/feed/',
    'https://www.thisdaylive.com/index.php/feed/',
  ],
  security:   ['https://www.premiumtimesng.com/news/headlines/feed','https://dailytrust.com/feed/'],
  government: ['https://www.premiumtimesng.com/government/feed','https://www.vanguardngr.com/feed/'],
  economy:    ['https://www.vanguardngr.com/category/business/feed/','https://www.premiumtimesng.com/business/feed'],
}

const SECURITY_KW   = ['kidnap','bandit','attack','bomb','explosion','terrorist','boko haram','iswap','gunmen','shooting','killed','troops','military','police','arrest','robbery','cultist','massacre','ambush','abduct','ransom','insurgent','herdsmen','clash','violence','murder','assassination','armed','security']
const GOVT_KW       = ['president','governor','minister','senate','house of rep','nass','national assembly','tinubu','bill','law','policy','budget','corruption','sack','appoint','inaugurat','election','inec','court','supreme','lawsuit','protest','strike','central bank','cbnn']
const ECONOMY_KW    = ['naira','dollar','exchange','inflation','fuel','petrol','subsidy','price hike','economy','gdp','revenue','tax','debt','imf','world bank','investment','unemployment','poverty','electricity','power outage','trading']
const AGRIC_KW      = ['farm','crop','harvest','food','rice','maize','cassava','yam','tomato','agric','livestock','cattle','fishery','irrigation','flood','drought','food security','hunger','famine']

function classifyNG(title, desc) {
  const t = (title + ' ' + desc).toLowerCase()
  if (SECURITY_KW.some(k => t.includes(k)))   return 'security'
  if (GOVT_KW.some(k => t.includes(k)))        return 'government'
  if (ECONOMY_KW.some(k => t.includes(k)))     return 'economy'
  if (AGRIC_KW.some(k => t.includes(k)))       return 'agriculture'
  return 'general'
}

const STATES = ['lagos','abuja','kano','rivers','kaduna','oyo','edo','delta','enugu','anambra','imo','abia','cross river','akwa ibom','borno','yobe','adamawa','gombe','bauchi','plateau','niger','kwara','ogun','ondo','ekiti','osun','kogi','benue','nassarawa','taraba','sokoto','kebbi','zamfara','katsina','jigawa','bayelsa']
function detectState(title, desc) {
  const t = (title + ' ' + desc).toLowerCase()
  return STATES.find(s => t.includes(s)) || 'federal'
}

function severityNG(title, desc) {
  const t = (title + ' ' + desc).toLowerCase()
  if (['killed','kidnap','explosion','bomb','attack','massacre','dead','casualt','abduct','gunmen'].some(k=>t.includes(k))) return 'CRITICAL'
  if (['arrest','clash','tension','protest','strike','warning','threat','unrest'].some(k=>t.includes(k))) return 'HIGH'
  return 'MEDIUM'
}

let _uid = 1
function toNGEvents(items, max = 40) {
  const seen = new Set()
  return items
    .filter(i => { const k = i.title.slice(0,60).toLowerCase(); if(seen.has(k)) return false; seen.add(k); return true })
    .slice(0, max)
    .map(item => ({
      id:          `ng_${_uid++}`,
      title:       item.title.slice(0, 130),
      description: item.description.slice(0, 300) || '',
      category:    classifyNG(item.title, item.description),
      severity:    severityNG(item.title, item.description),
      state:       detectState(item.title, item.description),
      source:      item.source,
      link:        item.link,
      timestamp:   item.pubDate ? new Date(item.pubDate).getTime() : Date.now(),
      isLive:      true,
    }))
}

// ─── Cache ──────────────────────────────────────────────────
let _cache = null, _fetched = 0
const TTL = 5 * 60 * 1000

// ─── Mock fallback data ─────────────────────────────────────
export const MOCK_NG_EVENTS = [
  {id:'ng1',title:'Bandits abduct 12 travellers on Kaduna-Abuja highway',description:'Armed men stopped multiple vehicles. Military operatives deployed.',category:'security',severity:'CRITICAL',state:'kaduna',source:'Premium Times',timestamp:Date.now()-900000,link:'',isLive:false},
  {id:'ng2',title:'Senate passes Electricity Act amendment',description:'National Assembly passes changes affecting tariffs and distribution companies.',category:'government',severity:'MEDIUM',state:'federal',source:'Vanguard',timestamp:Date.now()-1800000,link:'',isLive:false},
  {id:'ng3',title:'Naira hits ₦1,580 to dollar at parallel market',description:'Naira continued decline against the US dollar amid dollar scarcity.',category:'economy',severity:'HIGH',state:'federal',source:'Business Day',timestamp:Date.now()-2700000,link:'',isLive:false},
  {id:'ng4',title:'Boko Haram kills 8 soldiers in Borno ambush',description:'Insurgents attacked a military convoy on the Damboa-Maiduguri road overnight.',category:'security',severity:'CRITICAL',state:'borno',source:'Daily Trust',timestamp:Date.now()-3600000,link:'',isLive:false},
  {id:'ng5',title:'Edo State governor approves new education budget',description:'₦48 billion allocated to rebuild 800 primary schools across all 18 LGAs.',category:'government',severity:'MEDIUM',state:'edo',source:'Channels TV',timestamp:Date.now()-5400000,link:'',isLive:false},
  {id:'ng6',title:'Fuel scarcity returns to Lagos as NNPC cuts allocation',description:'Long queues reported at filling stations across Lagos.',category:'economy',severity:'HIGH',state:'lagos',source:'The Punch',timestamp:Date.now()-7200000,link:'',isLive:false},
  {id:'ng7',title:'Floods destroy crops in Kogi displacing 400 farming families',description:'River Niger overflow impacts Lokoja LGA farmers.',category:'agriculture',severity:'HIGH',state:'kogi',source:'Premium Times',timestamp:Date.now()-9000000,link:'',isLive:false},
  {id:'ng8',title:'EFCC arrests 47 in cybercrime sweep across Lagos',description:'Operation targets fraud hotspots in Ajah and Surulere.',category:'security',severity:'MEDIUM',state:'lagos',source:'Vanguard',timestamp:Date.now()-10800000,link:'',isLive:false},
]

export const MOCK_PREDICTIONS = [
  {id:'p1',title:'Naira stability (next 60 days)',probability:28,direction:'bearish',confidence:'HIGH',what:'Naira likely under pressure. Consider converting savings early.',color:'#EF4444',icon:'trending',category:'economy'},
  {id:'p2',title:'Security escalation — Northwest (30 days)',probability:74,direction:'bearish',confidence:'HIGH',what:'Bandit activity increases in dry season. Avoid rural roads after dark.',color:'#EF4444',icon:'alert',category:'security'},
  {id:'p3',title:'Fuel price increase (next 30 days)',probability:61,direction:'bearish',confidence:'MEDIUM',what:'NNPC allocation cuts suggest another price rise likely.',color:'#F59E0B',icon:'fire',category:'economy'},
  {id:'p4',title:'Flood risk — South-South (60 days)',probability:82,direction:'bearish',confidence:'HIGH',what:'Rivers, Delta, Bayelsa high flood risk. Prepare early.',color:'#EF4444',icon:'signal',category:'environment'},
  {id:'p5',title:'Power supply improvement — Lagos (90 days)',probability:44,direction:'bullish',confidence:'LOW',what:'Siemens upgrades may improve hours by 2-3hrs/day.',color:'#F59E0B',icon:'bolt',category:'infrastructure'},
  {id:'p6',title:'Food price relief (next 60 days)',probability:31,direction:'bullish',confidence:'LOW',what:'Harvest season may reduce tomato and maize prices slightly.',color:'#10B981',icon:'fire',category:'agriculture'},
]

export const MOCK_CIVIC = [
  {id:'c1',title:'What does a Governor actually do?',category:'government',readTime:'3 min',emoji:'🏛️',content:`A governor is the head of your state government. They have the power to:\n\n• Sign or reject state laws passed by the House of Assembly\n• Control the state budget — how YOUR money is spent on roads, hospitals, schools\n• Appoint commissioners and heads of state agencies\n• Declare a state of emergency in your state\n\nThe governor serves a 4-year term and can only serve twice. If your governor is doing a bad job, you have the right to petition, protest peacefully, and VOTE them out.\n\nWhat you can do: Attend town halls. Ask where the state allocation from Abuja is being spent.`},
  {id:'c2',title:'Your rights when arrested in Nigeria',category:'rights',readTime:'4 min',emoji:'⚖️',content:`Under the Nigerian Constitution and ACJA, when arrested you have the RIGHT to:\n\n• Be told WHY you are being arrested immediately\n• Remain silent — you do not have to answer questions\n• Call a lawyer — they cannot deny you this\n• Be brought before a court within 24-48 hours\n• Be treated humanely — no torture\n\nIf police violate these rights:\n• Note badge numbers and names\n• Contact the Public Complaints Commission: 0800-PUBLIC\n• NEVER sign anything without a lawyer present.`},
  {id:'c3',title:'How the Federal Budget works — simply',category:'government',readTime:'5 min',emoji:'💰',content:`Every year, the President presents a budget to the National Assembly:\n\n1. FG collects revenue — mainly from oil, taxes, customs\n2. Money goes into the Federation Account\n3. Shared: Federal (52%), States (26%), LGAs (21%)\n\nThe 2024 budget was ₦28.7 trillion.\n\nThe problem: much of this money is unaccounted for. Your LGA chairman receives federal allocation every month — demand to see how it is spent.\n\nYour action: Visit budgit.africa to track your state and LGA spending.`},
  {id:'c4',title:'How to report a crime or incident',category:'safety',readTime:'2 min',emoji:'🚨',content:`EMERGENCY NUMBERS:\n• Police Emergency: 112 or 199\n• Nigeria Police: 07000-POLICE\n• Fire Service: 199\n\nFOR REPORTS:\n• Go to nearest police station\n• Write a formal statement — demand a copy\n• Get an Incident Report Number\n\nIF POLICE DO NOTHING:\n• Report to Commissioner of Police for your state\n• Contact journalists at Premium Times, Channels TV\n• Use social media — public pressure works`},
  {id:'c5',title:'What is INEC and how does your vote work?',category:'government',readTime:'3 min',emoji:'🗳️',content:`INEC conducts elections in Nigeria.\n\nHOW YOUR VOTE WORKS:\n1. Register with INEC for your Permanent Voter Card (PVC)\n2. Check your polling unit on INEC website\n3. On election day, vote is verified by BVAS\n4. Results uploaded to IReV portal immediately\n\nPROTECT YOUR VOTE:\n• Never sell your PVC or vote\n• Results must be announced at polling unit before being moved\n• Document irregularities and report to INEC or YIAGA Africa`},
  {id:'c6',title:'How to contribute to Nigeria\'s growth',category:'civic',readTime:'4 min',emoji:'🇳🇬',content:`Every single Nigerian can contribute positively.\n\nAT COMMUNITY LEVEL:\n• Join or form a community development association\n• Attend LGA town hall meetings — demand accountability\n• Report infrastructure damage to your council\n\nAS A CITIZEN:\n• Register to vote and actually vote\n• Share verified information, fight misinformation\n• Report corruption to EFCC (efccnigeria.org) or ICPC (icpc.gov.ng)\n\n200 million Nigerians each doing one small positive thing daily = unstoppable change.`},
]

// ─── Public API ─────────────────────────────────────────────
export async function fetchNGEvents(category = 'all') {
  if (!BASE) return MOCK_NG_EVENTS

  if (_cache && Date.now() - _fetched < TTL) {
    return category === 'all' ? _cache : _cache.filter(e => e.category === category)
  }

  try {
    const feeds = category === 'security'   ? NG_FEEDS.security
                : category === 'government' ? NG_FEEDS.government
                : category === 'economy'    ? NG_FEEDS.economy
                : NG_FEEDS.general
    const results = await Promise.allSettled(feeds.map(f => fetchRSS(f)))
    const items = results.filter(r => r.status === 'fulfilled').flatMap(r => r.value)
    if (items.length < 3) return MOCK_NG_EVENTS
    _cache = toNGEvents(items)
    _fetched = Date.now()
    return category === 'all' ? _cache : _cache.filter(e => e.category === category)
  } catch {
    return MOCK_NG_EVENTS
  }
}

export async function fetchNGPredictions(events = []) {
  const key = import.meta.env.VITE_GROQ_API_KEY
  if (!key) return MOCK_PREDICTIONS
  try {
    const top = events.slice(0,10).map(e=>`[${e.category}] ${e.title}`)
    const prompt = `You are 0rion Nigeria AI. Based on these recent Nigerian events, generate 6 specific outcome predictions.\n\nEvents:\n${top.join('\n')}\n\nToday: ${new Date().toLocaleDateString('en-NG',{weekday:'long',month:'long',day:'numeric',year:'numeric'})}\n\nReturn ONLY valid JSON (no markdown):\n{"predictions":[{"title":"Short outcome (max 8 words)","probability":integer 5-95,"direction":"bearish|bullish|neutral","confidence":"HIGH|MEDIUM|LOW","what":"One practical sentence for Nigerians","color":"#EF4444|#F59E0B|#10B981","icon":"alert|trending|bolt|shield|signal|fire|wifi","category":"security|economy|government|agriculture|infrastructure|environment"}]}`
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method:'POST',
      headers:{'Authorization':`Bearer ${key}`,'Content-Type':'application/json'},
      body:JSON.stringify({model:'llama-3.3-70b-versatile',messages:[{role:'user',content:prompt}],temperature:0.4,max_tokens:1200,response_format:{type:'json_object'}})
    })
    if (!res.ok) return MOCK_PREDICTIONS
    const data = await res.json()
    const parsed = JSON.parse(data.choices[0].message.content)
    return parsed.predictions?.length >= 3 ? parsed.predictions : MOCK_PREDICTIONS
  } catch {
    return MOCK_PREDICTIONS
  }
}
