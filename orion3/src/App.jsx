import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase, hasSupabase } from './lib/supabase'
import { generateBrief, generateLocalForecast, hasGroq } from './lib/groq'
import { subscribeToPush, unsubscribeFromPush, notify, getPushStatus, registerSW } from './lib/push'
import {
  fetchEvents, fetchCII, fetchRegions, fetchMarkets, fetchBrief,
  fetchHyperLocal, reverseGeocode, MOCK_CII
} from './api/worldmonitor'

// ─── TOKENS ──────────────────────────────────────────────
const BG='#0D1117',BGL='#141B24',SD='#070A0E',SL='rgba(255,255,255,0.06)'
const BGLOW='#60A5FA',CYAN='#22D3EE',WHITE='#E8F0FF',MUTED='#5A7A96'
const DANGER='#EF4444',WARNING='#F59E0B',SUCCESS='#10B981',PURPLE='#A78BFA',BLUE='#3B82F6'
const N={
  raised:`6px 6px 14px ${SD},-3px -3px 10px ${SL}`,
  raisedLg:`10px 10px 24px ${SD},-5px -5px 16px ${SL}`,
  raisedSm:`3px 3px 8px ${SD},-2px -2px 6px ${SL}`,
  inset:`inset 4px 4px 10px ${SD},inset -2px -2px 7px ${SL}`,
  insetSm:`inset 2px 2px 6px ${SD},inset -1px -1px 4px ${SL}`,
}

// ─── ICONS ───────────────────────────────────────────────
const IC = {
  bolt:<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>,
  signal:<><path d="M2 20h.01M7 20v-4M12 20V10M17 20V4"/></>,
  eye:<><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>,
  trending:<><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></>,
  location:<><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></>,
  bell:<><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></>,
  filter:<><line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="12" y1="18" x2="12.01" y2="18"/></>,
  refresh:<><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></>,
  ship:<><path d="M2 20a2.4 2.4 0 002 1 2.4 2.4 0 002-1 2.4 2.4 0 012-1 2.4 2.4 0 012 1 2.4 2.4 0 002 1 2.4 2.4 0 002-1 2.4 2.4 0 012-1 2.4 2.4 0 012 1"/><path d="M4 18l-1-5h18l-2 5"/></>,
  wifi:<><path d="M5 12.55a11 11 0 0114.08 0M1.42 9a16 16 0 0121.16 0M8.53 16.11a6 6 0 016.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></>,
  alert:<><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>,
  fire:<path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 2.5z"/>,
  target:<><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></>,
  globe:<><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></>,
  chevU:<polyline points="18 15 12 9 6 15"/>,
  chevD:<polyline points="6 9 12 15 18 9"/>,
  chevR:<polyline points="9 18 15 12 9 6"/>,
  close:<><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>,
  bookmark:<path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/>,
  arrowUp:<><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></>,
  arrowDown:<><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></>,
  minus:<line x1="5" y1="12" x2="19" y2="12"/>,
  check:<polyline points="20 6 9 17 4 12"/>,
  plus:<><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>,
  shield:<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>,
  brain:<path d="M9.5 2A2.5 2.5 0 007 4.5 2.5 2.5 0 004.5 7 2.5 2.5 0 002 9.5v5A2.5 2.5 0 004.5 17 2.5 2.5 0 007 19.5 2.5 2.5 0 009.5 22h5a2.5 2.5 0 002.5-2.5 2.5 2.5 0 002.5-2.5A2.5 2.5 0 0022 14.5v-5A2.5 2.5 0 0019.5 7 2.5 2.5 0 0017 4.5 2.5 2.5 0 0014.5 2z"/>,
  scan:<><path d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2"/><line x1="7" y1="12" x2="17" y2="12"/></>,
  mic:<><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8"/></>,
  newspaper:<><path d="M4 22h16a2 2 0 002-2V4a2 2 0 00-2-2H8a2 2 0 00-2 2v16a2 2 0 01-2 2zm0 0a2 2 0 01-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8M15 18h-5M10 6h8v4h-8z"/></>,
  suitcase:<><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/></>,
  calendar:<><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>,
  exLink:<><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></>,
  lock:<><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></>,
  star:<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>,
  user:<><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></>,
  mail:<><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></>,
}
const I = ({n,s=16,c=WHITE,style={}}) => (
  <span style={{display:'inline-flex',alignItems:'center',flexShrink:0,...style}}>
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{IC[n]}</svg>
  </span>
)

// ─── STAR FIELD ──────────────────────────────────────────
function StarField() {
  const ref = useRef(null)
  useEffect(() => {
    const c = ref.current; if (!c) return
    const ctx = c.getContext('2d')
    const resize = () => { c.width = window.innerWidth; c.height = window.innerHeight }
    resize(); window.addEventListener('resize', resize)
    const stars = Array.from({length:70},()=>({x:Math.random(),y:Math.random(),r:Math.random()*0.5+0.1,o:Math.random()*0.07+0.02,s:Math.random()*0.001+0.0003,p:Math.random()*Math.PI*2}))
    let frame
    const draw = t => {
      ctx.clearRect(0,0,c.width,c.height)
      stars.forEach(s=>{ctx.beginPath();ctx.arc(s.x*c.width,s.y*c.height,s.r,0,Math.PI*2);ctx.fillStyle=`rgba(180,210,255,${s.o+Math.sin(t*s.s+s.p)*0.015})`;ctx.fill()})
      frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)
    return () => { cancelAnimationFrame(frame); window.removeEventListener('resize', resize) }
  }, [])
  return <canvas ref={ref} style={{position:'fixed',inset:0,width:'100%',height:'100%',pointerEvents:'none',zIndex:0,opacity:0.4}}/>
}

// ─── LOGO ────────────────────────────────────────────────
function Logo({size=34}) {
  const pts=[{x:.50,y:.06},{x:.84,y:.26},{x:.16,y:.26},{x:.74,y:.52},{x:.50,y:.48},{x:.26,y:.52},{x:.66,y:.84},{x:.34,y:.84}]
  const lines=[[0,1],[0,2],[1,2],[1,3],[2,5],[3,4],[4,5],[3,6],[5,7]]
  return (
    <svg width={size} height={size} viewBox="0 0 1 1">
      <defs><filter id="lf"><feGaussianBlur stdDeviation="0.03" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
      {lines.map(([a,b],i)=><line key={i} x1={pts[a].x} y1={pts[a].y} x2={pts[b].x} y2={pts[b].y} stroke="rgba(96,165,250,0.22)" strokeWidth="0.03" strokeLinecap="round"/>)}
      {pts.map((p,i)=><circle key={i} cx={p.x} cy={p.y} r={i===0?.068:i<=2?.044:.032} fill={i===0?CYAN:i<=2?BGLOW:BLUE} filter="url(#lf)" opacity={i===0?1:.8}/>)}
    </svg>
  )
}

// ─── PRIMITIVES ──────────────────────────────────────────
function Surface({children,style={},inset=false,glow=false,glowC=BLUE,onClick,r=20}) {
  const [hov,setHov] = useState(false)
  return (
    <div
      onMouseEnter={()=>!inset&&setHov(true)}
      onMouseLeave={()=>setHov(false)}
      onClick={onClick}
      style={{
        background: inset ? SD : `linear-gradient(145deg,${BGL} 0%,${BG} 100%)`,
        borderRadius: r,
        boxShadow: inset ? N.inset : hov
          ? `8px 8px 20px ${SD},-4px -4px 14px ${SL}${glow?`,0 0 28px ${glowC}33`:''}`
          : `6px 6px 16px ${SD},-3px -3px 10px ${SL}${glow?`,0 0 18px ${glowC}22`:''}`,
        transition: 'all 0.28s cubic-bezier(0.4,0,0.2,1)',
        transform: hov&&!inset ? 'translateY(-1px)' : 'none',
        position: 'relative', overflow: 'hidden',
        cursor: onClick ? 'pointer' : 'default',
        ...style,
      }}
    >
      {!inset && <div style={{position:'absolute',top:0,left:0,right:0,height:1,background:'linear-gradient(90deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03),transparent)',pointerEvents:'none',borderRadius:`${r}px ${r}px 0 0`}}/>}
      {children}
    </div>
  )
}

function Badge({label,variant='blue',dot=false}) {
  const V = {blue:{c:BGLOW,g:'rgba(59,130,246,0.28)'},danger:{c:'#FCA5A5',g:'rgba(239,68,68,0.28)'},warning:{c:'#FCD34D',g:'rgba(245,158,11,0.28)'},success:{c:'#6EE7B7',g:'rgba(16,185,129,0.28)'},muted:{c:MUTED,g:'transparent'},cyan:{c:CYAN,g:'rgba(34,211,238,0.25)'},purple:{c:PURPLE,g:'rgba(167,139,250,0.25)'}}
  const v = V[variant]||V.blue
  return (
    <span style={{display:'inline-flex',alignItems:'center',gap:4,padding:'3px 9px',borderRadius:99,background:`linear-gradient(145deg,${BGL},${BG})`,boxShadow:`2px 2px 6px ${SD},-1px -1px 4px ${SL},0 0 10px ${v.g}`,color:v.c,fontSize:10,fontWeight:700,letterSpacing:'0.06em',textTransform:'uppercase',fontFamily:"'SF Mono','Fira Code',monospace",textShadow:`0 0 8px ${v.c}88`,whiteSpace:'nowrap'}}>
      {dot && <span style={{width:4,height:4,borderRadius:'50%',background:v.c,boxShadow:`0 0 6px ${v.c}`,flexShrink:0,animation:variant==='danger'?'bp 1.4s infinite':'none'}}/>}
      {label}
    </span>
  )
}

function Btn({children,variant='default',sz='md',icon,onClick,full,disabled=false}) {
  const [p,setP] = useState(false)
  const SS = {sm:{px:14,py:8,fs:12,r:11},md:{px:20,py:12,fs:13,r:13},lg:{px:28,py:14,fs:14,r:15}}[sz]||{px:20,py:12,fs:13,r:13}
  const V = {
    default:{bg:`linear-gradient(145deg,${BGL},${BG})`,col:WHITE,sh:p?N.inset:N.raised},
    primary:{bg:p?`linear-gradient(145deg,#2563EB,#3B82F6)`:`linear-gradient(145deg,#4F9EFF,#3B82F6)`,col:'#fff',sh:p?`inset 3px 3px 8px rgba(30,58,138,0.6)`:`${N.raised},0 0 22px rgba(59,130,246,0.28)`},
    ghost:{bg:'transparent',col:BGLOW,sh:'none'},
    danger:{bg:`linear-gradient(145deg,#F87171,#EF4444)`,col:'#fff',sh:`${N.raised},0 0 18px rgba(239,68,68,0.25)`},
    success:{bg:`linear-gradient(145deg,#34D399,#10B981)`,col:'#fff',sh:`${N.raised},0 0 18px rgba(16,185,129,0.25)`},
  }
  const v = V[variant]||V.default
  return (
    <button onMouseDown={()=>setP(true)} onMouseUp={()=>setP(false)} onMouseLeave={()=>setP(false)} onClick={onClick} disabled={disabled}
      style={{display:'inline-flex',alignItems:'center',justifyContent:'center',gap:7,padding:`${SS.py}px ${SS.px}px`,borderRadius:SS.r,border:'none',background:v.bg,color:v.col,boxShadow:v.sh,fontSize:SS.fs,fontWeight:600,letterSpacing:'0.02em',cursor:disabled?'not-allowed':'pointer',transition:'all 0.14s cubic-bezier(0.4,0,0.2,1)',fontFamily:"'SF Pro Display',-apple-system,sans-serif",width:full?'100%':'auto',transform:p?'scale(0.98)':'scale(1)',outline:'none',opacity:disabled?0.5:1}}>
      {icon && <I n={icon} s={SS.fs} c={v.col}/>}
      {children}
    </button>
  )
}

function IBtn({icon,size=38,color=BGLOW,active=false,badge=false,onClick}) {
  const [p,setP] = useState(false)
  return (
    <button onMouseDown={()=>setP(true)} onMouseUp={()=>setP(false)} onMouseLeave={()=>setP(false)} onClick={onClick}
      style={{width:size,height:size,borderRadius:'50%',border:'none',background:`radial-gradient(circle at 35% 35%,${BGL},${BG})`,boxShadow:(p||active)?(`${N.inset}${active?`,0 0 14px ${color}44`:''}`):`${N.raised}`,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',transition:'all 0.14s',transform:p?'scale(0.95)':'scale(1)',outline:'none',position:'relative',flexShrink:0}}>
      <I n={icon} s={size*0.4} c={active?color:MUTED} style={{filter:active?`drop-shadow(0 0 5px ${color})`:''}}/>
      {badge && <span style={{position:'absolute',top:5,right:5,width:7,height:7,borderRadius:'50%',background:DANGER,boxShadow:`0 0 8px ${DANGER}`,border:`1px solid ${BG}`}}/>}
    </button>
  )
}

function Bar({label,value,color=BLUE,hint}) {
  return (
    <div style={{marginBottom:12}}>
      <div style={{display:'flex',justifyContent:'space-between',marginBottom:5}}>
        <span style={{fontSize:12,color:WHITE,fontWeight:500}}>{label}{hint&&<span style={{fontSize:10,color:MUTED,marginLeft:6}}>— {hint}</span>}</span>
        <span style={{fontSize:12,color,fontWeight:700,fontFamily:"'SF Mono',monospace",textShadow:`0 0 8px ${color}88`}}>{value}%</span>
      </div>
      <div style={{height:6,borderRadius:5,background:SD,boxShadow:N.inset,overflow:'hidden',position:'relative'}}>
        <div style={{position:'absolute',top:0,left:0,bottom:0,width:`${value}%`,background:`linear-gradient(90deg,${color}77,${color})`,borderRadius:5,boxShadow:`0 0 10px ${color}88`,transition:'width 1.2s cubic-bezier(0.4,0,0.2,1)'}}/>
        <div style={{position:'absolute',top:0,left:0,bottom:0,width:`${value}%`,background:'linear-gradient(180deg,rgba(255,255,255,0.16) 0%,transparent 60%)',borderRadius:5,transition:'width 1.2s cubic-bezier(0.4,0,0.2,1)'}}/>
      </div>
    </div>
  )
}

function Sparkline({data,color=BGLOW,width=80,height=30}) {
  const min=Math.min(...data),max=Math.max(...data),range=max-min||1
  const pts=data.map((v,i)=>({x:(i/(data.length-1))*width,y:height-((v-min)/range)*height*0.8-height*0.1}))
  const path=pts.map((p,i)=>`${i===0?'M':'L'}${p.x},${p.y}`).join(' ')
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <defs><linearGradient id={`sg${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.3"/><stop offset="100%" stopColor={color} stopOpacity="0"/></linearGradient></defs>
      <path d={`${path} L${width},${height} L0,${height} Z`} fill={`url(#sg${color.replace('#','')})`}/>
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" style={{filter:`drop-shadow(0 0 3px ${color})`}}/>
      <circle cx={pts[pts.length-1].x} cy={pts[pts.length-1].y} r={2.5} fill={color} style={{filter:`drop-shadow(0 0 4px ${color})`}}/>
    </svg>
  )
}

function useToast() {
  const [msg,setMsg] = useState('')
  const show = useCallback((m) => { setMsg(m); setTimeout(()=>setMsg(''),2200) }, [])
  function Toast() {
    return <div style={{position:'fixed',bottom:90,left:'50%',transform:`translateX(-50%) translateY(${msg?'0':'16px'})`,opacity:msg?1:0,transition:'all 0.3s',zIndex:200,pointerEvents:'none',background:`linear-gradient(145deg,${BGL},${BG})`,boxShadow:`${N.raised},0 0 18px rgba(59,130,246,0.15)`,padding:'9px 18px',borderRadius:12,fontSize:12,fontWeight:600,color:WHITE,whiteSpace:'nowrap'}}>{msg}</div>
  }
  return {show,Toast}
}

// ─── LIVE TICKER ─────────────────────────────────────────
const TICKS = ['CRITICAL · Naval formation — Taiwan Strait','HIGH · Internet outage spreading — Eastern Europe','WATCH · Protests growing — Tehran','HIGH · Military surge — Korean Peninsula','CRITICAL · APT-41 activity — SE Asia Finance']
function LiveTicker() {
  const [idx,setIdx] = useState(0)
  const [fade,setFade] = useState(true)
  useEffect(()=>{const t=setInterval(()=>{setFade(false);setTimeout(()=>{setIdx(i=>(i+1)%TICKS.length);setFade(true)},350)},3500);return()=>clearInterval(t)},[])
  return (
    <Surface inset style={{padding:'7px 14px',borderRadius:10,display:'flex',alignItems:'center',gap:10}}>
      <div style={{display:'flex',alignItems:'center',gap:5,flexShrink:0}}>
        <span style={{width:5,height:5,borderRadius:'50%',background:DANGER,boxShadow:`0 0 7px ${DANGER}`,animation:'bp 1.2s infinite'}}/>
        <span style={{fontSize:10,fontWeight:700,color:DANGER,letterSpacing:'0.08em',fontFamily:"'SF Mono',monospace"}}>LIVE</span>
      </div>
      <div style={{fontSize:11,color:MUTED,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',opacity:fade?1:0,transition:'opacity 0.3s',fontWeight:500,flex:1}}>{TICKS[idx]}</div>
    </Surface>
  )
}

// ─── GATE WALL ───────────────────────────────────────────
function GateWall({feature,onSignup,onLogin}) {
  const perks = ['Real-time threat alerts to your phone','Watchlist — track up to 5 countries','GeoEdge — Polymarket signal intelligence','My Area — GPS-based local intelligence','Travel Safety — destination monitoring']
  return (
    <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'24px',textAlign:'center'}}>
      <div style={{width:72,height:72,borderRadius:22,background:`radial-gradient(circle at 35% 35%,${BGL},${BG})`,boxShadow:`${N.raisedLg},0 0 28px ${BGLOW}22`,display:'flex',alignItems:'center',justifyContent:'center',marginBottom:20}}>
        <I n="lock" s={30} c={BGLOW} style={{filter:`drop-shadow(0 0 8px ${BGLOW})`}}/>
      </div>
      <div style={{fontSize:20,fontWeight:800,color:WHITE,marginBottom:8,letterSpacing:'-0.02em'}}>Unlock {feature}</div>
      <div style={{fontSize:13,color:MUTED,lineHeight:1.7,marginBottom:24,maxWidth:300}}>World Pulse and Daily Brief are free forever. Create a free account to unlock everything else.</div>
      <Surface inset style={{padding:'16px 20px',borderRadius:14,marginBottom:24,width:'100%',maxWidth:320,textAlign:'left'}}>
        <div style={{fontSize:11,color:BGLOW,fontWeight:700,letterSpacing:'0.08em',textTransform:'uppercase',marginBottom:10,fontFamily:"'SF Mono',monospace"}}>What you unlock</div>
        {perks.map((p,i)=>(
          <div key={i} style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
            <span style={{width:18,height:18,borderRadius:'50%',background:`linear-gradient(145deg,${BGL},${BG})`,boxShadow:N.raisedSm,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><I n="check" s={10} c={SUCCESS}/></span>
            <span style={{fontSize:12,color:MUTED}}>{p}</span>
          </div>
        ))}
      </Surface>
      <div style={{display:'flex',flexDirection:'column',gap:10,width:'100%',maxWidth:320}}>
        <Btn full variant="primary" sz="lg" icon="star" onClick={onSignup}>Create Free Account</Btn>
        <Btn full variant="ghost" sz="md" onClick={onLogin}>Sign In</Btn>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// SUPABASE AUTH SCREEN
// ═══════════════════════════════════════════════════════════
function AuthScreen({mode='signup',onSuccess,onBack}) {
  const [email,setEmail] = useState('')
  const [password,setPassword] = useState('')
  const [name,setName] = useState('')
  const [loading,setLoading] = useState(false)
  const [err,setErr] = useState('')
  const [confirmSent,setConfirmSent] = useState(false)

  const handle = async () => {
    if (!email || !password) { setErr('Email and password required'); return }
    if (mode==='signup' && password.length < 6) { setErr('Password must be at least 6 characters'); return }
    setLoading(true); setErr('')

    if (!supabase) {
      // No Supabase configured — use localStorage guest account
      const user = {id: Date.now().toString(), email, name: name||email.split('@')[0], watchlist:[], pushEnabled:false}
      localStorage.setItem('orion_user', JSON.stringify(user))
      onSuccess(user)
      return
    }

    try {
      if (mode === 'signup') {
        const {data, error} = await supabase.auth.signUp({
          email, password,
          options: { data: { name: name||email.split('@')[0] } }
        })
        if (error) { setErr(error.message); setLoading(false); return }
        if (data.user && !data.session) {
          setConfirmSent(true); setLoading(false); return
        }
        // Upsert profile
        if (data.user) {
          await supabase.from('profiles').upsert({ id: data.user.id, name: name||email.split('@')[0], watchlist: [], push_enabled: false })
        }
        onSuccess({ id: data.user.id, email, name: name||email.split('@')[0], watchlist: [], pushEnabled: false })
      } else {
        const {data, error} = await supabase.auth.signInWithPassword({ email, password })
        if (error) { setErr(error.message); setLoading(false); return }
        // Fetch profile
        const {data: prof} = await supabase.from('profiles').select('*').eq('id', data.user.id).single()
        onSuccess({ id: data.user.id, email, name: prof?.name||email.split('@')[0], watchlist: prof?.watchlist||[], pushEnabled: prof?.push_enabled||false })
      }
    } catch(e) {
      setErr('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  if (confirmSent) return (
    <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'32px 24px',textAlign:'center'}}>
      <div style={{width:64,height:64,borderRadius:20,background:`radial-gradient(circle at 35% 35%,${BGL},${BG})`,boxShadow:`${N.raisedLg},0 0 24px ${SUCCESS}33`,display:'flex',alignItems:'center',justifyContent:'center',marginBottom:20}}><I n="mail" s={28} c={SUCCESS} style={{filter:`drop-shadow(0 0 8px ${SUCCESS})`}}/></div>
      <div style={{fontSize:20,fontWeight:800,color:WHITE,marginBottom:8}}>Check your email</div>
      <div style={{fontSize:13,color:MUTED,lineHeight:1.7,maxWidth:280}}>We sent a confirmation link to <strong style={{color:WHITE}}>{email}</strong>. Click it to activate your account, then come back and sign in.</div>
      <div style={{marginTop:24}}><Btn variant="ghost" onClick={()=>onBack&&onBack()}>Back to Sign In</Btn></div>
    </div>
  )

  return (
    <div style={{flex:1,display:'flex',flexDirection:'column',padding:'0 24px'}}>
      <div style={{marginBottom:24}}>
        <div style={{fontSize:22,fontWeight:800,color:WHITE,marginBottom:6}}>{mode==='signup'?'Create your account':'Welcome back'}</div>
        <div style={{fontSize:13,color:MUTED}}>{mode==='signup'?'Free forever. No credit card.':'Sign in to your 0rion account.'}</div>
      </div>
      {!hasSupabase && (
        <Surface inset style={{padding:'11px 14px',borderRadius:12,marginBottom:14,background:'rgba(245,158,11,0.08)'}}>
          <div style={{fontSize:11,color:WARNING,lineHeight:1.6}}>⚠️ No Supabase configured — running in local mode. Your account will only exist on this device.</div>
        </Surface>
      )}
      {err && <Surface inset style={{padding:'10px 14px',borderRadius:11,marginBottom:14,background:'rgba(239,68,68,0.08)'}}><span style={{fontSize:12,color:DANGER}}>{err}</span></Surface>}
      {mode==='signup' && (
        <div style={{marginBottom:14}}>
          <div style={{fontSize:11,color:MUTED,fontWeight:600,letterSpacing:'0.08em',textTransform:'uppercase',marginBottom:6,fontFamily:"'SF Mono',monospace"}}>Your name</div>
          <Surface inset style={{padding:'12px 14px',borderRadius:12}}><input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Ada Okafor" style={{background:'none',border:'none',outline:'none',color:WHITE,fontSize:14,width:'100%',fontFamily:"'SF Pro Display',-apple-system,sans-serif"}}/></Surface>
        </div>
      )}
      {[{label:'Email address',val:email,set:setEmail,ph:'you@example.com',type:'email'},{label:'Password',val:password,set:setPassword,ph:mode==='signup'?'Min 6 characters':'Your password',type:'password'}].map(f=>(
        <div key={f.label} style={{marginBottom:14}}>
          <div style={{fontSize:11,color:MUTED,fontWeight:600,letterSpacing:'0.08em',textTransform:'uppercase',marginBottom:6,fontFamily:"'SF Mono',monospace"}}>{f.label}</div>
          <Surface inset style={{padding:'12px 14px',borderRadius:12}}><input type={f.type} value={f.val} onChange={e=>f.set(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handle()} placeholder={f.ph} style={{background:'none',border:'none',outline:'none',color:WHITE,fontSize:14,width:'100%',fontFamily:"'SF Pro Display',-apple-system,sans-serif"}}/></Surface>
        </div>
      ))}
      <Btn full variant="primary" sz="lg" onClick={handle} disabled={loading} style={{marginTop:8}}>{loading?(mode==='signup'?'Creating account...':'Signing in...'):(mode==='signup'?'Create Account':'Sign In')}</Btn>
      <div style={{marginTop:20,textAlign:'center',fontSize:12,color:MUTED}}>
        {mode==='signup'?<>Already have an account? <button onClick={()=>onBack&&onBack('login')} style={{background:'none',border:'none',color:BGLOW,cursor:'pointer',outline:'none',fontSize:12,fontWeight:600}}>Sign in</button></>:<>No account? <button onClick={()=>onBack&&onBack('signup')} style={{background:'none',border:'none',color:BGLOW,cursor:'pointer',outline:'none',fontSize:12,fontWeight:600}}>Create one free</button></>}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// ONBOARDING
// ═══════════════════════════════════════════════════════════
const COUNTRY_OPTS = [{code:'us',name:'United States',flag:'🇺🇸'},{code:'gb',name:'United Kingdom',flag:'🇬🇧'},{code:'ng',name:'Nigeria',flag:'🇳🇬'},{code:'za',name:'South Africa',flag:'🇿🇦'},{code:'in',name:'India',flag:'🇮🇳'},{code:'de',name:'Germany',flag:'🇩🇪'},{code:'fr',name:'France',flag:'🇫🇷'},{code:'jp',name:'Japan',flag:'🇯🇵'},{code:'au',name:'Australia',flag:'🇦🇺'},{code:'br',name:'Brazil',flag:'🇧🇷'},{code:'ca',name:'Canada',flag:'🇨🇦'},{code:'ae',name:'UAE',flag:'🇦🇪'},{code:'sg',name:'Singapore',flag:'🇸🇬'},{code:'gh',name:'Ghana',flag:'🇬🇭'},{code:'ke',name:'Kenya',flag:'🇰🇪'},{code:'mx',name:'Mexico',flag:'🇲🇽'}]
const WATCH_OPTS = [{code:'ua',name:'Ukraine',flag:'🇺🇦'},{code:'tw',name:'Taiwan',flag:'🇹🇼'},{code:'ir',name:'Iran',flag:'🇮🇷'},{code:'kp',name:'N. Korea',flag:'🇰🇵'},{code:'ru',name:'Russia',flag:'🇷🇺'},{code:'il',name:'Israel',flag:'🇮🇱'},{code:'cn',name:'China',flag:'🇨🇳'},{code:'pk',name:'Pakistan',flag:'🇵🇰'},{code:'sa',name:'Saudi Arabia',flag:'🇸🇦'},{code:'ve',name:'Venezuela',flag:'🇻🇪'},{code:'sy',name:'Syria',flag:'🇸🇾'},{code:'ly',name:'Libya',flag:'🇱🇾'}]

function Onboarding({onComplete}) {
  const [step,setStep] = useState(0) // 0=welcome, 1=auth, 2=home, 3=watchlist
  const [authMode,setAuthMode] = useState('signup')
  const [user,setUser] = useState(null)
  const [homeCountry,setHomeCountry] = useState('')
  const [watchlist,setWatchlist] = useState([])
  const [pushEnabled,setPushEnabled] = useState(false)

  const toggleW = (c) => setWatchlist(w=>w.includes(c)?w.filter(x=>x!==c):w.length<5?[...w,c]:w)

  const finish = async () => {
    const finalUser = {...user, homeCountry, watchlist, pushEnabled}
    // Save profile to Supabase if available
    if (supabase && user && user.id !== 'guest') {
      await supabase.from('profiles').upsert({ id: user.id, name: user.name, home_country: homeCountry, watchlist, push_enabled: pushEnabled })
    }
    localStorage.setItem('orion_user', JSON.stringify(finalUser))
    onComplete(finalUser)
  }

  const handlePush = async () => {
    const result = await subscribeToPush(user?.id || 'onboarding')
    setPushEnabled(result.ok)
  }

  if (step === 1) return (
    <div style={{position:'fixed',inset:0,zIndex:300,background:BG,display:'flex',justifyContent:'center'}}>
      <div style={{width:'100%',maxWidth:480,height:'100%',display:'flex',flexDirection:'column',position:'relative'}}>
        <StarField/>
        <div style={{position:'relative',zIndex:1,flex:1,display:'flex',flexDirection:'column',paddingTop:60}}>
          <div style={{display:'flex',alignItems:'center',gap:12,padding:'0 24px',marginBottom:28}}>
            <button onClick={()=>setStep(0)} style={{background:'none',border:'none',cursor:'pointer',color:MUTED,outline:'none'}}><I n="chevR" s={20} c={MUTED} style={{transform:'rotate(180deg)'}}/></button>
            <div style={{display:'flex',gap:6,flex:1}}>{[1,2,3].map(i=><div key={i} style={{height:3,flex:1,borderRadius:2,background:i<=1?BGLOW:SD,transition:'all 0.3s'}}/>)}</div>
          </div>
          <AuthScreen mode={authMode} onSuccess={u=>{setUser(u);setStep(2)}} onBack={(m)=>m?setAuthMode(m):setStep(0)}/>
        </div>
      </div>
    </div>
  )

  if (step === 2) return (
    <div style={{position:'fixed',inset:0,zIndex:300,background:BG,display:'flex',justifyContent:'center'}}>
      <div style={{width:'100%',maxWidth:480,height:'100%',display:'flex',flexDirection:'column',position:'relative',overflow:'hidden'}}>
        <StarField/>
        <div style={{position:'relative',zIndex:1,flex:1,display:'flex',flexDirection:'column',paddingTop:60,overflow:'hidden'}}>
          <div style={{display:'flex',alignItems:'center',gap:12,padding:'0 24px',marginBottom:28,flexShrink:0}}>
            <button onClick={()=>setStep(1)} style={{background:'none',border:'none',cursor:'pointer',outline:'none'}}><I n="chevR" s={20} c={MUTED} style={{transform:'rotate(180deg)'}}/></button>
            <div style={{display:'flex',gap:6,flex:1}}>{[1,2,3].map(i=><div key={i} style={{height:3,flex:1,borderRadius:2,background:i<=2?BGLOW:SD,transition:'all 0.3s'}}/>)}</div>
          </div>
          <div style={{padding:'0 24px',flexShrink:0}}>
            <div style={{fontSize:22,fontWeight:800,color:WHITE,marginBottom:6}}>Where are you based?</div>
            <div style={{fontSize:13,color:MUTED,marginBottom:20}}>Used for local intelligence and relevant alerts.</div>
          </div>
          <div style={{flex:1,overflowY:'auto',padding:'0 24px 100px'}}>
            {COUNTRY_OPTS.map(c=>(
              <Surface key={c.code} inset={homeCountry===c.code} glow={homeCountry===c.code} glowC={BGLOW} onClick={()=>setHomeCountry(c.code)} style={{padding:'12px 16px',cursor:'pointer',marginBottom:8}}>
                <div style={{display:'flex',alignItems:'center',gap:12}}><span style={{fontSize:22}}>{c.flag}</span><span style={{fontSize:14,fontWeight:600,color:WHITE,flex:1}}>{c.name}</span>{homeCountry===c.code&&<I n="check" s={16} c={SUCCESS}/>}</div>
              </Surface>
            ))}
          </div>
          <div style={{position:'absolute',bottom:0,left:0,right:0,padding:'12px 24px 24px',background:`linear-gradient(0deg,${BG} 60%,transparent 100%)`}}>
            <Btn full variant="primary" sz="lg" onClick={()=>setStep(3)} disabled={!homeCountry}>Continue</Btn>
          </div>
        </div>
      </div>
    </div>
  )

  if (step === 3) return (
    <div style={{position:'fixed',inset:0,zIndex:300,background:BG,display:'flex',justifyContent:'center'}}>
      <div style={{width:'100%',maxWidth:480,height:'100%',display:'flex',flexDirection:'column',position:'relative',overflow:'hidden'}}>
        <StarField/>
        <div style={{position:'relative',zIndex:1,flex:1,display:'flex',flexDirection:'column',paddingTop:60,overflow:'hidden'}}>
          <div style={{display:'flex',alignItems:'center',gap:12,padding:'0 24px',marginBottom:20,flexShrink:0}}>
            <button onClick={()=>setStep(2)} style={{background:'none',border:'none',cursor:'pointer',outline:'none'}}><I n="chevR" s={20} c={MUTED} style={{transform:'rotate(180deg)'}}/></button>
            <div style={{display:'flex',gap:6,flex:1}}>{[1,2,3].map(i=><div key={i} style={{height:3,flex:1,borderRadius:2,background:BGLOW,transition:'all 0.3s'}}/>)}</div>
          </div>
          <div style={{padding:'0 24px',flexShrink:0}}>
            <div style={{fontSize:22,fontWeight:800,color:WHITE,marginBottom:4}}>Pick your watchlist</div>
            <div style={{fontSize:13,color:MUTED,marginBottom:16}}>Track up to 5 countries. Change any time.</div>
          </div>
          <div style={{flex:1,overflowY:'auto',padding:'0 24px 120px'}}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:9,marginBottom:16}}>
              {WATCH_OPTS.map(c=>{const isS=watchlist.includes(c.code);return(
                <Surface key={c.code} inset={isS} glow={isS} glowC={BGLOW} onClick={()=>toggleW(c.code)} style={{padding:'10px 8px',cursor:'pointer',textAlign:'center'}}>
                  <div style={{fontSize:24,marginBottom:4}}>{c.flag}</div>
                  <div style={{fontSize:11,fontWeight:600,color:isS?WHITE:MUTED}}>{c.name}</div>
                  {isS&&<div style={{marginTop:4}}><I n="check" s={12} c={SUCCESS}/></div>}
                </Surface>
              )})}
            </div>
            <div style={{fontSize:11,color:MUTED,textAlign:'center',marginBottom:16}}>{watchlist.length}/5 selected</div>
            <Surface style={{padding:'14px 16px',cursor:'pointer',marginBottom:8}} onClick={handlePush}>
              <div style={{display:'flex',alignItems:'center',gap:12}}>
                <div style={{width:40,height:40,borderRadius:12,background:`radial-gradient(circle at 35% 35%,${BGL},${BG})`,boxShadow:`${N.raisedSm},0 0 12px ${pushEnabled?SUCCESS+'33':BGLOW+'22'}`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><I n="bell" s={18} c={pushEnabled?SUCCESS:BGLOW}/></div>
                <div style={{flex:1}}><div style={{fontWeight:600,fontSize:13,color:WHITE,marginBottom:2}}>Enable push alerts</div><div style={{fontSize:11,color:MUTED}}>Get notified when critical events hit</div></div>
                <div style={{width:36,height:20,borderRadius:10,background:pushEnabled?`linear-gradient(145deg,#34D399,#10B981)`:`linear-gradient(145deg,${BGL},${BG})`,boxShadow:pushEnabled?`${N.insetSm},0 0 10px ${SUCCESS}33`:N.raised,position:'relative',flexShrink:0}}><div style={{width:16,height:16,borderRadius:'50%',background:'#fff',boxShadow:N.raisedSm,position:'absolute',top:2,left:pushEnabled?18:2,transition:'left 0.2s'}}/></div>
              </div>
            </Surface>
          </div>
          <div style={{position:'absolute',bottom:0,left:0,right:0,padding:'12px 24px 24px',background:`linear-gradient(0deg,${BG} 60%,transparent 100%)`}}>
            <Btn full variant="primary" sz="lg" icon="check" onClick={finish}>Start Using 0rion</Btn>
          </div>
        </div>
      </div>
    </div>
  )

  // Step 0 — Welcome
  return (
    <div style={{position:'fixed',inset:0,zIndex:300,background:BG,display:'flex',justifyContent:'center'}}>
      <div style={{width:'100%',maxWidth:480,height:'100%',display:'flex',flexDirection:'column',position:'relative'}}>
        <StarField/>
        <div style={{position:'relative',zIndex:1,flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'0 24px',textAlign:'center'}}>
          <div style={{marginBottom:28}}>
            <div style={{width:90,height:90,borderRadius:28,background:`radial-gradient(circle at 35% 35%,${BGL},${BG})`,boxShadow:`${N.raisedLg},0 0 30px rgba(34,211,238,0.15)`,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 20px'}}><Logo size={54}/></div>
            <div style={{fontSize:34,fontWeight:900,letterSpacing:'-0.03em',background:`linear-gradient(135deg,${WHITE},${CYAN})`,WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',lineHeight:1,marginBottom:8}}>0rion</div>
            <div style={{fontSize:14,color:MUTED,lineHeight:1.7,maxWidth:280,margin:'0 auto'}}>Geopolitical intelligence for people who need to know what's happening — before it's news.</div>
          </div>
          <Surface inset style={{padding:'14px 18px',borderRadius:14,marginBottom:28,width:'100%',maxWidth:320,textAlign:'left'}}>
            {[{i:'bolt',c:DANGER,t:'Real-time threat signals from 100+ sources'},{i:'globe',c:BGLOW,t:'World Pulse — free forever'},{i:'trending',c:CYAN,t:'GeoEdge — signal to market alpha'},{i:'location',c:SUCCESS,t:'My Area — local intelligence via GPS'}].map(x=>(
              <div key={x.i} style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
                <div style={{width:28,height:28,borderRadius:8,background:`radial-gradient(circle at 35% 35%,${BGL},${BG})`,boxShadow:`${N.raisedSm},0 0 8px ${x.c}33`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><I n={x.i} s={13} c={x.c}/></div>
                <span style={{fontSize:12,color:WHITE,fontWeight:500}}>{x.t}</span>
              </div>
            ))}
          </Surface>
          <div style={{display:'flex',flexDirection:'column',gap:10,width:'100%',maxWidth:320}}>
            <Btn full variant="primary" sz="lg" icon="star" onClick={()=>setStep(1)}>Get Started — It's Free</Btn>
            <button onClick={()=>{const u={id:'guest',email:'',name:'Guest',homeCountry:'',watchlist:[],pushEnabled:false};localStorage.setItem('orion_user',JSON.stringify(u));onComplete(u)}} style={{background:'none',border:'none',color:MUTED,fontSize:12,cursor:'pointer',outline:'none',textDecoration:'underline',padding:'8px 0'}}>Explore without an account →</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// WORLD PULSE
// ═══════════════════════════════════════════════════════════
const SEV_C = {CRITICAL:DANGER,HIGH:'#F97316',MEDIUM:WARNING,LOW:SUCCESS,INFO:BGLOW}
const SEV_V = {CRITICAL:'danger',HIGH:'danger',MEDIUM:'warning',LOW:'success',INFO:'blue'}
const CAT_ICON = {military:'ship',cyber:'wifi',unrest:'fire',economic:'trending',environmental:'globe',intel:'target'}

// ✅ EventCard is a proper component — no hooks-in-map bug
function EventCard({ev,onDismiss}) {
  const [exp,setExp] = useState(false)
  const [out,setOut] = useState(false)
  const sc = SEV_C[ev.severity]||BGLOW
  const ago = () => { const d=Date.now()-ev.timestamp; if(d<60000)return 'Just now'; if(d<3600000)return `${Math.round(d/60000)}m ago`; return `${Math.round(d/3600000)}h ago` }
  return (
    <div style={{transform:out?'translateX(110%)':'translateX(0)',opacity:out?0:1,transition:'all 0.35s cubic-bezier(0.4,0,0.2,1)'}}>
      <Surface glow={ev.severity==='CRITICAL'} glowC={sc} style={{padding:0,overflow:'hidden'}} onClick={()=>setExp(e=>!e)}>
        <div style={{height:3,background:`linear-gradient(90deg,${sc},${sc}66)`,boxShadow:`0 0 10px ${sc}66`}}/>
        <div style={{padding:'14px 16px 12px'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:9}}>
            <div style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap'}}>
              <div style={{width:28,height:28,borderRadius:8,flexShrink:0,background:`radial-gradient(circle at 35% 35%,${BGL},${BG})`,boxShadow:`${N.raisedSm},0 0 10px ${sc}33`,display:'flex',alignItems:'center',justifyContent:'center'}}><I n={CAT_ICON[ev.category]||'globe'} s={12} c={sc} style={{filter:`drop-shadow(0 0 3px ${sc})`}}/></div>
              <Badge label={ev.severity} variant={SEV_V[ev.severity]} dot={ev.severity==='CRITICAL'}/>
              {ev.geoEdge&&<Badge label="GeoEdge" variant="cyan"/>}
            </div>
            <span style={{fontSize:10,color:MUTED,fontFamily:"'SF Mono',monospace",flexShrink:0,marginLeft:6}}>{ago()}</span>
          </div>
          <div style={{fontWeight:700,fontSize:13,color:WHITE,marginBottom:6,lineHeight:1.5}}>{ev.title}</div>
          <div style={{fontSize:12,color:MUTED,lineHeight:1.65,overflow:'hidden',maxHeight:exp?'150px':'36px',transition:'max-height 0.35s cubic-bezier(0.4,0,0.2,1)',marginBottom:10}}>{ev.description}</div>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:6}}>
            <div style={{display:'inline-flex',alignItems:'center',gap:6,padding:'5px 10px',borderRadius:8,background:SD,boxShadow:N.insetSm}}><span style={{fontSize:13}}>{ev.flag}</span><span style={{fontSize:11,color:BGLOW,fontWeight:500}}>{ev.region}</span></div>
            <div style={{display:'flex',gap:5}}>
              {ev.geoEdge&&<div style={{display:'inline-flex',alignItems:'center',gap:4,padding:'5px 9px',borderRadius:8,background:`radial-gradient(circle at 35% 35%,${BGL},${BG})`,boxShadow:`${N.raisedSm},0 0 10px ${CYAN}33`}}><I n="trending" s={10} c={CYAN}/><span style={{fontSize:10,color:CYAN,fontWeight:700,fontFamily:"'SF Mono',monospace"}}>TRADE</span></div>}
              <button onClick={e=>{e.stopPropagation();setOut(true);setTimeout(()=>onDismiss&&onDismiss(ev.id),350)}} style={{background:'none',border:'none',cursor:'pointer',padding:4,outline:'none'}}><I n="close" s={13} c={MUTED}/></button>
            </div>
          </div>
          {exp&&ev.tags.length>0&&<div style={{marginTop:8,display:'flex',gap:5,flexWrap:'wrap'}}>{ev.tags.map(t=><span key={t} style={{fontSize:10,color:MUTED,background:SD,boxShadow:N.insetSm,padding:'2px 7px',borderRadius:5,fontFamily:"'SF Mono',monospace"}}>{t}</span>)}</div>}
        </div>
        <div style={{borderTop:`1px solid rgba(255,255,255,0.03)`,padding:'6px',display:'flex',alignItems:'center',justifyContent:'center',gap:4}}><I n={exp?'chevU':'chevD'} s={11} c={MUTED}/><span style={{fontSize:9,color:MUTED,letterSpacing:'0.06em'}}>{exp?'COLLAPSE':'EXPAND'}</span></div>
      </Surface>
    </div>
  )
}

function WorldPulse() {
  const [events,setEvents] = useState([])
  const [loading,setLoading] = useState(true)
  const [filter,setFilter] = useState('all')
  const [dismissed,setDismissed] = useState(new Set())
  const {show,Toast} = useToast()

  useEffect(()=>{fetchEvents().then(e=>{setEvents(e);setLoading(false)});const t=setInterval(()=>fetchEvents().then(setEvents),30000);return()=>clearInterval(t)},[])

  const FILTERS = [{id:'all',label:'All',icon:'globe',c:BGLOW},{id:'military',label:'Military',icon:'ship',c:PURPLE},{id:'cyber',label:'Cyber',icon:'wifi',c:CYAN},{id:'unrest',label:'Unrest',icon:'fire',c:WARNING},{id:'critical',label:'Critical',icon:'alert',c:DANGER},{id:'intel',label:'Intel',icon:'target',c:SUCCESS}]
  const filtered = events.filter(e=>!dismissed.has(e.id)&&(filter==='all'||(filter==='critical'?e.severity==='CRITICAL':e.category===filter)))
  const critC = events.filter(e=>e.severity==='CRITICAL').length
  const highC = events.filter(e=>e.severity==='HIGH').length

  return (
    <div style={{flex:1,overflowY:'auto',paddingBottom:8}}>
      {loading ? (
        <div style={{display:'flex',flexDirection:'column',gap:12}}>{[1,2,3].map(i=><Surface key={i} style={{height:120,opacity:0.4}}/>)}</div>
      ) : (
        <>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:14}}>
            {[{l:'Critical',v:critC,c:DANGER,i:'alert'},{l:'High Risk',v:highC,c:WARNING,i:'bolt'},{l:'Active',v:events.length,c:BGLOW,i:'eye'}].map(s=>(
              <Surface key={s.l} style={{padding:'11px 13px'}}>
                <I n={s.i} s={14} c={s.c} style={{filter:`drop-shadow(0 0 4px ${s.c}88)`,marginBottom:6}}/>
                <div style={{fontSize:24,fontWeight:900,color:WHITE,lineHeight:1,textShadow:`0 0 18px ${s.c}44`}}>{s.v}</div>
                <div style={{fontSize:10,color:MUTED,marginTop:2}}>{s.l}</div>
              </Surface>
            ))}
          </div>
          <div style={{display:'flex',gap:7,marginBottom:13,overflowX:'auto',paddingBottom:2}}>
            {FILTERS.map(f=>{const isA=filter===f.id;return(
              <button key={f.id} onClick={()=>setFilter(f.id)} style={{display:'inline-flex',alignItems:'center',gap:5,padding:'7px 13px',borderRadius:11,border:'none',background:`linear-gradient(145deg,${BGL},${BG})`,boxShadow:isA?`${N.inset},0 0 14px ${f.c}33`:N.raisedSm,color:isA?f.c:MUTED,fontSize:12,fontWeight:600,cursor:'pointer',whiteSpace:'nowrap',flexShrink:0,outline:'none',textShadow:isA?`0 0 8px ${f.c}88`:'none'}}>
                <I n={f.icon} s={12} c={isA?f.c:MUTED}/>{f.label}
              </button>
            )})}
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:11}}>
            {filtered.length===0&&<Surface style={{padding:28,textAlign:'center'}}><I n="check" s={24} c={SUCCESS} style={{marginBottom:8,filter:`drop-shadow(0 0 8px ${SUCCESS})`}}/><div style={{fontSize:14,fontWeight:600,color:WHITE,marginBottom:4}}>All clear</div><div style={{fontSize:12,color:MUTED}}>No events matching this filter.</div></Surface>}
            {filtered.map((ev,i)=>(
              <div key={ev.id} style={{animation:`fadeUp 0.4s ${i*0.04}s ease both`,opacity:0,animationFillMode:'forwards'}}>
                <EventCard ev={ev} onDismiss={id=>{setDismissed(d=>new Set([...d,id]));show('Dismissed')}}/>
              </div>
            ))}
          </div>
        </>
      )}
      <div style={{height:20}}/>
      <Toast/>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// TENSION METER
// ═══════════════════════════════════════════════════════════
function Gauge({value,color,size=180}) {
  const [anim,setAnim] = useState(0)
  useEffect(()=>{const t=setTimeout(()=>setAnim(value),400);return()=>clearTimeout(t)},[value])
  const r=62,cx=size/2,cy=size*0.72
  const toR=d=>((d-90)*Math.PI)/180
  const arc=(from,to,rad)=>{const x1=cx+rad*Math.cos(toR(from)),y1=cy+rad*Math.sin(toR(from)),x2=cx+rad*Math.cos(toR(to)),y2=cy+rad*Math.sin(toR(to));return`M ${x1} ${y1} A ${rad} ${rad} 0 0 1 ${x2} ${y2}`}
  return (
    <div style={{width:size,height:size*0.72,background:`radial-gradient(ellipse at 40% 35%,${BGL},${BG})`,boxShadow:`inset 5px 5px 14px ${SD},inset -3px -3px 10px ${SL}`,borderRadius:`${size}px ${size}px 0 0`,position:'relative',overflow:'hidden',margin:'0 auto'}}>
      <svg width={size} height={size*0.72} viewBox={`0 0 ${size} ${size*0.72}`} style={{position:'absolute',inset:0}}>
        <defs><linearGradient id="gg" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor={SUCCESS}/><stop offset="50%" stopColor={WARNING}/><stop offset="100%" stopColor={DANGER}/></linearGradient><filter id="gf"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
        <path d={arc(-90,90,r)} fill="none" stroke={SD} strokeWidth="11" strokeLinecap="round"/>
        <path d={arc(-90,Math.min(-90+anim*1.8,90),r)} fill="none" stroke="url(#gg)" strokeWidth="11" strokeLinecap="round" style={{transition:'all 1.3s cubic-bezier(0.4,0,0.2,1)',filter:`drop-shadow(0 0 5px ${color})`}}/>
        <line x1={cx} y1={cy} x2={cx+(r-16)*Math.cos(toR(-90+anim*1.8))} y2={cy+(r-16)*Math.sin(toR(-90+anim*1.8))} stroke={color} strokeWidth="2.5" strokeLinecap="round" filter="url(#gf)" style={{transition:'all 1.3s cubic-bezier(0.4,0,0.2,1)'}}/>
        <circle cx={cx} cy={cy} r={7} fill={BG} style={{filter:`drop-shadow(3px 3px 5px ${SD}) drop-shadow(-2px -2px 4px ${SL})`}}/>
        <circle cx={cx} cy={cy} r={3.5} fill={color} style={{filter:`drop-shadow(0 0 5px ${color})`}}/>
        <text x={cx} y={cy-26} textAnchor="middle" fill={WHITE} fontSize="26" fontWeight="900" fontFamily="'SF Pro Display',-apple-system,sans-serif">{anim}</text>
        <text x={cx} y={cy-11} textAnchor="middle" fill={MUTED} fontSize="8" fontFamily="'SF Mono',monospace" letterSpacing="0.1em">/100</text>
      </svg>
    </div>
  )
}

// ✅ RegionRow is a proper component
function RegionRow({r,selected,onSelect}) {
  const isS = selected===r.id
  return (
    <Surface inset={isS} glow={isS} glowC={r.color} onClick={()=>onSelect(isS?null:r.id)} style={{padding:'12px 16px',cursor:'pointer'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <div style={{width:36,height:36,borderRadius:10,background:`radial-gradient(circle at 35% 35%,${BGL},${BG})`,boxShadow:N.raisedSm,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>{r.flag}</div>
          <div><div style={{fontWeight:600,fontSize:13,color:WHITE}}>{r.label}</div><div style={{fontSize:11,color:MUTED,marginTop:1}}>{r.events} active signals</div></div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{fontSize:22,fontWeight:800,color:r.color,fontFamily:"'SF Mono',monospace",textShadow:`0 0 12px ${r.color}66`}}>{r.score}</div>
          <div style={{width:24,height:24,borderRadius:7,background:`radial-gradient(circle at 35% 35%,${BGL},${BG})`,boxShadow:N.raisedSm,display:'flex',alignItems:'center',justifyContent:'center'}}><I n={r.trend>0?'arrowUp':r.trend<0?'arrowDown':'minus'} s={11} c={r.trend>0?DANGER:r.trend<0?SUCCESS:MUTED}/></div>
        </div>
      </div>
      {isS&&<div style={{marginTop:12,paddingTop:12,borderTop:`1px solid rgba(255,255,255,0.04)`}}>
        <Bar label="Military Activity" value={Math.min(r.score+10,100)} color={r.color}/>
        <Bar label="Civil Unrest" value={Math.max(r.score-15,0)} color={WARNING}/>
        <Bar label="Cyber Threat" value={Math.round(r.score*0.7)} color={CYAN}/>
      </div>}
    </Surface>
  )
}

function TensionMeter() {
  const [regions,setRegions] = useState([])
  const [selected,setSelected] = useState(null)
  const [loading,setLoading] = useState(true)
  useEffect(()=>{fetchRegions().then(r=>{setRegions(r);setSelected(r[0]?.id||null);setLoading(false)})},[])
  const global = regions.length?Math.round(regions.reduce((a,r)=>a+r.score,0)/regions.length):0
  const globalC = global>65?DANGER:global>45?WARNING:SUCCESS
  if(loading) return <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center'}}><I n="refresh" s={24} c={BGLOW} style={{animation:'spin 0.9s linear infinite'}}/></div>
  return (
    <div style={{flex:1,overflowY:'auto',paddingBottom:8}}>
      <Surface style={{padding:'20px 20px 16px',textAlign:'center',marginBottom:14}}>
        <div style={{fontSize:10,color:MUTED,letterSpacing:'0.12em',textTransform:'uppercase',marginBottom:14,fontFamily:"'SF Mono',monospace"}}>Global Tension Index</div>
        <Gauge value={global} color={globalC} size={180}/>
        <div style={{fontWeight:700,fontSize:15,color:WHITE,marginTop:10,textShadow:`0 0 20px ${globalC}44`}}>World Stability</div>
        <div style={{fontSize:12,color:MUTED,marginTop:3}}>{global>65?'High tension — multiple hotspots active':global>45?'Moderate — situation developing':'Stable — routine monitoring'}</div>
        <div style={{display:'flex',justifyContent:'center',gap:8,marginTop:10}}><Badge label={`${regions.filter(r=>r.score>65).length} Critical Regions`} variant="danger" dot/><Badge label={`${regions.reduce((a,r)=>a+r.events,0)} Signals`} variant="blue"/></div>
      </Surface>
      <div style={{display:'flex',flexDirection:'column',gap:9}}>
        {regions.map(r=><RegionRow key={r.id} r={r} selected={selected} onSelect={setSelected}/>)}
      </div>
      <div style={{height:20}}/>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// WATCHLIST
// ═══════════════════════════════════════════════════════════
const ALL_CII_INFO = {ua:{name:'Ukraine',flag:'🇺🇦'},tw:{name:'Taiwan',flag:'🇹🇼'},ir:{name:'Iran',flag:'🇮🇷'},ng:{name:'Nigeria',flag:'🇳🇬'},kp:{name:'N. Korea',flag:'🇰🇵'},ru:{name:'Russia',flag:'🇷🇺'},il:{name:'Israel',flag:'🇮🇱'},cn:{name:'China',flag:'🇨🇳'},pk:{name:'Pakistan',flag:'🇵🇰'},sa:{name:'Saudi Arabia',flag:'🇸🇦'},ve:{name:'Venezuela',flag:'🇻🇪'},sy:{name:'Syria',flag:'🇸🇾'},ly:{name:'Libya',flag:'🇱🇾'}}
const ALL_CII_CODES = Object.keys(ALL_CII_INFO)

// ✅ CountryRow is a proper component
function CountryRow({c,selected,onSelect,onRemove}) {
  const isS = selected===c.code
  const color = c.score>65?DANGER:c.score>45?WARNING:SUCCESS
  return (
    <Surface inset={isS} glow={isS} glowC={color} onClick={()=>onSelect(isS?null:c.code)} style={{padding:'13px 16px',cursor:'pointer'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <div style={{width:42,height:42,borderRadius:12,background:`radial-gradient(circle at 35% 35%,${BGL},${BG})`,boxShadow:N.raisedSm,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22}}>{c.flag}</div>
          <div><div style={{fontWeight:700,fontSize:14,color:WHITE}}>{c.country}</div><div style={{fontSize:11,color:MUTED,marginTop:2}}>{c.activeSignals} active signals</div></div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <Sparkline data={c.history} color={color}/>
          <div style={{textAlign:'right'}}><div style={{fontSize:22,fontWeight:900,color,fontFamily:"'SF Mono',monospace",textShadow:`0 0 14px ${color}66`}}>{c.score}</div><div style={{fontSize:10,color:MUTED}}>Threat</div></div>
          <div style={{width:24,height:24,borderRadius:7,background:`radial-gradient(circle at 35% 35%,${BGL},${BG})`,boxShadow:N.raisedSm,display:'flex',alignItems:'center',justifyContent:'center'}}><I n={c.trend>0?'arrowUp':c.trend<0?'arrowDown':'minus'} s={11} c={c.trend>0?DANGER:c.trend<0?SUCCESS:MUTED}/></div>
        </div>
      </div>
      {isS&&<div style={{marginTop:14,paddingTop:12,borderTop:`1px solid rgba(255,255,255,0.04)`}}>
        <div style={{fontSize:12,color:MUTED,lineHeight:1.65,marginBottom:12}}>{c.summary}</div>
        <Bar label="Conflict Activity" value={c.breakdown.military} color={color}/>
        <Bar label="Civil Unrest" value={c.breakdown.civil} color={WARNING}/>
        <Bar label="Cyber Exposure" value={c.breakdown.cyber} color={CYAN}/>
        <button onClick={e=>{e.stopPropagation();onRemove(c.code)}} style={{marginTop:10,padding:'8px 14px',borderRadius:11,border:'none',background:`linear-gradient(145deg,${BGL},${BG})`,boxShadow:N.raisedSm,color:DANGER,fontSize:12,fontWeight:600,cursor:'pointer',outline:'none'}}>Remove from watchlist</button>
      </div>}
    </Surface>
  )
}

function Watchlist({user,onUpdateUser}) {
  const [scores,setScores] = useState([])
  const [loading,setLoading] = useState(true)
  const [selected,setSelected] = useState(null)
  const [adding,setAdding] = useState(false)
  const {show,Toast} = useToast()

  const loadScores = useCallback(async(wl) => {
    if (!wl.length) { setLoading(false); return }
    const data = await fetchCII(wl)
    // fill in any missing codes with MOCK_CII
    const found = new Set(data.map(d=>d.code))
    const extra = MOCK_CII.filter(c=>wl.includes(c.code)&&!found.has(c.code))
    setScores([...data,...extra])
    setLoading(false)
  }, [])

  useEffect(()=>{loadScores(user.watchlist)},[user.watchlist])

  const remove = async (code) => {
    const updated = {...user, watchlist: user.watchlist.filter(c=>c!==code)}
    if (supabase && user.id!=='guest') await supabase.from('profiles').update({watchlist:updated.watchlist}).eq('id',user.id)
    localStorage.setItem('orion_user',JSON.stringify(updated))
    onUpdateUser(updated)
    setScores(s=>s.filter(c=>c.code!==code))
    show('Removed from watchlist')
  }
  const add = async (code) => {
    if (user.watchlist.length>=5) { show('Max 5 countries'); return }
    const updated = {...user, watchlist:[...user.watchlist,code]}
    if (supabase && user.id!=='guest') await supabase.from('profiles').update({watchlist:updated.watchlist}).eq('id',user.id)
    localStorage.setItem('orion_user',JSON.stringify(updated))
    onUpdateUser(updated)
    const newScore = MOCK_CII.find(c=>c.code===code)
    if (newScore) setScores(s=>[...s,newScore])
    setAdding(false)
    show('Added to watchlist')
  }

  if (loading) return <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center'}}><I n="refresh" s={24} c={BGLOW} style={{animation:'spin 0.9s linear infinite'}}/></div>
  return (
    <div style={{flex:1,overflowY:'auto',paddingBottom:8}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
        <div><div style={{fontSize:14,fontWeight:700,color:WHITE}}>Tracking {user.watchlist.length}/5 countries</div><div style={{fontSize:11,color:MUTED}}>Tap for full breakdown</div></div>
        <Btn sz="sm" variant="primary" icon="plus" onClick={()=>setAdding(a=>!a)}>Add</Btn>
      </div>
      {adding&&(
        <Surface inset style={{padding:14,marginBottom:14,borderRadius:14}}>
          <div style={{fontSize:11,color:MUTED,marginBottom:10}}>Select a country to track:</div>
          <div style={{display:'flex',flexDirection:'column',gap:7,maxHeight:200,overflowY:'auto'}}>
            {ALL_CII_CODES.filter(c=>!user.watchlist.includes(c)).map(c=>{const info=ALL_CII_INFO[c];return(
              <div key={c} onClick={()=>add(c)} style={{display:'flex',alignItems:'center',gap:10,padding:'9px 12px',borderRadius:10,cursor:'pointer',background:`radial-gradient(circle at 35% 35%,${BGL},${BG})`,boxShadow:N.raisedSm}}>
                <span style={{fontSize:18}}>{info.flag}</span>
                <span style={{fontSize:13,fontWeight:600,color:WHITE,flex:1}}>{info.name}</span>
                <I n="plus" s={14} c={BGLOW}/>
              </div>
            )})}
            {ALL_CII_CODES.filter(c=>!user.watchlist.includes(c)).length===0&&<div style={{fontSize:12,color:MUTED,textAlign:'center',padding:'8px 0'}}>All countries tracked. Remove one to add another.</div>}
          </div>
        </Surface>
      )}
      <div style={{display:'flex',flexDirection:'column',gap:9}}>
        {scores.map(c=><CountryRow key={c.code} c={c} selected={selected} onSelect={setSelected} onRemove={remove}/>)}
        {scores.length===0&&<Surface style={{padding:28,textAlign:'center'}}><I n="eye" s={28} c={MUTED} style={{marginBottom:10}}/><div style={{fontSize:14,fontWeight:600,color:WHITE,marginBottom:4}}>No countries tracked yet</div><div style={{fontSize:12,color:MUTED}}>Tap Add to start tracking countries</div></Surface>}
      </div>
      <div style={{height:20}}/>
      <Toast/>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// GEOEDGE
// ═══════════════════════════════════════════════════════════
// ✅ MarketCard is a proper component
function MarketCard({m,i}) {
  const [exp,setExp] = useState(false)
  const up = m.change24h>=0
  const divC = m.divergence==='HIGH'?DANGER:WARNING
  return (
    <Surface glow={m.divergence==='HIGH'} glowC={BLUE} style={{padding:0,overflow:'hidden',animation:`fadeUp 0.4s ${i*0.06}s ease both`,opacity:0,animationFillMode:'forwards'}} onClick={()=>setExp(e=>!e)}>
      <div style={{height:3,background:`linear-gradient(90deg,${BLUE},${CYAN})`,boxShadow:`0 0 10px ${BLUE}66`}}/>
      <div style={{padding:'15px 17px 13px'}}>
        <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:9}}><span style={{fontSize:18}}>{m.flag}</span><Badge label={`${m.divergence} DIVERGENCE`} variant={m.divergence==='HIGH'?'danger':'warning'} dot/><Badge label={m.signalType} variant="cyan"/></div>
        <div style={{fontWeight:700,fontSize:13,color:WHITE,marginBottom:13,lineHeight:1.5}}>{m.question}</div>
        <div style={{display:'flex',alignItems:'flex-end',justifyContent:'space-between',marginBottom:12}}>
          <Surface inset style={{padding:'10px 15px',borderRadius:12,display:'inline-block'}}>
            <div style={{fontSize:32,fontWeight:900,color:WHITE,lineHeight:1,fontFamily:"'SF Pro Display',-apple-system,sans-serif"}}>{m.probability}<span style={{fontSize:15,color:MUTED}}>%</span></div>
            <div style={{fontSize:9,color:MUTED,marginTop:3,letterSpacing:'0.06em'}}>PROBABILITY</div>
          </Surface>
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:4,padding:'9px 13px',borderRadius:12,background:`radial-gradient(circle at 35% 35%,${BGL},${BG})`,boxShadow:`${N.raisedSm},0 0 12px ${up?SUCCESS:DANGER}33`}}>
            <I n={up?'arrowUp':'arrowDown'} s={14} c={up?SUCCESS:DANGER}/>
            <span style={{fontSize:14,fontWeight:800,color:up?SUCCESS:DANGER,fontFamily:"'SF Mono',monospace"}}>{Math.abs(m.change24h)}%</span>
            <span style={{fontSize:9,color:MUTED}}>24H</span>
          </div>
          <div style={{textAlign:'right'}}>
            <div style={{fontSize:13,fontWeight:700,color:WHITE}}>{m.volume}</div>
            <div style={{fontSize:10,color:MUTED}}>Volume</div>
            <div style={{marginTop:5,fontSize:10,color:divC,fontWeight:700,background:`radial-gradient(circle at 35% 35%,${BGL},${BG})`,boxShadow:N.raisedSm,padding:'2px 7px',borderRadius:6,display:'inline-block'}}>Signal {m.signalScore}</div>
          </div>
        </div>
        <Surface inset style={{padding:'10px 13px',borderRadius:11}}>
          <div style={{fontSize:10,color:BGLOW,fontWeight:700,letterSpacing:'0.07em',textTransform:'uppercase',marginBottom:4}}>0rion Signal</div>
          <div style={{fontSize:12,color:MUTED,lineHeight:1.6}}>{m.signal}</div>
        </Surface>
        {exp&&(
          <div style={{marginTop:12,animation:'fadeUp 0.25s ease both'}}>
            <Bar label="Signal Confidence" value={m.signalScore} color={BGLOW}/>
            <Bar label="Market Mispricing" value={m.divergence==='HIGH'?78:45} color={divC}/>
            <Btn full variant="primary" icon="exLink" onClick={e=>{e.stopPropagation();window.open(`https://polymarket.com/event/${m.polymarketSlug||''}?ref=0rion`,'_blank')}} sz="md">Trade on Polymarket</Btn>
          </div>
        )}
        <div style={{borderTop:`1px solid rgba(255,255,255,0.03)`,marginTop:12,paddingTop:6,display:'flex',justifyContent:'center',gap:4}}><I n={exp?'chevU':'chevD'} s={11} c={MUTED}/><span style={{fontSize:9,color:MUTED,letterSpacing:'0.06em'}}>{exp?'COLLAPSE':'VIEW ANALYSIS'}</span></div>
      </div>
    </Surface>
  )
}

function GeoEdge() {
  const [markets,setMarkets] = useState([])
  const [loading,setLoading] = useState(true)
  useEffect(()=>{fetchMarkets().then(m=>{setMarkets(m);setLoading(false)});const t=setInterval(()=>fetchMarkets().then(setMarkets),60000);return()=>clearInterval(t)},[])
  if (loading) return <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center'}}><I n="refresh" s={24} c={BGLOW} style={{animation:'spin 0.9s linear infinite'}}/></div>
  return (
    <div style={{flex:1,overflowY:'auto',paddingBottom:8}}>
      <Surface inset style={{padding:'11px 14px',borderRadius:12,marginBottom:14}}>
        <div style={{display:'flex',alignItems:'flex-start',gap:8}}><I n="brain" s={14} c={CYAN} style={{filter:`drop-shadow(0 0 5px ${CYAN})`,marginTop:1}}/><div style={{fontSize:12,color:MUTED,lineHeight:1.6}}>0rion detects ground-truth signals before markets price them in. High divergence = potential edge. Always verify before trading.</div></div>
      </Surface>
      <div style={{display:'flex',flexDirection:'column',gap:12}}>
        {markets.map((m,i)=><MarketCard key={m.id} m={m} i={i}/>)}
      </div>
      <div style={{height:20}}/>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// MY AREA
// ═══════════════════════════════════════════════════════════
// ✅ NearbyItem is a proper component
function NearbyItem({ev,expanded,onToggle}) {
  return (
    <Surface onClick={()=>onToggle(ev.id)} style={{padding:'13px 16px',cursor:'pointer',marginBottom:9}}>
      <div style={{display:'flex',alignItems:'center',gap:12}}>
        <div style={{width:36,height:36,borderRadius:10,background:`radial-gradient(circle at 35% 35%,${BGL},${BG})`,boxShadow:`${N.raisedSm},0 0 10px ${ev.color}33`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><I n={ev.icon} s={16} c={ev.color} style={{filter:`drop-shadow(0 0 4px ${ev.color})`}}/></div>
        <div style={{flex:1}}><div style={{fontWeight:600,fontSize:13,color:WHITE}}>{ev.title}</div><div style={{fontSize:11,color:MUTED,marginTop:2}}>{ev.distanceKm}km away · {ev.time}</div></div>
        <I n={expanded?'chevU':'chevD'} s={14} c={MUTED}/>
      </div>
      {expanded&&<div style={{marginTop:10,fontSize:12,color:MUTED,lineHeight:1.65,paddingTop:10,borderTop:`1px solid rgba(255,255,255,0.04)`}}>{ev.description}</div>}
    </Surface>
  )
}

function MyArea() {
  const [status,setStatus] = useState('idle') // idle | scanning | done | denied
  const [data,setData] = useState(null)
  const [expanded,setExpanded] = useState(null)
  const {show,Toast} = useToast()

  const scan = useCallback(() => {
    setStatus('scanning')
    if (!navigator.geolocation) {
      setTimeout(()=>fetchHyperLocal(6.4281,3.4219).then(d=>{setData(d);setStatus('done')}),2000)
      return
    }
    navigator.geolocation.getCurrentPosition(
      async pos => { const d=await fetchHyperLocal(pos.coords.latitude,pos.coords.longitude); setData(d); setStatus('done') },
      () => fetchHyperLocal(6.4281,3.4219).then(d=>{setData(d);setStatus('done')}),
      {timeout:8000}
    )
  },[])

  const toggleExpand = useCallback((id) => setExpanded(e=>e===id?null:id), [])

  return (
    <div style={{flex:1,overflowY:'auto',paddingBottom:8}}>
      {(status==='idle'||status==='scanning')&&(
        <Surface glow glowC={status==='scanning'?BLUE:SUCCESS} style={{padding:20,marginBottom:14}}>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <div style={{position:'relative',flexShrink:0}}>
              <div style={{width:48,height:48,borderRadius:'50%',background:`radial-gradient(circle at 35% 35%,${BGL},${BG})`,boxShadow:`${N.raised},0 0 14px ${status==='scanning'?BLUE:SUCCESS}44`,display:'flex',alignItems:'center',justifyContent:'center'}}><I n={status==='scanning'?'scan':'location'} s={22} c={status==='scanning'?BGLOW:SUCCESS} style={{filter:`drop-shadow(0 0 5px ${status==='scanning'?BGLOW:SUCCESS})`}}/></div>
              {status==='scanning'&&[1,2,3].map(i=><div key={i} style={{position:'absolute',inset:-(i*9),borderRadius:'50%',border:`1px solid rgba(59,130,246,${0.25-i*0.07})`,animation:`ripple ${1.2+i*0.3}s ease-out infinite`,animationDelay:`${i*0.25}s`,pointerEvents:'none'}}/>)}
            </div>
            <div style={{flex:1}}>
              <div style={{fontWeight:700,fontSize:15,color:WHITE}}>Area Intelligence</div>
              <div style={{fontSize:12,color:status==='scanning'?BGLOW:MUTED,marginTop:2}}>{status==='scanning'?'Scanning your location...':'Get local threat intelligence for your exact location'}</div>
            </div>
          </div>
          {status==='idle'&&<div style={{marginTop:14}}><Btn full variant="primary" icon="location" sz="lg" onClick={scan}>Scan My Area</Btn></div>}
        </Surface>
      )}
      {status==='done'&&data&&(
        <div style={{animation:'fadeUp 0.4s ease both'}}>
          <Surface glow glowC={SUCCESS} style={{padding:20,marginBottom:14}}>
            <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:16}}>
              <div style={{width:42,height:42,borderRadius:'50%',background:`radial-gradient(circle at 35% 35%,${BGL},${BG})`,boxShadow:`${N.raised},0 0 14px ${SUCCESS}44`,display:'flex',alignItems:'center',justifyContent:'center'}}><I n="location" s={20} c={SUCCESS} style={{filter:`drop-shadow(0 0 5px ${SUCCESS})`}}/></div>
              <div><div style={{fontWeight:700,fontSize:15,color:WHITE}}>{data.flag} {data.city}</div><div style={{fontSize:11,color:MUTED,marginTop:1}}>{data.lga} · {data.country}</div></div>
              <Badge label="LIVE" variant="danger" dot/>
            </div>
            <Bar label="Public Safety" value={data.safetyScore} color={SUCCESS} hint="Good"/>
            <Bar label="Internet Stability" value={data.internetScore} color={BGLOW} hint="Normal"/>
            <Bar label="Traffic" value={100-data.trafficScore} color={WARNING} hint="Moderate"/>
            <Bar label="Infrastructure" value={data.infraScore} color={BGLOW} hint="Stable"/>
            <Surface inset style={{padding:'12px 14px',borderRadius:12,marginTop:4}}>
              <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:5}}><I n="brain" s={13} c={SUCCESS}/><span style={{fontSize:10,color:SUCCESS,fontWeight:700,letterSpacing:'0.08em',textTransform:'uppercase'}}>AI Forecast — Next 24h</span></div>
              <div style={{fontSize:12,color:MUTED,lineHeight:1.7}}>{data.aiforecast}</div>
            </Surface>
          </Surface>
          <Surface style={{padding:'16px 18px',marginBottom:14}}>
            <div style={{fontSize:11,color:MUTED,fontWeight:600,letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:12,fontFamily:"'SF Mono',monospace"}}>AI Risk Predictions</div>
            {data.riskPredictions.map(p=>(
              <div key={p.label} style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
                <span style={{fontSize:12,color:WHITE,fontWeight:500,flex:1}}>{p.label}</span>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <div style={{width:80,height:5,borderRadius:3,background:SD,boxShadow:N.insetSm,overflow:'hidden',position:'relative'}}><div style={{position:'absolute',top:0,left:0,bottom:0,width:`${p.probability}%`,background:`linear-gradient(90deg,${p.color}77,${p.color})`,borderRadius:3}}/></div>
                  <span style={{fontSize:12,fontWeight:700,color:p.color,fontFamily:"'SF Mono',monospace",width:32,textAlign:'right'}}>{p.probability}%</span>
                </div>
              </div>
            ))}
          </Surface>
          <div style={{fontSize:11,color:MUTED,fontWeight:600,letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:10,fontFamily:"'SF Mono',monospace"}}>Nearby Events</div>
          {data.nearbyEvents.map(ev=><NearbyItem key={ev.id} ev={ev} expanded={expanded===ev.id} onToggle={toggleExpand}/>)}
          <div style={{marginTop:12}}><Btn full variant="default" icon="refresh" onClick={()=>{setStatus('idle');setData(null)}}>Rescan</Btn></div>
        </div>
      )}
      <div style={{height:20}}/>
      <Toast/>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// DAILY BRIEF
// ═══════════════════════════════════════════════════════════
// ✅ BriefRow is a proper component
function BriefRow({bs,i,expanded,onToggle}) {
  return (
    <Surface onClick={()=>onToggle(i)} style={{padding:'14px 16px',cursor:'pointer',animation:`fadeUp 0.4s ${i*0.06}s ease both`,opacity:0,animationFillMode:'forwards'}}>
      <div style={{display:'flex',alignItems:'center',gap:10}}>
        <div style={{width:34,height:34,borderRadius:10,background:`radial-gradient(circle at 35% 35%,${BGL},${BG})`,boxShadow:`${N.raisedSm},0 0 10px ${bs.color}33`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><I n={bs.icon} s={15} c={bs.color} style={{filter:`drop-shadow(0 0 4px ${bs.color})`}}/></div>
        <div style={{flex:1}}><div style={{fontWeight:700,fontSize:13,color:WHITE}}>{bs.title}</div></div>
        <Badge label={bs.tag} variant={bs.tag==='CRITICAL'?'danger':bs.tag==='HIGH'?'danger':bs.tag==='MEDIUM'?'warning':'blue'}/>
        <I n={expanded?'chevU':'chevD'} s={13} c={MUTED} style={{marginLeft:4}}/>
      </div>
      {expanded&&<div style={{fontSize:12,color:MUTED,lineHeight:1.7,paddingTop:10,marginTop:10,borderTop:`1px solid rgba(255,255,255,0.04)`}}>{bs.content}</div>}
    </Surface>
  )
}

function DailyBrief() {
  const [brief,setBrief] = useState([])
  const [audioScript,setAudioScript] = useState('')
  const [loading,setLoading] = useState(true)
  const [aiGenerating,setAiGenerating] = useState(false)
  const [expanded,setExpanded] = useState(null)
  const [mode,setMode] = useState('text')
  // Speech synthesis state
  const [speaking,setSpeaking] = useState(false)
  const [speechProgress,setSpeechProgress] = useState(0)
  const [speechDuration,setSpeechDuration] = useState(0)
  const [speechText,setSpeechText] = useState('')
  const utterRef = useRef(null)
  const progressRef = useRef(null)

  // Load brief — try Groq first, fall back to worldmonitor, then mock
  useEffect(()=>{
    const load = async () => {
      setLoading(true)
      // Try Groq AI generation
      if (hasGroq) {
        setAiGenerating(true)
        try {
          const [events, regions] = await Promise.all([fetchEvents(), fetchRegions()])
          const result = await generateBrief(events, regions, [])
          if (result?.sections) {
            setBrief(result.sections)
            setAudioScript(result.audioScript || '')
            setAiGenerating(false)
            setLoading(false)
            return
          }
        } catch {}
        setAiGenerating(false)
      }
      // Fall back to worldmonitor or mock
      const data = await fetchBrief()
      setBrief(data)
      setAudioScript(data.map(s=>s.content).join(' '))
      setLoading(false)
    }
    load()
  },[])

  // Speech synthesis — uses browser's built-in TTS (free, no API needed)
  const startSpeech = useCallback(() => {
    if (!('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()

    const text = audioScript || brief.map(s=>`${s.title}. ${s.content}`).join(' ')
    if (!text) return
    setSpeechText(text)

    const utt = new SpeechSynthesisUtterance(text)
    // Prefer a good English voice
    const voices = window.speechSynthesis.getVoices()
    const preferred = voices.find(v=>v.name.includes('Google US English')||v.name.includes('Samantha')||v.name.includes('Daniel')) || voices.find(v=>v.lang==='en-US') || voices[0]
    if (preferred) utt.voice = preferred
    utt.rate = 0.92
    utt.pitch = 1.0
    utt.volume = 1.0

    // Estimate duration ~150 words/minute
    const wordCount = text.split(' ').length
    const estDuration = (wordCount / 150) * 60 * 1000
    setSpeechDuration(estDuration)
    setSpeechProgress(0)

    utt.onstart = () => {
      setSpeaking(true)
      const startTime = Date.now()
      progressRef.current = setInterval(()=>{
        const elapsed = Date.now() - startTime
        setSpeechProgress(Math.min((elapsed/estDuration)*100, 99))
      }, 200)
    }
    utt.onend = () => {
      setSpeaking(false)
      setSpeechProgress(100)
      if (progressRef.current) clearInterval(progressRef.current)
    }
    utt.onerror = () => {
      setSpeaking(false)
      if (progressRef.current) clearInterval(progressRef.current)
    }

    utterRef.current = utt
    window.speechSynthesis.speak(utt)
  }, [audioScript, brief])

  const stopSpeech = useCallback(() => {
    window.speechSynthesis.cancel()
    setSpeaking(false)
    setSpeechProgress(0)
    if (progressRef.current) clearInterval(progressRef.current)
  }, [])

  const toggleSpeech = useCallback(() => {
    if (speaking) stopSpeech()
    else startSpeech()
  }, [speaking, startSpeech, stopSpeech])

  useEffect(()=>()=>{
    window.speechSynthesis?.cancel()
    if (progressRef.current) clearInterval(progressRef.current)
  },[])

  const toggleExpand = useCallback((i) => setExpanded(e=>e===i?null:i), [])
  const date = new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})
  const hasSpeech = 'speechSynthesis' in window
  const estSecs = speechDuration ? Math.round(speechDuration/1000) : Math.round((brief.map(s=>s.content).join(' ').split(' ').length/150)*60)

  return (
    <div style={{flex:1,overflowY:'auto',paddingBottom:8}}>
      <Surface style={{padding:'18px 20px',marginBottom:14}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
          <div>
            <div style={{fontSize:11,color:MUTED,letterSpacing:'0.1em',textTransform:'uppercase',fontFamily:"'SF Mono',monospace"}}>Morning Intelligence Brief</div>
            <div style={{fontSize:15,fontWeight:700,color:WHITE,marginTop:3}}>{date}</div>
          </div>
          <div style={{display:'flex',gap:7,alignItems:'center'}}>
            {hasGroq&&<Badge label="AI" variant="cyan"/>}
            <Badge label={`${brief.length} Updates`} variant="blue" dot/>
          </div>
        </div>

        {/* Mode toggle */}
        <div style={{display:'flex',gap:8,marginBottom:mode==='audio'?14:0}}>
          {['text','audio'].map(m=>(
            <button key={m} onClick={()=>setMode(m)} style={{flex:1,padding:'9px',borderRadius:11,border:'none',background:`linear-gradient(145deg,${BGL},${BG})`,boxShadow:mode===m?`${N.inset},0 0 14px ${BGLOW}33`:N.raisedSm,color:mode===m?BGLOW:MUTED,fontSize:12,fontWeight:600,cursor:'pointer',outline:'none',display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
              <I n={m==='text'?'newspaper':'mic'} s={13} c={mode===m?BGLOW:MUTED}/>
              {m==='text'?'Read':'Listen'}
            </button>
          ))}
        </div>

        {/* Audio player — real SpeechSynthesis */}
        {mode==='audio'&&(
          <Surface inset style={{padding:'13px 15px',borderRadius:13}}>
            {!hasSpeech ? (
              <div style={{fontSize:12,color:MUTED,textAlign:'center'}}>Speech not supported in this browser. Use Chrome or Safari.</div>
            ) : loading ? (
              <div style={{display:'flex',alignItems:'center',gap:10,justifyContent:'center'}}><I n="refresh" s={16} c={BGLOW} style={{animation:'spin 0.9s linear infinite'}}/><span style={{fontSize:12,color:MUTED}}>{aiGenerating?'Generating AI brief...':'Loading brief...'}</span></div>
            ) : (
              <>
                <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:12}}>
                  <button onClick={toggleSpeech} style={{width:42,height:42,borderRadius:'50%',border:'none',background:speaking?`linear-gradient(145deg,#4F9EFF,${BLUE})`:`radial-gradient(circle at 35% 35%,${BGL},${BG})`,boxShadow:speaking?`${N.inset},0 0 18px ${BLUE}44`:N.raised,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',outline:'none',flexShrink:0}}>
                    {speaking?<div style={{width:10,height:10,background:'#fff',borderRadius:2,boxShadow:'2px 0 0 #fff'}}/>:<I n="mic" s={17} c={BGLOW}/>}
                  </button>
                  <div style={{flex:1}}>
                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
                      <span style={{fontSize:12,fontWeight:600,color:WHITE}}>{speaking?'Reading brief...':speechProgress===100?'Brief complete':'AI Intelligence Brief'}</span>
                      <span style={{fontSize:11,color:MUTED,fontFamily:"'SF Mono',monospace"}}>~{estSecs}s</span>
                    </div>
                    <div style={{height:5,borderRadius:3,background:SD,boxShadow:N.insetSm,overflow:'hidden'}}>
                      <div style={{height:'100%',width:`${speechProgress}%`,background:`linear-gradient(90deg,${BGLOW}77,${BGLOW})`,borderRadius:3,transition:'width 0.2s linear'}}/>
                    </div>
                  </div>
                </div>
                {/* Show current script */}
                <Surface inset style={{padding:'10px 12px',borderRadius:10,maxHeight:80,overflow:'hidden'}}>
                  <div style={{fontSize:11,color:MUTED,lineHeight:1.6,fontStyle:'italic'}}>
                    "{(audioScript||brief.map(s=>s.content).join(' ')).slice(0,160)}..."
                  </div>
                </Surface>
                {!hasGroq&&<div style={{marginTop:8,fontSize:10,color:MUTED,textAlign:'center'}}>Add VITE_GROQ_API_KEY for AI-generated briefs</div>}
              </>
            )}
          </Surface>
        )}
      </Surface>

      {/* AI generating indicator */}
      {aiGenerating&&mode==='text'&&(
        <Surface inset style={{padding:'12px 14px',borderRadius:12,marginBottom:12,display:'flex',alignItems:'center',gap:10}}>
          <I n="brain" s={15} c={CYAN} style={{animation:'spin 1.5s linear infinite',filter:`drop-shadow(0 0 5px ${CYAN})`}}/>
          <div>
            <div style={{fontSize:12,fontWeight:600,color:CYAN}}>Groq AI generating your brief...</div>
            <div style={{fontSize:11,color:MUTED,marginTop:2}}>Analyzing live signals with llama-3.3-70b</div>
          </div>
        </Surface>
      )}

      {mode==='text'&&(
        loading&&!aiGenerating
          ? <div style={{display:'flex',flexDirection:'column',gap:10}}>{[1,2,3,4,5].map(i=><Surface key={i} style={{height:60,opacity:0.4}}/>)}</div>
          : <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {brief.map((bs,i)=><BriefRow key={i} bs={bs} i={i} expanded={expanded===i} onToggle={toggleExpand}/>)}
            </div>
      )}
      <div style={{height:20}}/>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// TRAVEL SAFETY
// ═══════════════════════════════════════════════════════════
// ✅ TripCard is a proper component
function TripCard({trip,expanded,onToggle,onEnableAlerts,userId}) {
  const SC = s=>s>65?DANGER:s>40?WARNING:SUCCESS
  const maxS = Math.max(...trip.stops.map(s=>s.score))
  const sc = SC(maxS)
  return (
    <Surface glow glowC={sc} style={{padding:0,overflow:'hidden',marginBottom:12}}>
      <div style={{height:3,background:`linear-gradient(90deg,${sc},${sc}66)`,boxShadow:`0 0 10px ${sc}66`}}/>
      <div style={{padding:'15px 17px'}} onClick={()=>onToggle(trip.id)}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:expanded?14:0}}>
          <div><div style={{fontWeight:700,fontSize:14,color:WHITE,marginBottom:3}}>{trip.name}</div><div style={{display:'flex',alignItems:'center',gap:7}}><I n="calendar" s={11} c={MUTED}/><span style={{fontSize:11,color:MUTED}}>{trip.dates}</span><Badge label={maxS>65?'High Risk':maxS>40?'Monitor':'Safe'} variant={maxS>65?'danger':maxS>40?'warning':'success'}/></div></div>
          <I n={expanded?'chevU':'chevD'} s={15} c={MUTED}/>
        </div>
        {expanded&&(
          <div style={{animation:'fadeUp 0.3s ease both'}}>
            {trip.stops.map((stop,i)=>(
              <div key={i} style={{marginBottom:10}}>
                <Surface style={{padding:'13px 15px'}}>
                  <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:10}}><span style={{fontSize:22}}>{stop.flag}</span><div style={{flex:1}}><div style={{fontWeight:700,fontSize:13,color:WHITE}}>{stop.city}</div><div style={{fontSize:11,color:MUTED}}>{stop.events} active signals</div></div><div style={{textAlign:'right'}}><div style={{fontSize:20,fontWeight:800,color:SC(stop.score),fontFamily:"'SF Mono',monospace"}}>{stop.score}</div><div style={{fontSize:10,color:MUTED}}>Threat Level</div></div></div>
                  <Bar label="Safety Score" value={100-stop.score} color={SC(stop.score)}/>
                  <Surface inset style={{padding:'10px 12px',borderRadius:10}}><div style={{fontSize:11,color:MUTED,lineHeight:1.6}}>{stop.score<40?'Low threat. Routine travel precautions apply. No active alerts for your dates.':'Moderate activity detected. Stay informed and check local advisories before departure.'}</div></Surface>
                </Surface>
              </div>
            ))}
            <Btn full variant="primary" icon="bell" onClick={e=>{e.stopPropagation();onEnableAlerts(trip.id)}} sz="md">Enable Alerts for This Trip</Btn>
          </div>
        )}
      </div>
    </Surface>
  )
}

function TravelSafety({user}) {
  const [trips,setTrips] = useState([{id:1,name:'Dubai Business Trip',dates:'Mar 15–19',stops:[{city:'Dubai',flag:'🇦🇪',score:38,events:2},{city:'Abu Dhabi',flag:'🇦🇪',score:35,events:1}]}])
  const [adding,setAdding] = useState(false)
  const [newCity,setNewCity] = useState('')
  const [newDate,setNewDate] = useState('')
  const [expanded,setExpanded] = useState(1)
  const {show,Toast} = useToast()

  const toggleTrip = useCallback((id)=>setExpanded(e=>e===id?null:id),[])
  const enableAlerts = useCallback(async (tripId) => {
    const trip = trips.find(t => t.id === tripId)
    const result = await subscribeToPush(user.id)
    if (result.ok) {
      show(`Alerts enabled for ${trip?.name || 'this trip'}!`)
      // Send a test notification immediately so user knows it worked
      setTimeout(() => notify(
        `0rion — ${trip?.name || 'Trip'} Monitoring Active`,
        `You'll be alerted to threats in ${trip?.stops.map(s=>s.city).join(', ') || 'your destinations'}.`,
        'HIGH'
      ), 1500)
    } else {
      show(result.reason === 'denied' ? 'Please allow notifications in browser settings' : 'Could not enable alerts')
    }
  }, [trips, user, show])

  return (
    <div style={{flex:1,overflowY:'auto',paddingBottom:8}}>
      <Surface inset style={{padding:'11px 14px',borderRadius:12,marginBottom:14}}>
        <div style={{display:'flex',alignItems:'flex-start',gap:8}}><I n="shield" s={14} c={BGLOW} style={{filter:`drop-shadow(0 0 4px ${BGLOW})`,marginTop:1}}/><div style={{fontSize:12,color:MUTED,lineHeight:1.6}}>0rion monitors your destinations in real time. You'll get alerted the moment a threat signal appears for any city on your itinerary.</div></div>
      </Surface>
      {trips.map(trip=><TripCard key={trip.id} trip={trip} expanded={expanded===trip.id} onToggle={toggleTrip} onEnableAlerts={enableAlerts} userId={user.id}/>)}
      <Surface onClick={!adding?()=>setAdding(true):undefined} style={{padding:'16px 18px',cursor:'pointer',borderRadius:16,border:`2px dashed rgba(255,255,255,0.07)`,marginBottom:12}}>
        {!adding?(
          <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:10}}>
            <div style={{width:30,height:30,borderRadius:'50%',background:`radial-gradient(circle at 35% 35%,${BGL},${BG})`,boxShadow:N.raisedSm,display:'flex',alignItems:'center',justifyContent:'center'}}><I n="plus" s={14} c={BGLOW}/></div>
            <span style={{fontSize:13,fontWeight:600,color:BGLOW}}>Add a Trip</span>
          </div>
        ):(
          <div onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:12,fontWeight:700,color:WHITE,marginBottom:12}}>New Trip</div>
            {[{label:'Destination city',val:newCity,set:setNewCity,ph:'e.g. Nairobi, Kenya'},{label:'Travel dates',val:newDate,set:setNewDate,ph:'e.g. Apr 10–15'}].map(f=>(
              <div key={f.label} style={{marginBottom:10}}>
                <Surface inset style={{padding:'10px 13px',borderRadius:11}}><input value={f.val} onChange={e=>f.set(e.target.value)} placeholder={f.ph} style={{background:'none',border:'none',outline:'none',color:WHITE,fontSize:13,width:'100%',fontFamily:"'SF Pro Display',-apple-system,sans-serif"}}/></Surface>
              </div>
            ))}
            <div style={{display:'flex',gap:8}}>
              <Btn full variant="primary" icon="check" onClick={()=>{if(newCity&&newDate){setTrips(t=>[...t,{id:Date.now(),name:`Trip to ${newCity}`,dates:newDate,stops:[{city:newCity,flag:'🌍',score:Math.floor(Math.random()*60+10),events:Math.floor(Math.random()*5+1)}]}]);setNewCity('');setNewDate('');setAdding(false)}}} sz="md">Add Trip</Btn>
              <Btn sz="md" variant="default" onClick={()=>setAdding(false)}>Cancel</Btn>
            </div>
          </div>
        )}
      </Surface>
      <div style={{height:20}}/>
      <Toast/>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// APP SHELL
// ═══════════════════════════════════════════════════════════
const NAV = [
  {id:'pulse',    icon:'bolt',      label:'Pulse'},
  {id:'tension',  icon:'signal',    label:'Tension'},
  {id:'watchlist',icon:'eye',       label:'Watch'},
  {id:'geoedge',  icon:'trending',  label:'GeoEdge'},
  {id:'area',     icon:'location',  label:'My Area'},
  {id:'brief',    icon:'newspaper', label:'Brief'},
  {id:'travel',   icon:'suitcase',  label:'Travel'},
]
const FREE = new Set(['pulse','tension','brief'])
const SCREEN_NAMES = {pulse:'World Pulse',tension:'Tension Meter',watchlist:'Watchlist',geoedge:'GeoEdge',area:'My Area',brief:'Daily Brief',travel:'Travel Safety'}

export default function App() {
  const [screen,setScreen] = useState('pulse')
  const [user,setUser] = useState(null)
  const [showOnboarding,setShowOnboarding] = useState(false)
  const [showAuth,setShowAuth] = useState(false)
  const [authMode,setAuthMode] = useState('signup')
  const [mounted,setMounted] = useState(false)

  useEffect(()=>{
    setTimeout(()=>setMounted(true),100)

    // Register service worker for background push
    registerSW()

    // Check Supabase session first
    const init = async () => {
      if (supabase) {
        const {data:{session}} = await supabase.auth.getSession()
        if (session) {
          const {data:prof} = await supabase.from('profiles').select('*').eq('id',session.user.id).single()
          const u = {id:session.user.id,email:session.user.email,name:prof?.name||session.user.email.split('@')[0],watchlist:prof?.watchlist||[],pushEnabled:prof?.push_enabled||false,homeCountry:prof?.home_country||''}
          localStorage.setItem('orion_user',JSON.stringify(u))
          setUser(u); return
        }
      }
      const stored = localStorage.getItem('orion_user')
      if (stored) { try { setUser(JSON.parse(stored)) } catch { setShowOnboarding(true) } }
      else setShowOnboarding(true)
    }
    init()

    // Listen for Supabase auth changes
    if (supabase) {
      const {data:{subscription}} = supabase.auth.onAuthStateChange(async (event,session)=>{
        if (event==='SIGNED_OUT') { setUser(null); localStorage.removeItem('orion_user'); setShowOnboarding(true) }
      })
      return ()=>subscription.unsubscribe()
    }
  },[])

  // Watch for new CRITICAL events and notify user
  useEffect(()=>{
    if (!user || user.id === 'guest') return
    let knownIds = new Set()
    let first = true
    const check = async () => {
      const events = await fetchEvents()
      if (first) { events.forEach(e=>knownIds.add(e.id)); first=false; return }
      const newCritical = events.filter(e=>e.severity==='CRITICAL'&&!knownIds.has(e.id))
      newCritical.forEach(e=>{
        knownIds.add(e.id)
        notify(`🚨 ${e.severity}: ${e.country}`, e.title, e.severity)
      })
    }
    check()
    const t = setInterval(check, 60000)
    return ()=>clearInterval(t)
  },[user])
    if (!FREE.has(id) && (!user || user.id==='guest')) {
      setAuthMode('signup'); setShowAuth(true); return
    }
    setScreen(id)
  }

  const handleOnboardingComplete = (u) => { setUser(u); setShowOnboarding(false); setShowAuth(false) }

  const handleSignOut = async () => {
    if (supabase) await supabase.auth.signOut()
    localStorage.removeItem('orion_user')
    setUser(null); setShowOnboarding(true)
  }

  const updateUser = (u) => { setUser(u); localStorage.setItem('orion_user',JSON.stringify(u)) }

  const isGuest = !user || user.id==='guest'

  const screens = {
    pulse:     <WorldPulse/>,
    tension:   <TensionMeter/>,
    watchlist: isGuest ? <GateWall feature="Watchlist" onSignup={()=>{setAuthMode('signup');setShowAuth(true)}} onLogin={()=>{setAuthMode('login');setShowAuth(true)}}/> : <Watchlist user={user} onUpdateUser={updateUser}/>,
    geoedge:   isGuest ? <GateWall feature="GeoEdge" onSignup={()=>{setAuthMode('signup');setShowAuth(true)}} onLogin={()=>{setAuthMode('login');setShowAuth(true)}}/> : <GeoEdge/>,
    area:      isGuest ? <GateWall feature="My Area" onSignup={()=>{setAuthMode('signup');setShowAuth(true)}} onLogin={()=>{setAuthMode('login');setShowAuth(true)}}/> : <MyArea/>,
    brief:     <DailyBrief/>,
    travel:    isGuest ? <GateWall feature="Travel Safety" onSignup={()=>{setAuthMode('signup');setShowAuth(true)}} onLogin={()=>{setAuthMode('login');setShowAuth(true)}}/> : <TravelSafety user={user}/>,
  }

  return (
    <div style={{minHeight:'100vh',background:BG,fontFamily:"'SF Pro Display',-apple-system,BlinkMacSystemFont,sans-serif",color:WHITE,position:'relative',overflowX:'hidden',opacity:mounted?1:0,transition:'opacity 0.5s'}}>
      <style>{`
        @keyframes bp{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.3;transform:scale(0.75)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes ripple{0%{opacity:0.7;transform:scale(1)}100%{opacity:0;transform:scale(2.6)}}
        @keyframes slideIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
        *{box-sizing:border-box}button{outline:none;-webkit-tap-highlight-color:transparent}
        input::placeholder{color:#5A7A96}
        ::-webkit-scrollbar{width:0;display:none}
        html,body{overflow:hidden;margin:0;padding:0}
      `}</style>
      <StarField/>
      <div style={{position:'fixed',top:'-10%',left:'20%',width:500,height:400,background:'radial-gradient(ellipse,rgba(59,130,246,0.03) 0%,transparent 70%)',pointerEvents:'none',zIndex:1}}/>

      {/* Onboarding */}
      {showOnboarding&&<Onboarding onComplete={handleOnboardingComplete}/>}

      {/* Auth modal — triggered from gate walls */}
      {showAuth&&!showOnboarding&&(
        <div style={{position:'fixed',inset:0,zIndex:300,background:BG,display:'flex',justifyContent:'center'}}>
          <div style={{width:'100%',maxWidth:480,height:'100%',display:'flex',flexDirection:'column',position:'relative'}}>
            <StarField/>
            <div style={{position:'relative',zIndex:1,flex:1,display:'flex',flexDirection:'column',paddingTop:60}}>
              <div style={{display:'flex',alignItems:'center',gap:12,padding:'0 24px',marginBottom:28}}>
                <button onClick={()=>setShowAuth(false)} style={{background:'none',border:'none',cursor:'pointer',outline:'none'}}><I n="chevR" s={20} c={MUTED} style={{transform:'rotate(180deg)'}}/></button>
                <div style={{fontSize:16,fontWeight:700,color:WHITE}}>{authMode==='signup'?'Create Account':'Sign In'}</div>
              </div>
              <AuthScreen mode={authMode} onSuccess={u=>{setUser(u);localStorage.setItem('orion_user',JSON.stringify(u));setShowAuth(false)}} onBack={(m)=>m?setAuthMode(m):setShowAuth(false)}/>
            </div>
          </div>
        </div>
      )}

      {/* Main app */}
      {user&&<div style={{position:'fixed',inset:0,zIndex:2,display:'flex',justifyContent:'center'}}>
        <div style={{width:'100%',maxWidth:480,height:'100%',display:'flex',flexDirection:'column',position:'relative',overflow:'hidden'}}>
          {/* Header */}
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 20px 12px',background:`linear-gradient(180deg,${BG} 55%,rgba(13,17,23,0) 100%)`,position:'sticky',top:0,zIndex:10}}>
            <div style={{display:'flex',alignItems:'center',gap:11}}>
              <div style={{width:36,height:36,borderRadius:11,background:`radial-gradient(circle at 35% 35%,${BGL},${BG})`,boxShadow:`3px 3px 8px ${SD},-2px -2px 6px ${SL},0 0 12px rgba(34,211,238,0.12)`,display:'flex',alignItems:'center',justifyContent:'center'}}><Logo size={22}/></div>
              <div>
                <div style={{fontSize:17,fontWeight:900,letterSpacing:'-0.02em',background:`linear-gradient(135deg,${WHITE},${CYAN})`,WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',lineHeight:1}}>0rion</div>
                <div style={{fontSize:9,color:MUTED,letterSpacing:'0.08em',textTransform:'uppercase',marginTop:1}}>{SCREEN_NAMES[screen]}</div>
              </div>
            </div>
            <div style={{display:'flex',gap:9,alignItems:'center'}}>
              {isGuest ? (
                <Btn sz="sm" variant="primary" onClick={()=>{setAuthMode('signup');setShowAuth(true)}}>Sign Up Free</Btn>
              ) : (
                <button onClick={handleSignOut} title={`Signed in as ${user.name}`} style={{background:'none',border:'none',cursor:'pointer',outline:'none',display:'flex',alignItems:'center',gap:6,padding:'6px 10px',borderRadius:10,boxShadow:N.raisedSm}}>
                  <I n="user" s={14} c={MUTED}/>
                  <span style={{fontSize:11,color:MUTED,fontWeight:500,maxWidth:80,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{user.name}</span>
                </button>
              )}
              <IBtn icon="bell" size={36} badge/>
            </div>
          </div>

          {/* Live ticker */}
          <div style={{padding:'0 20px 10px'}}><LiveTicker/></div>

          {/* Screen content */}
          <div key={screen} style={{flex:1,overflowY:'auto',padding:'6px 20px 0',display:'flex',flexDirection:'column',animation:'slideIn 0.28s ease both'}}>
            {screens[screen]}
          </div>

          {/* Bottom nav */}
          <div style={{padding:'0 16px 14px',background:`linear-gradient(0deg,${BG} 55%,rgba(13,17,23,0) 100%)`}}>
            <div style={{display:'flex',justifyContent:'space-around',alignItems:'center',background:`linear-gradient(180deg,${BGL},${BG})`,boxShadow:`0 -2px 20px ${SD},0 -1px 0 ${SL},${N.raised}`,borderRadius:22,padding:'10px 6px'}}>
              {NAV.map(item=>{
                const isA = screen===item.id
                const gated = !FREE.has(item.id)&&isGuest
                return (
                  <button key={item.id} onClick={()=>handleNav(item.id)} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:3,padding:'7px 10px',borderRadius:14,border:'none',background:'transparent',cursor:'pointer',outline:'none',boxShadow:isA?N.inset:'none',transition:'all 0.2s',flexShrink:0,position:'relative'}}>
                    <I n={item.icon} s={18} c={isA?BGLOW:gated?MUTED+'66':MUTED} style={{filter:isA?`drop-shadow(0 0 6px ${BGLOW})`:''}}/>
                    <span style={{fontSize:9,fontWeight:600,letterSpacing:'0.03em',color:isA?BGLOW:MUTED,textShadow:isA?`0 0 8px ${BGLOW}88`:'none'}}>{item.label}</span>
                    {gated&&<span style={{position:'absolute',top:4,right:6,width:5,height:5,borderRadius:'50%',background:MUTED+'55'}}/>}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>}
    </div>
  )
}
