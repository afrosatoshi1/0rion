// Nigeria Briefing — AI Daily Brief + Live from 20+ sources
import { useState, useEffect, useCallback } from 'react'
import { fetchNGEvents, NG_SOURCES } from '../api/nigeria'

const BG='#0D1117',BGL='#141B24',WHITE='#F0F6FC',MUTED='#5A7A96',CYAN='#22D3EE',SUCCESS='#10B981',DANGER='#EF4444',WARNING='#F59E0B',BLUE='#3B82F6'
const SD='rgba(0,0,0,0.45)',SL='rgba(255,255,255,0.06)'
const N={raised:`3px 3px 8px ${SD},-2px -2px 6px ${SL}`,inset:`inset 2px 2px 6px ${SD},inset -1px -1px 4px ${SL}`,raisedSm:`2px 2px 5px ${SD},-1px -1px 4px ${SL}`}

const CAT_META={
  security:  {color:DANGER,  emoji:'🚨',label:'Security'},
  military:  {color:'#FF6B6B',emoji:'⚔️',label:'Military'},
  government:{color:BLUE,    emoji:'🏛️',label:'Government'},
  economy:   {color:SUCCESS, emoji:'📈',label:'Economy'},
  election:  {color:WARNING, emoji:'🗳️',label:'Election'},
  agriculture:{color:'#86EFAC',emoji:'🌾',label:'Agriculture'},
  budget:    {color:WARNING, emoji:'💰',label:'Budget'},
  general:   {color:MUTED,   emoji:'📰',label:'General'},
}
const SOURCE_TYPE_COLOR={national:BLUE,tv:CYAN,investigative:WARNING,business:SUCCESS,official:'#A78BFA',military:DANGER,regional:MUTED}

function Surface({children,style={},inset,onClick}){
  return <div onClick={onClick} style={{background:`linear-gradient(145deg,${BGL},${BG})`,borderRadius:16,boxShadow:inset?N.inset:N.raised,border:`1px solid ${SL}`,cursor:onClick?'pointer':'default',...style}}>{children}</div>
}

async function generateNGBriefing(events){
  const key=import.meta.env.VITE_GROQ_API_KEY
  if(!key||!events.length) return null
  try {
    const byCategory={}
    events.slice(0,25).forEach(e=>{
      if(!byCategory[e.category]) byCategory[e.category]=[]
      byCategory[e.category].push(e.title)
    })
    const summary=Object.entries(byCategory).map(([cat,titles])=>`[${cat.toUpperCase()}]\n${titles.slice(0,4).join('\n')}`).join('\n\n')
    const res=await fetch('https://api.groq.com/openai/v1/chat/completions',{
      method:'POST',headers:{'Authorization':`Bearer ${key}`,'Content-Type':'application/json'},
      body:JSON.stringify({
        model:'llama-3.3-70b-versatile',
        messages:[{role:'user',content:`You are 0rion Nigeria Intelligence AI. Generate a comprehensive daily briefing for Nigerians based on today's news.\n\nToday's stories:\n${summary}\n\nDate: ${new Date().toLocaleDateString('en-NG',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}\n\nReturn JSON:\n{"headline":"One powerful sentence summarizing the most critical development today","sections":[{"title":"section title","icon":"🔴 or relevant emoji","severity":"CRITICAL|HIGH|MEDIUM","content":"2-3 sentences of context and what it means for Nigerians","action":"One thing Nigerians should know or do"}],"bottom_line":"One closing sentence — what should every Nigerian be watching today?"}`}],
        temperature:0.4,max_tokens:1200,response_format:{type:'json_object'}
      })
    })
    if(!res.ok) return null
    const data=await res.json()
    return JSON.parse(data.choices[0].message.content)
  } catch { return null }
}

function NewsCard({e,expanded,onToggle}){
  const meta=CAT_META[e.category]||CAT_META.general
  const srcColor=SOURCE_TYPE_COLOR[e.sourceType]||MUTED
  const timeAgo=t=>{const m=Math.floor((Date.now()-t)/60000);return m<60?`${m}m ago`:m<1440?`${Math.floor(m/60)}h ago`:`${Math.floor(m/1440)}d ago`}
  return (
    <Surface onClick={()=>onToggle(e.id)} style={{padding:'13px 16px',marginBottom:8,borderLeft:`3px solid ${meta.color}`}}>
      <div style={{display:'flex',gap:10,alignItems:'flex-start'}}>
        <div style={{fontSize:18,flexShrink:0,marginTop:1}}>{meta.emoji}</div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:'flex',gap:6,marginBottom:5,flexWrap:'wrap',alignItems:'center'}}>
            <span style={{fontSize:9,fontWeight:700,color:meta.color,background:`${meta.color}22`,padding:'2px 6px',borderRadius:5}}>{e.severity}</span>
            <span style={{fontSize:9,fontWeight:700,color:srcColor,background:`${srcColor}22`,padding:'2px 6px',borderRadius:5}}>{e.source}</span>
            {e.state&&e.state!=='federal'&&<span style={{fontSize:9,color:MUTED,textTransform:'capitalize'}}>{e.state}</span>}
            <span style={{fontSize:9,color:MUTED,marginLeft:'auto'}}>{timeAgo(e.timestamp)}</span>
          </div>
          <div style={{fontSize:13,fontWeight:600,color:WHITE,lineHeight:1.45,marginBottom:expanded?8:0}}>{e.title}</div>
          {expanded&&<>
            {e.description&&<div style={{fontSize:12,color:MUTED,lineHeight:1.65,marginBottom:8}}>{e.description}</div>}
            {e.link&&<a href={e.link} target="_blank" rel="noopener noreferrer" onClick={ev=>ev.stopPropagation()} style={{fontSize:11,color:CYAN,fontWeight:600}}>Read full story →</a>}
          </>}
        </div>
      </div>
    </Surface>
  )
}

export default function NGBriefing(){
  const [events,setEvents]=useState([])
  const [briefing,setBriefing]=useState(null)
  const [loading,setLoading]=useState(true)
  const [briefingLoading,setBriefingLoading]=useState(false)
  const [catFilter,setCatFilter]=useState('all')
  const [srcFilter,setSrcFilter]=useState('all')
  const [expanded,setExpanded]=useState(null)
  const [showSources,setShowSources]=useState(false)

  const load=useCallback(async()=>{
    setLoading(true)
    const data=await fetchNGEvents('all')
    setEvents(data)
    setLoading(false)
    // Generate briefing async
    setBriefingLoading(true)
    const brief=await generateNGBriefing(data)
    setBriefing(brief)
    setBriefingLoading(false)
  },[])

  useEffect(()=>{load()},[])

  const filtered=events.filter(e=>{
    if(catFilter!=='all'&&e.category!==catFilter) return false
    if(srcFilter!=='all'&&e.sourceType!==srcFilter) return false
    return true
  })

  const toggle=useCallback(id=>setExpanded(e=>e===id?null:id),[])
  const cats=Object.keys(CAT_META)
  const srcTypes=[...new Set(NG_SOURCES.map(s=>s.type))]

  return (
    <div style={{paddingBottom:8}}>
      {/* Daily Briefing */}
      <Surface style={{padding:'16px',marginBottom:12,overflow:'hidden',position:'relative'}}>
        <div style={{position:'absolute',top:0,right:0,width:120,height:120,borderRadius:'50%',background:`radial-gradient(circle,${CYAN}08,transparent)`,transform:'translate(30%,-30%)'}}/>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
          <div>
            <div style={{fontSize:15,fontWeight:800,color:WHITE}}>🇳🇬 Nigeria Briefing</div>
            <div style={{fontSize:10,color:MUTED}}>{new Date().toLocaleDateString('en-NG',{weekday:'long',month:'long',day:'numeric'})}</div>
          </div>
          <button onClick={load} style={{background:`linear-gradient(145deg,${BGL},${BG})`,border:'none',borderRadius:10,padding:'6px 12px',color:CYAN,fontSize:11,fontWeight:700,cursor:'pointer',boxShadow:N.raisedSm}}>↻ Refresh</button>
        </div>
        {briefingLoading&&<div style={{padding:'12px 0',color:MUTED,fontSize:12}}>🤖 AI generating briefing...</div>}
        {!briefingLoading&&briefing&&(
          <>
            <Surface inset style={{padding:'12px 14px',borderRadius:12,marginBottom:12,borderLeft:`3px solid ${CYAN}`}}>
              <div style={{fontSize:13,fontWeight:700,color:WHITE,lineHeight:1.5}}>{briefing.headline}</div>
            </Surface>
            {briefing.sections?.map((s,i)=>(
              <div key={i} style={{marginBottom:10}}>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                  <span style={{fontSize:16}}>{s.icon}</span>
                  <span style={{fontSize:12,fontWeight:700,color:s.severity==='CRITICAL'?DANGER:s.severity==='HIGH'?WARNING:SUCCESS}}>{s.title}</span>
                </div>
                <div style={{fontSize:12,color:MUTED,lineHeight:1.65,marginLeft:28}}>{s.content}</div>
                {s.action&&<div style={{fontSize:11,color:CYAN,marginLeft:28,marginTop:4}}>→ {s.action}</div>}
              </div>
            ))}
            {briefing.bottom_line&&<Surface inset style={{padding:'10px 12px',borderRadius:10,marginTop:10}}><div style={{fontSize:11,color:WARNING,fontWeight:600,lineHeight:1.6}}>📌 Watch: {briefing.bottom_line}</div></Surface>}
          </>
        )}
        {!briefingLoading&&!briefing&&!loading&&(
          <div style={{fontSize:12,color:MUTED,textAlign:'center',padding:'10px 0'}}>Add VITE_GROQ_API_KEY to enable AI briefings</div>
        )}
      </Surface>

      {/* Source list toggle */}
      <Surface style={{padding:'10px 14px',marginBottom:10,cursor:'pointer'}} onClick={()=>setShowSources(s=>!s)}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div style={{fontSize:12,fontWeight:700,color:WHITE}}>📡 {NG_SOURCES.length} Active Sources</div>
          <span style={{fontSize:11,color:CYAN}}>{showSources?'Hide':'Show'}</span>
        </div>
        {showSources&&<div style={{display:'flex',flexWrap:'wrap',gap:6,marginTop:10}}>
          {NG_SOURCES.map(s=>(
            <span key={s.name} style={{fontSize:10,padding:'2px 8px',borderRadius:6,background:`${SOURCE_TYPE_COLOR[s.type]||MUTED}22`,color:SOURCE_TYPE_COLOR[s.type]||MUTED,fontWeight:600}}>{s.name}</span>
          ))}
        </div>}
      </Surface>

      {/* Filters */}
      <div style={{display:'flex',gap:5,marginBottom:8,overflowX:'auto',paddingBottom:2}}>
        <button onClick={()=>setCatFilter('all')} style={{flex:'0 0 auto',padding:'5px 10px',borderRadius:8,border:'none',background:catFilter==='all'?`linear-gradient(135deg,${BLUE},#2563EB)`:`linear-gradient(145deg,${BGL},${BG})`,color:catFilter==='all'?WHITE:MUTED,fontSize:10,fontWeight:700,cursor:'pointer'}}>All</button>
        {cats.map(c=>(
          <button key={c} onClick={()=>setCatFilter(c)} style={{flex:'0 0 auto',padding:'5px 10px',borderRadius:8,border:'none',background:catFilter===c?`linear-gradient(135deg,${CAT_META[c].color},${CAT_META[c].color}CC)`:`linear-gradient(145deg,${BGL},${BG})`,color:catFilter===c?WHITE:MUTED,fontSize:10,fontWeight:700,cursor:'pointer',whiteSpace:'nowrap'}}>
            {CAT_META[c].emoji} {CAT_META[c].label}
          </button>
        ))}
      </div>
      <div style={{display:'flex',gap:5,marginBottom:12,overflowX:'auto',paddingBottom:2}}>
        <button onClick={()=>setSrcFilter('all')} style={{flex:'0 0 auto',padding:'4px 8px',borderRadius:7,border:'none',background:srcFilter==='all'?`linear-gradient(135deg,${CYAN},#0891B2)`:`linear-gradient(145deg,${BGL},${BG})`,color:srcFilter==='all'?WHITE:MUTED,fontSize:9,fontWeight:700,cursor:'pointer'}}>All types</button>
        {srcTypes.map(t=>(
          <button key={t} onClick={()=>setSrcFilter(t)} style={{flex:'0 0 auto',padding:'4px 8px',borderRadius:7,border:'none',background:srcFilter===t?`linear-gradient(135deg,${SOURCE_TYPE_COLOR[t]||MUTED},${SOURCE_TYPE_COLOR[t]||MUTED}CC)`:`linear-gradient(145deg,${BGL},${BG})`,color:srcFilter===t?WHITE:MUTED,fontSize:9,fontWeight:700,cursor:'pointer',whiteSpace:'nowrap',textTransform:'capitalize'}}>{t}</button>
        ))}
      </div>

      {/* Stats row */}
      <div style={{display:'flex',gap:8,marginBottom:12,overflowX:'auto'}}>
        {[{l:'Total',v:events.length,c:WHITE},{l:'Critical',v:events.filter(e=>e.severity==='CRITICAL').length,c:DANGER},{l:'Security',v:events.filter(e=>e.category==='security'||e.category==='military').length,c:WARNING},{l:'Economy',v:events.filter(e=>e.category==='economy').length,c:SUCCESS}].map(s=>(
          <Surface key={s.l} inset style={{padding:'8px 12px',textAlign:'center',flex:'0 0 auto',minWidth:60}}>
            <div style={{fontSize:16,fontWeight:800,color:s.c,fontFamily:"'SF Mono',monospace"}}>{s.v}</div>
            <div style={{fontSize:9,color:MUTED}}>{s.l}</div>
          </Surface>
        ))}
      </div>

      {loading&&<div style={{textAlign:'center',padding:24,color:MUTED,fontSize:13}}>Fetching from {NG_SOURCES.length} sources...</div>}
      {!loading&&filtered.length===0&&<Surface inset style={{padding:24,textAlign:'center'}}><div style={{fontSize:12,color:MUTED}}>No stories match this filter</div></Surface>}
      {filtered.map(e=><NewsCard key={e.id} e={e} expanded={expanded===e.id} onToggle={toggle}/>)}
    </div>
  )
}
