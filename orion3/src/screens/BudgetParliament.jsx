// Budget & Parliament Tracker
import { useState, useEffect } from 'react'
import { BUDGET_2025, fetchParliamentActivity, fetchNGEvents, fetchLiveFAAC } from '../api/nigeria'

const BG='#0D1117',BGL='#141B24',WHITE='#F0F6FC',MUTED='#5A7A96',CYAN='#22D3EE',SUCCESS='#10B981',DANGER='#EF4444',WARNING='#F59E0B',BLUE='#3B82F6'
const SD='rgba(0,0,0,0.45)',SL='rgba(255,255,255,0.06)'
const N={raised:`3px 3px 8px ${SD},-2px -2px 6px ${SL}`,inset:`inset 2px 2px 6px ${SD},inset -1px -1px 4px ${SL}`,raisedSm:`2px 2px 5px ${SD},-1px -1px 4px ${SL}`}

function Surface({children,style={},inset}){
  return <div style={{background:`linear-gradient(145deg,${BGL},${BG})`,borderRadius:16,boxShadow:inset?N.inset:N.raised,border:`1px solid ${SL}`,...style}}>{children}</div>
}
function Bar({label,value,max,color,sub}){
  const pct=Math.min(100,Math.round(value/max*100))
  return (
    <div style={{marginBottom:12}}>
      <div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:4}}>
        <span style={{color:WHITE,fontWeight:600}}>{label}</span>
        <span style={{color,fontWeight:700,fontFamily:"'SF Mono',monospace"}}>₦{(value/1000).toFixed(1)}T <span style={{color:MUTED,fontWeight:400}}>({pct}%)</span></span>
      </div>
      <div style={{height:8,borderRadius:4,background:SD,overflow:'hidden'}}>
        <div style={{height:'100%',width:`${pct}%`,background:color,borderRadius:4,transition:'width 1s ease'}}/>
      </div>
      {sub&&<div style={{fontSize:10,color:MUTED,marginTop:3}}>{sub}</div>}
    </div>
  )
}

export default function BudgetParliament(){
  const [tab,setTab]=useState('budget')
  const [parliament,setParliament]=useState({items:[],summary:null,bills:[]})
  const [loading,setLoading]=useState(false)
  const [stateFilter,setStateFilter]=useState('')
  const [liveFaac,setLiveFaac]=useState(null)
  const budget=BUDGET_2025

  useEffect(()=>{
    if(tab==='parliament') loadParliament()
    if(tab==='states') loadFaac()
  },[tab])

  const loadFaac=async()=>{
    const data=await fetchLiveFAAC()
    if(data) setLiveFaac(data)
  }

  const loadParliament=async()=>{
    setLoading(true)
    try {
      const events=await fetchNGEvents('government')
      const data=await fetchParliamentActivity(events)
      setParliament(data)
    } catch{}
    setLoading(false)
  }

  const filteredStates=stateFilter
    ? budget.stateAllocations.filter(s=>s.state.toLowerCase().includes(stateFilter.toLowerCase()))
    : budget.stateAllocations

  const tabs=[{id:'budget',l:'Federal Budget'},{id:'states',l:'State Allocations'},{id:'parliament',l:'NASS Activity'}]

  return (
    <div style={{paddingBottom:8}}>
      {/* Header */}
      <Surface style={{padding:'14px 16px',marginBottom:12}}>
        <div style={{fontSize:15,fontWeight:800,color:WHITE,marginBottom:2}}>💰 Budget & Parliament</div>
        <div style={{fontSize:11,color:MUTED}}>Federal budget • State FAAC allocations • NASS activity</div>
        <div style={{fontSize:10,color:WARNING,marginTop:6}}>📊 Budget data: FY{budget.year} · Source: {budget.source}</div>
        <div style={{fontSize:10,color:MUTED,marginTop:2}}>Assumptions: Oil @ ${budget.oilPrice.assumed}/bbl · Exchange ₦{budget.exchangeRate.assumed}/$</div>
      </Surface>

      {/* Tabs */}
      <div style={{display:'flex',gap:6,marginBottom:12}}>
        {tabs.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{flex:1,padding:'8px',borderRadius:12,border:'none',background:tab===t.id?`linear-gradient(135deg,${BLUE},#2563EB)`:`linear-gradient(145deg,${BGL},${BG})`,color:tab===t.id?WHITE:MUTED,fontSize:11,fontWeight:700,cursor:'pointer',boxShadow:N.raisedSm}}>{t.l}</button>
        ))}
      </div>

      {/* Budget tab */}
      {tab==='budget'&&(
        <div>
          <Surface glow glowC={WARNING} style={{padding:'16px',marginBottom:12}}>
            <div style={{textAlign:'center',marginBottom:12}}>
              <div style={{fontSize:11,color:MUTED,textTransform:'uppercase',letterSpacing:'0.08em'}}>FY{budget.year} Total Budget</div>
              <div style={{fontSize:32,fontWeight:900,color:WHITE,fontFamily:"'SF Mono',monospace",marginTop:4}}>{budget.totalFormatted}</div>
              <div style={{fontSize:11,color:DANGER,marginTop:4}}>Deficit: {budget.deficit.value} ({budget.deficit.gdpPct} of GDP)</div>
            </div>
            {budget.breakdown.map(b=>(
              <div key={b.label} style={{marginBottom:14}}>
                <Bar label={b.label} value={b.value} max={budget.totalBn} color={b.color} sub={b.note}/>
              </div>
            ))}
          </Surface>

          <Surface style={{padding:'14px 16px',marginBottom:12}}>
            <div style={{fontSize:13,fontWeight:700,color:WHITE,marginBottom:10}}>FAAC Sharing Formula</div>
            {[{l:'Federal Government',v:budget.faac.federal,color:DANGER},{l:'State Governments (36 states)',v:budget.faac.state,color:BLUE},{l:'Local Governments',v:budget.faac.lga,color:SUCCESS}].map(f=>(
              <div key={f.l} style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
                <span style={{fontSize:12,color:WHITE}}>{f.l}</span>
                <span style={{fontSize:14,fontWeight:800,color:f.color,fontFamily:"'SF Mono',monospace"}}>{f.v}%</span>
              </div>
            ))}
            <Surface inset style={{padding:'10px 12px',borderRadius:10,marginTop:4}}>
              <div style={{fontSize:11,color:MUTED,lineHeight:1.7}}>Every month, oil revenue + taxes flow into the Federation Account and are shared. Your governor gets a monthly allocation. Demand to know how it is spent in your community.</div>
            </Surface>
          </Surface>

          <Surface style={{padding:'14px 16px'}}>
            <div style={{fontSize:13,fontWeight:700,color:WHITE,marginBottom:4}}>Deficit Financing</div>
            <div style={{fontSize:12,color:MUTED,lineHeight:1.65}}>{budget.deficit.financed}. Nigeria spends more than it earns every year. ₦{budget.deficit.value} was borrowed to fund this budget — added to existing national debt.</div>
          </Surface>
        </div>
      )}

      {/* State allocations */}
      {tab==='states'&&(
        <div>
          <Surface inset style={{padding:'8px 12px',borderRadius:12,marginBottom:12}}>
            <input value={stateFilter} onChange={e=>setStateFilter(e.target.value)} placeholder="Search state..." style={{background:'none',border:'none',outline:'none',color:WHITE,fontSize:13,width:'100%',fontFamily:'inherit'}}/>
          </Surface>
          <Surface inset style={{padding:'10px 14px',borderRadius:12,marginBottom:12}}>
            <div style={{fontSize:11,color:MUTED,lineHeight:1.65}}>{liveFaac ? '🟢 Live FAAC data loaded from BudgIT' : '📊 FY2025 estimated monthly allocations for all 37 states + FCT. Based on population, derivation, and equity sharing formula. Source: Ministry of Finance / BudgIT.'}</div>
          </Surface>
          {filteredStates.map(s=>(
            <Surface key={s.state} style={{padding:'12px 16px',marginBottom:8}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <div>
                  <div style={{fontSize:13,fontWeight:700,color:WHITE}}>{s.state}</div>
                  <div style={{fontSize:11,color:MUTED,marginTop:2}}>Pop: {s.pop} • Per capita: {s.perCapita}</div>
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{fontSize:15,fontWeight:800,color:SUCCESS,fontFamily:"'SF Mono',monospace"}}>{s.amount}</div>
                  <div style={{fontSize:10,color:MUTED}}>monthly est.</div>
                </div>
              </div>
            </Surface>
          ))}
        </div>
      )}

      {/* Parliament */}
      {tab==='parliament'&&(
        <div>
          {loading&&<div style={{textAlign:'center',padding:24,color:MUTED}}>Analyzing NASS activity...</div>}
          {!loading&&parliament.summary&&(
            <Surface glow glowC={BLUE} style={{padding:'14px 16px',marginBottom:12}}>
              <div style={{fontSize:12,fontWeight:700,color:CYAN,marginBottom:8}}>🏛️ NASS Summary (AI-generated from live news)</div>
              <div style={{fontSize:12,color:MUTED,lineHeight:1.7}}>{parliament.summary}</div>
            </Surface>
          )}
          {!loading&&parliament.bills?.length>0&&(
            <div style={{marginBottom:12}}>
              <div style={{fontSize:13,fontWeight:700,color:WHITE,marginBottom:10}}>Bills & Legislation</div>
              {parliament.bills.map((b,i)=>(
                <Surface key={i} style={{padding:'12px 14px',marginBottom:8}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:6}}>
                    <div style={{fontSize:13,fontWeight:700,color:WHITE,flex:1,marginRight:10}}>{b.name}</div>
                    <span style={{fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:6,background:b.status==='passed'?`${SUCCESS}22`:b.status==='rejected'?`${DANGER}22`:`${WARNING}22`,color:b.status==='passed'?SUCCESS:b.status==='rejected'?DANGER:WARNING,flexShrink:0}}>{b.status?.toUpperCase()}</span>
                  </div>
                  <div style={{fontSize:11,color:MUTED,marginBottom:4}}>{b.chamber}</div>
                  {b.impact&&<div style={{fontSize:11,color:WARNING,lineHeight:1.6}}>💡 {b.impact}</div>}
                </Surface>
              ))}
            </div>
          )}
          {!loading&&(parliament.items||[]).length>0&&(
            <div>
              <div style={{fontSize:13,fontWeight:700,color:WHITE,marginBottom:10}}>Recent NASS News</div>
              {(parliament.items||[]).map(e=>(
                <Surface key={e.id} style={{padding:'12px 14px',marginBottom:8}}>
                  <div style={{fontSize:13,fontWeight:600,color:WHITE,marginBottom:4,lineHeight:1.4}}>{e.title}</div>
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:MUTED}}>
                    <span>{e.source}</span>
                    <span>{new Date(e.timestamp).toLocaleDateString('en-NG')}</span>
                  </div>
                  {e.link&&<a href={e.link} target="_blank" rel="noopener noreferrer" style={{fontSize:11,color:CYAN,marginTop:4,display:'inline-block'}}>Read more →</a>}
                </Surface>
              ))}
            </div>
          )}
          {!loading&&!parliament.summary&&parliament.items?.length===0&&(
            <Surface inset style={{padding:30,textAlign:'center'}}>
              <div style={{fontSize:28,marginBottom:8}}>🏛️</div>
              <div style={{fontSize:13,color:MUTED}}>No NASS activity found in current feeds. Try again later.</div>
            </Surface>
          )}
        </div>
      )}
    </div>
  )
}
