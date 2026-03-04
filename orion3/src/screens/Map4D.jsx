// 0rion 4D Intelligence Map — v2
// worldmonitor-inspired: dark tiles, marker clustering, bounded zoom,
// progressive layers, real GPS coords, authenticated community reports

import { useState, useEffect, useRef, useCallback } from 'react'
import { fetchNGEvents } from '../api/nigeria'
import { fetchEvents } from '../api/worldmonitor'
import { fetchAllReports, subscribeToReports, getIncidentType, INCIDENT_TYPES, submitReport, verifyReport } from '../api/reports'
import { supabase } from '../lib/supabase'

// ─── Design tokens ──────────────────────────────────────────
const BG='#0D1117',BGL='#141B24',SD='#070A0E',SL='rgba(255,255,255,0.06)'
const BGLOW='#60A5FA',WHITE='#E8F0FF',MUTED='#5A7A96'
const DANGER='#EF4444',WARNING='#F59E0B',SUCCESS='#10B981',PURPLE='#A78BFA'
const N={raised:`6px 6px 14px ${SD},-3px -3px 10px ${SL}`,raisedSm:`3px 3px 8px ${SD},-2px -2px 6px ${SL}`}
const SEV_COLOR={CRITICAL:DANGER,HIGH:WARNING,MEDIUM:BGLOW,LOW:MUTED}

// ─── Real coordinates ────────────────────────────────────────
const GEO={
  'Ukraine':[48.379,31.165],'Russia':[55.751,37.618],'Taiwan':[23.698,120.960],
  'China':[39.916,116.383],'Israel':[31.768,35.213],'Gaza':[31.354,34.308],
  'Iran':[35.689,51.389],'Lebanon':[33.889,35.502],'Syria':[33.510,36.292],
  'Iraq':[33.341,44.401],'Yemen':[15.369,44.191],'Sudan':[15.557,32.553],
  'Ethiopia':[9.145,40.489],'Somalia':[2.046,45.342],'Libya':[32.902,13.180],
  'Mali':[12.652,-8.001],'Myanmar':[16.800,96.157],'Afghanistan':[34.525,69.178],
  'Pakistan':[33.738,73.084],'India':[28.614,77.202],'N. Korea':[39.032,125.754],
  'S. Korea':[37.566,126.978],'Japan':[35.689,139.691],'Philippines':[14.599,120.984],
  'Venezuela':[10.491,-66.879],'Colombia':[4.711,-74.073],'Haiti':[18.543,-72.338],
  'Mexico':[19.433,-99.133],'USA':[38.907,-77.037],'Europe':[52.520,13.405],
  'Germany':[52.520,13.405],'France':[48.857,2.352],'UK':[51.507,-0.128],
  'Nigeria':[9.082,8.675],'Kenya':[-1.286,36.820],'Egypt':[30.044,31.236],
  'Sudan':[15.557,32.553],'Congo':[-4.322,15.322],'Saudi Arabia':[24.688,46.724],
  'UAE':[24.466,54.367],'Turkey':[39.921,32.854],'Brazil':[-15.780,-47.930],
  'Argentina':[-34.614,-58.443],'Global':[20,0],
}
const NG_STATES={
  'lagos':[6.455,3.384],'abuja':[9.058,7.495],'kano':[12.000,8.517],
  'rivers':[4.825,7.034],'kaduna':[10.516,7.440],'edo':[6.312,5.616],
  'borno':[11.833,13.151],'oyo':[7.388,3.905],'delta':[5.654,5.830],
  'enugu':[6.441,7.498],'anambra':[6.212,7.069],'imo':[5.572,7.058],
  'kogi':[7.800,6.741],'plateau':[9.218,9.518],'niger':[9.638,5.991],
  'zamfara':[12.170,6.221],'kebbi':[12.452,4.199],'sokoto':[13.064,5.244],
  'kwara':[8.967,4.387],'ogun':[7.160,3.347],'ondo':[7.252,5.195],
  'ekiti':[7.719,5.311],'osun':[7.563,4.559],'benue':[7.340,8.130],
  'nassarawa':[8.497,8.520],'bauchi':[10.313,9.844],'gombe':[10.290,11.167],
  'adamawa':[9.326,12.395],'yobe':[12.294,11.439],'taraba':[7.999,10.773],
  'cross river':[5.871,8.599],'akwa ibom':[4.905,7.853],'abia':[5.416,7.505],
  'bayelsa':[4.772,6.065],'federal':[9.058,7.495],
}

// ─── Leaflet + MarkerCluster loader ─────────────────────────
function useLeaflet(onReady) {
  useEffect(()=>{
    const load=(urls,cb)=>{
      let i=0
      const next=()=>{ if(i>=urls.length){cb();return}; const s=document.createElement('script'); s.src=urls[i++]; s.onload=next; document.head.appendChild(s) }
      next()
    }
    if(!document.getElementById('lf-css')){
      const c=document.createElement('link'); c.id='lf-css'; c.rel='stylesheet'
      c.href='https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css'
      document.head.appendChild(c)
    }
    if(!document.getElementById('mc-css')){
      ['https://cdnjs.cloudflare.com/ajax/libs/leaflet.markercluster/1.5.3/MarkerCluster.Default.min.css',
       'https://cdnjs.cloudflare.com/ajax/libs/leaflet.markercluster/1.5.3/MarkerCluster.min.css'
      ].forEach(href=>{const c=document.createElement('link');c.rel='stylesheet';c.href=href;document.head.appendChild(c)})
      document.getElementById('mc-css') || (() => { const d = document.createElement('div'); d.id='mc-css'; document.head.appendChild(d) })()
    }
    const toLoad=[]
    if(!window.L) toLoad.push('https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js')
    toLoad.push('https://cdnjs.cloudflare.com/ajax/libs/leaflet.markercluster/1.5.3/leaflet.markercluster.min.js')
    load(toLoad,onReady)
  },[]) // eslint-disable-line
}

// ─── Groq moderation ─────────────────────────────────────────
async function moderateReport(type,desc){
  const key=import.meta.env.VITE_GROQ_API_KEY
  if(!key) return {safe:true,confidence:0.5}
  try{
    const res=await fetch('https://api.groq.com/openai/v1/chat/completions',{
      method:'POST',
      headers:{'Authorization':`Bearer ${key}`,'Content-Type':'application/json'},
      body:JSON.stringify({
        model:'llama-3.3-70b-versatile',
        messages:[{role:'user',content:`Moderate this Nigerian community incident report. Is it genuine?\nType: ${type}\nDescription: ${desc||'(none)'}\nReturn ONLY JSON: {"safe":true/false,"reason":"brief","confidence":0.0-1.0}\nUNSAFE if: hate speech, names private individuals, panic-spreading without basis, spam, incites violence.`}],
        max_tokens:100,temperature:0.1,response_format:{type:'json_object'},
      })
    })
    if(!res.ok) return {safe:true,confidence:0.5}
    const d=await res.json()
    return JSON.parse(d.choices[0].message.content)
  }catch{return{safe:true,confidence:0.5}}
}

async function checkRateLimit(userId){
  if(!supabase||!userId) return {allowed:false,remaining:0}
  try{
    const since=new Date(Date.now()-86400000).toISOString()
    const {count}=await supabase.from('community_reports').select('*',{count:'exact',head:true}).eq('user_id',userId).gte('created_at',since)
    const remaining=Math.max(0,5-(count||0))
    return {allowed:remaining>0,remaining}
  }catch{return{allowed:true,remaining:5}}
}

function timeAgo(ts){
  const d=Date.now()-new Date(ts).getTime()
  if(d<60000) return 'just now'
  if(d<3600000) return `${Math.floor(d/60000)}m ago`
  if(d<86400000) return `${Math.floor(d/3600000)}h ago`
  return `${Math.floor(d/86400000)}d ago`
}
function jitter(v,r=0.15){return v+(Math.random()-0.5)*r}

// ─── Marker icon factory ─────────────────────────────────────
function makeIcon(color,emoji,critical=false,size=26){
  if(!window.L) return null
  const pulse=critical?`<div style="position:absolute;inset:-4px;border-radius:50%;border:2px solid ${color};opacity:0.4;animation:pulse 2s ease infinite"/>`:''
  return window.L.divIcon({
    html:`<div style="position:relative;width:${size}px;height:${size}px">${pulse}<div style="width:${size}px;height:${size}px;border-radius:50%;background:radial-gradient(circle at 35% 30%,${color}55,${color}22);border:2px solid ${color};box-shadow:0 0 10px ${color}88,0 0 3px ${color};display:flex;align-items:center;justify-content:center;font-size:${Math.round(size*0.44)}px;line-height:1">${emoji}</div></div>`,
    className:'',iconSize:[size,size],iconAnchor:[size/2,size/2],
  })
}
function makeYouIcon(){
  if(!window.L) return null
  return window.L.divIcon({
    html:`<div style="width:16px;height:16px;border-radius:50%;background:${BGLOW};border:3px solid white;box-shadow:0 0 0 3px ${BGLOW}55,0 0 14px ${BGLOW}"/>`,
    className:'',iconSize:[16,16],iconAnchor:[8,8],
  })
}

const CAT_EMOJI={military:'⚔️',cyber:'💻',unrest:'✊',economic:'💰',environmental:'🌊',security:'🛡️',government:'🏛️',agriculture:'🌾',general:'📰'}
const TYPE_EMOJI={kidnapping:'🚨',robbery:'🔫',accident:'🚗',fire:'🔥',flood:'🌊',protest:'✊',power:'⚡',road_block:'🚧',gunshots:'💥',gas_leak:'☣️',market_fire:'🔥',building_collapse:'🏚️',cult_clash:'⚔️',police_action:'👮',medical:'🏥',other:'📌'}

// ─── Report form ─────────────────────────────────────────────
const CATS=[
  {id:'kidnapping',e:'🚨',l:'Kidnapping'},{id:'gunshots',e:'💥',l:'Gunshots'},
  {id:'robbery',e:'🔫',l:'Armed Robbery'},{id:'fire',e:'🔥',l:'Fire Outbreak'},
  {id:'accident',e:'🚗',l:'Road Accident'},{id:'flood',e:'🌊',l:'Flooding'},
  {id:'protest',e:'✊',l:'Protest/Unrest'},{id:'power',e:'⚡',l:'Power Outage'},
  {id:'road_block',e:'🚧',l:'Road Block'},{id:'building_collapse',e:'🏚️',l:'Building Collapse'},
  {id:'cult_clash',e:'⚔️',l:'Cult Clash'},{id:'medical',e:'🏥',l:'Medical Emerg.'},
]

function ReportForm({user,location,onClose,onSubmitted}){
  const [type,setType]=useState('')
  const [desc,setDesc]=useState('')
  const [anon,setAnon]=useState(false)
  const [step,setStep]=useState(1)
  const [loading,setLoading]=useState(false)
  const [error,setError]=useState('')
  const [rate,setRate]=useState(null)
  const selCat=CATS.find(c=>c.id===type)

  useEffect(()=>{if(user?.id)checkRateLimit(user.id).then(setRate)},[user?.id])

  const handle=async()=>{
    if(!user){setError('Sign in to report.');return}
    const r=await checkRateLimit(user.id)
    if(!r.allowed){setError(`Limit: 5 reports per 24h. ${5-r.remaining+r.remaining} used today.`);return}
    setLoading(true);setError('')
    const mod=await moderateReport(selCat?.l||type,desc)
    if(!mod.safe&&mod.confidence>0.75){setError(`⚠️ Flagged: ${mod.reason}. Only report incidents you directly witnessed.`);setLoading(false);return}
    const result=await submitReport({type,description:desc,anonymous:anon,lat:location?.lat,lon:location?.lon,state:location?.state||'',lga:location?.lga||'',userId:user.id,title:selCat?.l||type})
    setLoading(false)
    if(result.success) onSubmitted(result.report)
    else setError('Could not submit. Please try again.')
  }

  return(
    <div style={{position:'absolute',bottom:0,left:0,right:0,zIndex:600,padding:'0 12px 16px'}}>
      <div style={{background:`linear-gradient(145deg,${BGL},${BG})`,borderRadius:20,border:`1px solid ${SL}`,boxShadow:`${N.raised},0 0 40px rgba(0,0,0,0.9)`,overflow:'hidden'}}>
        <div style={{height:3,background:`linear-gradient(90deg,${DANGER},${WARNING})`}}/>
        <div style={{padding:'14px 16px'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
            <div>
              <div style={{fontSize:14,fontWeight:700,color:WHITE}}>🚨 Report Incident</div>
              {rate&&<div style={{fontSize:10,color:rate.remaining<=1?DANGER:MUTED}}>{rate.remaining} of 5 daily reports remaining</div>}
            </div>
            <button onClick={onClose} style={{background:'none',border:'none',color:MUTED,fontSize:22,cursor:'pointer',outline:'none'}}>×</button>
          </div>

          {step===1&&(
            <>
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:6,marginBottom:10}}>
                {CATS.map(c=>(
                  <button key={c.id} onClick={()=>{setType(c.id);setStep(2)}} style={{padding:'8px 3px',borderRadius:10,border:'none',cursor:'pointer',outline:'none',background:`linear-gradient(145deg,${BGL},${BG})`,boxShadow:N.raisedSm,display:'flex',flexDirection:'column',alignItems:'center',gap:3}}>
                    <span style={{fontSize:18}}>{c.e}</span>
                    <span style={{fontSize:9,color:MUTED,fontWeight:600,textAlign:'center',lineHeight:1.2}}>{c.l}</span>
                  </button>
                ))}
              </div>
              <div style={{fontSize:10,color:MUTED,textAlign:'center',lineHeight:1.5}}>
                ⚠️ 3 false reports = permanent ban. All reports are AI-moderated.
              </div>
            </>
          )}

          {step===2&&selCat&&(
            <>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
                <button onClick={()=>setStep(1)} style={{background:'none',border:'none',color:MUTED,cursor:'pointer',outline:'none',fontSize:18}}>←</button>
                <span style={{fontSize:18}}>{selCat.e}</span>
                <span style={{fontSize:13,fontWeight:700,color:WHITE}}>{selCat.l}</span>
              </div>
              <textarea value={desc} onChange={e=>setDesc(e.target.value)} placeholder="Describe briefly (optional). Don't name private individuals." maxLength={240} style={{width:'100%',background:SD,border:`1px solid ${SL}`,borderRadius:10,color:WHITE,padding:'10px 12px',fontSize:12,resize:'none',height:68,outline:'none',fontFamily:'inherit',lineHeight:1.5,marginBottom:8}}/>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
                <label style={{display:'flex',alignItems:'center',gap:6,cursor:'pointer',fontSize:11,color:MUTED}}>
                  <input type="checkbox" checked={anon} onChange={e=>setAnon(e.target.checked)} style={{accentColor:BGLOW}}/>Anonymous
                </label>
                {location?.lat&&<span style={{fontSize:10,color:SUCCESS}}>📍 GPS captured</span>}
              </div>
              {error&&<div style={{fontSize:11,color:DANGER,background:`${DANGER}11`,border:`1px solid ${DANGER}33`,borderRadius:8,padding:'7px 10px',marginBottom:10}}>{error}</div>}
              <button onClick={handle} disabled={loading} style={{width:'100%',padding:'11px',borderRadius:12,border:'none',cursor:'pointer',outline:'none',background:`linear-gradient(135deg,${DANGER},#DC2626)`,color:'#fff',fontSize:13,fontWeight:700,opacity:loading?0.7:1}}>
                {loading?'🔍 AI checking report...':'📍 Submit Report'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Event panel ─────────────────────────────────────────────
function EventPanel({ev,user,onClose,onVerify}){
  if(!ev) return null
  const color=ev._color||BGLOW
  const verified=(ev.verified_count||0)>=3
  return(
    <div style={{position:'absolute',bottom:0,left:0,right:0,zIndex:600,padding:'0 12px 16px'}}>
      <div style={{background:`linear-gradient(145deg,${BGL},${BG})`,borderRadius:20,border:`1px solid ${SL}`,boxShadow:`${N.raised},0 0 30px rgba(0,0,0,0.85)`,overflow:'hidden'}}>
        <div style={{height:3,background:`linear-gradient(90deg,${color},${color}44)`}}/>
        <div style={{padding:'14px 16px'}}>
          <div style={{display:'flex',alignItems:'flex-start',gap:10,marginBottom:10}}>
            <span style={{fontSize:22,flexShrink:0}}>{ev._emoji}</span>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontWeight:700,fontSize:13,color:WHITE,lineHeight:1.3,marginBottom:5}}>{ev.title}</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:4,marginBottom:5}}>
                <span style={{fontSize:10,fontWeight:700,color,background:`${color}18`,padding:'2px 8px',borderRadius:10,border:`1px solid ${color}33`}}>
                  {ev._src==='community'?(getIncidentType(ev.type)?.label||ev.type):(ev.severity||'INFO')}
                </span>
                {ev._src==='community'&&(verified
                  ?<span style={{fontSize:10,color:SUCCESS,fontWeight:600}}>✓ Verified ({ev.verified_count})</span>
                  :<span style={{fontSize:10,color:WARNING}}>⏳ Unverified ({ev.verified_count||0}/3 needed)</span>
                )}
              </div>
              {ev.description&&<div style={{fontSize:11,color:MUTED,lineHeight:1.6,marginBottom:5}}>{ev.description}</div>}
              <div style={{fontSize:10,color:MUTED,display:'flex',gap:8,flexWrap:'wrap'}}>
                {(ev.state||ev.region||ev.country)&&<span>📍 {ev.state||ev.region||ev.country}</span>}
                <span>🕐 {timeAgo(ev.created_at||ev.timestamp)}</span>
                {!ev._src==='community'&&ev.source&&<span>· {ev.source}</span>}
              </div>
            </div>
            <button onClick={onClose} style={{background:'none',border:'none',color:MUTED,fontSize:20,cursor:'pointer',outline:'none',flexShrink:0}}>×</button>
          </div>
          {ev._src==='community'&&user&&!verified&&(
            <button onClick={()=>onVerify(ev.id)} style={{width:'100%',padding:'9px',borderRadius:10,border:`1px solid ${SUCCESS}44`,background:`${SUCCESS}11`,color:SUCCESS,fontSize:12,fontWeight:600,cursor:'pointer',outline:'none'}}>
              ✓ I saw this too — Confirm report
            </button>
          )}
          {ev.link&&<a href={ev.link} target="_blank" rel="noopener noreferrer" style={{display:'block',marginTop:8,textAlign:'center',fontSize:11,color:BGLOW,textDecoration:'none'}}>🔗 Read full story</a>}
        </div>
      </div>
    </div>
  )
}

// ─── Main Map ────────────────────────────────────────────────
export default function Map4D({user}){
  const mapRef=useRef(null), mapObj=useRef(null), clusterRef=useRef({}), youRef=useRef(null)
  const [ready,setReady]=useState(false)
  const [loading,setLoading]=useState(true)
  const [events,setEvents]=useState([])
  const [ngEvents,setNgEvents]=useState([])
  const [reports,setReports]=useState([])
  const [selected,setSelected]=useState(null)
  const [showForm,setShowForm]=useState(false)
  const [userLoc,setUserLoc]=useState(null)
  const [timeWin,setTimeWin]=useState(48)
  const [newCount,setNewCount]=useState(0)
  const [region,setRegion]=useState('global')
  const [layers,setLayers]=useState({global:true,nigeria:true,community:true})

  const REGIONS=[
    {id:'global',label:'🌍 Global',center:[20,0],zoom:2},
    {id:'nigeria',label:'🇳🇬 Nigeria',center:[9.1,8.7],zoom:6},
    {id:'africa',label:'🌍 Africa',center:[3,20],zoom:4},
    {id:'europe',label:'🇪🇺 Europe',center:[52,15],zoom:4},
    {id:'mena',label:'🕌 MENA',center:[28,38],zoom:4},
    {id:'asia',label:'🌏 Asia',center:[30,100],zoom:3},
    {id:'americas',label:'🌎 Americas',center:[10,-80],zoom:3},
  ]

  useLeaflet(()=>setReady(true))

  useEffect(()=>{
    setLoading(true)
    Promise.allSettled([fetchEvents(),fetchNGEvents('all'),fetchAllReports({hours:timeWin})]).then(([ev,ng,rep])=>{
      if(ev.status==='fulfilled') setEvents(ev.value||[])
      if(ng.status==='fulfilled') setNgEvents(ng.value||[])
      if(rep.status==='fulfilled') setReports(rep.value||[])
      setLoading(false)
    })
  },[timeWin])

  useEffect(()=>{
    navigator.geolocation?.getCurrentPosition(p=>setUserLoc({lat:p.coords.latitude,lon:p.coords.longitude}),()=>{})
  },[])

  useEffect(()=>{
    const unsub=subscribeToReports(r=>{setReports(p=>[r,...p]);setNewCount(c=>c+1);setTimeout(()=>setNewCount(c=>Math.max(0,c-1)),8000)})
    return unsub
  },[])

  // Init map
  useEffect(()=>{
    if(!ready||!mapRef.current||mapObj.current) return
    const L=window.L
    mapObj.current=L.map(mapRef.current,{
      center:[20,0],zoom:2,minZoom:2,maxZoom:17,zoomControl:false,
      worldCopyJump:false,maxBounds:[[-85,-180],[85,180]],maxBoundsViscosity:1.0,
    })
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',{
      attribution:'©OpenStreetMap ©CartoDB',subdomains:'abcd',maxZoom:17,minZoom:2,
    }).addTo(mapObj.current)
    L.control.zoom({position:'topright'}).addTo(mapObj.current)
    mapObj.current.on('click',()=>{setSelected(null);setShowForm(false)})
    return()=>{if(mapObj.current){mapObj.current.remove();mapObj.current=null}}
  },[ready])

  // Render markers
  useEffect(()=>{
    if(!ready||!mapObj.current||!window.L) return
    const L=window.L
    Object.values(clusterRef.current).forEach(g=>g.remove())
    clusterRef.current={}

    const mkCluster=(color)=>L.markerClusterGroup({
      maxClusterRadius:50,showCoverageOnHover:false,zoomToBoundsOnClick:true,spiderfyOnMaxZoom:true,
      iconCreateFunction:cluster=>{
        const n=cluster.getChildCount(),sz=n>20?40:n>5?32:26
        return L.divIcon({html:`<div style="width:${sz}px;height:${sz}px;border-radius:50%;background:${color}33;border:2px solid ${color};display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:${color};box-shadow:0 0 12px ${color}55">${n}</div>`,className:'',iconSize:[sz,sz],iconAnchor:[sz/2,sz/2]})
      },
    })

    // Global events
    if(layers.global){
      const cg=mkCluster(BGLOW)
      events.forEach(ev=>{
        const base=GEO[ev.country]||GEO['Global']
        const icon=makeIcon(SEV_COLOR[ev.severity]||MUTED,CAT_EMOJI[ev.category]||'📡',ev.severity==='CRITICAL')
        if(!icon) return
        const gm = L.marker([jitter(base[0],1.2),jitter(base[1],1.2)],{icon})
          .on('click',e=>{e.originalEvent?.stopPropagation();setSelected({...ev,_src:'global',_color:SEV_COLOR[ev.severity]||MUTED,_emoji:CAT_EMOJI[ev.category]||'📡'});setShowForm(false)})
        cg.addLayer(gm)
      })
      cg.addTo(mapObj.current);clusterRef.current.global=cg
    }

    // Nigerian events
    if(layers.nigeria){
      const cg=mkCluster(SUCCESS)
      ngEvents.forEach(ev=>{
        const base=NG_STATES[ev.state?.toLowerCase()]||NG_STATES['federal']
        const icon=makeIcon(SEV_COLOR[ev.severity]||BGLOW,CAT_EMOJI[ev.category]||'📰',ev.severity==='CRITICAL',24)
        if(!icon) return
        const nm = L.marker([jitter(base[0],0.2),jitter(base[1],0.2)],{icon})
          .on('click',e=>{e.originalEvent?.stopPropagation();setSelected({...ev,_src:'nigeria',_color:SEV_COLOR[ev.severity]||BGLOW,_emoji:CAT_EMOJI[ev.category]||'📰'});setShowForm(false)})
        cg.addLayer(nm)
      })
      cg.addTo(mapObj.current);clusterRef.current.nigeria=cg
    }

    // Community reports
    if(layers.community){
      const cutoff=Date.now()-timeWin*3600000
      const cg=mkCluster(DANGER)
      reports.filter(r=>r.lat&&r.lon&&new Date(r.created_at).getTime()>cutoff).forEach(r=>{
        const verified=(r.verified_count||0)>=3
        const critical=['kidnapping','gunshots','robbery','building_collapse','cult_clash'].includes(r.type)
        const icon=makeIcon(verified?DANGER:WARNING,TYPE_EMOJI[r.type]||'📌',critical,24)
        if(!icon) return
        const cm = L.marker([r.lat,r.lon],{icon,zIndexOffset:100})
          .on('click',e=>{e.originalEvent?.stopPropagation();setSelected({...r,title:r.title||r.type,_src:'community',_color:verified?DANGER:WARNING,_emoji:TYPE_EMOJI[r.type]||'📌'});setShowForm(false)})
        cg.addLayer(cm)
      })
      cg.addTo(mapObj.current);clusterRef.current.community=cg
    }

    // You
    if(userLoc){
      if(youRef.current) youRef.current.remove()
      const icon=makeYouIcon()
      if(icon) youRef.current=L.marker([userLoc.lat,userLoc.lon],{icon,zIndexOffset:1000}).addTo(mapObj.current)
    }
  },[ready,events,ngEvents,reports,layers,timeWin,userLoc])

  const flyTo=useCallback((id)=>{
    setRegion(id)
    const r=REGIONS.find(x=>x.id===id)
    if(r&&mapObj.current) mapObj.current.flyTo(r.center,r.zoom,{duration:1.2})
  },[])

  const flyToUser=useCallback(()=>{
    if(userLoc&&mapObj.current) mapObj.current.flyTo([userLoc.lat,userLoc.lon],13,{duration:1.0})
  },[userLoc])

  const total=(layers.global?events.length:0)+(layers.nigeria?ngEvents.length:0)+(layers.community?reports.length:0)
  const critical=[...events,...ngEvents].filter(e=>e.severity==='CRITICAL').length

  return(
    <div style={{position:'relative',flex:1,display:'flex',flexDirection:'column',overflow:'hidden',borderRadius:0,margin:'0 -20px',marginBottom:-100}}>
      <style>{`
        @keyframes pulse{0%,100%{opacity:0.7;transform:scale(1)}50%{opacity:0.1;transform:scale(1.8)}}
        @keyframes bp{0%,100%{opacity:1}50%{opacity:0.3}}
        .leaflet-container{background:#070a0e!important}
        .leaflet-control-zoom a{background:#141B24!important;color:#E8F0FF!important;border-color:rgba(255,255,255,0.1)!important}
        .leaflet-control-zoom a:hover{background:#1a2332!important}
        .marker-cluster-small,.marker-cluster-medium,.marker-cluster-large{background:transparent!important}
        .marker-cluster-small div,.marker-cluster-medium div,.marker-cluster-large div{background:transparent!important}
      `}</style>

      <div ref={mapRef} style={{flex:1,minHeight:0}}/>

      {/* Loading */}
      {(!ready||loading)&&(
        <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',background:`${BG}CC`,zIndex:10,gap:12}}>
          <div style={{fontSize:40}}>🌍</div>
          <div style={{fontSize:13,color:MUTED}}>{!ready?'Loading map engine...':'Fetching live intelligence...'}</div>
          <div style={{display:'flex',gap:6}}>{[0,1,2].map(i=><div key={i} style={{width:6,height:6,borderRadius:'50%',background:BGLOW,animation:`bp 1.4s ease ${i*0.2}s infinite`}}/>)}</div>
        </div>
      )}

      {/* Region presets — left */}
      <div style={{position:'absolute',top:12,left:12,zIndex:400}}>
        <div style={{background:`${BG}EE`,borderRadius:12,padding:'6px 8px',backdropFilter:'blur(8px)',border:`1px solid ${SL}`,display:'flex',flexDirection:'column',gap:2}}>
          {REGIONS.map(r=>(
            <button key={r.id} onClick={()=>flyTo(r.id)} style={{padding:'5px 10px',borderRadius:8,border:'none',cursor:'pointer',outline:'none',textAlign:'left',background:region===r.id?`${BGLOW}22`:'transparent',color:region===r.id?BGLOW:MUTED,fontSize:10,fontWeight:600,whiteSpace:'nowrap',borderWidth:1,borderStyle:'solid',borderColor:region===r.id?`${BGLOW}44`:'transparent'}}>
              {r.label}
            </button>
          ))}
          {userLoc&&<button onClick={flyToUser} style={{padding:'5px 10px',borderRadius:8,border:`1px solid ${SUCCESS}44`,background:`${SUCCESS}11`,color:SUCCESS,fontSize:10,fontWeight:600,cursor:'pointer',outline:'none',marginTop:4}}>📍 My location</button>}
        </div>
      </div>

      {/* Stats + layers — top right (offset from zoom control) */}
      <div style={{position:'absolute',top:12,right:50,zIndex:400,display:'flex',flexDirection:'column',gap:5,alignItems:'flex-end'}}>
        <div style={{background:`${BG}EE`,borderRadius:10,padding:'6px 12px',backdropFilter:'blur(8px)',border:`1px solid ${SL}`,display:'flex',gap:12}}>
          <div style={{textAlign:'center'}}><div style={{fontSize:14,fontWeight:800,color:WHITE,fontFamily:"'SF Mono',monospace"}}>{total}</div><div style={{fontSize:9,color:MUTED}}>events</div></div>
          <div style={{width:1,background:SL}}/>
          <div style={{textAlign:'center'}}><div style={{fontSize:14,fontWeight:800,color:DANGER,fontFamily:"'SF Mono',monospace"}}>{critical}</div><div style={{fontSize:9,color:MUTED}}>critical</div></div>
          {newCount>0&&<><div style={{width:1,background:SL}}/><div style={{textAlign:'center'}}><div style={{fontSize:14,fontWeight:800,color:WARNING}}>+{newCount}</div><div style={{fontSize:9,color:WARNING}}>new</div></div></>}
        </div>
        <div style={{background:`${BG}EE`,borderRadius:10,padding:'5px 8px',backdropFilter:'blur(8px)',border:`1px solid ${SL}`,display:'flex',gap:4}}>
          {[{k:'global',e:'🌍',l:'Global',c:BGLOW},{k:'nigeria',e:'🇳🇬',l:'Nigeria',c:SUCCESS},{k:'community',e:'👥',l:'Community',c:DANGER}].map(l=>(
            <button key={l.k} onClick={()=>setLayers(p=>({...p,[l.k]:!p[l.k]}))} title={l.l} style={{padding:'4px 8px',borderRadius:7,border:'none',cursor:'pointer',outline:'none',background:layers[l.k]?`${l.c}22`:'transparent',opacity:layers[l.k]?1:0.35,borderWidth:1,borderStyle:'solid',borderColor:layers[l.k]?`${l.c}55`:'transparent',display:'flex',alignItems:'center',gap:3}}>
              <span style={{fontSize:12}}>{l.e}</span>
              <span style={{fontSize:9,color:layers[l.k]?l.c:MUTED,fontWeight:600}}>{l.l}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Time filter — bottom centre */}
      {!selected&&!showForm&&(
        <div style={{position:'absolute',bottom:16,left:'50%',transform:'translateX(-50%)',zIndex:400}}>
          <div style={{background:`${BG}EE`,borderRadius:20,padding:'5px 8px',backdropFilter:'blur(8px)',border:`1px solid ${SL}`,display:'flex',gap:3,alignItems:'center'}}>
            <span style={{fontSize:10,color:MUTED,padding:'0 4px'}}>⏱</span>
            {[{v:6,l:'6h'},{v:24,l:'24h'},{v:48,l:'48h'},{v:168,l:'7d'}].map(t=>(
              <button key={t.v} onClick={()=>setTimeWin(t.v)} style={{padding:'5px 11px',borderRadius:14,border:'none',cursor:'pointer',outline:'none',background:timeWin===t.v?BGLOW:'transparent',color:timeWin===t.v?'#fff':MUTED,fontSize:11,fontWeight:600}}>{t.l}</button>
            ))}
          </div>
        </div>
      )}

      {/* Report button */}
      {!showForm&&!selected&&(
        <button onClick={()=>{if(user)setShowForm(true)}} style={{position:'absolute',bottom:16,right:16,zIndex:400,width:50,height:50,borderRadius:'50%',border:'none',cursor:user?'pointer':'not-allowed',background:`linear-gradient(135deg,${DANGER},#DC2626)`,boxShadow:`0 4px 20px ${DANGER}88`,fontSize:20,outline:'none',opacity:user?1:0.5}} title={user?'Report incident':'Sign in to report'}>🚨</button>
      )}

      {/* Legend */}
      {!selected&&!showForm&&(
        <div style={{position:'absolute',bottom:16,left:12,zIndex:400}}>
          <div style={{background:`${BG}EE`,borderRadius:10,padding:'7px 10px',backdropFilter:'blur(8px)',border:`1px solid ${SL}`}}>
            {[[DANGER,'Critical'],[WARNING,'High'],[BGLOW,'Medium'],[WARNING,'Unverified report'],[DANGER,'Verified report']].map(([c,l],i)=>(
              <div key={i} style={{display:'flex',alignItems:'center',gap:5,marginBottom:i<4?3:0}}>
                <div style={{width:7,height:7,borderRadius:'50%',background:c,boxShadow:`0 0 5px ${c}`,flexShrink:0}}/>
                <span style={{fontSize:9,color:MUTED}}>{l}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Panels */}
      {selected&&!showForm&&(
        <EventPanel ev={selected} user={user} onClose={()=>setSelected(null)}
          onVerify={async id=>{
            if(!user) return
            await verifyReport(id,user.id)
            setReports(p=>p.map(r=>r.id===id?{...r,verified_count:(r.verified_count||0)+1}:r))
            setSelected(p=>p?{...p,verified_count:(p.verified_count||0)+1}:p)
          }}
        />
      )}
      {showForm&&<ReportForm user={user} location={userLoc} onClose={()=>setShowForm(false)} onSubmitted={r=>{setReports(p=>[r,...p]);setShowForm(false)}}/>}
    </div>
  )
}
