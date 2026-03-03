// 0rion Nigeria Screens
// NigeriaPulse, GovernmentWatch, PredictionEngine, NigeriaEconomy, Agriculture, CivicIQ

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  fetchNGEvents, fetchNGPredictions,
  MOCK_NG_EVENTS, MOCK_PREDICTIONS, MOCK_CIVIC,
} from '../api/nigeria'
import {
  fetchNairaRate, fetchCryptoPrices, fetchFuelPrices, fetchMarketPrices, submitFuelPrice, submitMarketPrice,
} from '../api/economy'
import { hasGroq } from '../lib/groq'

// ─── Design tokens (same as App.jsx) ─────────────────────
const BG='#0D1117',BGL='#141B24',SD='#070A0E',SL='rgba(255,255,255,0.06)'
const BGLOW='#60A5FA',CYAN='#22D3EE',WHITE='#E8F0FF',MUTED='#5A7A96'
const DANGER='#EF4444',WARNING='#F59E0B',SUCCESS='#10B981',PURPLE='#A78BFA',GREEN='#10B981'
const N={
  raised:`6px 6px 14px ${SD},-3px -3px 10px ${SL}`,
  raisedSm:`3px 3px 8px ${SD},-2px -2px 6px ${SL}`,
  inset:`inset 4px 4px 10px ${SD},inset -2px -2px 7px ${SL}`,
  insetSm:`inset 2px 2px 6px ${SD},inset -1px -1px 4px ${SL}`,
}

// ─── Shared mini components ───────────────────────────────
const IC = {
  alert:<><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>,
  bolt:<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>,
  brain:<path d="M9.5 2A2.5 2.5 0 007 4.5 2.5 2.5 0 004.5 7 2.5 2.5 0 002 9.5v5A2.5 2.5 0 004.5 17 2.5 2.5 0 007 19.5 2.5 2.5 0 009.5 22h5a2.5 2.5 0 002.5-2.5 2.5 2.5 0 002.5-2.5A2.5 2.5 0 0022 14.5v-5A2.5 2.5 0 0019.5 7 2.5 2.5 0 0017 4.5 2.5 2.5 0 0014.5 2z"/>,
  chevD:<polyline points="6 9 12 15 18 9"/>,
  chevU:<polyline points="18 15 12 9 6 15"/>,
  eye:<><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>,
  fire:<path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 2.5z"/>,
  refresh:<><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></>,
  shield:<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>,
  signal:<><path d="M2 20h.01M7 20v-4M12 20V10M17 20V4"/></>,
  trending:<><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></>,
  user:<><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></>,
  wifi:<><path d="M5 12.55a11 11 0 0114.08 0M1.42 9a16 16 0 0121.16 0M8.53 16.11a6 6 0 016.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></>,
  exLink:<><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></>,
  arrowUp:<><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></>,
  arrowDown:<><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></>,
  check:<polyline points="20 6 9 17 4 12"/>,
  book:<><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></>,
  share:<><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></>,
}

const Ico = ({n,s=16,c=WHITE,style={}}) => (
  <span style={{display:'inline-flex',alignItems:'center',flexShrink:0,...style}}>
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{IC[n]}</svg>
  </span>
)

const Surf = ({children,style={},inset=false,glow=false,glowC=BGLOW}) => (
  <div style={{
    background:`linear-gradient(145deg,${BGL},${BG})`,
    borderRadius:16,
    boxShadow: inset ? N.inset : glow ? `${N.raised},0 0 20px ${glowC}22` : N.raised,
    border:`1px solid ${SL}`,
    padding:16,
    ...style,
  }}>{children}</div>
)

const Bdg = ({label,color=BGLOW,dot=false}) => (
  <span style={{display:'inline-flex',alignItems:'center',gap:4,padding:'3px 8px',borderRadius:20,background:`${color}18`,border:`1px solid ${color}33`,fontSize:10,fontWeight:700,color,letterSpacing:'0.06em',textTransform:'uppercase',whiteSpace:'nowrap'}}>
    {dot&&<span style={{width:5,height:5,borderRadius:'50%',background:color,display:'inline-block'}}/>}
    {label}
  </span>
)

const Btn = ({children,onClick,variant='default',full=false,style={}}) => {
  const bg = variant==='primary' ? `linear-gradient(135deg,#3B82F6,#2563EB)`
           : variant==='green'   ? `linear-gradient(135deg,${SUCCESS},#059669)`
           : `linear-gradient(145deg,${BGL},${BG})`
  const col = variant==='primary'||variant==='green' ? '#fff' : MUTED
  return (
    <button onClick={onClick} style={{
      background:bg, color:col, border:'none', borderRadius:12,
      padding:'10px 16px', fontSize:12, fontWeight:600, cursor:'pointer',
      outline:'none', boxShadow: variant==='default'?N.raised:'none',
      width: full?'100%':'auto', ...style,
    }}>{children}</button>
  )
}

// Category pill
const CAT_COLORS = {security:'#EF4444',government:'#A78BFA',economy:'#F59E0B',agriculture:'#10B981',general:'#60A5FA',infrastructure:'#22D3EE',environment:'#34D399',rights:'#F472B6',civic:'#818CF8'}
const CatBdg = ({cat}) => <Bdg label={cat} color={CAT_COLORS[cat]||BGLOW}/>

// State badge
const StateBdg = ({state}) => (
  <span style={{fontSize:10,color:MUTED,background:`${BG}`,borderRadius:8,padding:'2px 7px',border:`1px solid ${SL}`,textTransform:'capitalize'}}>{state}</span>
)

// Time ago
function timeAgo(ts) {
  const diff = Date.now() - ts
  if (diff < 60000)   return 'just now'
  if (diff < 3600000) return `${Math.floor(diff/60000)}m ago`
  if (diff < 86400000)return `${Math.floor(diff/3600000)}h ago`
  return `${Math.floor(diff/86400000)}d ago`
}

// ─── Event card ───────────────────────────────────────────
function NGEventCard({ev, expanded, onToggle, pidgin}) {
  const sc = ev.severity==='CRITICAL'?DANGER:ev.severity==='HIGH'?WARNING:MUTED
  return (
    <Surf glow glowC={sc} style={{padding:0,overflow:'hidden',marginBottom:10}}>
      <div style={{height:2,background:`linear-gradient(90deg,${sc},${sc}44)`}}/>
      <div style={{padding:'13px 15px',cursor:'pointer'}} onClick={()=>onToggle(ev.id)}>
        <div style={{display:'flex',alignItems:'flex-start',gap:10}}>
          <div style={{flex:1}}>
            <div style={{display:'flex',flexWrap:'wrap',gap:5,marginBottom:6,alignItems:'center'}}>
              <CatBdg cat={ev.category}/>
              <StateBdg state={ev.state}/>
              {ev.severity==='CRITICAL'&&<Bdg label="CRITICAL" color={DANGER} dot/>}
              {ev.isLive&&<Bdg label="LIVE" color={SUCCESS} dot/>}
            </div>
            <div style={{fontWeight:700,fontSize:13,color:WHITE,lineHeight:1.4,marginBottom:4}}>{ev.title}</div>
            <div style={{fontSize:10,color:MUTED,display:'flex',gap:8,alignItems:'center'}}>
              <span>{timeAgo(ev.timestamp)}</span>
              {ev.source&&<><span>·</span><span>{ev.source}</span></>}
            </div>
          </div>
          <Ico n={expanded?'chevU':'chevD'} s={13} c={MUTED} style={{marginTop:2,flexShrink:0}}/>
        </div>
        {expanded&&(
          <div style={{marginTop:10,paddingTop:10,borderTop:`1px solid ${SL}`}}>
            <div style={{fontSize:12,color:MUTED,lineHeight:1.7,marginBottom:10}}>{ev.description}</div>
            {ev.link&&(
              <a href={ev.link} target="_blank" rel="noopener noreferrer" style={{display:'inline-flex',alignItems:'center',gap:5,fontSize:11,color:BGLOW,textDecoration:'none'}}>
                <Ico n="exLink" s={12} c={BGLOW}/>Read full story
              </a>
            )}
          </div>
        )}
      </div>
    </Surf>
  )
}

// ─── 1. NIGERIA PULSE ─────────────────────────────────────
export function NigeriaPulse({pidgin}) {
  const [events,setEvents]     = useState([])
  const [loading,setLoading]   = useState(true)
  const [filter,setFilter]     = useState('all')
  const [state,setState]       = useState('all')
  const [expanded,setExpanded] = useState(null)

  const FILTERS = [{id:'all',label:'All'},{id:'security',label:'🛡️ Security'},{id:'government',label:'🏛️ Govt'},{id:'economy',label:'💰 Economy'},{id:'agriculture',label:'🌾 Agric'}]
  const STATES  = ['all','lagos','abuja','kano','rivers','kaduna','edo','borno','oyo','delta','enugu','anambra']

  useEffect(() => {
    setLoading(true)
    fetchNGEvents('all').then(e => { setEvents(e); setLoading(false) })
    const t = setInterval(() => fetchNGEvents('all').then(setEvents), 5*60*1000)
    return () => clearInterval(t)
  }, [])

  const filtered = events.filter(e =>
    (filter==='all' || e.category===filter) &&
    (state==='all'  || e.state===state)
  )

  const toggle = useCallback(id => setExpanded(e => e===id?null:id), [])

  const critCount = events.filter(e=>e.severity==='CRITICAL').length

  return (
    <div style={{flex:1,overflowY:'auto',paddingBottom:8}}>
      {/* Header stats */}
      <div style={{display:'flex',gap:8,marginBottom:12}}>
        {[
          {label:'Incidents',value:events.length,color:BGLOW},
          {label:'Critical',value:critCount,color:DANGER},
          {label:'States',value:new Set(events.map(e=>e.state)).size,color:SUCCESS},
        ].map(s=>(
          <Surf key={s.label} style={{flex:1,padding:'10px 12px',textAlign:'center'}}>
            <div style={{fontSize:20,fontWeight:800,color:s.color,fontFamily:"'SF Mono',monospace"}}>{s.value}</div>
            <div style={{fontSize:10,color:MUTED,marginTop:2}}>{s.label}</div>
          </Surf>
        ))}
      </div>

      {/* Category filter */}
      <div style={{display:'flex',gap:6,overflowX:'auto',paddingBottom:4,marginBottom:10,scrollbarWidth:'none'}}>
        {FILTERS.map(f=>(
          <button key={f.id} onClick={()=>setFilter(f.id)} style={{
            padding:'7px 12px',borderRadius:20,border:'none',whiteSpace:'nowrap',
            background: filter===f.id ? `linear-gradient(135deg,#3B82F6,#2563EB)` : `linear-gradient(145deg,${BGL},${BG})`,
            color: filter===f.id ? '#fff' : MUTED,
            fontSize:11,fontWeight:600,cursor:'pointer',outline:'none',
            boxShadow: filter===f.id ? 'none' : N.raisedSm,
          }}>{f.label}</button>
        ))}
      </div>

      {/* State filter */}
      <div style={{display:'flex',gap:5,overflowX:'auto',paddingBottom:4,marginBottom:12,scrollbarWidth:'none'}}>
        {STATES.map(s=>(
          <button key={s} onClick={()=>setState(s)} style={{
            padding:'5px 10px',borderRadius:16,border:'none',whiteSpace:'nowrap',
            background: state===s ? `${BGLOW}22` : 'transparent',
            color: state===s ? BGLOW : MUTED,
            fontSize:10,fontWeight:600,cursor:'pointer',outline:'none',
            borderWidth:1,borderStyle:'solid',borderColor: state===s ? `${BGLOW}44` : 'transparent',
            textTransform:'capitalize',
          }}>{s==='all'?'All States':s.charAt(0).toUpperCase()+s.slice(1)}</button>
        ))}
      </div>

      {/* Event list */}
      {loading
        ? [1,2,3,4].map(i=><Surf key={i} style={{height:70,opacity:0.4,marginBottom:10}}/>)
        : filtered.length === 0
        ? <div style={{textAlign:'center',color:MUTED,padding:40,fontSize:13}}>No incidents match your filter.</div>
        : filtered.map(ev=><NGEventCard key={ev.id} ev={ev} expanded={expanded===ev.id} onToggle={toggle} pidgin={pidgin}/>)
      }
      <div style={{height:20}}/>
    </div>
  )
}

// ─── 2. GOVERNMENT WATCH ──────────────────────────────────
export function GovernmentWatch({pidgin}) {
  const [events,setEvents]     = useState([])
  const [loading,setLoading]   = useState(true)
  const [tab,setTab]           = useState('news')
  const [expanded,setExpanded] = useState(null)
  const toggle = useCallback(id=>setExpanded(e=>e===id?null:id),[])

  useEffect(()=>{
    fetchNGEvents('government').then(e=>{setEvents(e.filter(ev=>ev.category==='government'));setLoading(false)})
  },[])

  const BUDGET_ITEMS = [
    {sector:'Education',alloc:822.9,spent:61,color:'#60A5FA'},
    {sector:'Defence',alloc:2988.7,spent:78,color:'#EF4444'},
    {sector:'Health',alloc:1000.3,spent:54,color:'#10B981'},
    {sector:'Works & Housing',alloc:991.3,spent:47,color:'#F59E0B'},
    {sector:'Agriculture',alloc:248.2,spent:38,color:'#34D399'},
    {sector:'Power',alloc:350.0,spent:42,color:'#A78BFA'},
  ]

  const NASS_BILLS = [
    {title:'National Health Insurance Amendment Bill',status:'passed',date:'Feb 2026',impact:'Expands coverage to informal sector workers'},
    {title:'Electricity Act (Amendment) Bill',status:'passed',date:'Jan 2026',impact:'Allows private electricity trading between neighbours'},
    {title:'Social Media Regulation Bill',status:'reading',date:'Ongoing',impact:'Could restrict online speech — controversial'},
    {title:'Agricultural Development Fund Bill',status:'reading',date:'Ongoing',impact:'₦500bn fund for smallholder farmers'},
    {title:'Petroleum Industry Act (Amendment)',status:'assented',date:'Dec 2025',impact:'Changes gas flaring penalties'},
  ]

  const STATUS_COLOR = {passed:'#10B981',reading:'#F59E0B',assented:'#60A5FA',rejected:'#EF4444'}

  return (
    <div style={{flex:1,overflowY:'auto',paddingBottom:8}}>
      {/* Tabs */}
      <div style={{display:'flex',gap:6,marginBottom:14}}>
        {[{id:'news',label:'📰 News'},{id:'budget',label:'💰 Budget'},{id:'nass',label:'🏛️ NASS'}].map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{
            flex:1,padding:'9px 6px',borderRadius:12,border:'none',
            background: tab===t.id ? `linear-gradient(135deg,#3B82F6,#2563EB)` : `linear-gradient(145deg,${BGL},${BG})`,
            color: tab===t.id ? '#fff' : MUTED,
            fontSize:11,fontWeight:600,cursor:'pointer',outline:'none',
            boxShadow: tab===t.id ? 'none' : N.raisedSm,
          }}>{t.label}</button>
        ))}
      </div>

      {tab==='news'&&(
        loading
          ? [1,2,3].map(i=><Surf key={i} style={{height:70,opacity:0.4,marginBottom:10}}/>)
          : events.length===0
          ? <div style={{color:MUTED,textAlign:'center',padding:40}}>No government news found. Showing latest from archives.</div>
          : events.map(ev=><NGEventCard key={ev.id} ev={ev} expanded={expanded===ev.id} onToggle={toggle}/>)
      )}

      {tab==='budget'&&(
        <>
          <Surf style={{padding:'14px 16px',marginBottom:12}}>
            <div style={{fontSize:11,color:MUTED,letterSpacing:'0.08em',textTransform:'uppercase',fontFamily:"'SF Mono',monospace",marginBottom:4}}>2024 Federal Budget</div>
            <div style={{fontSize:22,fontWeight:800,color:WHITE}}>₦28.7 Trillion</div>
            <div style={{fontSize:11,color:WARNING,marginTop:2}}>Deficit: ₦9.18 trillion (32%)</div>
          </Surf>
          {BUDGET_ITEMS.map(item=>(
            <Surf key={item.sector} style={{padding:'12px 14px',marginBottom:8}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                <span style={{fontSize:13,fontWeight:600,color:WHITE}}>{item.sector}</span>
                <div style={{textAlign:'right'}}>
                  <div style={{fontSize:12,fontWeight:700,color:item.color}}>₦{item.alloc}bn</div>
                  <div style={{fontSize:10,color:MUTED}}>{item.spent}% spent</div>
                </div>
              </div>
              <div style={{height:5,borderRadius:3,background:SD,boxShadow:N.insetSm,overflow:'hidden'}}>
                <div style={{height:'100%',width:`${item.spent}%`,background:`linear-gradient(90deg,${item.color}77,${item.color})`,borderRadius:3,transition:'width 0.8s ease'}}/>
              </div>
            </Surf>
          ))}
          <Surf inset style={{padding:'12px 14px',borderRadius:12,marginTop:4}}>
            <div style={{fontSize:11,color:MUTED,lineHeight:1.6}}>
              Source: Budget Office of the Federation. Data updated quarterly. Track your state at{' '}
              <span style={{color:BGLOW}}>budgit.africa</span>
            </div>
          </Surf>
        </>
      )}

      {tab==='nass'&&(
        <>
          <Surf inset style={{padding:'11px 14px',borderRadius:12,marginBottom:12}}>
            <div style={{fontSize:12,color:MUTED,lineHeight:1.6}}>
              Bills currently in the National Assembly. Track your senator at{' '}
              <span style={{color:BGLOW}}>nassnigeria.gov.ng</span>
            </div>
          </Surf>
          {NASS_BILLS.map((bill,i)=>(
            <Surf key={i} style={{padding:'13px 15px',marginBottom:8}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:6}}>
                <div style={{flex:1,marginRight:8}}>
                  <div style={{fontSize:13,fontWeight:700,color:WHITE,marginBottom:4}}>{bill.title}</div>
                  <div style={{fontSize:11,color:MUTED,lineHeight:1.5}}>{bill.impact}</div>
                </div>
                <div style={{textAlign:'right',flexShrink:0}}>
                  <Bdg label={bill.status} color={STATUS_COLOR[bill.status]||BGLOW}/>
                  <div style={{fontSize:10,color:MUTED,marginTop:4}}>{bill.date}</div>
                </div>
              </div>
            </Surf>
          ))}
        </>
      )}
      <div style={{height:20}}/>
    </div>
  )
}

// ─── 3. PREDICTION ENGINE ─────────────────────────────────
export function PredictionEngine({pidgin}) {
  const [predictions,setPredictions] = useState([])
  const [loading,setLoading]         = useState(true)
  const [generating,setGenerating]   = useState(false)
  const [expanded,setExpanded]       = useState(null)
  const toggle = useCallback(id=>setExpanded(e=>e===id?null:id),[])

  useEffect(()=>{
    const load = async () => {
      setLoading(true)
      if (hasGroq) {
        setGenerating(true)
        const events = await fetchNGEvents('all')
        const preds  = await fetchNGPredictions(events)
        setPredictions(preds)
        setGenerating(false)
      } else {
        setPredictions(MOCK_PREDICTIONS)
      }
      setLoading(false)
    }
    load()
  },[])

  const bullish  = predictions.filter(p=>p.direction==='bullish').length
  const bearish  = predictions.filter(p=>p.direction==='bearish').length
  const overallSentiment = bearish > bullish ? 'CAUTIOUS' : bullish > bearish ? 'POSITIVE' : 'NEUTRAL'
  const sentimentColor   = bearish > bullish ? DANGER : bullish > bearish ? SUCCESS : WARNING

  return (
    <div style={{flex:1,overflowY:'auto',paddingBottom:8}}>
      {/* Header */}
      <Surf glow glowC={PURPLE} style={{padding:'16px 18px',marginBottom:14}}>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
          <div style={{width:38,height:38,borderRadius:12,background:`radial-gradient(circle at 35% 35%,${BGL},${BG})`,boxShadow:`${N.raisedSm},0 0 14px ${PURPLE}44`,display:'flex',alignItems:'center',justifyContent:'center'}}>
            <Ico n="brain" s={18} c={PURPLE} style={{filter:`drop-shadow(0 0 5px ${PURPLE})`}}/>
          </div>
          <div>
            <div style={{fontWeight:700,fontSize:14,color:WHITE}}>AI Prediction Engine</div>
            <div style={{fontSize:11,color:MUTED}}>Groq llama-3.3-70b · Nigerian context</div>
          </div>
          {hasGroq ? <Bdg label="LIVE AI" color={SUCCESS} dot/> : <Bdg label="DEMO" color={MUTED}/>}
        </div>
        {generating && (
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
            <Ico n="refresh" s={13} c={CYAN} style={{animation:'spin 0.9s linear infinite'}}/>
            <span style={{fontSize:11,color:CYAN}}>Analysing live Nigerian intelligence feeds...</span>
          </div>
        )}
        <div style={{display:'flex',gap:8}}>
          <div style={{flex:1,textAlign:'center'}}>
            <div style={{fontSize:18,fontWeight:800,color:sentimentColor}}>{overallSentiment}</div>
            <div style={{fontSize:10,color:MUTED}}>Outlook</div>
          </div>
          <div style={{flex:1,textAlign:'center'}}>
            <div style={{fontSize:18,fontWeight:800,color:DANGER}}>{bearish}</div>
            <div style={{fontSize:10,color:MUTED}}>Risk signals</div>
          </div>
          <div style={{flex:1,textAlign:'center'}}>
            <div style={{fontSize:18,fontWeight:800,color:SUCCESS}}>{bullish}</div>
            <div style={{fontSize:10,color:MUTED}}>Positive signals</div>
          </div>
        </div>
      </Surf>

      {/* Predictions */}
      {loading
        ? [1,2,3,4].map(i=><Surf key={i} style={{height:80,opacity:0.4,marginBottom:10}}/>)
        : predictions.map((p,i)=>(
          <Surf key={p.id||i} style={{padding:0,overflow:'hidden',marginBottom:10}} glow glowC={p.color}>
            <div style={{height:2,background:`linear-gradient(90deg,${p.color},${p.color}33)`}}/>
            <div style={{padding:'13px 15px',cursor:'pointer'}} onClick={()=>toggle(p.id||i)}>
              <div style={{display:'flex',alignItems:'center',gap:10}}>
                <div style={{width:36,height:36,borderRadius:11,background:`radial-gradient(circle at 35% 35%,${BGL},${BG})`,boxShadow:`${N.raisedSm},0 0 10px ${p.color}33`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                  <Ico n={p.icon||'signal'} s={16} c={p.color} style={{filter:`drop-shadow(0 0 4px ${p.color})`}}/>
                </div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:13,color:WHITE,marginBottom:4}}>{p.title}</div>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <div style={{flex:1,height:6,borderRadius:3,background:SD,boxShadow:N.insetSm,overflow:'hidden'}}>
                      <div style={{height:'100%',width:`${p.probability}%`,background:`linear-gradient(90deg,${p.color}77,${p.color})`,borderRadius:3}}/>
                    </div>
                    <span style={{fontSize:13,fontWeight:800,color:p.color,fontFamily:"'SF Mono',monospace",flexShrink:0,minWidth:36}}>{p.probability}%</span>
                  </div>
                </div>
                <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:4,flexShrink:0}}>
                  <Bdg label={p.confidence} color={p.color}/>
                  <div style={{display:'flex',alignItems:'center',gap:3}}>
                    <Ico n={p.direction==='bullish'?'arrowUp':p.direction==='bearish'?'arrowDown':'signal'} s={11} c={p.direction==='bullish'?SUCCESS:p.direction==='bearish'?DANGER:WARNING}/>
                    <span style={{fontSize:9,color:p.direction==='bullish'?SUCCESS:p.direction==='bearish'?DANGER:WARNING,fontWeight:700,textTransform:'uppercase'}}>{p.direction}</span>
                  </div>
                </div>
              </div>
              {expanded===(p.id||i)&&(
                <div style={{marginTop:10,paddingTop:10,borderTop:`1px solid ${SL}`}}>
                  <div style={{fontSize:11,color:MUTED,fontWeight:600,letterSpacing:'0.08em',textTransform:'uppercase',marginBottom:6}}>What to do</div>
                  <Surf inset style={{padding:'10px 12px',borderRadius:10}}>
                    <div style={{fontSize:12,color:WHITE,lineHeight:1.6}}>{p.what}</div>
                  </Surf>
                  <div style={{fontSize:10,color:MUTED,marginTop:6,textAlign:'center'}}>
                    AI prediction · Not financial/security advice
                  </div>
                </div>
              )}
            </div>
          </Surf>
        ))
      }
      {!hasGroq&&(
        <Surf inset style={{padding:'12px 14px',borderRadius:12,marginTop:4}}>
          <div style={{fontSize:11,color:MUTED,textAlign:'center'}}>Add VITE_GROQ_API_KEY for live AI predictions based on real Nigerian events.</div>
        </Surf>
      )}
      <div style={{height:20}}/>
    </div>
  )
}

// ─── 4. NIGERIA ECONOMY ───────────────────────────────────
export function NigeriaEconomy({ pidgin, user }) {
  const [rates,      setRates]      = useState(null)
  const [crypto,     setCrypto]     = useState(null)
  const [fuelPrices, setFuelPrices] = useState([])
  const [mktPrices,  setMktPrices]  = useState([])
  const [loading,    setLoading]    = useState(true)
  const [tab,        setTab]        = useState('overview')
  const [showReport, setShowReport] = useState(false)
  const [reportType, setReportType] = useState('fuel')
  const [reportForm, setReportForm] = useState({ product:'PMS', price:'', state:'', station:'', item:'', unit:'kg', market:'' })
  const [submitting, setSubmitting] = useState(false)
  const [submitDone, setSubmitDone] = useState(false)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const [r, c, f, m] = await Promise.allSettled([
        fetchNairaRate(),
        fetchCryptoPrices(),
        fetchFuelPrices(),
        fetchMarketPrices(),
      ])
      if (r.status === 'fulfilled') setRates(r.value)
      if (c.status === 'fulfilled') setCrypto(c.value)
      if (f.status === 'fulfilled') setFuelPrices(f.value.prices || [])
      if (m.status === 'fulfilled') setMktPrices(m.value.prices || [])
      setLoading(false)
    }
    load()
    const t = setInterval(load, 10 * 60 * 1000) // refresh every 10 mins
    return () => clearInterval(t)
  }, [])

  const handleSubmitPrice = async () => {
    if (!user) return
    setSubmitting(true)
    let ok = false
    if (reportType === 'fuel') {
      ok = await submitFuelPrice({ ...reportForm, userId: user.id })
    } else {
      ok = await submitMarketPrice({ ...reportForm, userId: user.id })
    }
    setSubmitting(false)
    if (ok) {
      setSubmitDone(true)
      setShowReport(false)
      setTimeout(() => setSubmitDone(false), 3000)
      // Refresh
      const [f, m] = await Promise.allSettled([fetchFuelPrices(), fetchMarketPrices()])
      if (f.status === 'fulfilled') setFuelPrices(f.value.prices || [])
      if (m.status === 'fulfilled') setMktPrices(m.value.prices || [])
    }
  }

  // Group fuel prices by product, take latest per state
  const fuelByProduct = {}
  fuelPrices.forEach(p => {
    if (!fuelByProduct[p.product]) fuelByProduct[p.product] = []
    fuelByProduct[p.product].push(p)
  })

  // Group market prices by item
  const mktByItem = {}
  mktPrices.forEach(p => {
    if (!mktByItem[p.item]) mktByItem[p.item] = []
    mktByItem[p.item].push(p)
  })

  function avgPrice(arr) {
    if (!arr?.length) return null
    return Math.round(arr.reduce((s, x) => s + Number(x.price), 0) / arr.length)
  }

  function timeAgo(ts) {
    const d = Date.now() - new Date(ts).getTime()
    if (d < 3600000) return `${Math.floor(d/60000)}m ago`
    if (d < 86400000) return `${Math.floor(d/3600000)}h ago`
    return `${Math.floor(d/86400000)}d ago`
  }

  const Spinner = () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: 11, color: MUTED, animation: 'spin 1s linear infinite', display: 'inline-block' }}>↻</span>
      <span style={{ fontSize: 11, color: MUTED }}>Loading live data...</span>
    </div>
  )

  return (
    <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 8 }}>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {[{ id: 'overview', label: '📊 Rates' }, { id: 'fuel', label: '⛽ Fuel' }, { id: 'market', label: '🛒 Market' }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, padding: '9px 6px', borderRadius: 12, border: 'none',
            background: tab === t.id ? `linear-gradient(135deg,#F59E0B,#D97706)` : `linear-gradient(145deg,${BGL},${BG})`,
            color: tab === t.id ? '#fff' : MUTED,
            fontSize: 11, fontWeight: 600, cursor: 'pointer', outline: 'none',
            boxShadow: tab === t.id ? 'none' : N.raisedSm,
          }}>{t.label}</button>
        ))}
      </div>

      {submitDone && (
        <Surf style={{ padding: '10px 14px', marginBottom: 12, background: `${SUCCESS}18`, border: `1px solid ${SUCCESS}44` }}>
          <span style={{ fontSize: 12, color: SUCCESS }}>✅ Price submitted — thank you for helping your community!</span>
        </Surf>
      )}

      {tab === 'overview' && (
        <>
          {/* Official Naira Rate */}
          <Surf glow glowC={WARNING} style={{ padding: '16px 18px', marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: MUTED, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Naira / US Dollar</div>
              {rates?.live
                ? <Bdg label="LIVE" color={SUCCESS} dot />
                : <Bdg label="OFFLINE" color={MUTED} />}
            </div>
            {loading ? <Spinner /> : rates?.official ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: WHITE }}>₦{rates.official.toLocaleString()}</div>
                <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>Official CBN Rate · {rates.source}</div>
                <div style={{ fontSize: 10, color: MUTED, marginTop: 2 }}>Updated: {rates.date}</div>
              </div>
            ) : <div style={{ fontSize: 12, color: MUTED }}>Rate unavailable — check your connection.</div>}
            <Surf inset style={{ padding: '9px 12px', borderRadius: 10, marginTop: 12 }}>
              <div style={{ fontSize: 11, color: MUTED, lineHeight: 1.6 }}>
                Parallel market rate is crowd-reported. Go to the <span style={{ color: BGLOW }}>Fuel tab</span> to submit a rate you've seen today.
              </div>
            </Surf>
          </Surf>

          {/* Crypto */}
          <Surf style={{ padding: '14px 16px', marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: MUTED, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Cryptocurrency</div>
              {crypto?.live ? <Bdg label="LIVE" color={SUCCESS} dot /> : <Bdg label="OFFLINE" color={MUTED} />}
            </div>
            {loading ? <Spinner /> : (
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: MUTED, marginBottom: 2 }}>₿ Bitcoin</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: WARNING }}>
                    {crypto?.btc_ngn ? `₦${(crypto.btc_ngn / 1000000).toFixed(1)}M` : 'N/A'}
                  </div>
                  <div style={{ fontSize: 10, color: MUTED }}>${crypto?.btc_usd?.toLocaleString() || 'N/A'}</div>
                </div>
                <div style={{ width: 1, background: SL }} />
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: MUTED, marginBottom: 2 }}>Ξ Ethereum</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: BGLOW }}>
                    {crypto?.eth_ngn ? `₦${(crypto.eth_ngn / 1000).toFixed(0)}K` : 'N/A'}
                  </div>
                  <div style={{ fontSize: 10, color: MUTED }}>${crypto?.eth_usd?.toLocaleString() || 'N/A'}</div>
                </div>
                <div style={{ width: 1, background: SL }} />
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: MUTED, marginBottom: 2 }}>₮ USDT</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: SUCCESS }}>
                    {crypto?.usdt_ngn ? `₦${Math.round(crypto.usdt_ngn).toLocaleString()}` : 'N/A'}
                  </div>
                  <div style={{ fontSize: 10, color: MUTED }}>per dollar</div>
                </div>
              </div>
            )}
          </Surf>

          <Surf inset style={{ padding: '11px 14px', borderRadius: 12 }}>
            <div style={{ fontSize: 11, color: MUTED, lineHeight: 1.6 }}>
              Rates are live from ECB (official) and CoinGecko (crypto). For NGX stocks visit{' '}
              <span style={{ color: BGLOW }}>ngxgroup.com</span>
            </div>
          </Surf>
        </>
      )}

      {tab === 'fuel' && (
        <>
          {/* Crowd-reported fuel prices */}
          <Surf style={{ padding: '13px 15px', marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: WHITE }}>⛽ Crowd-Reported Fuel Prices</div>
                <div style={{ fontSize: 10, color: MUTED, marginTop: 2 }}>Submitted by 0rion users across Nigeria</div>
              </div>
              <Bdg label="👥 LIVE" color={SUCCESS} dot />
            </div>
            {fuelPrices.length === 0 ? (
              <div style={{ padding: '20px 0', textAlign: 'center' }}>
                <div style={{ fontSize: 13, color: MUTED, marginBottom: 8 }}>No prices reported yet.</div>
                <div style={{ fontSize: 11, color: MUTED }}>Be the first to report a price from your filling station!</div>
              </div>
            ) : (
              Object.entries(fuelByProduct).map(([product, prices]) => (
                <div key={product} style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: WARNING, fontWeight: 700, marginBottom: 6 }}>{product}</div>
                  {prices.slice(0, 5).map((p, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: i < prices.length - 1 ? `1px solid ${SL}` : 'none' }}>
                      <div>
                        <span style={{ fontSize: 12, color: WHITE, fontWeight: 600 }}>{p.station || 'Filling Station'}</span>
                        <span style={{ fontSize: 10, color: MUTED, marginLeft: 6, textTransform: 'capitalize' }}>{p.state} · {p.lga}</span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: WARNING }}>₦{Number(p.price).toLocaleString()}/L</div>
                        <div style={{ fontSize: 9, color: MUTED }}>{timeAgo(p.created_at)}</div>
                      </div>
                    </div>
                  ))}
                  <div style={{ fontSize: 10, color: MUTED, marginTop: 4 }}>
                    Average: <span style={{ color: WARNING, fontWeight: 700 }}>₦{avgPrice(prices)?.toLocaleString()}/L</span> from {prices.length} report{prices.length !== 1 ? 's' : ''}
                  </div>
                </div>
              ))
            )}
          </Surf>
          <Btn full variant="primary" onClick={() => { setReportType('fuel'); setShowReport(true) }}
            style={{ background: `linear-gradient(135deg,#F59E0B,#D97706)`, marginBottom: 8 }}>
            ⛽ Report Fuel Price Near You
          </Btn>
        </>
      )}

      {tab === 'market' && (
        <>
          <Surf style={{ padding: '13px 15px', marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: WHITE }}>🛒 Crowd-Reported Market Prices</div>
                <div style={{ fontSize: 10, color: MUTED, marginTop: 2 }}>Submitted by 0rion users from local markets</div>
              </div>
              <Bdg label="👥 LIVE" color={SUCCESS} dot />
            </div>
            {mktPrices.length === 0 ? (
              <div style={{ padding: '20px 0', textAlign: 'center' }}>
                <div style={{ fontSize: 13, color: MUTED, marginBottom: 8 }}>No prices reported yet.</div>
                <div style={{ fontSize: 11, color: MUTED }}>Report what you saw in your market today!</div>
              </div>
            ) : (
              Object.entries(mktByItem).slice(0, 15).map(([item, prices]) => (
                <div key={item} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${SL}` }}>
                  <div>
                    <span style={{ fontSize: 12, color: WHITE, fontWeight: 600, textTransform: 'capitalize' }}>{item}</span>
                    <span style={{ fontSize: 10, color: MUTED, marginLeft: 6 }}>per {prices[0]?.unit || 'unit'}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: WHITE }}>₦{avgPrice(prices)?.toLocaleString()}</div>
                    <div style={{ fontSize: 9, color: MUTED }}>{prices.length} report{prices.length !== 1 ? 's' : ''} · {timeAgo(prices[0].created_at)}</div>
                  </div>
                </div>
              ))
            )}
          </Surf>
          <Btn full variant="primary" onClick={() => { setReportType('market'); setShowReport(true) }}
            style={{ background: `linear-gradient(135deg,#10B981,#059669)`, marginBottom: 8 }}>
            🛒 Report Market Price Near You
          </Btn>
        </>
      )}

      {/* Price report modal */}
      {showReport && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: `${BG}EE`, display: 'flex', alignItems: 'flex-end', padding: 16 }}>
          <div style={{ width: '100%', maxWidth: 480, margin: '0 auto', background: `linear-gradient(145deg,${BGL},${BG})`, borderRadius: 20, padding: 20, border: `1px solid ${SL}`, boxShadow: N.raised }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: WHITE }}>{reportType === 'fuel' ? '⛽ Report Fuel Price' : '🛒 Report Market Price'}</div>
              <button onClick={() => setShowReport(false)} style={{ background: 'none', border: 'none', color: MUTED, fontSize: 20, cursor: 'pointer', outline: 'none' }}>×</button>
            </div>
            {reportType === 'fuel' ? (
              <>
                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                  {['PMS', 'AGO', 'LPG'].map(p => (
                    <button key={p} onClick={() => setReportForm(f => ({ ...f, product: p }))} style={{
                      flex: 1, padding: '8px', borderRadius: 10, border: 'none', cursor: 'pointer', outline: 'none',
                      background: reportForm.product === p ? `${WARNING}22` : `linear-gradient(145deg,${BGL},${BG})`,
                      color: reportForm.product === p ? WARNING : MUTED,
                      fontSize: 12, fontWeight: 700,
                      borderWidth: 1, borderStyle: 'solid', borderColor: reportForm.product === p ? `${WARNING}44` : 'transparent',
                    }}>{p}</button>
                  ))}
                </div>
                <input placeholder="Price per litre (₦)" type="number" value={reportForm.price} onChange={e => setReportForm(f => ({ ...f, price: e.target.value }))} style={{ width: '100%', background: SD, border: `1px solid ${SL}`, borderRadius: 10, color: WHITE, padding: '10px 12px', fontSize: 12, outline: 'none', fontFamily: 'inherit', marginBottom: 8 }} />
                <input placeholder="Station name (optional)" value={reportForm.station} onChange={e => setReportForm(f => ({ ...f, station: e.target.value }))} style={{ width: '100%', background: SD, border: `1px solid ${SL}`, borderRadius: 10, color: WHITE, padding: '10px 12px', fontSize: 12, outline: 'none', fontFamily: 'inherit', marginBottom: 8 }} />
              </>
            ) : (
              <>
                <input placeholder="Item name (e.g. Rice, Tomato, Chicken)" value={reportForm.item} onChange={e => setReportForm(f => ({ ...f, item: e.target.value }))} style={{ width: '100%', background: SD, border: `1px solid ${SL}`, borderRadius: 10, color: WHITE, padding: '10px 12px', fontSize: 12, outline: 'none', fontFamily: 'inherit', marginBottom: 8 }} />
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <input placeholder="Price (₦)" type="number" value={reportForm.price} onChange={e => setReportForm(f => ({ ...f, price: e.target.value }))} style={{ flex: 1, background: SD, border: `1px solid ${SL}`, borderRadius: 10, color: WHITE, padding: '10px 12px', fontSize: 12, outline: 'none', fontFamily: 'inherit' }} />
                  <select value={reportForm.unit} onChange={e => setReportForm(f => ({ ...f, unit: e.target.value }))} style={{ flex: 1, background: SD, border: `1px solid ${SL}`, borderRadius: 10, color: WHITE, padding: '10px 12px', fontSize: 12, outline: 'none', fontFamily: 'inherit' }}>
                    {['kg', 'bag', 'basket', 'tuber', 'litre', 'carton', 'dozen', 'piece'].map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <input placeholder="Market name (optional)" value={reportForm.market} onChange={e => setReportForm(f => ({ ...f, market: e.target.value }))} style={{ width: '100%', background: SD, border: `1px solid ${SL}`, borderRadius: 10, color: WHITE, padding: '10px 12px', fontSize: 12, outline: 'none', fontFamily: 'inherit', marginBottom: 8 }} />
              </>
            )}
            <input placeholder="Your state (e.g. Edo)" value={reportForm.state} onChange={e => setReportForm(f => ({ ...f, state: e.target.value }))} style={{ width: '100%', background: SD, border: `1px solid ${SL}`, borderRadius: 10, color: WHITE, padding: '10px 12px', fontSize: 12, outline: 'none', fontFamily: 'inherit', marginBottom: 12 }} />
            <button onClick={handleSubmitPrice} disabled={!reportForm.price || submitting} style={{
              width: '100%', padding: 12, borderRadius: 12, border: 'none', cursor: 'pointer', outline: 'none',
              background: `linear-gradient(135deg,#F59E0B,#D97706)`, color: '#fff', fontSize: 13, fontWeight: 700,
              opacity: submitting || !reportForm.price ? 0.6 : 1,
            }}>{submitting ? 'Submitting...' : '✅ Submit Price'}</button>
            {!user && <div style={{ fontSize: 11, color: DANGER, textAlign: 'center', marginTop: 8 }}>You must be signed in to submit prices.</div>}
          </div>
        </div>
      )}

      <div style={{ height: 20 }} />
    </div>
  )
}

// ─── 5. AGRICULTURE ───────────────────────────────────────
export function Agriculture({pidgin}) {
  const [events,setEvents]     = useState([])
  const [loading,setLoading]   = useState(true)
  const [expanded,setExpanded] = useState(null)
  const toggle = useCallback(id=>setExpanded(e=>e===id?null:id),[])

  useEffect(()=>{
    fetchNGEvents('agriculture').then(e=>{
      setEvents(e.filter(ev=>ev.category==='agriculture'))
      setLoading(false)
    })
  },[])

  const SEASONS = [
    {zone:'North-West & North-East',crop:'Millet, Sorghum, Groundnut',status:'Dry season — harvest complete',color:SUCCESS},
    {zone:'North-Central (Benue, Kogi)',crop:'Yam, Rice, Soybean',status:'Land prep begins March',color:WARNING},
    {zone:'South-West',crop:'Cocoa, Cassava, Maize',status:'Rainy season starts April',color:BGLOW},
    {zone:'South-South & South-East',crop:'Palm Oil, Yam, Cassava',status:'Year-round farming possible',color:SUCCESS},
  ]

  const FOOD_SECURITY = [
    {state:'Borno',level:'CRISIS',color:DANGER,pop:'4.2M affected'},
    {state:'Yobe',level:'STRESSED',color:WARNING,pop:'1.8M affected'},
    {state:'Adamawa',level:'STRESSED',color:WARNING,pop:'1.2M affected'},
    {state:'Zamfara',level:'STRESSED',color:WARNING,pop:'900K affected'},
    {state:'Lagos',level:'MINIMAL',color:SUCCESS,pop:'Stable'},
    {state:'Rivers',level:'MINIMAL',color:SUCCESS,pop:'Stable'},
  ]

  return (
    <div style={{flex:1,overflowY:'auto',paddingBottom:8}}>
      {/* Food security map */}
      <Surf style={{padding:'14px 16px',marginBottom:12}}>
        <div style={{fontSize:11,color:MUTED,letterSpacing:'0.08em',textTransform:'uppercase',marginBottom:10}}>Food Security by State</div>
        {FOOD_SECURITY.map((s,i)=>(
          <div key={i} style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <div style={{width:8,height:8,borderRadius:'50%',background:s.color,boxShadow:`0 0 6px ${s.color}`}}/>
              <span style={{fontSize:12,color:WHITE,fontWeight:600}}>{s.state}</span>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <span style={{fontSize:10,color:MUTED}}>{s.pop}</span>
              <Bdg label={s.level} color={s.color}/>
            </div>
          </div>
        ))}
        <div style={{fontSize:10,color:MUTED,marginTop:6}}>Source: IPC/FEWS NET Nigeria Report</div>
      </Surf>

      {/* Farming seasons */}
      <div style={{fontSize:11,color:MUTED,fontWeight:600,letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:8}}>Farming Calendar — March 2026</div>
      {SEASONS.map((s,i)=>(
        <Surf key={i} style={{padding:'12px 14px',marginBottom:8}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:4}}>
            <div style={{fontWeight:600,fontSize:12,color:WHITE,flex:1,marginRight:8}}>{s.zone}</div>
            <Bdg label={s.status.split('—')[0].trim()} color={s.color}/>
          </div>
          <div style={{fontSize:11,color:MUTED}}>{s.crop}</div>
          <div style={{fontSize:11,color:s.color,marginTop:2}}>{s.status}</div>
        </Surf>
      ))}

      {/* Agric news */}
      <div style={{fontSize:11,color:MUTED,fontWeight:600,letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:8,marginTop:14}}>Agriculture News</div>
      {loading
        ? [1,2].map(i=><Surf key={i} style={{height:60,opacity:0.4,marginBottom:8}}/>)
        : events.slice(0,6).map(ev=><NGEventCard key={ev.id} ev={ev} expanded={expanded===ev.id} onToggle={toggle}/>)
      }

      <Surf inset style={{padding:'12px 14px',borderRadius:12,marginTop:8}}>
        <div style={{fontSize:11,color:MUTED,lineHeight:1.6}}>
          Report farm incidents or food shortages in your community by calling the Agricultural Hotline:{' '}
          <span style={{color:BGLOW}}>0800-FARMERS (0800-3276377)</span>
        </div>
      </Surf>
      <div style={{height:20}}/>
    </div>
  )
}

// ─── 6. CIVIC IQ ──────────────────────────────────────────
function CivicCard({item, expanded, onToggle}) {
  return (
    <Surf glow glowC={CAT_COLORS[item.category]||BGLOW} style={{padding:0,overflow:'hidden',marginBottom:10}}>
      <div style={{padding:'14px 16px',cursor:'pointer'}} onClick={()=>onToggle(item.id)}>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:expanded?12:0}}>
          <div style={{fontSize:24,flexShrink:0}}>{item.emoji}</div>
          <div style={{flex:1}}>
            <div style={{fontWeight:700,fontSize:13,color:WHITE,lineHeight:1.3,marginBottom:4}}>{item.title}</div>
            <div style={{display:'flex',gap:6,alignItems:'center'}}>
              <CatBdg cat={item.category}/>
              <span style={{fontSize:10,color:MUTED}}>📖 {item.readTime}</span>
            </div>
          </div>
          <Ico n={expanded?'chevU':'chevD'} s={13} c={MUTED}/>
        </div>
        {expanded&&(
          <div style={{paddingTop:12,borderTop:`1px solid ${SL}`}}>
            <div style={{fontSize:12,color:MUTED,lineHeight:1.8,whiteSpace:'pre-line'}}>{item.content}</div>
            <div style={{display:'flex',gap:8,marginTop:12}}>
              <Btn variant="primary" style={{flex:1,fontSize:11}} onClick={e=>{e.stopPropagation();if(navigator.share){navigator.share({title:item.title,text:item.content.slice(0,200)+'...',url:window.location.href})}}}>
                <span style={{display:'flex',alignItems:'center',justifyContent:'center',gap:5}}><Ico n="share" s={12} c="#fff"/>Share on WhatsApp</span>
              </Btn>
            </div>
          </div>
        )}
      </div>
    </Surf>
  )
}

export function CivicIQ({pidgin}) {
  const [expanded,setExpanded] = useState(null)
  const [search,setSearch]     = useState('')
  const [filter,setFilter]     = useState('all')
  const toggle = useCallback(id=>setExpanded(e=>e===id?null:id),[])

  const FILTERS = [{id:'all',label:'All'},{id:'government',label:'🏛️ Govt'},{id:'rights',label:'⚖️ Rights'},{id:'safety',label:'🚨 Safety'},{id:'civic',label:'🇳🇬 Civic'}]

  const filtered = MOCK_CIVIC.filter(c =>
    (filter==='all' || c.category===filter) &&
    (search==='' || c.title.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div style={{flex:1,overflowY:'auto',paddingBottom:8}}>
      {/* Header */}
      <Surf style={{padding:'14px 16px',marginBottom:12}}>
        <div style={{fontWeight:700,fontSize:15,color:WHITE,marginBottom:4}}>Civic IQ</div>
        <div style={{fontSize:12,color:MUTED,lineHeight:1.6,marginBottom:12}}>
          Everything every Nigerian should know — in plain language. Share with friends and family on WhatsApp.
        </div>
        {/* Search */}
        <div style={{background:SD,borderRadius:10,padding:'9px 12px',boxShadow:N.insetSm,display:'flex',alignItems:'center',gap:8}}>
          <span style={{fontSize:13}}>🔍</span>
          <input
            value={search}
            onChange={e=>setSearch(e.target.value)}
            placeholder="Search topics..."
            style={{background:'none',border:'none',outline:'none',color:WHITE,fontSize:12,width:'100%',fontFamily:"inherit"}}
          />
        </div>
      </Surf>

      {/* Filter */}
      <div style={{display:'flex',gap:6,overflowX:'auto',paddingBottom:4,marginBottom:12,scrollbarWidth:'none'}}>
        {FILTERS.map(f=>(
          <button key={f.id} onClick={()=>setFilter(f.id)} style={{
            padding:'7px 12px',borderRadius:20,border:'none',whiteSpace:'nowrap',
            background: filter===f.id ? `linear-gradient(135deg,#3B82F6,#2563EB)` : `linear-gradient(145deg,${BGL},${BG})`,
            color: filter===f.id ? '#fff' : MUTED,
            fontSize:11,fontWeight:600,cursor:'pointer',outline:'none',
            boxShadow: filter===f.id ? 'none' : N.raisedSm,
          }}>{f.label}</button>
        ))}
      </div>

      {/* Cards */}
      {filtered.length===0
        ? <div style={{textAlign:'center',color:MUTED,padding:40}}>No articles match your search.</div>
        : filtered.map(item=><CivicCard key={item.id} item={item} expanded={expanded===item.id} onToggle={toggle}/>)
      }

      {/* Suggest topics */}
      <Surf inset style={{padding:'12px 14px',borderRadius:12,marginTop:4}}>
        <div style={{fontSize:11,color:MUTED,lineHeight:1.6,textAlign:'center'}}>
          Want to suggest a topic? Email us at{' '}
          <span style={{color:BGLOW}}>civic@0rion.app</span>
        </div>
      </Surf>
      <div style={{height:20}}/>
    </div>
  )
}
