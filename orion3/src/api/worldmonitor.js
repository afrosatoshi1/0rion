const BASE = import.meta.env.VITE_WORLDMONITOR_URL || ''
async function get(path, mock) {
  if (!BASE) return mock
  try {
    const res = await fetch(`${BASE}${path}`, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return mock
    const data = await res.json()
    if (!data || (Array.isArray(data) && !data.length)) return mock
    return data
  } catch { return mock }
}
export const MOCK_EVENTS = [
  {id:'e1',title:'Unusual naval formation — Taiwan Strait',description:'AIS tracking shows 12+ vessels in close formation near contested waters. 3 carrier groups confirmed. Elevated deployment posture.',severity:'CRITICAL',category:'military',country:'Taiwan',region:'Taiwan Strait, W. Pacific',flag:'🇹🇼',timestamp:Date.now()-120000,tags:['#TaiwanStrait','#NavalAlert'],geoEdge:true,signalScore:91},
  {id:'e2',title:'Internet outage spreading — Eastern Europe',description:'BGP routing anomalies across Poland, Romania and the Baltics. Pattern consistent with targeted infrastructure disruption.',severity:'HIGH',category:'cyber',country:'Poland',region:'Poland, Romania, Baltics',flag:'🇵🇱',timestamp:Date.now()-480000,tags:['#CyberAttack','#Infrastructure'],signalScore:78},
  {id:'e3',title:'Military flight surge — Korean Peninsula',description:'OpenSky shows 340% above baseline. USAF and ROKAF active. Surge 3+ hours above anomaly threshold.',severity:'HIGH',category:'military',country:'South Korea',region:'Korean Peninsula, NE Asia',flag:'🇰🇷',timestamp:Date.now()-840000,tags:['#Korea','#MilFlights'],geoEdge:true,signalScore:84},
  {id:'e4',title:'Mass protest building in Tehran',description:'ACLED reports 3,000+ demonstrators near parliament. Internet throttling detected. Security forces on standby.',severity:'MEDIUM',category:'unrest',country:'Iran',region:'Tehran, Iran',flag:'🇮🇷',timestamp:Date.now()-1380000,tags:['#IranProtest'],signalScore:61},
  {id:'e5',title:'APT-41 targeting SE Asian finance',description:'Coordinated spear-phishing against 14 institutions. IOCs match Chinese state-sponsored attribution.',severity:'CRITICAL',category:'cyber',country:'Singapore',region:'Singapore, Malaysia, Thailand',flag:'🇸🇬',timestamp:Date.now()-1860000,tags:['#APT41','#CyberEspionage'],signalScore:88},
  {id:'e6',title:'Satellite fire surge — Amazon Basin',description:'NASA FIRMS shows 47% above seasonal baseline. Coordinates near agricultural expansion zones.',severity:'MEDIUM',category:'environmental',country:'Brazil',region:'Para State, Brazil',flag:'🇧🇷',timestamp:Date.now()-2700000,tags:['#Amazon'],signalScore:55},
  {id:'e7',title:'Nationwide strike — French transport',description:'Rail workers walkout day 3. Major airports at 40% capacity. Government talks collapsed overnight.',severity:'HIGH',category:'unrest',country:'France',region:'Paris, Marseille, Lyon',flag:'🇫🇷',timestamp:Date.now()-3600000,tags:['#FranceStrike'],signalScore:67},
]
export const MOCK_CII = [
  {code:'ua',country:'Ukraine',flag:'🇺🇦',score:82,trend:3,history:[60,65,70,72,78,80,82],breakdown:{military:90,civil:75,cyber:80,economic:70},activeSignals:14,summary:'Active conflict zone. Frontline movements in 3 sectors. Foreign military aid ongoing.'},
  {code:'tw',country:'Taiwan',flag:'🇹🇼',score:67,trend:5,history:[50,52,55,58,62,65,67],breakdown:{military:78,civil:45,cyber:60,economic:55},activeSignals:7,summary:'Naval tensions elevated. Strait crossings at highest in 18 months.'},
  {code:'ir',country:'Iran',flag:'🇮🇷',score:71,trend:-2,history:[75,74,73,72,70,71,71],breakdown:{military:65,civil:72,cyber:58,economic:80},activeSignals:9,summary:'Nuclear talks stalled. Domestic unrest continues but trending calmer.'},
  {code:'ng',country:'Nigeria',flag:'🇳🇬',score:45,trend:0,history:[40,42,44,45,44,46,45],breakdown:{military:35,civil:55,cyber:25,economic:60},activeSignals:3,summary:'Northern security incidents sporadic. Economic instability within normal range.'},
  {code:'kp',country:'N. Korea',flag:'🇰🇵',score:74,trend:4,history:[55,58,62,65,68,72,74],breakdown:{military:92,civil:40,cyber:65,economic:55},activeSignals:11,summary:'Missile test window active. South Korea and US on elevated readiness.'},
  {code:'ru',country:'Russia',flag:'🇷🇺',score:79,trend:1,history:[72,73,74,76,77,79,79],breakdown:{military:88,civil:60,cyber:85,economic:75},activeSignals:16,summary:'Ongoing conflict operations. Cyber ops at sustained high tempo.'},
  {code:'il',country:'Israel',flag:'🇮🇱',score:77,trend:2,history:[65,68,70,72,74,76,77],breakdown:{military:85,civil:65,cyber:70,economic:60},activeSignals:12,summary:'Regional tensions elevated. Multiple active fronts. Diplomatic pressure ongoing.'},
  {code:'cn',country:'China',flag:'🇨🇳',score:55,trend:2,history:[48,49,50,51,53,54,55],breakdown:{military:60,civil:40,cyber:75,economic:50},activeSignals:8,summary:'Taiwan Strait activity elevated. Regional economic pressure campaigns active.'},
  {code:'pk',country:'Pakistan',flag:'🇵🇰',score:62,trend:0,history:[58,59,60,61,62,61,62],breakdown:{military:65,civil:68,cyber:40,economic:72},activeSignals:6,summary:'Domestic political instability. Border tensions with India elevated.'},
  {code:'sa',country:'Saudi Arabia',flag:'🇸🇦',score:44,trend:-1,history:[48,47,46,45,44,44,44],breakdown:{military:50,civil:35,cyber:35,economic:55},activeSignals:4,summary:'Regional proxy conflicts ongoing. Domestic stability solid. Oil diplomacy active.'},
  {code:'ve',country:'Venezuela',flag:'🇻🇪',score:58,trend:1,history:[52,53,54,55,56,57,58],breakdown:{military:45,civil:75,cyber:25,economic:85},activeSignals:5,summary:'Economic collapse deepening. Emigration surge ongoing. Political stalemate.'},
  {code:'sy',country:'Syria',flag:'🇸🇾',score:76,trend:0,history:[74,75,75,76,75,76,76],breakdown:{military:85,civil:70,cyber:30,economic:88},activeSignals:10,summary:'Ongoing low-intensity conflict. Multiple foreign forces active.'},
]
export const MOCK_REGIONS = [
  {id:'mena',label:'Middle East',flag:'🕌',score:78,trend:3,events:14,color:'#EF4444'},
  {id:'eeur',label:'Eastern Europe',flag:'🏛️',score:65,trend:1,events:9,color:'#F59E0B'},
  {id:'asia',label:'East Asia',flag:'🏯',score:71,trend:5,events:11,color:'#F59E0B'},
  {id:'weur',label:'Western Europe',flag:'🗼',score:28,trend:-2,events:3,color:'#10B981'},
  {id:'africa',label:'Sub-Saharan Africa',flag:'🌍',score:52,trend:0,events:6,color:'#F59E0B'},
  {id:'amer',label:'Americas',flag:'🗽',score:31,trend:-1,events:4,color:'#10B981'},
  {id:'seasia',label:'SE Asia',flag:'🏝️',score:58,trend:2,events:8,color:'#F59E0B'},
  {id:'ocean',label:'Oceania',flag:'🦘',score:15,trend:0,events:1,color:'#10B981'},
]
export const MOCK_MARKETS = [
  {id:'m1',question:'Will Taiwan face a military blockade in 2025?',probability:34,change24h:7,volume:'$2.4M',signal:'Naval convergence — 3+ signal types co-occurring in Taiwan Strait. Market has not repriced yet.',signalType:'Geo-Convergence',signalScore:87,country:'Taiwan',flag:'🇹🇼',divergence:'HIGH',polymarketSlug:'taiwan-military-blockade-2025'},
  {id:'m2',question:'Will Iran nuclear talks collapse before Q2?',probability:58,change24h:-4,volume:'$1.1M',signal:'Street protests calming. Internet stability improving. Threat score dropped 6 points this week.',signalType:'Threat Score Drop',signalScore:72,country:'Iran',flag:'🇮🇷',divergence:'MEDIUM',polymarketSlug:''},
  {id:'m3',question:'Will North Korea conduct a nuclear test in 2025?',probability:41,change24h:9,volume:'$3.7M',signal:'Military flight surge 340% above baseline. Seismic stations on alert. Historical precursor pattern detected.',signalType:'Flight Surge Anomaly',signalScore:91,country:'N. Korea',flag:'🇰🇵',divergence:'HIGH',polymarketSlug:''},
  {id:'m4',question:'Will a major cyberattack hit EU infrastructure?',probability:67,change24h:3,volume:'$890K',signal:'BGP anomalies across Baltic states. APT-29 indicators detected. Pattern similar to 2022 pre-attack.',signalType:'Cyber Precursor',signalScore:78,country:'EU',flag:'🇪🇺',divergence:'MEDIUM',polymarketSlug:''},
]
export const MOCK_BRIEF = [
  {title:'Top Threat',icon:'alert',color:'#EF4444',tag:'CRITICAL',content:'Taiwan Strait naval convergence remains the highest-priority signal. 12+ vessels in unusual formation. Market has not priced this in — GeoEdge divergence flagged.'},
  {title:'Conflict Watch',icon:'ship',color:'#A78BFA',tag:'HIGH',content:'Ukraine frontlines stable overnight. Korean Peninsula military flights 3x above baseline for 3rd consecutive day. Iran domestic situation slowly calming.'},
  {title:'Cyber Landscape',icon:'wifi',color:'#22D3EE',tag:'MEDIUM',content:'Baltic internet anomalies ongoing. APT-41 actively targeting SE Asian financial sector. No major new ransomware campaigns in last 12h.'},
  {title:'Economic Signals',icon:'trending',color:'#10B981',tag:'INFO',content:'Polymarket odds on Iran nuclear collapse fell 4pts. Taiwan market 7pts underpriced vs 0rion signal composite.'},
  {title:'Your Watchlist',icon:'eye',color:'#60A5FA',tag:'UPDATE',content:'Ukraine (+3), N. Korea (+4), Taiwan (+5) all trending up. Nigeria and Iran stable. 44 signals across 5 tracked countries.'},
]
export const MOCK_HYPERLOCAL = {
  city:'Victoria Island',lga:'Lagos Island LGA',country:'Nigeria',flag:'🇳🇬',
  safetyScore:82,internetScore:76,trafficScore:46,infraScore:88,
  aiforecast:'Your area looks calm. Minor traffic delays near Eko Bridge expected until 18:00. Internet speeds may dip during evening peak. No security concerns within 5km.',
  nearbyEvents:[
    {id:'l1',title:'Internet slowdown reported',distanceKm:0.3,icon:'wifi',color:'#F59E0B',time:'14m ago',description:'Multiple users reporting slower speeds. Provider monitoring.'},
    {id:'l2',title:'Traffic disruption — Eko Bridge',distanceKm:1.2,icon:'alert',color:'#5A7A96',time:'32m ago',description:'Minor road works causing congestion. Expected to clear by 18:00.'},
    {id:'l3',title:'Security checkpoint active',distanceKm:2.8,icon:'shield',color:'#60A5FA',time:'1h ago',description:'Routine checkpoint on Ozumba Mbadiwe. Minor delays.'},
  ],
  riskPredictions:[
    {label:'Civil unrest (next 7 days)',probability:8,color:'#10B981'},
    {label:'Internet outage (next 24h)',probability:21,color:'#F59E0B'},
    {label:'Security incident (next 48h)',probability:5,color:'#10B981'},
    {label:'Power disruption (next 7 days)',probability:34,color:'#F59E0B'},
  ],
}
export const fetchEvents     = ()        => get('/api/events', MOCK_EVENTS)
export const fetchCII        = (codes=[])=> get(codes.length?`/api/cii?countries=${codes.join(',')}`:`/api/cii`, codes.length?MOCK_CII.filter(c=>codes.includes(c.code)):MOCK_CII)
export const fetchRegions    = ()        => get('/api/regions', MOCK_REGIONS)
export const fetchMarkets    = ()        => get('/api/geoedge', MOCK_MARKETS)
export const fetchBrief      = ()        => get('/api/brief', MOCK_BRIEF)
export const fetchHyperLocal = (lat,lon) => get(`/api/hyperlocal?lat=${lat}&lon=${lon}`, MOCK_HYPERLOCAL)
export async function reverseGeocode(lat, lon) {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,{signal:AbortSignal.timeout(5000)})
    const d = await res.json()
    return {city:d.address?.city||d.address?.town||d.address?.village||'Your Location',country:d.address?.country||'',flag:'📍'}
  } catch { return {city:'Your Location',country:'',flag:'📍'} }
}
