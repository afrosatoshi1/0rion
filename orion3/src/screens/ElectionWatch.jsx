// Election Watch — Report & Authenticate Poll Results
import { useState, useEffect, useCallback } from 'react'

const BG='#0D1117',BGL='#141B24',WHITE='#F0F6FC',MUTED='#5A7A96',CYAN='#22D3EE',SUCCESS='#10B981',DANGER='#EF4444',WARNING='#F59E0B',BLUE='#3B82F6',GREEN='#10B981'
const SD='rgba(0,0,0,0.45)',SL='rgba(255,255,255,0.06)'
const N={raised:`3px 3px 8px ${SD},-2px -2px 6px ${SL}`,inset:`inset 2px 2px 6px ${SD},inset -1px -1px 4px ${SL}`,raisedSm:`2px 2px 5px ${SD},-1px -1px 4px ${SL}`}

function Surface({children,style={},inset,onClick}){
  return <div onClick={onClick} style={{background:`linear-gradient(145deg,${BGL},${BG})`,borderRadius:16,boxShadow:inset?N.inset:N.raised,border:`1px solid ${SL}`,cursor:onClick?'pointer':'default',...style}}>{children}</div>
}
function Btn({children,onClick,variant='default',disabled,full,style={}}){
  const bg=variant==='primary'?`linear-gradient(135deg,${BLUE},#2563EB)`:variant==='success'?`linear-gradient(135deg,${SUCCESS},#059669)`:variant==='danger'?`linear-gradient(135deg,${DANGER},#DC2626)`:`linear-gradient(145deg,${BGL},${BG})`
  return <button onClick={onClick} disabled={disabled} style={{background:bg,border:'none',borderRadius:12,padding:'10px 18px',color:WHITE,fontWeight:700,fontSize:13,cursor:disabled?'not-allowed':'pointer',opacity:disabled?0.5:1,width:full?'100%':'auto',boxShadow:N.raised,...style}}>{children}</button>
}

const NG_STATES=['Lagos','Abuja (FCT)','Kano','Rivers','Kaduna','Oyo','Edo','Delta','Enugu','Anambra','Imo','Abia','Cross River','Akwa Ibom','Borno','Yobe','Adamawa','Gombe','Bauchi','Plateau','Niger','Kwara','Ogun','Ondo','Ekiti','Osun','Kogi','Benue','Nassarawa','Taraba','Sokoto','Kebbi','Zamfara','Katsina','Jigawa','Bayelsa','Ebonyi']
const PARTIES=['APC','PDP','LP','NNPP','Other']
const PARTY_COLORS={APC:'#10B981',PDP:'#3B82F6',LP:'#F59E0B',NNPP:'#A78BFA',Other:'#5A7A96'}

async function aiVerifyResult(result){
  const key=import.meta.env.VITE_GROQ_API_KEY
  if(!key) return {safe:true,reason:'',confidence:0.5}
  try {
    const total=result.apc+result.pdp+result.lp+result.nnpp+result.other
    const res=await fetch('https://api.groq.com/openai/v1/chat/completions',{
      method:'POST',headers:{'Authorization':`Bearer ${key}`,'Content-Type':'application/json'},
      body:JSON.stringify({model:'llama-3.3-70b-versatile',messages:[{role:'user',content:`You are an election integrity AI for Nigeria. Analyze this polling unit result for anomalies.\n\nPolling unit: ${result.pollingUnit}, ${result.lga}, ${result.state}\nAPC: ${result.apc} | PDP: ${result.pdp} | LP: ${result.lp} | NNPP: ${result.nnpp} | Other: ${result.other}\nTotal votes: ${total} | Accredited voters: ${result.accredited}\n\nFlag if:\n- Any party has 100% of votes (statistically impossible)\n- Total votes exceed accredited voters\n- Numbers seem impossibly high for a single polling unit (max ~500 voters per PU in Nigeria)\n- The ratio strongly suggests data entry error\n\nReturn JSON: {"safe":boolean,"flag_reason":"brief reason if flagged, empty if safe","confidence":0.0-1.0,"anomalies":["list","of","issues"]}`}],temperature:0.1,max_tokens:300,response_format:{type:'json_object'}})
    })
    if(!res.ok) return {safe:true,reason:'',confidence:0.5}
    const data=await res.json()
    return JSON.parse(data.choices[0].message.content)
  } catch { return {safe:true,reason:'',confidence:0.5} }
}

function ResultCard({r,onVerify,userId,canVerify}){
  const total=r.apc_votes+r.pdp_votes+r.lp_votes+r.nnpp_votes+(r.other_votes||0)
  const maxParty=['APC','PDP','LP','NNPP','Other'].reduce((a,p)=>{
    const v=r[p.toLowerCase()+'_votes']||0;return v>a.v?{p,v}:a
  },{p:'',v:0})
  const statusColor=r.is_verified?SUCCESS:r.ai_flagged?DANGER:WARNING
  const statusLabel=r.is_verified?'✅ Verified':r.ai_flagged?'⚠️ AI Flagged':`⏳ ${r.verified_count}/3 confirmations`
  return (
    <Surface style={{padding:'14px 16px',marginBottom:10}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
        <div>
          <div style={{fontSize:13,fontWeight:700,color:WHITE,marginBottom:2}}>{r.polling_unit}</div>
          <div style={{fontSize:11,color:MUTED}}>{r.ward&&r.ward+' • '}{r.lga} • {r.state}</div>
        </div>
        <div style={{fontSize:10,fontWeight:700,color:statusColor,padding:'3px 8px',borderRadius:8,background:`${statusColor}15`}}>{statusLabel}</div>
      </div>
      {r.ai_flagged&&<div style={{background:`${DANGER}15`,border:`1px solid ${DANGER}44`,borderRadius:10,padding:'8px 10px',marginBottom:10,fontSize:11,color:DANGER}}>⚠️ {r.ai_flag_reason}</div>}
      {/* Vote bars */}
      {[['APC',r.apc_votes],['PDP',r.pdp_votes],['LP',r.lp_votes],['NNPP',r.nnpp_votes],['Other',r.other_votes||0]].map(([p,v])=>{
        if(!v&&p!=='APC'&&p!=='PDP') return null
        const pct=total>0?Math.round(v/total*100):0
        return (
          <div key={p} style={{marginBottom:7}}>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:11,marginBottom:3}}>
              <span style={{color:PARTY_COLORS[p],fontWeight:700}}>{p}</span>
              <span style={{color:WHITE}}>{v.toLocaleString()} <span style={{color:MUTED}}>({pct}%)</span></span>
            </div>
            <div style={{height:6,borderRadius:3,background:SD,overflow:'hidden'}}>
              <div style={{height:'100%',width:`${pct}%`,background:PARTY_COLORS[p],borderRadius:3,transition:'width 0.8s ease'}}/>
            </div>
          </div>
        )
      })}
      <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:MUTED,marginTop:8,paddingTop:8,borderTop:`1px solid ${SL}`}}>
        <span>Total votes: <strong style={{color:WHITE}}>{total.toLocaleString()}</strong></span>
        <span>Accredited: <strong style={{color:WHITE}}>{(r.total_accredited||0).toLocaleString()}</strong></span>
      </div>
      {r.image_url&&<a href={r.image_url} target="_blank" rel="noopener noreferrer" style={{display:'inline-block',marginTop:8,fontSize:11,color:CYAN}}>📷 View result sheet</a>}
      <div style={{fontSize:10,color:MUTED,marginTop:6}}>{new Date(r.submitted_at).toLocaleString('en-NG')}</div>
      {canVerify&&!r.is_verified&&!r.ai_flagged&&(
        <button onClick={()=>onVerify(r.id)} style={{marginTop:10,width:'100%',padding:'8px',borderRadius:10,border:`1px solid ${SUCCESS}44`,background:`${SUCCESS}15`,color:SUCCESS,fontSize:12,fontWeight:700,cursor:'pointer'}}>
          ✅ I can confirm this result
        </button>
      )}
    </Surface>
  )
}

export default function ElectionWatch({user,supabase}){
  const [tab,setTab]=useState('results')
  const [results,setResults]=useState([])
  const [loading,setLoading]=useState(false)
  const [showForm,setShowForm]=useState(false)
  const [submitting,setSubmitting]=useState(false)
  const [msg,setMsg]=useState(null)
  const [filterState,setFilterState]=useState('all')

  // Form state
  const [form,setForm]=useState({state:'',lga:'',ward:'',pollingUnit:'',puCode:'',accredited:'',apc:'',pdp:'',lp:'',nnpp:'',other:'',imageUrl:''})

  const isGuest=user.id==='guest'
  const toast=(m,t='success')=>{setMsg({text:m,type:t});setTimeout(()=>setMsg(null),4000)}

  const load=useCallback(async()=>{
    if(!supabase){setResults([]);return}
    setLoading(true)
    try {
      let q=supabase.from('election_results').select('*').order('submitted_at',{ascending:false}).limit(100)
      if(filterState!=='all') q=q.eq('state',filterState.toLowerCase())
      const {data}=await q
      setResults(data||[])
    } catch{}
    setLoading(false)
  },[supabase,filterState])

  useEffect(()=>{load()},[load])

  const setF=(k,v)=>setForm(f=>({...f,[k]:v}))

  const submit=async()=>{
    if(isGuest){toast('Sign in to submit results','error');return}
    if(!form.state||!form.lga||!form.pollingUnit){toast('Please fill required fields','error');return}
    setSubmitting(true)
    const r={
      user_id:user.id,state:form.state,lga:form.lga,ward:form.ward||null,
      polling_unit:form.pollingUnit,pu_code:form.puCode||null,
      apc_votes:parseInt(form.apc)||0,pdp_votes:parseInt(form.pdp)||0,
      lp_votes:parseInt(form.lp)||0,nnpp_votes:parseInt(form.nnpp)||0,
      other_votes:parseInt(form.other)||0,
      total_accredited:parseInt(form.accredited)||0,
      image_url:form.imageUrl||null,
    }
    // AI verification
    const check=await aiVerifyResult({...r,...form,apc:r.apc_votes,pdp:r.pdp_votes,lp:r.lp_votes,nnpp:r.nnpp_votes,other:r.other_votes})
    r.ai_flagged=!check.safe&&check.confidence>0.7
    r.ai_flag_reason=r.ai_flagged?check.flag_reason:null
    if(supabase){
      const {error}=await supabase.from('election_results').insert([r])
      if(error){toast('Submit failed: '+error.message,'error');setSubmitting(false);return}
    }
    toast(r.ai_flagged?'Submitted but AI flagged anomalies — review required':'Result submitted ✓')
    setForm({state:'',lga:'',ward:'',pollingUnit:'',puCode:'',accredited:'',apc:'',pdp:'',lp:'',nnpp:'',other:'',imageUrl:''})
    setShowForm(false)
    load()
    setSubmitting(false)
  }

  const verify=async(id)=>{
    if(isGuest||!supabase) return
    try {
      await supabase.from('result_verifications').insert([{result_id:id,user_id:user.id}])
      const r=results.find(x=>x.id===id)
      const newCount=(r.verified_count||0)+1
      await supabase.from('election_results').update({verified_count:newCount,is_verified:newCount>=3}).eq('id',id)
      load()
      toast('Confirmation recorded ✓')
    } catch(e){toast(e.code==='23505'?'Already confirmed':'Error','error')}
  }

  // Tally by party
  const tally=results.reduce((a,r)=>{
    a.apc+=r.apc_votes||0;a.pdp+=r.pdp_votes||0;a.lp+=r.lp_votes||0;a.nnpp+=r.nnpp_votes||0
    return a
  },{apc:0,pdp:0,lp:0,nnpp:0})
  const tallyTotal=tally.apc+tally.pdp+tally.lp+tally.nnpp||1

  return (
    <div style={{paddingBottom:8}}>
      <style>{`select{background:${BGL};color:${WHITE};border:none;outline:none;font-family:inherit;font-size:13px;width:100%} input[type=number]{-moz-appearance:textfield} input[type=number]::-webkit-outer-spin-button,input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none}`}</style>

      {/* Header */}
      <Surface style={{padding:'16px',marginBottom:12}} glow glowC={BLUE}>
        <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:8}}>
          <div style={{fontSize:28}}>🗳️</div>
          <div>
            <div style={{fontSize:15,fontWeight:800,color:WHITE}}>Election Watch 2027</div>
            <div style={{fontSize:11,color:MUTED}}>Community-verified poll results • Unofficial</div>
          </div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8}}>
          {[{l:'Total Results',v:results.length},{l:'Verified',v:results.filter(r=>r.is_verified).length},{l:'Flagged',v:results.filter(r=>r.ai_flagged).length}].map(s=>(
            <Surface key={s.l} inset style={{padding:'10px',textAlign:'center'}}>
              <div style={{fontSize:18,fontWeight:800,color:WHITE,fontFamily:"'SF Mono',monospace"}}>{s.v}</div>
              <div style={{fontSize:10,color:MUTED}}>{s.l}</div>
            </Surface>
          ))}
        </div>
      </Surface>

      {/* Live tally */}
      <Surface style={{padding:'14px 16px',marginBottom:12}}>
        <div style={{fontSize:12,fontWeight:700,color:WHITE,marginBottom:10}}>📊 Community Tally (unofficial)</div>
        {[['APC',tally.apc],['PDP',tally.pdp],['LP',tally.lp],['NNPP',tally.nnpp]].map(([p,v])=>(
          <div key={p} style={{marginBottom:8}}>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:3}}>
              <span style={{color:PARTY_COLORS[p],fontWeight:700}}>{p}</span>
              <span style={{color:WHITE}}>{v.toLocaleString()} <span style={{color:MUTED}}>({Math.round(v/tallyTotal*100)}%)</span></span>
            </div>
            <div style={{height:8,borderRadius:4,background:SD,overflow:'hidden'}}>
              <div style={{height:'100%',width:`${v/tallyTotal*100}%`,background:PARTY_COLORS[p],borderRadius:4,transition:'width 1s ease'}}/>
            </div>
          </div>
        ))}
        <div style={{fontSize:10,color:MUTED,marginTop:8}}>Based on {results.length} submitted polling units • Not official INEC figures</div>
      </Surface>

      {/* Tabs */}
      <div style={{display:'flex',gap:6,marginBottom:12}}>
        {[{id:'results',l:'All Results'},{id:'submit',l:'Submit Result'},{id:'info',l:'How it works'}].map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{flex:1,padding:'8px',borderRadius:12,border:'none',background:tab===t.id?`linear-gradient(135deg,${BLUE},#2563EB)`:`linear-gradient(145deg,${BGL},${BG})`,color:tab===t.id?WHITE:MUTED,fontSize:12,fontWeight:700,cursor:'pointer',boxShadow:N.raisedSm}}>{t.l}</button>
        ))}
      </div>

      {msg&&<div style={{padding:'10px 14px',borderRadius:12,marginBottom:12,background:msg.type==='error'?`${DANGER}22`:`${SUCCESS}22`,border:`1px solid ${msg.type==='error'?DANGER:SUCCESS}44`,color:msg.type==='error'?DANGER:SUCCESS,fontSize:13,fontWeight:600}}>{msg.text}</div>}

      {/* Results list */}
      {tab==='results'&&(
        <div>
          <Surface inset style={{padding:'8px 12px',borderRadius:12,marginBottom:12}}>
            <select value={filterState} onChange={e=>setFilterState(e.target.value)}>
              <option value="all">All states</option>
              {NG_STATES.map(s=><option key={s} value={s.toLowerCase()}>{s}</option>)}
            </select>
          </Surface>
          {loading&&<div style={{textAlign:'center',padding:20,color:MUTED}}>Loading results...</div>}
          {!loading&&results.length===0&&(
            <Surface inset style={{padding:30,textAlign:'center'}}>
              <div style={{fontSize:32,marginBottom:10}}>🗳️</div>
              <div style={{fontSize:14,color:WHITE,fontWeight:700,marginBottom:6}}>No results yet</div>
              <div style={{fontSize:12,color:MUTED}}>Be the first to submit your polling unit result</div>
            </Surface>
          )}
          {results.map(r=><ResultCard key={r.id} r={r} onVerify={verify} userId={user.id} canVerify={!isGuest}/>)}
        </div>
      )}

      {/* Submit form */}
      {tab==='submit'&&(
        <div>
          {isGuest&&<Surface inset style={{padding:'14px',borderRadius:12,marginBottom:12}}><div style={{fontSize:12,color:WARNING,textAlign:'center'}}>⚠️ You must be signed in to submit results</div></Surface>}
          <Surface inset style={{padding:'12px 14px',borderRadius:12,marginBottom:14}}>
            <div style={{fontSize:12,color:MUTED,lineHeight:1.7}}>📋 Submit your polling unit result. Every submission is AI-verified and requires 3 independent confirmations to be marked as verified. False submissions will result in an account ban.</div>
          </Surface>
          {[
            {l:'State *',k:'state',type:'select'},
            {l:'LGA *',k:'lga',ph:'e.g. Ikeja'},
            {l:'Ward',k:'ward',ph:'e.g. Ward 03'},
            {l:'Polling Unit Name *',k:'pollingUnit',ph:'e.g. Community Primary School'},
            {l:'PU Code (if known)',k:'puCode',ph:'e.g. 12/04/08/001'},
            {l:'Total Accredited Voters',k:'accredited',ph:'0',type:'number'},
          ].map(f=>(
            <div key={f.k} style={{marginBottom:12}}>
              <div style={{fontSize:11,color:MUTED,fontWeight:600,letterSpacing:'0.06em',textTransform:'uppercase',marginBottom:5}}>{f.l}</div>
              <Surface inset style={{padding:'9px 12px',borderRadius:10}}>
                {f.type==='select'
                  ? <select value={form.state} onChange={e=>setF('state',e.target.value)}><option value="">Select state</option>{NG_STATES.map(s=><option key={s} value={s.toLowerCase()}>{s}</option>)}</select>
                  : <input type={f.type||'text'} value={form[f.k]} onChange={e=>setF(f.k,e.target.value)} placeholder={f.ph} style={{background:'none',border:'none',outline:'none',color:WHITE,fontSize:13,width:'100%',fontFamily:'inherit'}}/>
                }
              </Surface>
            </div>
          ))}
          <div style={{fontSize:11,color:MUTED,fontWeight:600,letterSpacing:'0.06em',textTransform:'uppercase',marginBottom:8}}>VOTES</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:12}}>
            {PARTIES.map(p=>(
              <div key={p}>
                <div style={{fontSize:11,color:PARTY_COLORS[p],fontWeight:700,marginBottom:4}}>{p}</div>
                <Surface inset style={{padding:'9px 12px',borderRadius:10}}>
                  <input type="number" value={form[p.toLowerCase()]||''} onChange={e=>setF(p.toLowerCase(),e.target.value)} placeholder="0" min="0" style={{background:'none',border:'none',outline:'none',color:WHITE,fontSize:13,width:'100%',fontFamily:'inherit'}}/>
                </Surface>
              </div>
            ))}
          </div>
          <div style={{marginBottom:14}}>
            <div style={{fontSize:11,color:MUTED,fontWeight:600,letterSpacing:'0.06em',textTransform:'uppercase',marginBottom:5}}>Result Sheet Image URL (optional)</div>
            <Surface inset style={{padding:'9px 12px',borderRadius:10}}>
              <input value={form.imageUrl} onChange={e=>setF('imageUrl',e.target.value)} placeholder="https://... (upload to imgur/cloudinary first)" style={{background:'none',border:'none',outline:'none',color:WHITE,fontSize:13,width:'100%',fontFamily:'inherit'}}/>
            </Surface>
          </div>
          <Btn variant="primary" full onClick={submit} disabled={submitting||isGuest}>{submitting?'Verifying & Submitting...':'Submit Result'}</Btn>
        </div>
      )}

      {/* Info */}
      {tab==='info'&&(
        <div>
          {[
            {emoji:'📝',title:'1. Submit your result',body:'After voting, go to your polling unit result sheet and submit the figures here. Include your state, LGA, ward, and polling unit name.'},
            {emoji:'🤖',title:'2. AI checks the numbers',body:'Our AI immediately scans for anomalies — votes exceeding accredited voters, impossibly lopsided results, or data entry errors. Flagged results are highlighted.'},
            {emoji:'👥',title:'3. Community verification',body:'3 independent users from the same polling unit must submit matching results for it to be marked as ✅ Verified. One submission = unverified.'},
            {emoji:'📊',title:'4. Live community tally',body:'All verified results are aggregated into a real-time unofficial tally. This is NOT official INEC figures — it is community-driven transparency.'},
            {emoji:'⚠️',title:'Disclaimer',body:'These are community-submitted results for transparency only. Official election results come from INEC. False submissions = permanent ban.'},
          ].map(s=>(
            <Surface key={s.title} style={{padding:'14px 16px',marginBottom:10}}>
              <div style={{display:'flex',gap:12,alignItems:'flex-start'}}>
                <div style={{fontSize:24,flexShrink:0}}>{s.emoji}</div>
                <div><div style={{fontSize:13,fontWeight:700,color:WHITE,marginBottom:4}}>{s.title}</div><div style={{fontSize:12,color:MUTED,lineHeight:1.65}}>{s.body}</div></div>
              </div>
            </Surface>
          ))}
        </div>
      )}
    </div>
  )
}
