// 0rion 4D Map — Real-time intelligence map
// Leaflet.js (free, no API key) 
// Data: ACLED (security with GPS), Community reports (Supabase), RSS events (WorldMonitor)

import { useState, useEffect, useRef, useCallback } from 'react'
import { fetchNGEvents } from '../api/nigeria'
import { fetchAllReports, subscribeToReports, getIncidentType, INCIDENT_TYPES, submitReport, verifyReport } from '../api/reports'
import { fetchEvents } from '../api/worldmonitor'

const BG='#0D1117',BGL='#141B24',SD='#070A0E',SL='rgba(255,255,255,0.06)'
const BGLOW='#60A5FA',WHITE='#E8F0FF',MUTED='#5A7A96'
const DANGER='#EF4444',WARNING='#F59E0B',SUCCESS='#10B981',PURPLE='#A78BFA'
const N={raised:`6px 6px 14px ${SD},-3px -3px 10px ${SL}`,raisedSm:`3px 3px 8px ${SD},-2px -2px 6px ${SL}`,inset:`inset 4px 4px 10px ${SD},inset -2px -2px 7px ${SL}`}
const CAT_COLOR = {security:DANGER,government:PURPLE,economy:WARNING,agriculture:SUCCESS,general:BGLOW,community:SUCCESS,fire:DANGER,flood:BGLOW,health:SUCCESS,traffic:WARNING,infrastructure:MUTED}
const SEV_COLOR  = {CRITICAL:DANGER,HIGH:WARNING,MEDIUM:BGLOW}

function Surf({children,style={}}) {
  return <div style={{background:`linear-gradient(145deg,${BGL},${BG})`,borderRadius:16,boxShadow:N.raised,border:`1px solid ${SL}`,padding:14,...style}}>{children}</div>
}
function Bdg({label,color=BGLOW}) {
  return <span style={{padding:'3px 8px',borderRadius:20,background:`${color}18`,border:`1px solid ${color}33`,fontSize:10,fontWeight:700,color,letterSpacing:'0.06em',textTransform:'uppercase',whiteSpace:'nowrap'}}>{label}</span>
}

function useLeaflet(onReady) {
  useEffect(() => {
    if (window.L) { onReady(); return }
    const css = document.createElement('link')
    css.rel = 'stylesheet'
    css.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css'
    document.head.appendChild(css)
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js'
    script.onload = onReady
    document.head.appendChild(script)
  }, [])
}

function makeIcon(color, size=20, critical=false) {
  if (!window.L) return null
  const ring = critical ? `<circle cx="12" cy="12" r="10" fill="none" stroke="${color}" stroke-width="1" opacity="0.4"/>` : ''
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24">${ring}<circle cx="12" cy="12" r="7" fill="${color}" fill-opacity="0.3" stroke="${color}" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="${color}"/></svg>`
  return window.L.divIcon({ html:`<div style="filter:drop-shadow(0 0 5px ${color}88)">${svg}</div>`,className:'',iconSize:[size,size],iconAnchor:[size/2,size/2] })
}

function makeUserIcon(verified) {
  if (!window.L) return null
  const color = verified ? SUCCESS : WARNING
  return window.L.divIcon({ html:`<div style="width:28px;height:28px;border-radius:50%;background:${color}33;border:2px solid ${color};display:flex;align-items:center;justify-content:center;font-size:14px;filter:drop-shadow(0 0 6px ${color})">👥</div>`,className:'',iconSize:[28,28],iconAnchor:[14,14] })
}

export function Map4D({ user }) {
  const mapRef     = useRef(null)
  const mapObj     = useRef(null)
  const markersRef = useRef([])
  const [ready,setReady]           = useState(false)
  const [events,setEvents]         = useState([])
  const [loading,setLoading]       = useState(true)
  const [selected,setSelected]     = useState(null)
  const [userPos,setUserPos]       = useState(null)
  const [showReport,setShowReport] = useState(false)
  const [tapPos,setTapPos]         = useState(null)
  const [submitOk,setSubmitOk]     = useState(false)
  const [submitting,setSubmitting] = useState(false)
  const [report,setReport]         = useState({title:'',description:'',category:'security'})
  const [layers,setLayers]         = useState({security:true,community:true,government:true,economy:false,agriculture:false})

  useLeaflet(()=>setReady(true))

  // Init map
  useEffect(()=>{
    if(!ready||mapObj.current) return
    const L=window.L
    const map=L.map(mapRef.current,{center:[9.082,8.675],zoom:6,zoomControl:false,attributionControl:false})
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',{maxZoom:19}).addTo(map)
    L.control.zoom({position:'bottomright'}).addTo(map)
    L.control.attribution({position:'bottomleft',prefix:'© CARTO · ACLED · 0rion'}).addTo(map)

    map.on('click', e => setTapPos({lat:e.latlng.lat,lon:e.latlng.lng}))
    mapObj.current = map

    if(navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(pos=>{
        const {latitude:lat,longitude:lon}=pos.coords
        setUserPos({lat,lon})
        map.setView([lat,lon],10)
        const icon=L.divIcon({html:`<div style="width:18px;height:18px;border-radius:50%;background:${BGLOW};box-shadow:0 0 0 5px ${BGLOW}33,0 0 0 10px ${BGLOW}15"></div>`,className:'',iconSize:[18,18],iconAnchor:[9,9]})
        L.marker([lat,lon],{icon}).addTo(map).bindTooltip('📍 You',{permanent:false,direction:'top'})
      })
    }
    return ()=>{ if(mapObj.current){mapObj.current.remove();mapObj.current=null} }
  },[ready])

  // Load events
  useEffect(()=>{
    const load=async()=>{ setLoading(true); const evs=await fetchNGEvents('all',userPos?.lat,userPos?.lon); setEvents(evs); setLoading(false) }
    load()
    const t=setInterval(load,5*60*1000)
    return()=>clearInterval(t)
  },[userPos])

  // Plot markers
  useEffect(()=>{
    const L=window.L
    if(!L||!mapObj.current) return
    markersRef.current.forEach(m=>m.remove())
    markersRef.current=[]
    events.filter(e=>{
      if(!e.lat||!e.lon||isNaN(e.lat)||isNaN(e.lon)) return false
      if(e.type==='community') return layers.community
      if(e.category==='security') return layers.security
      if(e.category==='government') return layers.government
      if(e.category==='economy') return layers.economy
      if(e.category==='agriculture') return layers.agriculture
      return true
    }).forEach(ev=>{
      const color = ev.type==='community' ? (ev.verified?SUCCESS:WARNING)
                  : SEV_COLOR[ev.severity]||BGLOW
      const icon = ev.type==='community' ? makeUserIcon(ev.verified) : makeIcon(color,ev.severity==='CRITICAL'?26:18,ev.severity==='CRITICAL')
      if(!icon) return
      const m=L.marker([ev.lat,ev.lon],{icon}).addTo(mapObj.current).on('click',()=>setSelected(ev))
      markersRef.current.push(m)
    })
  },[events,layers])

  const toggle=useCallback(l=>setLayers(prev=>({...prev,[l]:!prev[l]})),[])

  const handleSubmit=async()=>{
    if(!report.title||!tapPos) return
    setSubmitting(true)
    try {
      await submitReport({...report, type: report.category||'other', lat:tapPos.lat, lon:tapPos.lon, userId: user?.id})
      setSubmitOk(true); setShowReport(false)
      setReport({title:'',description:'',category:'security'})
      setTimeout(()=>setSubmitOk(false),4000)
      const evs=await fetchNGEvents('all',userPos?.lat,userPos?.lon)
      setEvents(evs)
    } catch { alert('Submit failed. Check your connection.') }
    setSubmitting(false)
  }

  const critCount=events.filter(e=>e.severity==='CRITICAL').length
  const commCount=events.filter(e=>e.type==='community').length

  return (
    <div style={{flex:1,position:'relative',margin:'0 -20px',overflow:'hidden'}}>
      <style>{`
        .leaflet-container{background:#0D1117!important}
        .leaflet-control-zoom{border:none!important}
        .leaflet-control-zoom a{background:${BGL}!important;color:${WHITE}!important;border:1px solid ${SL}!important}
        .leaflet-tooltip{background:${BGL}!important;border:1px solid ${SL}!important;color:${WHITE}!important;font-size:11px!important;border-radius:8px!important;padding:5px 9px!important}
        .leaflet-attribution-flag{display:none!important}
      `}</style>

      <div ref={mapRef} style={{position:'absolute',inset:0,zIndex:0}}/>

      {/* Stats bar */}
      <div style={{position:'absolute',top:8,left:8,right:8,zIndex:10,display:'flex',gap:6,justifyContent:'center',pointerEvents:'none'}}>
        {[{l:`${events.length} Events`,c:BGLOW},{l:`${critCount} Critical`,c:DANGER},{l:`${commCount} Community`,c:SUCCESS}].map(s=>(
          <div key={s.l} style={{background:`${BG}ee`,borderRadius:20,padding:'5px 11px',border:`1px solid ${s.c}33`}}>
            <span style={{fontSize:10,fontWeight:700,color:s.c}}>{s.l}</span>
          </div>
        ))}
        {loading&&<div style={{background:`${BG}ee`,borderRadius:20,padding:'5px 11px',border:`1px solid ${SL}`}}><span style={{fontSize:10,color:MUTED}}>●</span></div>}
      </div>

      {/* Layer toggles */}
      <div style={{position:'absolute',top:46,right:8,zIndex:10,display:'flex',flexDirection:'column',gap:5}}>
        {[{id:'security',l:'🛡️ Security',c:DANGER},{id:'community',l:'👥 Reports',c:SUCCESS},{id:'government',l:'🏛️ Govt',c:PURPLE},{id:'economy',l:'💰 Econ',c:WARNING},{id:'agriculture',l:'🌾 Agric',c:SUCCESS}].map(lyr=>(
          <button key={lyr.id} onClick={()=>toggle(lyr.id)} style={{
            padding:'6px 10px',borderRadius:10,border:`1px solid ${layers[lyr.id]?lyr.c+'55':SL}`,cursor:'pointer',outline:'none',
            background:layers[lyr.id]?`${BGL}ee`:`${BG}bb`,color:layers[lyr.id]?lyr.c:MUTED,
            fontSize:10,fontWeight:700,textAlign:'left',transition:'all 0.2s',
          }}>{lyr.l}</button>
        ))}
      </div>

      {/* Tap location hint */}
      {tapPos&&!showReport&&(
        <div style={{position:'absolute',bottom:140,left:'50%',transform:'translateX(-50%)',zIndex:10}}>
          <div style={{background:`${BG}ee`,border:`1px solid ${DANGER}44`,borderRadius:20,padding:'6px 14px'}}>
            <span style={{fontSize:11,color:DANGER}}>📍 {tapPos.lat.toFixed(3)}, {tapPos.lon.toFixed(3)} selected</span>
          </div>
        </div>
      )}

      {/* Report button */}
      <div style={{position:'absolute',bottom:70,left:'50%',transform:'translateX(-50%)',zIndex:10}}>
        {submitOk&&(
          <div style={{background:`${SUCCESS}22`,border:`1px solid ${SUCCESS}44`,borderRadius:20,padding:'7px 14px',marginBottom:8,textAlign:'center',whiteSpace:'nowrap'}}>
            <span style={{fontSize:11,color:SUCCESS,fontWeight:700}}>✓ Submitted! Neighbours alerted.</span>
          </div>
        )}
        <button onClick={()=>setShowReport(true)} style={{
          padding:'11px 22px',borderRadius:22,border:'none',cursor:'pointer',outline:'none',
          background:`linear-gradient(135deg,${DANGER},#DC2626)`,color:'#fff',
          fontSize:12,fontWeight:700,boxShadow:`0 4px 18px ${DANGER}44`,
        }}>🚨 Report Incident</button>
      </div>

      {/* Selected event */}
      {selected&&(
        <div style={{position:'absolute',bottom:130,left:10,right:10,zIndex:10}}>
          <Surf style={{padding:'13px 15px'}}>
            <div style={{display:'flex',justifyContent:'space-between',gap:8}}>
              <div style={{flex:1}}>
                <div style={{display:'flex',gap:5,flexWrap:'wrap',marginBottom:6}}>
                  <Bdg label={selected.severity} color={SEV_COLOR[selected.severity]}/>
                  <Bdg label={selected.category} color={CAT_COLOR[selected.category]||BGLOW}/>
                  {selected.type==='community'&&<Bdg label={selected.verified?'✓ Verified':'Community'} color={selected.verified?SUCCESS:WARNING}/>}
                </div>
                <div style={{fontWeight:700,fontSize:12,color:WHITE,lineHeight:1.4,marginBottom:4}}>{selected.title}</div>
                {selected.description&&<div style={{fontSize:11,color:MUTED,lineHeight:1.5,marginBottom:4}}>{selected.description.slice(0,150)}{selected.description.length>150?'...':''}</div>}
                <div style={{fontSize:10,color:MUTED}}>{selected.source} · {new Date(selected.timestamp).toLocaleDateString('en-NG')}</div>
                {selected.link&&<a href={selected.link} target="_blank" rel="noopener noreferrer" style={{fontSize:11,color:BGLOW,textDecoration:'none',display:'block',marginTop:4}}>→ Read more</a>}
              </div>
              <button onClick={()=>setSelected(null)} style={{background:'none',border:'none',cursor:'pointer',color:MUTED,fontSize:20,lineHeight:1,alignSelf:'flex-start',padding:'0 2px',outline:'none'}}>×</button>
            </div>
          </Surf>
        </div>
      )}

      {/* Report modal */}
      {showReport&&(
        <div style={{position:'absolute',inset:0,zIndex:20,background:`${BG}ee`,display:'flex',alignItems:'flex-end'}}>
          <div style={{width:'100%',padding:14}}>
            <Surf style={{padding:18}}>
              <div style={{fontWeight:700,fontSize:14,color:WHITE,marginBottom:4}}>Report an Incident</div>
              <div style={{fontSize:11,color:tapPos?SUCCESS:MUTED,marginBottom:14}}>
                {tapPos?`📍 Location: ${tapPos.lat.toFixed(4)}, ${tapPos.lon.toFixed(4)}`:'⚠️ Tap the map first to set location'}
              </div>
              <div style={{display:'flex',gap:5,flexWrap:'wrap',marginBottom:12}}>
                {[{id:'security',l:'🛡️ Security'},{id:'fire',l:'🔥 Fire'},{id:'flood',l:'💧 Flood'},{id:'traffic',l:'🚗 Traffic'},{id:'health',l:'🏥 Health'},{id:'infrastructure',l:'🔧 Infra'}].map(c=>(
                  <button key={c.id} onClick={()=>setReport(r=>({...r,category:c.id}))} style={{
                    padding:'6px 9px',borderRadius:14,border:`1px solid ${report.category===c.id?DANGER+'55':SL}`,
                    cursor:'pointer',outline:'none',background:report.category===c.id?`${DANGER}22`:`linear-gradient(145deg,${BGL},${BG})`,
                    color:report.category===c.id?DANGER:MUTED,fontSize:10,fontWeight:600,
                  }}>{c.l}</button>
                ))}
              </div>
              <div style={{background:SD,borderRadius:10,padding:'10px 12px',marginBottom:10,boxShadow:N.inset}}>
                <input value={report.title} onChange={e=>setReport(r=>({...r,title:e.target.value}))} placeholder="What happened? (required)" maxLength={120} style={{background:'none',border:'none',outline:'none',color:WHITE,fontSize:13,width:'100%',fontFamily:'inherit'}}/>
              </div>
              <div style={{background:SD,borderRadius:10,padding:'10px 12px',marginBottom:14,boxShadow:N.inset}}>
                <textarea value={report.description} onChange={e=>setReport(r=>({...r,description:e.target.value}))} placeholder="More details — number of people involved, time, etc." rows={2} maxLength={280} style={{background:'none',border:'none',outline:'none',color:WHITE,fontSize:12,width:'100%',fontFamily:'inherit',resize:'none'}}/>
              </div>
              <div style={{display:'flex',gap:8}}>
                <button onClick={()=>setShowReport(false)} style={{flex:1,padding:'10px',borderRadius:12,border:'none',cursor:'pointer',background:`linear-gradient(145deg,${BGL},${BG})`,color:MUTED,fontSize:12,fontWeight:600,outline:'none'}}>Cancel</button>
                <button onClick={handleSubmit} disabled={!report.title||!tapPos||submitting} style={{
                  flex:2,padding:'10px',borderRadius:12,border:'none',cursor:'pointer',outline:'none',
                  background:(!report.title||!tapPos||submitting)?BGL:`linear-gradient(135deg,${DANGER},#DC2626)`,
                  color:(!report.title||!tapPos||submitting)?MUTED:'#fff',fontSize:12,fontWeight:700,
                }}>{submitting?'Submitting...':'🚨 Submit Report'}</button>
              </div>
              <div style={{fontSize:10,color:MUTED,textAlign:'center',marginTop:8}}>Visible to all 0rion users in Nigeria.</div>
            </Surf>
          </div>
        </div>
      )}
    </div>
  )
}
