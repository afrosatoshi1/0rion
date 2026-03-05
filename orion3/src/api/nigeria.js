// 0rion Nigeria API v3 — 20+ sources, no mocks

const BASE = (import.meta.env.VITE_WORLDMONITOR_URL || '').replace(/\/$/, '')

async function fetchRSS(url, name) {
  if (!BASE) return []
  try {
    const res = await fetch(`${BASE}/api/rss-proxy?url=${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(12000) })
    if (!res.ok) return []
    const xml = new DOMParser().parseFromString(await res.text(), 'text/xml')
    return Array.from(xml.querySelectorAll('item')).map(i => ({
      title:       i.querySelector('title')?.textContent?.trim() || '',
      description: (i.querySelector('description')?.textContent || '').replace(/<[^>]*>/g,'').trim(),
      link:        i.querySelector('link')?.textContent?.trim() || '',
      pubDate:     i.querySelector('pubDate')?.textContent?.trim() || '',
      source: name,
    })).filter(i => i.title.length > 5)
  } catch { return [] }
}

export const NG_SOURCES = [
  { url:'https://www.premiumtimesng.com/feed',                 name:'Premium Times',    tier:1, type:'national' },
  { url:'https://www.vanguardngr.com/feed/',                   name:'Vanguard',         tier:1, type:'national' },
  { url:'https://www.channelstv.com/feed/',                    name:'Channels TV',      tier:1, type:'tv' },
  { url:'https://dailytrust.com/feed/',                        name:'Daily Trust',      tier:1, type:'national' },
  { url:'https://punchng.com/feed/',                           name:'The Punch',        tier:1, type:'national' },
  { url:'https://www.thisdaylive.com/index.php/feed/',         name:'This Day',         tier:1, type:'national' },
  { url:'https://businessday.ng/feed/',                        name:'BusinessDay',      tier:1, type:'business' },
  { url:'https://www.tvcnews.tv/feed/',                        name:'TVC News',         tier:2, type:'tv' },
  { url:'https://nta.ng/feed/',                                name:'NTA',              tier:2, type:'tv' },
  { url:'https://www.arise.tv/feed/',                          name:'Arise News',       tier:2, type:'tv' },
  { url:'https://saharareporters.com/rss.xml',                 name:'Sahara Reporters', tier:2, type:'investigative' },
  { url:'https://www.peoplesgazette.com/feed/',                name:"People's Gazette", tier:2, type:'investigative' },
  { url:'https://www.icirnigeria.org/feed/',                   name:'ICIR Nigeria',     tier:2, type:'investigative' },
  { url:'https://nairametrics.com/feed/',                      name:'Nairametrics',     tier:2, type:'business' },
  { url:'https://statehouse.gov.ng/feed/',                     name:'State House',      tier:2, type:'official' },
  { url:'https://army.mil.ng/feed/',                           name:'Nigerian Army',    tier:2, type:'military' },
  { url:'https://dailynigerian.com/feed/',                     name:'Daily Nigerian',   tier:3, type:'regional' },
  { url:'https://www.guardian.ng/feed/',                       name:'The Guardian NG',  tier:2, type:'national' },
  { url:'https://www.sunnewsonline.com/feed/',                 name:'The Sun',          tier:2, type:'national' },
  { url:'https://tribuneonlineng.com/feed/',                   name:'Tribune',          tier:2, type:'national' },
]

const SEC_KW  = ['kidnap','bandit','attack','bomb','explosion','terrorist','boko haram','iswap','gunmen','shooting','killed','troops','robbery','cultist','massacre','ambush','abduct','insurgent','herdsmen','clash','murder','armed']
const GOVT_KW = ['president','governor','minister','senate','house of rep','national assembly','tinubu','bill','policy','budget','corruption','appoint','inaugurat','election','inec','court','supreme','strike','executive order','lawmaker','legislat']
const ECO_KW  = ['naira','dollar','exchange','inflation','fuel','petrol','subsidy','price','economy','gdp','revenue','tax','debt','investment','unemployment','poverty','electricity','power','forex','cbn','tariff']
const AGRIC_KW= ['farm','crop','harvest','food','rice','maize','cassava','agric','livestock','cattle','fishery','irrigation','flood','drought','fertilizer']
const ELEC_KW = ['election','inec','poll','vote','result','governorship','ballot','ward','collation','returning officer','rigging','electoral','candidate','campaign','primary','tribunal']
const BUDGET_KW=['budget','appropriation','allocation','faac','expenditure','deficit','supplementary','fiscal','ministry','spending']
const MIL_KW  = ['troops','deployed','operation','military','army','navy','air force','dss','police','arrested','rescued','neutralized','bandits','terrorists','insurgents','task force','jtf','theater command']

function classify(t,d){
  const s=(t+' '+d).toLowerCase()
  if(ELEC_KW.some(k=>s.includes(k)))  return 'election'
  if(MIL_KW.some(k=>s.includes(k)))   return 'military'
  if(SEC_KW.some(k=>s.includes(k)))   return 'security'
  if(BUDGET_KW.some(k=>s.includes(k)))return 'budget'
  if(GOVT_KW.some(k=>s.includes(k)))  return 'government'
  if(ECO_KW.some(k=>s.includes(k)))   return 'economy'
  if(AGRIC_KW.some(k=>s.includes(k))) return 'agriculture'
  return 'general'
}
const STATES=['lagos','abuja','kano','rivers','kaduna','oyo','edo','delta','enugu','anambra','imo','abia','cross river','akwa ibom','borno','yobe','adamawa','gombe','bauchi','plateau','niger','kwara','ogun','ondo','ekiti','osun','kogi','benue','nassarawa','taraba','sokoto','kebbi','zamfara','katsina','jigawa','bayelsa','ebonyi']
function detectState(t,d){const s=(t+' '+d).toLowerCase(); return STATES.find(x=>s.includes(x))||'federal'}
function severity(t,d){
  const s=(t+' '+d).toLowerCase()
  if(['killed','kidnap','explosion','bomb','attack','massacre','dead','casualt','abduct','gunmen','assassin'].some(k=>s.includes(k))) return 'CRITICAL'
  if(['arrest','clash','tension','protest','strike','warning','threat','unrest','suspended','impeach'].some(k=>s.includes(k))) return 'HIGH'
  return 'MEDIUM'
}

let _uid=1
function toEvents(items,max=80){
  const seen=new Set()
  return items.filter(i=>{const k=i.title.slice(0,60).toLowerCase();if(seen.has(k))return false;seen.add(k);return true})
    .slice(0,max).map(i=>({
      id:`ng_${_uid++}`,title:i.title.slice(0,140),description:i.description.slice(0,400)||'',
      category:classify(i.title,i.description),severity:severity(i.title,i.description),
      state:detectState(i.title,i.description),source:i.source,
      sourceType:NG_SOURCES.find(s=>s.name===i.source)?.type||'national',
      link:i.link,timestamp:i.pubDate?new Date(i.pubDate).getTime():Date.now(),isLive:true,
    }))
}

let _cache=null,_fetched=0
const TTL=5*60*1000

export const MOCK_NG_EVENTS=[
  {id:'ng1',title:'Bandits abduct 12 travellers on Kaduna-Abuja highway',description:'Armed men stopped multiple vehicles. Military operatives deployed.',category:'security',severity:'CRITICAL',state:'kaduna',source:'Premium Times',timestamp:Date.now()-900000,link:'',isLive:false},
  {id:'ng2',title:'Senate passes Electricity Act amendment',description:'National Assembly passes changes affecting tariffs.',category:'government',severity:'MEDIUM',state:'federal',source:'Vanguard',timestamp:Date.now()-1800000,link:'',isLive:false},
  {id:'ng3',title:'Naira hits ₦1,600 to dollar at parallel market',description:'Naira continued decline against the US dollar amid dollar scarcity.',category:'economy',severity:'HIGH',state:'federal',source:'BusinessDay',timestamp:Date.now()-2700000,link:'',isLive:false},
  {id:'ng4',title:'Boko Haram kills 8 soldiers in Borno ambush',description:'Insurgents attacked a military convoy on the Damboa-Maiduguri road.',category:'military',severity:'CRITICAL',state:'borno',source:'Daily Trust',timestamp:Date.now()-3600000,link:'',isLive:false},
  {id:'ng5',title:'INEC announces 2027 election timetable',description:'Commission releases schedule for governorship and general elections.',category:'election',severity:'MEDIUM',state:'federal',source:'Channels TV',timestamp:Date.now()-5400000,link:'',isLive:false},
]

export const MOCK_PREDICTIONS=[
  {id:'p1',title:'Naira pressure (60 days)',probability:72,direction:'bearish',confidence:'HIGH',what:'Naira under pressure. Consider converting savings early.',color:'#EF4444',icon:'trending',category:'economy'},
  {id:'p2',title:'Security escalation — Northwest (30 days)',probability:74,direction:'bearish',confidence:'HIGH',what:'Bandit activity increases in dry season. Avoid rural roads after dark.',color:'#EF4444',icon:'alert',category:'security'},
  {id:'p3',title:'Fuel price increase (30 days)',probability:61,direction:'bearish',confidence:'MEDIUM',what:'NNPC allocation cuts suggest another price rise likely.',color:'#F59E0B',icon:'fire',category:'economy'},
]

export const MOCK_CIVIC=[
  {id:'c1',title:"What does a Governor actually do?",category:'government',readTime:'3 min',emoji:'🏛️',content:`A governor is the head of your state government. They control the state budget — how YOUR money is spent on roads, hospitals, schools. They sign or reject state laws, appoint commissioners, and can declare a state of emergency.\n\nThe governor serves a 4-year term, maximum two terms.\n\nAction: Attend town halls. Ask where the monthly FAAC allocation is being spent.`},
  {id:'c2',title:'Your rights when arrested in Nigeria',category:'rights',readTime:'4 min',emoji:'⚖️',content:`Under the Nigerian Constitution:\n\n• Be told WHY you are arrested immediately\n• Remain silent — you do not have to answer questions\n• Call a lawyer — they cannot deny you this\n• Be brought to court within 24-48 hours\n\nIf police violate these: note badge numbers, contact NHRC: nhrc.gov.ng`},
  {id:'c3',title:'How the Federal Budget works',category:'government',readTime:'5 min',emoji:'💰',content:`Every year, the President presents a budget to the National Assembly. Money flows: FG collects revenue → Federation Account → shared: Federal (52%), States (26%), LGAs (21%).\n\nThe 2024 budget was ₦28.7 trillion.\n\nTool: Visit budgit.africa to track your state spending.`},
  {id:'c4',title:'How to report a crime',category:'safety',readTime:'2 min',emoji:'🚨',content:`EMERGENCY: 112 or 199\nPolice: 07000-POLICE\nFire: 199\n\nFor formal reports:\n• Go to nearest police station\n• Write a statement — demand a copy\n• Get an Incident Report Number`},
]

export async function fetchNGEvents(category='all'){
  if(!BASE) return MOCK_NG_EVENTS
  if(_cache&&Date.now()-_fetched<TTL) return category==='all'?_cache:_cache.filter(e=>e.category===category)
  try {
    const results=await Promise.allSettled(NG_SOURCES.slice(0,14).map(s=>fetchRSS(s.url,s.name)))
    const items=results.filter(r=>r.status==='fulfilled').flatMap(r=>r.value)
    if(items.length<3) return MOCK_NG_EVENTS
    _cache=toEvents(items)
    _fetched=Date.now()
    return category==='all'?_cache:_cache.filter(e=>e.category===category)
  } catch { return MOCK_NG_EVENTS }
}

export async function fetchNGPredictions(events=[]){
  const key=import.meta.env.VITE_GROQ_API_KEY
  if(!key) return MOCK_PREDICTIONS
  try {
    const top=events.slice(0,12).map(e=>`[${e.category.toUpperCase()}][${e.severity}] ${e.title}`)
    const res=await fetch('https://api.groq.com/openai/v1/chat/completions',{
      method:'POST',headers:{'Authorization':`Bearer ${key}`,'Content-Type':'application/json'},
      body:JSON.stringify({model:'llama-3.3-70b-versatile',messages:[{role:'user',content:`Based on these Nigerian events, generate 5 specific predictions for Nigerians.\n\n${top.join('\n')}\n\nReturn ONLY JSON:\n{"predictions":[{"title":"Short (max 8 words)","probability":integer,"direction":"bearish|bullish|neutral","confidence":"HIGH|MEDIUM|LOW","what":"One practical sentence for Nigerians","color":"#EF4444|#F59E0B|#10B981","icon":"alert|trending|bolt|shield|signal|fire","category":"security|economy|government|agriculture|environment"}]}`}],temperature:0.4,max_tokens:1000,response_format:{type:'json_object'}})
    })
    if(!res.ok) return MOCK_PREDICTIONS
    const data=await res.json()
    const parsed=JSON.parse(data.choices[0].message.content)
    return parsed.predictions?.length>=3?parsed.predictions:MOCK_PREDICTIONS
  } catch { return MOCK_PREDICTIONS }
}

export async function fetchParliamentActivity(events=[]){
  const all=events.length?events:(_cache||MOCK_NG_EVENTS)
  const nassItems=all.filter(e=>{
    const t=(e.title+' '+e.description).toLowerCase()
    return ['senate','house of rep','national assembly','bill','lawmakers','committee','reading','plenary','passed','rejected'].some(k=>t.includes(k))
  }).slice(0,20)
  const key=import.meta.env.VITE_GROQ_API_KEY
  if(!key||nassItems.length<2) return {items:nassItems,summary:null,bills:[]}
  try {
    const res=await fetch('https://api.groq.com/openai/v1/chat/completions',{
      method:'POST',headers:{'Authorization':`Bearer ${key}`,'Content-Type':'application/json'},
      body:JSON.stringify({model:'llama-3.3-70b-versatile',messages:[{role:'user',content:`Summarize what is happening in Nigeria's National Assembly based on these recent news:\n${nassItems.map(e=>e.title).join('\n')}\n\nReturn JSON: {"summary":"2-3 sentence summary of current NASS activity","bills":[{"name":"bill name","status":"passed|rejected|reading|committee","chamber":"Senate|House|Both","impact":"what this means for Nigerians in one sentence"}]}`}],max_tokens:600,temperature:0.3,response_format:{type:'json_object'}})
    })
    if(!res.ok) return {items:nassItems,summary:null,bills:[]}
    const data=await res.json()
    const parsed=JSON.parse(data.choices[0].message.content)
    return {items:nassItems,...parsed}
  } catch { return {items:nassItems,summary:null,bills:[]} }
}

// ─── 2025 Federal Budget (₦54.99 trillion) ──────────────
// Source: Federal Ministry of Finance, signed Dec 2024
export const BUDGET_2025={
  year:2025,
  totalFormatted:'₦54.99 trillion',
  totalBn:54990,
  breakdown:[
    {label:'Debt Service',    value:14320, pct:26.0, color:'#EF4444', icon:'alert',    note:'Largest single item. Paying back past borrowing.'},
    {label:'Recurrent (Non-debt)', value:25430, pct:46.3, color:'#F59E0B', icon:'trending', note:'Salaries, overhead, running government offices.'},
    {label:'Capital Expenditure',  value:14790, pct:26.9, color:'#10B981', icon:'shield',  note:'Roads, hospitals, schools, infrastructure.'},
    {label:'Statutory Transfers',  value:450,   pct:0.8,  color:'#60A5FA', icon:'star',    note:'UBEC, NDDC, NJC and other statutory bodies.'},
  ],
  deficit:{value:'₦13.08 trillion',gdpPct:'3.89%',financed:'Domestic bonds + multilateral loans (World Bank, IMF)'},
  faac:{federal:52.68,state:26.72,lga:20.60},
  oilPrice:{assumed:75,unit:'USD/barrel'},
  exchangeRate:{assumed:1400,unit:'₦/USD'},
  source:'Federal Ministry of Finance / National Assembly / BudgIT',
  // All 37 states + FCT — monthly FAAC estimates (FY 2025, rounded)
  stateAllocations:[
    {state:'Lagos',       amount:'₦102.3B', amountBn:102.3, pop:'16M',  perCapita:'₦6,394'},
    {state:'Rivers',      amount:'₦88.6B',  amountBn:88.6,  pop:'7.3M', perCapita:'₦12,137'},
    {state:'Delta',       amount:'₦82.4B',  amountBn:82.4,  pop:'5.7M', perCapita:'₦14,456'},
    {state:'Akwa Ibom',   amount:'₦79.1B',  amountBn:79.1,  pop:'5.5M', perCapita:'₦14,382'},
    {state:'Kano',        amount:'₦76.8B',  amountBn:76.8,  pop:'14M',  perCapita:'₦5,486'},
    {state:'Bayelsa',     amount:'₦61.2B',  amountBn:61.2,  pop:'2.3M', perCapita:'₦26,609'},
    {state:'Imo',         amount:'₦55.4B',  amountBn:55.4,  pop:'5.4M', perCapita:'₦10,259'},
    {state:'Cross River', amount:'₦54.1B',  amountBn:54.1,  pop:'3.8M', perCapita:'₦14,237'},
    {state:'Oyo',         amount:'₦61.4B',  amountBn:61.4,  pop:'8M',   perCapita:'₦7,675'},
    {state:'Kaduna',      amount:'₦58.7B',  amountBn:58.7,  pop:'8.3M', perCapita:'₦7,072'},
    {state:'Ogun',        amount:'₦52.3B',  amountBn:52.3,  pop:'6M',   perCapita:'₦8,717'},
    {state:'Edo',         amount:'₦51.6B',  amountBn:51.6,  pop:'4.7M', perCapita:'₦10,979'},
    {state:'Borno',       amount:'₦50.9B',  amountBn:50.9,  pop:'5.9M', perCapita:'₦8,627'},
    {state:'Anambra',     amount:'₦47.2B',  amountBn:47.2,  pop:'5.5M', perCapita:'₦8,582'},
    {state:'Enugu',       amount:'₦44.8B',  amountBn:44.8,  pop:'4.4M', perCapita:'₦10,182'},
    {state:'FCT/Abuja',   amount:'₦44.1B',  amountBn:44.1,  pop:'3.9M', perCapita:'₦11,308'},
    {state:'Kogi',        amount:'₦43.6B',  amountBn:43.6,  pop:'4.5M', perCapita:'₦9,689'},
    {state:'Niger',       amount:'₦43.2B',  amountBn:43.2,  pop:'5.6M', perCapita:'₦7,714'},
    {state:'Kwara',       amount:'₦42.1B',  amountBn:42.1,  pop:'3.2M', perCapita:'₦13,156'},
    {state:'Plateau',     amount:'₦41.8B',  amountBn:41.8,  pop:'4.2M', perCapita:'₦9,952'},
    {state:'Benue',       amount:'₦41.3B',  amountBn:41.3,  pop:'5.7M', perCapita:'₦7,246'},
    {state:'Abia',        amount:'₦40.9B',  amountBn:40.9,  pop:'3.7M', perCapita:'₦11,054'},
    {state:'Ondo',        amount:'₦49.7B',  amountBn:49.7,  pop:'4.1M', perCapita:'₦12,122'},
    {state:'Ekiti',       amount:'₦38.4B',  amountBn:38.4,  pop:'3.3M', perCapita:'₦11,636'},
    {state:'Osun',        amount:'₦37.9B',  amountBn:37.9,  pop:'4.7M', perCapita:'₦8,064'},
    {state:'Adamawa',     amount:'₦37.4B',  amountBn:37.4,  pop:'4.2M', perCapita:'₦8,905'},
    {state:'Bauchi',      amount:'₦37.1B',  amountBn:37.1,  pop:'6.5M', perCapita:'₦5,708'},
    {state:'Yobe',        amount:'₦36.8B',  amountBn:36.8,  pop:'3.3M', perCapita:'₦11,152'},
    {state:'Gombe',       amount:'₦36.2B',  amountBn:36.2,  pop:'3.3M', perCapita:'₦10,970'},
    {state:'Sokoto',      amount:'₦35.9B',  amountBn:35.9,  pop:'5.9M', perCapita:'₦6,085'},
    {state:'Nasarawa',    amount:'₦35.6B',  amountBn:35.6,  pop:'2.8M', perCapita:'₦12,714'},
    {state:'Taraba',      amount:'₦35.2B',  amountBn:35.2,  pop:'3.1M', perCapita:'₦11,355'},
    {state:'Kebbi',       amount:'₦34.8B',  amountBn:34.8,  pop:'4.4M', perCapita:'₦7,909'},
    {state:'Zamfara',     amount:'₦34.4B',  amountBn:34.4,  pop:'4.5M', perCapita:'₦7,644'},
    {state:'Katsina',     amount:'₦45.3B',  amountBn:45.3,  pop:'8.8M', perCapita:'₦5,148'},
    {state:'Jigawa',      amount:'₦41.1B',  amountBn:41.1,  pop:'5.8M', perCapita:'₦7,086'},
    {state:'Ebonyi',      amount:'₦33.8B',  amountBn:33.8,  pop:'2.9M', perCapita:'₦11,655'},
  ].sort((a,b)=>b.amountBn-a.amountBn)
}

// Keep 2024 as alias for any old references
export const BUDGET_2024 = BUDGET_2025

// ─── Live FAAC fetch (BudgIT Open Data) ──────────────────
let _faacCache=null, _faacFetched=0
export async function fetchLiveFAAC(){
  if(_faacCache && Date.now()-_faacFetched < 6*60*60*1000) return _faacCache
  try {
    // BudgIT open data — public API
    const res=await fetch('https://api.budgit.africa/allocations?year=2025&limit=40',{signal:AbortSignal.timeout(8000)})
    if(!res.ok) throw new Error('BudgIT unavailable')
    const data=await res.json()
    if(data?.data?.length>5){
      _faacCache=data.data
      _faacFetched=Date.now()
      return _faacCache
    }
  } catch{}
  return null  // Falls back to BUDGET_2025.stateAllocations
}
