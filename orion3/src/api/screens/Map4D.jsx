// 0rion 4D Intelligence Map
// Leaflet.js — world → Nigeria → state → LGA → street
// Layers: global events + Nigerian news + community reports + time slider
// "4D" = spatial zoom depth (world→house) + time dimension

import { useState, useEffect, useRef, useCallback } from 'react'
import { fetchNGEvents } from '../api/nigeria'
import { fetchEvents } from '../api/worldmonitor'
import { fetchAllReports, subscribeToReports, getIncidentType, INCIDENT_TYPES, submitReport, verifyReport } from '../api/reports'
import { supabase } from '../lib/supabase'

const BG='#0D1117',BGL='#141B24',SD='#070A0E',SL='rgba(255,255,255,0.06)'
const BGLOW='#60A5FA',WHITE='#E8F0FF',MUTED='#5A7A96'
const DANGER='#EF4444',WARNING='#F59E0B',SUCCESS='#10B981',PURPLE='#A78BFA'
const N={
  raised:`6px 6px 14px ${SD},-3px -3px 10px ${SL}`,
  raisedSm:`3px 3px 8px ${SD},-2px -2px 6px ${SL}`,
  inset:`inset 4px 4px 10px ${SD},inset -2px -2px 7px ${SL}`,
}

const SEVERITY_COLOR = { CRITICAL: '#EF4444', HIGH: '#F59E0B', MEDIUM: '#60A5FA' }

// ─── Leaflet loader ────────────────────────────────────────
function useLeaflet() {
  const [L, setL] = useState(null)
  useEffect(() => {
    if (window.L) { setL(window.L); return }
    // Load Leaflet CSS
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link')
      link.id = 'leaflet-css'
      link.rel = 'stylesheet'
      link.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css'
      document.head.appendChild(link)
    }
    // Load Leaflet JS
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js'
    script.onload = () => setL(window.L)
    document.head.appendChild(script)
  }, [])
  return L
}

// ─── Report submission modal ───────────────────────────────
function ReportModal({ onClose, onSubmit, userLocation }) {
  const [type, setType]         = useState('')
  const [desc, setDesc]         = useState('')
  const [useGPS, setUseGPS]     = useState(true)
  const [anonymous, setAnon]    = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone]         = useState(false)

  const handleSubmit = async () => {
    if (!type) return
    setSubmitting(true)
    const loc = useGPS && userLocation ? userLocation : null
    const result = await onSubmit({
      type, description: desc, anonymous,
      lat: loc?.lat, lon: loc?.lon,
      state: loc?.state || '', lga: loc?.lga || '',
    })
    setSubmitting(false)
    if (result) { setDone(true); setTimeout(onClose, 2000) }
  }

  return (
    <div style={{position:'absolute',bottom:0,left:0,right:0,zIndex:1000,background:`linear-gradient(180deg,transparent,${BG} 8%)`,padding:'20px 16px 24px'}}>
      <div style={{background:`linear-gradient(145deg,${BGL},${BG})`,borderRadius:20,boxShadow:`${N.raised},0 0 30px rgba(0,0,0,0.8)`,border:`1px solid ${SL}`,padding:20}}>
        {done ? (
          <div style={{textAlign:'center',padding:'20px 0'}}>
            <div style={{fontSize:36,marginBottom:8}}>✅</div>
            <div style={{fontSize:15,fontWeight:700,color:SUCCESS}}>Report submitted!</div>
            <div style={{fontSize:12,color:MUTED,marginTop:4}}>Your community thanks you.</div>
          </div>
        ) : (
          <>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
              <div style={{fontSize:14,fontWeight:700,color:WHITE}}>🚨 Report Incident</div>
              <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',color:MUTED,fontSize:20,lineHeight:1,outline:'none'}}>×</button>
            </div>

            {/* Incident type grid */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:6,marginBottom:14}}>
              {INCIDENT_TYPES.slice(0,8).map(t => (
                <button key={t.id} onClick={()=>setType(t.id)} style={{
                  padding:'8px 4px',borderRadius:10,border:'none',cursor:'pointer',outline:'none',
                  background: type===t.id ? `${t.color}22` : `linear-gradient(145deg,${BGL},${BG})`,
                  borderWidth:1,borderStyle:'solid',borderColor: type===t.id ? `${t.color}66` : 'transparent',
                  display:'flex',flexDirection:'column',alignItems:'center',gap:3,
                }}>
                  <span style={{fontSize:18}}>{t.emoji}</span>
                  <span style={{fontSize:9,color:type===t.id?t.color:MUTED,fontWeight:600,textAlign:'center',lineHeight:1.2}}>{t.label}</span>
                </button>
              ))}
            </div>

            {/* More types */}
            <select value={type} onChange={e=>setType(e.target.value)} style={{
              width:'100%',background:SD,border:`1px solid ${SL}`,borderRadius:10,
              color:type?WHITE:MUTED,padding:'9px 12px',fontSize:12,
              outline:'none',marginBottom:12,fontFamily:'inherit',
            }}>
              <option value="">— Select incident type —</option>
              {INCIDENT_TYPES.map(t=><option key={t.id} value={t.id}>{t.emoji} {t.label}</option>)}
            </select>

            {/* Description */}
            <textarea
              value={desc}
              onChange={e=>setDesc(e.target.value)}
              placeholder="What happened? (optional — brief description helps others)"
              maxLength={280}
              style={{
                width:'100%',background:SD,border:`1px solid ${SL}`,borderRadius:10,
                color:WHITE,padding:'10px 12px',fontSize:12,resize:'none',height:72,
                outline:'none',fontFamily:'inherit',lineHeight:1.5,
              }}
            />
            <div style={{fontSize:10,color:MUTED,textAlign:'right',marginBottom:12}}>{desc.length}/280</div>

            {/* Options */}
            <div style={{display:'flex',gap:12,marginBottom:14}}>
              <label style={{display:'flex',alignItems:'center',gap:6,cursor:'pointer'}}>
                <input type="checkbox" checked={useGPS} onChange={e=>setUseGPS(e.target.checked)} style={{accentColor:BGLOW}}/>
                <span style={{fontSize:11,color:MUTED}}>📍 Use my location</span>
              </label>
              <label style={{display:'flex',alignItems:'center',gap:6,cursor:'pointer'}}>
                <input type="checkbox" checked={anonymous} onChange={e=>setAnon(e.target.checked)} style={{accentColor:BGLOW}}/>
                <span style={{fontSize:11,color:MUTED}}>👤 Stay anonymous</span>
              </label>
            </div>

            <button
              onClick={handleSubmit}
              disabled={!type || submitting}
              style={{
                width:'100%',padding:'12px',borderRadius:12,border:'none',cursor:type?'pointer':'not-allowed',
                background: type ? `linear-gradient(135deg,#EF4444,#DC2626)` : `${BGL}`,
                color: type ? '#fff' : MUTED,
                fontSize:13,fontWeight:700,outline:'none',
                opacity: submitting ? 0.7 : 1,
              }}
            >{submitting ? 'Submitting...' : '🚨 Submit Report'}</button>

            <div style={{fontSize:10,color:MUTED,textAlign:'center',marginTop:8}}>
              False reports are a crime. Report only what you have seen directly.
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Event detail panel ────────────────────────────────────
function EventPanel({ event, onClose, onVerify, user }) {
  if (!event) return null
  const isCommunity = event._type === 'community'
  const it = isCommunity ? getIncidentType(event.type) : null
  const color = isCommunity ? (it?.color || MUTED) : SEVERITY_COLOR[event.severity] || MUTED

  function timeAgo(ts) {
    const d = Date.now() - new Date(ts).getTime()
    if (d < 60000) return 'just now'
    if (d < 3600000) return `${Math.floor(d/60000)}m ago`
    if (d < 86400000) return `${Math.floor(d/3600000)}h ago`
    return `${Math.floor(d/86400000)}d ago`
  }

  return (
    <div style={{position:'absolute',bottom:0,left:0,right:0,zIndex:1000,padding:'0 16px 16px'}}>
      <div style={{background:`linear-gradient(145deg,${BGL},${BG})`,borderRadius:20,boxShadow:`${N.raised},0 0 20px rgba(0,0,0,0.8)`,border:`1px solid ${SL}`,padding:16}}>
        <div style={{height:2,background:`linear-gradient(90deg,${color},${color}33)`,borderRadius:2,marginBottom:12}}/>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
          <div style={{flex:1,marginRight:12}}>
            <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:4}}>
              {isCommunity && <span style={{fontSize:18}}>{it?.emoji}</span>}
              <span style={{fontSize:10,fontWeight:700,color,letterSpacing:'0.06em',textTransform:'uppercase',background:`${color}18`,padding:'2px 7px',borderRadius:10}}>
                {isCommunity ? it?.label : event.severity}
              </span>
              {isCommunity && event.verified_count > 0 && (
                <span style={{fontSize:10,color:SUCCESS}}>✓ {event.verified_count} confirmed</span>
              )}
            </div>
            <div style={{fontSize:13,fontWeight:700,color:WHITE,lineHeight:1.3,marginBottom:4}}>{event.title}</div>
            {event.description && (
              <div style={{fontSize:11,color:MUTED,lineHeight:1.6}}>{event.description}</div>
            )}
            <div style={{fontSize:10,color:MUTED,marginTop:6,display:'flex',gap:8}}>
              {(event.state||event.region) && <span>📍 {event.state||event.region}</span>}
              <span>🕐 {timeAgo(event.created_at||event.timestamp)}</span>
              {isCommunity && <span style={{color:WARNING}}>👥 Community Report</span>}
              {!isCommunity && event.source && <span>{event.source}</span>}
            </div>
          </div>
          <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',color:MUTED,fontSize:20,outline:'none',flexShrink:0}}>×</button>
        </div>
        {isCommunity && user && (
          <button onClick={()=>onVerify(event.id)} style={{
            width:'100%',padding:'9px',borderRadius:10,border:`1px solid ${SUCCESS}44`,
            background:`${SUCCESS}11`,color:SUCCESS,fontSize:12,fontWeight:600,cursor:'pointer',outline:'none',
          }}>✓ Confirm — I saw this too</button>
        )}
      </div>
    </div>
  )
}

// ─── Main 4D Map ───────────────────────────────────────────
export default function Map4D({ user }) {
  const mapRef       = useRef(null)
  const mapInstance  = useRef(null)
  const markersRef   = useRef([])
  const L            = useLeaflet()

  const [events,       setEvents]       = useState([])
  const [ngEvents,     setNgEvents]     = useState([])
  const [reports,      setReports]      = useState([])
  const [loading,      setLoading]      = useState(true)
  const [showReport,   setShowReport]   = useState(false)
  const [selectedEvent,setSelectedEvent]= useState(null)
  const [userLocation, setUserLocation] = useState(null)
  const [timeWindow,   setTimeWindow]   = useState(72) // hours
  const [layers,       setLayers]       = useState({ global: true, nigeria: true, community: true })
  const [newReportCount, setNewReportCount] = useState(0)

  // ─── Load all data ─────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const [ev, ng, rep] = await Promise.allSettled([
        fetchEvents(),
        fetchNGEvents('all'),
        fetchAllReports({ hours: timeWindow }),
      ])
      if (ev.status === 'fulfilled')  setEvents(ev.value)
      if (ng.status === 'fulfilled')  setNgEvents(ng.value)
      if (rep.status === 'fulfilled') setReports(rep.value)
      setLoading(false)
    }
    load()
  }, [timeWindow])

  // ─── GPS location ──────────────────────────────────────
  useEffect(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      pos => setUserLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => setUserLocation({ lat: 9.082, lon: 8.6753 }) // Nigeria centre fallback
    )
  }, [])

  // ─── Real-time new reports subscription ────────────────
  useEffect(() => {
    const unsub = subscribeToReports(newReport => {
      setReports(prev => [newReport, ...prev])
      setNewReportCount(c => c + 1)
      // Auto-clear badge after 5s
      setTimeout(() => setNewReportCount(c => Math.max(0, c - 1)), 5000)
    })
    return unsub
  }, [])

  // ─── Map coordinate lookup for events ─────────────────
  const EVENT_COORDS = {
    'Ukraine':      [48.379, 31.165],
    'Russia':       [61.524, 105.318],
    'Taiwan':       [23.698, 120.960],
    'China':        [35.861, 104.195],
    'Israel':       [31.046, 34.851],
    'Iran':         [32.427, 53.688],
    'Gaza':         [31.354, 34.308],
    'N. Korea':     [40.339, 127.510],
    'S. Korea':     [35.907, 127.766],
    'Syria':        [34.802, 38.996],
    'Iraq':         [33.223, 43.679],
    'Yemen':        [15.552, 48.516],
    'Nigeria':      [9.082, 8.675],
    'Sudan':        [12.862, 30.217],
    'Ethiopia':     [9.145, 40.489],
    'Myanmar':      [21.913, 95.956],
    'Afghanistan':  [33.939, 67.709],
    'Pakistan':     [30.375, 69.345],
    'India':        [20.593, 78.962],
    'USA':          [37.090, -95.712],
    'Europe':       [54.525, 15.255],
    'Global':       [20,   0],
  }
  const NG_STATE_COORDS = {
    'lagos':      [6.465, 3.406],
    'abuja':      [9.072, 7.491],
    'kano':       [12.002, 8.592],
    'rivers':     [4.815, 7.049],
    'kaduna':     [10.523, 7.438],
    'edo':        [6.335, 5.627],
    'borno':      [11.846, 13.160],
    'oyo':        [7.850, 3.930],
    'delta':      [5.680, 5.680],
    'enugu':      [6.441, 7.498],
    'anambra':    [6.221, 6.937],
    'imo':        [5.572, 7.058],
    'kogi':       [7.800, 6.741],
    'plateau':    [9.218, 9.518],
    'niger':      [9.638, 5.991],
    'zamfara':    [12.170, 6.221],
    'kebbi':      [12.452, 4.199],
    'sokoto':     [13.064, 5.244],
    'kwara':      [8.967, 4.387],
    'ogun':       [6.998, 3.473],
    'ondo':       [7.252, 5.195],
    'ekiti':      [7.719, 5.311],
    'osun':       [7.563, 4.559],
    'benue':      [7.340, 8.130],
    'nassarawa':  [8.497, 8.520],
    'bauchi':     [10.313, 9.844],
    'gombe':      [10.290, 11.167],
    'adamawa':    [9.326, 12.395],
    'yobe':       [12.294, 11.439],
    'taraba':     [7.999, 10.773],
    'cross river':[5.871, 8.599],
    'akwa ibom':  [4.905, 7.853],
    'abia':       [5.416, 7.505],
    'bayelsa':    [4.772, 6.065],
    'federal':    [9.072, 7.491],
  }

  // ─── Build and render map ──────────────────────────────
  useEffect(() => {
    if (!L || !mapRef.current) return
    if (mapInstance.current) return // already init

    // Dark map tiles (CartoDB dark matter — free)
    mapInstance.current = L.map(mapRef.current, {
      center: userLocation ? [userLocation.lat, userLocation.lon] : [9.082, 8.675],
      zoom: userLocation ? 10 : 6,
      zoomControl: false,
    })

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '©OpenStreetMap ©CartoDB',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(mapInstance.current)

    // Zoom control top-right
    L.control.zoom({ position: 'topright' }).addTo(mapInstance.current)

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove()
        mapInstance.current = null
      }
    }
  }, [L]) // eslint-disable-line

  // ─── Render markers whenever data/layers change ────────
  useEffect(() => {
    if (!L || !mapInstance.current) return

    // Clear existing markers
    markersRef.current.forEach(m => m.remove())
    markersRef.current = []

    const addMarker = (lat, lon, color, emoji, data) => {
      if (!lat || !lon || isNaN(lat) || isNaN(lon)) return
      const icon = L.divIcon({
        className: '',
        html: `<div style="
          width:28px;height:28px;border-radius:50%;
          background:radial-gradient(circle at 35% 35%,${color}44,${color}22);
          border:2px solid ${color};
          box-shadow:0 0 10px ${color}88,0 0 20px ${color}33;
          display:flex;align-items:center;justify-content:center;
          font-size:13px;cursor:pointer;
          transition:transform 0.2s;
        ">${emoji}</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      })
      const marker = L.marker([lat, lon], { icon })
        .addTo(mapInstance.current)
        .on('click', () => setSelectedEvent(data))
      markersRef.current.push(marker)
    }

    // ── Global events ──────────────────────────────────
    if (layers.global) {
      events.forEach(ev => {
        const coords = EVENT_COORDS[ev.country] || EVENT_COORDS['Global']
        // Add small random offset to prevent stacking
        const lat = coords[0] + (Math.random() - 0.5) * 1.5
        const lon = coords[1] + (Math.random() - 0.5) * 1.5
        const color = SEVERITY_COLOR[ev.severity] || MUTED
        const emoji = ev.category==='military'?'⚔️':ev.category==='cyber'?'💻':ev.category==='unrest'?'✊':'📡'
        addMarker(lat, lon, color, emoji, { ...ev, _type: 'global' })
      })
    }

    // ── Nigerian news events ───────────────────────────
    if (layers.nigeria) {
      ngEvents.forEach(ev => {
        const coords = NG_STATE_COORDS[ev.state?.toLowerCase()] || NG_STATE_COORDS['federal']
        const lat = coords[0] + (Math.random() - 0.5) * 0.3
        const lon = coords[1] + (Math.random() - 0.5) * 0.3
        const color = ev.severity==='CRITICAL'?DANGER:ev.severity==='HIGH'?WARNING:BGLOW
        const emoji = ev.category==='security'?'🛡️':ev.category==='government'?'🏛️':ev.category==='economy'?'💰':'📰'
        addMarker(lat, lon, color, emoji, { ...ev, _type: 'nigeria' })
      })
    }

    // ── Community reports ──────────────────────────────
    if (layers.community) {
      const now = Date.now()
      const cutoff = now - timeWindow * 60 * 60 * 1000
      reports
        .filter(r => new Date(r.created_at).getTime() > cutoff)
        .forEach(r => {
          if (!r.lat || !r.lon) return
          const it = getIncidentType(r.type)
          addMarker(r.lat, r.lon, it.color, it.emoji,
            { ...r, title: r.title||it.label, _type: 'community' })
        })
    }

    // ── User location marker ───────────────────────────
    if (userLocation) {
      const youIcon = L.divIcon({
        className: '',
        html: `<div style="
          width:16px;height:16px;border-radius:50%;
          background:${BGLOW};
          border:3px solid white;
          box-shadow:0 0 0 4px ${BGLOW}44,0 0 20px ${BGLOW}88;
        "/>`,
        iconSize: [16, 16], iconAnchor: [8, 8],
      })
      const youMarker = L.marker([userLocation.lat, userLocation.lon], { icon: youIcon, zIndexOffset: 1000 })
        .addTo(mapInstance.current)
      markersRef.current.push(youMarker)
    }

  }, [L, events, ngEvents, reports, layers, timeWindow, userLocation])

  // ─── Submit report handler ─────────────────────────────
  const handleSubmitReport = useCallback(async (reportData) => {
    if (!user) return false
    const result = await submitReport({ ...reportData, userId: user.id })
    if (result.success) {
      setReports(prev => [result.report, ...prev])
      return true
    }
    return false
  }, [user])

  const handleVerify = useCallback(async (reportId) => {
    if (!user) return
    await verifyReport(reportId, user.id)
    setReports(prev => prev.map(r =>
      r.id === reportId ? { ...r, verified_count: (r.verified_count||0) + 1 } : r
    ))
    setSelectedEvent(prev => prev ? { ...prev, verified_count: (prev.verified_count||0) + 1 } : prev)
  }, [user])

  const toggleLayer = (key) => setLayers(prev => ({ ...prev, [key]: !prev[key] }))

  const LAYERS = [
    { key: 'global',    label: '🌍', title: 'Global', color: BGLOW },
    { key: 'nigeria',   label: '🇳🇬', title: 'Nigeria', color: SUCCESS },
    { key: 'community', label: '👥', title: 'Community', color: DANGER },
  ]

  const TIME_OPTIONS = [
    { value: 6,   label: '6h' },
    { value: 24,  label: '24h' },
    { value: 72,  label: '3d' },
    { value: 168, label: '7d' },
  ]

  const totalMarkers = (layers.global ? events.length : 0)
    + (layers.nigeria ? ngEvents.length : 0)
    + (layers.community ? reports.length : 0)

  return (
    <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: 16, margin: '0 -20px' }}>

      {/* Map container */}
      <div ref={mapRef} style={{ flex: 1, minHeight: 0, background: '#0a0f1a' }}>
        {(!L || loading) && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 10, gap: 12 }}>
            <div style={{ fontSize: 32 }}>🌍</div>
            <div style={{ fontSize: 13, color: MUTED }}>Loading intelligence map...</div>
            <div style={{ fontSize: 11, color: MUTED+'88' }}>{loading ? 'Fetching live data...' : 'Rendering map...'}</div>
          </div>
        )}
      </div>

      {/* Top controls bar */}
      <div style={{
        position: 'absolute', top: 10, left: 12, right: 12, zIndex: 500,
        display: 'flex', gap: 6, alignItems: 'center',
      }}>
        {/* Layer toggles */}
        <div style={{ display: 'flex', gap: 5, background: `${BG}CC`, borderRadius: 12, padding: '5px 8px', backdropFilter: 'blur(8px)', border: `1px solid ${SL}` }}>
          {LAYERS.map(l => (
            <button key={l.key} onClick={() => toggleLayer(l.key)} title={l.title} style={{
              padding: '4px 8px', borderRadius: 8, border: 'none', cursor: 'pointer', outline: 'none', fontSize: 13,
              background: layers[l.key] ? `${l.color}22` : 'transparent',
              opacity: layers[l.key] ? 1 : 0.4,
              borderWidth: 1, borderStyle: 'solid', borderColor: layers[l.key] ? `${l.color}55` : 'transparent',
            }}>
              {l.label}
            </button>
          ))}
        </div>

        {/* Marker count */}
        <div style={{ background: `${BG}CC`, borderRadius: 10, padding: '5px 10px', backdropFilter: 'blur(8px)', border: `1px solid ${SL}`, fontSize: 10, color: BGLOW, fontWeight: 700, fontFamily: "'SF Mono',monospace" }}>
          {totalMarkers} events
        </div>

        {/* New report badge */}
        {newReportCount > 0 && (
          <div style={{ background: `${DANGER}22`, borderRadius: 10, padding: '5px 10px', border: `1px solid ${DANGER}44`, fontSize: 10, color: DANGER, fontWeight: 700, animation: 'fadeUp 0.3s ease' }}>
            +{newReportCount} new
          </div>
        )}
      </div>

      {/* Time slider */}
      <div style={{
        position: 'absolute', bottom: selectedEvent || showReport ? 180 : 70, left: 12, right: 12, zIndex: 500,
        display: 'flex', gap: 5, justifyContent: 'center',
      }}>
        <div style={{ display: 'flex', gap: 4, background: `${BG}DD`, borderRadius: 10, padding: '4px 6px', backdropFilter: 'blur(8px)', border: `1px solid ${SL}` }}>
          <span style={{ fontSize: 10, color: MUTED, padding: '3px 4px', alignSelf: 'center' }}>⏱</span>
          {TIME_OPTIONS.map(t => (
            <button key={t.value} onClick={() => setTimeWindow(t.value)} style={{
              padding: '4px 10px', borderRadius: 7, border: 'none', cursor: 'pointer', outline: 'none',
              background: timeWindow === t.value ? BGLOW : 'transparent',
              color: timeWindow === t.value ? '#fff' : MUTED,
              fontSize: 11, fontWeight: 600,
            }}>{t.label}</button>
          ))}
        </div>
      </div>

      {/* Report button */}
      {!showReport && !selectedEvent && (
        <div style={{ position: 'absolute', bottom: 16, right: 16, zIndex: 500 }}>
          <button onClick={() => { if (user) setShowReport(true) }} style={{
            width: 52, height: 52, borderRadius: '50%', border: 'none', cursor: 'pointer', outline: 'none',
            background: `linear-gradient(135deg,#EF4444,#DC2626)`,
            boxShadow: `0 4px 20px #EF444488`,
            fontSize: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'relative',
          }}>
            🚨
          </button>
          {!user && (
            <div style={{ position: 'absolute', bottom: 56, right: 0, background: BGL, borderRadius: 8, padding: '5px 10px', fontSize: 10, color: MUTED, whiteSpace: 'nowrap', border: `1px solid ${SL}` }}>
              Sign in to report
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      {!selectedEvent && !showReport && (
        <div style={{
          position: 'absolute', bottom: 16, left: 12, zIndex: 500,
          background: `${BG}DD`, borderRadius: 10, padding: '8px 10px', backdropFilter: 'blur(8px)', border: `1px solid ${SL}`,
        }}>
          {[
            { color: DANGER, label: 'Critical' },
            { color: WARNING, label: 'High' },
            { color: BGLOW, label: 'Medium' },
            { color: DANGER, label: 'Community', dot: true },
          ].map((l, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: i < 3 ? 4 : 0 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: l.color, boxShadow: l.dot ? `0 0 0 2px ${l.color}44` : `0 0 6px ${l.color}` }} />
              <span style={{ fontSize: 9, color: MUTED }}>{l.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      {showReport && (
        <ReportModal
          onClose={() => setShowReport(false)}
          onSubmit={handleSubmitReport}
          userLocation={userLocation}
        />
      )}

      {selectedEvent && !showReport && (
        <EventPanel
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onVerify={handleVerify}
          user={user}
        />
      )}
    </div>
  )
}
