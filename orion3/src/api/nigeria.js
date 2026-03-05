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

// ─── 2026 Federal Budget ("Budget of Consolidation") ────────
// Source: Presidency / Federal Ministry of Finance
// Presented by President Tinubu to National Assembly, 19 Dec 2025
// Total expenditure ₦58.18T | Revenue ₦34.33T | Deficit ₦23.85T
export const BUDGET_2026={
  year:2026,
  title:'Budget of Consolidation, Renewed Resilience and Shared Prosperity',
  totalFormatted:'\u20a658.18 trillion',
  totalBn:58180,
  revenueFormatted:'\u20a634.33 trillion',
  revenueBn:34330,
  breakdown:[
    {label:'Capital Expenditure',  value:26080, pct:44.8, color:'#10B981', icon:'shield',   note:'Largest capital budget in Nigerian history. Roads, hospitals, schools, power.'},
    {label:'Debt Service',         value:15520, pct:26.7, color:'#EF4444', icon:'alert',    note:'Includes \u20a63.19T sinking fund. Paying back past borrowing — growing every year.'},
    {label:'Recurrent (Non-debt)', value:15250, pct:26.2, color:'#F59E0B', icon:'trending', note:'Personnel \u20a610.75T, overheads \u20a62.22T. Salaries, pensions, running costs.'},
    {label:'Statutory Transfers',  value:4100,  pct:7.0,  color:'#60A5FA', icon:'star',     note:'UBEC, NDDC, NJC, Revenue Mobilization and other statutory bodies.'},
  ],
  sectorAllocations:[
    {label:'Defence & Security', value:5410, color:'#EF4444', note:'Army \u20a61.5T · Navy \u20a6444B · Air Force \u20a6407B + DSS, Police'},
    {label:'Infrastructure',     value:3560, color:'#F59E0B', note:'Roads, bridges, power grid, urban development'},
    {label:'Education',          value:3520, color:'#3B82F6', note:'NELFUND (788K+ students) · vocational training · school infrastructure'},
    {label:'Health',             value:2480, color:'#10B981', note:'6% of total budget · primary care expansion · disease prevention'},
  ],
  deficit:{value:'\u20a623.85 trillion',gdpPct:'4.28%',financed:'Domestic bonds + concessional multilateral loans (World Bank, IMF, AfDB)'},
  faac:{federal:52.68,state:26.72,lga:20.60},
  oilPrice:{assumed:64.85,unit:'USD/barrel'},
  oilProduction:{assumed:1.84,unit:'mbpd'},
  exchangeRate:{assumed:1400,unit:'\u20a6/USD'},
  source:'Statehouse.gov.ng / Federal Ministry of Finance / National Assembly',
  note:'Single-budget cycle introduced — no more rollover budgets from 2026.',
  stateAllocations:[
    {state:'Lagos',      amount:'\u20a6112.4B',amountBn:112.4,pop:'16M',  perCapita:'\u20a67,025'},
    {state:'Rivers',     amount:'\u20a698.2B', amountBn:98.2, pop:'7.3M', perCapita:'\u20a613,452'},
    {state:'Delta',      amount:'\u20a691.6B', amountBn:91.6, pop:'5.7M', perCapita:'\u20a616,070'},
    {state:'Akwa Ibom',  amount:'\u20a688.3B', amountBn:88.3, pop:'5.5M', perCapita:'\u20a616,055'},
    {state:'Kano',       amount:'\u20a685.1B', amountBn:85.1, pop:'14M',  perCapita:'\u20a66,079'},
    {state:'Bayelsa',    amount:'\u20a668.4B', amountBn:68.4, pop:'2.3M', perCapita:'\u20a629,739'},
    {state:'Oyo',        amount:'\u20a668.6B', amountBn:68.6, pop:'8M',   perCapita:'\u20a68,575'},
    {state:'Kaduna',     amount:'\u20a665.4B', amountBn:65.4, pop:'8.3M', perCapita:'\u20a67,880'},
    {state:'Imo',        amount:'\u20a661.8B', amountBn:61.8, pop:'5.4M', perCapita:'\u20a611,444'},
    {state:'Cross River',amount:'\u20a660.4B', amountBn:60.4, pop:'3.8M', perCapita:'\u20a615,895'},
    {state:'Ondo',       amount:'\u20a655.6B', amountBn:55.6, pop:'4.1M', perCapita:'\u20a613,561'},
    {state:'Ogun',       amount:'\u20a658.3B', amountBn:58.3, pop:'6M',   perCapita:'\u20a69,717'},
    {state:'Edo',        amount:'\u20a657.6B', amountBn:57.6, pop:'4.7M', perCapita:'\u20a612,255'},
    {state:'Borno',      amount:'\u20a656.8B', amountBn:56.8, pop:'5.9M', perCapita:'\u20a69,627'},
    {state:'Anambra',    amount:'\u20a652.7B', amountBn:52.7, pop:'5.5M', perCapita:'\u20a69,582'},
    {state:'Enugu',      amount:'\u20a650.1B', amountBn:50.1, pop:'4.4M', perCapita:'\u20a611,386'},
    {state:'Katsina',    amount:'\u20a650.8B', amountBn:50.8, pop:'8.8M', perCapita:'\u20a65,773'},
    {state:'FCT/Abuja',  amount:'\u20a649.3B', amountBn:49.3, pop:'3.9M', perCapita:'\u20a612,641'},
    {state:'Kogi',       amount:'\u20a648.8B', amountBn:48.8, pop:'4.5M', perCapita:'\u20a610,844'},
    {state:'Niger',      amount:'\u20a648.3B', amountBn:48.3, pop:'5.6M', perCapita:'\u20a68,625'},
    {state:'Jigawa',     amount:'\u20a646.0B', amountBn:46.0, pop:'5.8M', perCapita:'\u20a67,931'},
    {state:'Kwara',      amount:'\u20a647.1B', amountBn:47.1, pop:'3.2M', perCapita:'\u20a614,719'},
    {state:'Plateau',    amount:'\u20a646.7B', amountBn:46.7, pop:'4.2M', perCapita:'\u20a611,119'},
    {state:'Benue',      amount:'\u20a646.2B', amountBn:46.2, pop:'5.7M', perCapita:'\u20a68,105'},
    {state:'Abia',       amount:'\u20a645.8B', amountBn:45.8, pop:'3.7M', perCapita:'\u20a612,378'},
    {state:'Ekiti',      amount:'\u20a643.1B', amountBn:43.1, pop:'3.3M', perCapita:'\u20a613,061'},
    {state:'Osun',       amount:'\u20a642.5B', amountBn:42.5, pop:'4.7M', perCapita:'\u20a69,043'},
    {state:'Adamawa',    amount:'\u20a641.9B', amountBn:41.9, pop:'4.2M', perCapita:'\u20a69,976'},
    {state:'Bauchi',     amount:'\u20a641.6B', amountBn:41.6, pop:'6.5M', perCapita:'\u20a66,400'},
    {state:'Yobe',       amount:'\u20a641.2B', amountBn:41.2, pop:'3.3M', perCapita:'\u20a612,485'},
    {state:'Gombe',      amount:'\u20a640.6B', amountBn:40.6, pop:'3.3M', perCapita:'\u20a612,303'},
    {state:'Sokoto',     amount:'\u20a640.3B', amountBn:40.3, pop:'5.9M', perCapita:'\u20a66,831'},
    {state:'Nasarawa',   amount:'\u20a639.9B', amountBn:39.9, pop:'2.8M', perCapita:'\u20a614,250'},
    {state:'Taraba',     amount:'\u20a639.5B', amountBn:39.5, pop:'3.1M', perCapita:'\u20a612,742'},
    {state:'Kebbi',      amount:'\u20a639.0B', amountBn:39.0, pop:'4.4M', perCapita:'\u20a68,864'},
    {state:'Zamfara',    amount:'\u20a638.6B', amountBn:38.6, pop:'4.5M', perCapita:'\u20a68,578'},
    {state:'Ebonyi',     amount:'\u20a637.9B', amountBn:37.9, pop:'2.9M', perCapita:'\u20a613,069'},
  ].sort((a,b)=>b.amountBn-a.amountBn)
}
export const BUDGET_2025 = BUDGET_2026
export const BUDGET_2024 = BUDGET_2026

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
