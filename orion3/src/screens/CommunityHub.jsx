// Community Hub — Posts, Challenges, Content, AI Advice
import { useState, useEffect, useCallback } from 'react'

const BG='#0D1117',BGL='#141B24',WHITE='#F0F6FC',MUTED='#5A7A96',CYAN='#22D3EE',SUCCESS='#10B981',DANGER='#EF4444',WARNING='#F59E0B',BLUE='#3B82F6',PURPLE='#A78BFA'
const SD='rgba(0,0,0,0.45)',SL='rgba(255,255,255,0.06)'
const N={raised:`3px 3px 8px ${SD},-2px -2px 6px ${SL}`,inset:`inset 2px 2px 6px ${SD},inset -1px -1px 4px ${SL}`,raisedSm:`2px 2px 5px ${SD},-1px -1px 4px ${SL}`}

function Surface({children,style={},inset,onClick,glow,glowC=CYAN}){
  return <div onClick={onClick} style={{background:`linear-gradient(145deg,${BGL},${BG})`,borderRadius:16,boxShadow:inset?N.inset:glow?`${N.raised},0 0 16px ${glowC}22`:N.raised,border:`1px solid ${SL}`,cursor:onClick?'pointer':'default',...style}}>{children}</div>
}
function Btn({children,onClick,variant='default',disabled,full,sz='md',style={}}){
  const bg=variant==='primary'?`linear-gradient(135deg,${BLUE},#2563EB)`:variant==='success'?`linear-gradient(135deg,${SUCCESS},#059669)`:variant==='purple'?`linear-gradient(135deg,${PURPLE},#7C3AED)`:`linear-gradient(145deg,${BGL},${BG})`
  const pad=sz==='sm'?'6px 12px':'10px 18px'
  return <button onClick={onClick} disabled={disabled} style={{background:bg,border:'none',borderRadius:12,padding:pad,color:WHITE,fontWeight:700,fontSize:sz==='sm'?11:13,cursor:disabled?'not-allowed':'pointer',opacity:disabled?0.5:1,width:full?'100%':'auto',boxShadow:N.raised,...style}}>{children}</button>
}

const CATEGORIES=[
  {id:'all',label:'All',emoji:'🌍'},
  {id:'challenge',label:'Challenges',emoji:'🆘'},
  {id:'article',label:'Articles',emoji:'📰'},
  {id:'post',label:'Posts',emoji:'💬'},
  {id:'advice',label:'Advice',emoji:'💡'},
]

async function getAIAdvice(title,body,category){
  const key=import.meta.env.VITE_GROQ_API_KEY
  if(!key) return null
  try {
    const isChallenge=category==='challenge'
    const prompt=isChallenge
      ? `You are 0rion Nigeria AI — an intelligent assistant for Nigerians. Someone has submitted this challenge they are facing:\n\nTitle: ${title}\nDetails: ${body}\n\nProvide practical, specific advice based on Nigerian laws, institutions, and current realities. Reference actual government offices, NGOs, legal provisions, or community resources in Nigeria where applicable.\n\nReturn JSON: {"advice":"3-4 paragraph practical advice for this Nigerian","resources":["resource 1","resource 2"],"urgency":"low|medium|high","action_steps":["step 1","step 2","step 3"]}`
      : `Rate the factual accuracy of this Nigerian content on a scale of 0-100 and explain briefly.\n\nTitle: ${title}\nContent: ${body}\n\nReturn JSON: {"factuality_score":integer 0-100,"assessment":"one sentence","is_misinformation":boolean}`
    const res=await fetch('https://api.groq.com/openai/v1/chat/completions',{
      method:'POST',headers:{'Authorization':`Bearer ${key}`,'Content-Type':'application/json'},
      body:JSON.stringify({model:'llama-3.3-70b-versatile',messages:[{role:'user',content:prompt}],temperature:0.4,max_tokens:800,response_format:{type:'json_object'}})
    })
    if(!res.ok) return null
    const data=await res.json()
    return JSON.parse(data.choices[0].message.content)
  } catch { return null }
}

function ContentCard({item,onVote,onExpand,expanded,userId}){
  const typeColor={post:BLUE,article:CYAN,challenge:WARNING,advice:SUCCESS}
  const typeEmoji={post:'💬',article:'📰',challenge:'🆘',advice:'💡'}
  const scoreColor=item.factuality>70?SUCCESS:item.factuality>40?WARNING:item.factuality>0?DANGER:MUTED
  return (
    <Surface style={{padding:'14px 16px',marginBottom:10,borderLeft:item.is_featured?`3px solid ${CYAN}`:'none'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
        <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
          <span style={{fontSize:10,fontWeight:700,color:typeColor[item.type]||BLUE,background:`${typeColor[item.type]||BLUE}22`,padding:'2px 8px',borderRadius:6}}>{typeEmoji[item.type]||'💬'} {item.type?.toUpperCase()}</span>
          {item.is_featured&&<span style={{fontSize:10,fontWeight:700,color:CYAN,background:`${CYAN}22`,padding:'2px 8px',borderRadius:6}}>⭐ FEATURED</span>}
          {item.is_resolved&&<span style={{fontSize:10,fontWeight:700,color:SUCCESS,background:`${SUCCESS}22`,padding:'2px 8px',borderRadius:6}}>✅ RESOLVED</span>}
          {item.factuality>0&&<span style={{fontSize:10,fontWeight:700,color:scoreColor}}>Fact: {item.factuality}/100</span>}
        </div>
        <div style={{fontSize:10,color:MUTED}}>{item.state||'Nigeria'}</div>
      </div>
      <div style={{fontSize:14,fontWeight:700,color:WHITE,marginBottom:6,lineHeight:1.4}}>{item.title}</div>
      <div style={{fontSize:12,color:MUTED,lineHeight:1.65,marginBottom:8}} onClick={()=>onExpand(item.id)} style={{fontSize:12,color:MUTED,lineHeight:1.65,marginBottom:8,cursor:'pointer'}}>
        {expanded?item.body:item.body?.slice(0,160)+(item.body?.length>160?'...':'')}
      </div>

      {/* AI Advice for challenges */}
      {expanded&&item.ai_advice&&(
        <Surface inset style={{padding:'12px 14px',borderRadius:12,marginBottom:10,borderLeft:`3px solid ${PURPLE}`}}>
          <div style={{fontSize:11,fontWeight:700,color:PURPLE,marginBottom:6}}>🤖 0rion AI Advice</div>
          <div style={{fontSize:12,color:MUTED,lineHeight:1.7,whiteSpace:'pre-line'}}>{item.ai_advice}</div>
        </Surface>
      )}

      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div style={{display:'flex',gap:8}}>
          <button onClick={()=>onVote(item.id,'up')} style={{background:'none',border:'none',cursor:'pointer',color:MUTED,fontSize:12,padding:'4px 8px',borderRadius:8,fontWeight:700}}>👍 {item.upvotes||0}</button>
          <button onClick={()=>onVote(item.id,'down')} style={{background:'none',border:'pointer',cursor:'pointer',color:MUTED,fontSize:12,padding:'4px 8px',borderRadius:8,fontWeight:700}}>👎 {item.downvotes||0}</button>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <span style={{fontSize:10,color:MUTED}}>{item.anonymous?'Anonymous':item.author_name||'User'}</span>
          <span style={{fontSize:10,color:MUTED}}>{new Date(item.created_at).toLocaleDateString('en-NG')}</span>
          <button onClick={()=>onExpand(item.id)} style={{background:'none',border:'none',cursor:'pointer',fontSize:11,color:CYAN,fontWeight:600}}>{expanded?'Less':'More'}</button>
        </div>
      </div>
    </Surface>
  )
}

export default function CommunityHub({user,supabase}){
  const [cat,setCat]=useState('all')
  const [items,setItems]=useState([])
  const [loading,setLoading]=useState(false)
  const [showCompose,setShowCompose]=useState(false)
  const [expanded,setExpanded]=useState(null)
  const [msg,setMsg]=useState(null)
  const [aiWorking,setAiWorking]=useState(false)
  const isGuest=user.id==='guest'
  const toast=(m,t='success')=>{setMsg({text:m,type:t});setTimeout(()=>setMsg(null),4000)}

  // Compose form
  const [type,setType]=useState('post')
  const [title,setTitle]=useState('')
  const [body,setBody]=useState('')
  const [state,setState]=useState('')
  const [anon,setAnon]=useState(false)
  const [submitting,setSubmitting]=useState(false)

  const load=useCallback(async()=>{
    if(!supabase){setItems([]);return}
    setLoading(true)
    try {
      let q=supabase.from('community_content').select('*').order('created_at',{ascending:false}).limit(50)
      if(cat!=='all') q=q.eq('type',cat)
      const {data}=await q
      setItems(data||[])
    } catch{}
    setLoading(false)
  },[supabase,cat])

  useEffect(()=>{load()},[load])

  const vote=async(id,direction)=>{
    if(isGuest||!supabase){toast('Sign in to vote','error');return}
    try {
      await supabase.from('content_votes').insert([{content_id:id,user_id:user.id,vote:direction}])
      const field=direction==='up'?'upvotes':'downvotes'
      const item=items.find(x=>x.id===id)
      await supabase.from('community_content').update({[field]:(item[field]||0)+1}).eq('id',id)
      setItems(prev=>prev.map(x=>x.id===id?{...x,[field]:(x[field]||0)+1}:x))
    } catch(e){if(e.code==='23505')toast('Already voted','error')}
  }

  const submit=async()=>{
    if(isGuest){toast('Sign in to post','error');return}
    if(!title.trim()||!body.trim()){toast('Title and content required','error');return}
    setSubmitting(true)
    setAiWorking(true)
    const aiResult=await getAIAdvice(title,body,type)
    setAiWorking(false)
    const record={
      user_id:user.id,author_name:anon?null:(user.name||'User'),
      type,title:title.trim(),body:body.trim(),state:state||null,anonymous:anon,
      ai_advice: type==='challenge'&&aiResult?.advice ? aiResult.advice : null,
      factuality: type!=='challenge'&&aiResult?.factuality_score ? aiResult.factuality_score : 0,
      ai_score: aiResult?.factuality_score||0,
    }
    if(supabase){
      const {error}=await supabase.from('community_content').insert([record])
      if(error){toast('Post failed: '+error.message,'error');setSubmitting(false);return}
    }
    toast('Posted ✓')
    setTitle('');setBody('');setType('post');setState('');setAnon(false);setShowCompose(false)
    load()
    setSubmitting(false)
  }

  const toggleExpand=useCallback((id)=>setExpanded(e=>e===id?null:id),[])

  const NG_STATES=['Lagos','Abuja (FCT)','Kano','Rivers','Kaduna','Oyo','Edo','Delta','Enugu','Anambra','Imo','Abia','Cross River','Akwa Ibom','Borno','Yobe','Adamawa','Gombe','Bauchi','Plateau','Niger','Kwara','Ogun','Ondo','Ekiti','Osun','Kogi','Benue','Nassarawa','Taraba','Sokoto','Kebbi','Zamfara','Katsina','Jigawa','Bayelsa','Ebonyi']

  return (
    <div style={{paddingBottom:8}}>
      <style>{`select{background:${BGL};color:${WHITE};border:none;outline:none;font-family:inherit;font-size:13px;width:100%}`}</style>

      {/* Header */}
      <Surface glow glowC={PURPLE} style={{padding:'14px 16px',marginBottom:12}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div>
            <div style={{fontSize:15,fontWeight:800,color:WHITE}}>📣 Community Hub</div>
            <div style={{fontSize:11,color:MUTED}}>Posts • Challenges • AI Advice • Articles</div>
          </div>
          <Btn variant="primary" sz="sm" onClick={()=>setShowCompose(s=>!s)}>+ Post</Btn>
        </div>
      </Surface>

      {/* Compose */}
      {showCompose&&(
        <Surface style={{padding:'16px',marginBottom:12}}>
          <div style={{fontSize:13,fontWeight:700,color:WHITE,marginBottom:12}}>Create Content</div>
          {/* Type selector */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:6,marginBottom:14}}>
            {[{id:'post',e:'💬'},{id:'article',e:'📰'},{id:'challenge',e:'🆘'},{id:'advice',e:'💡'}].map(t=>(
              <button key={t.id} onClick={()=>setType(t.id)} style={{padding:'8px 4px',borderRadius:10,border:'none',background:type===t.id?`linear-gradient(135deg,${BLUE},#2563EB)`:`linear-gradient(145deg,${BGL},${BG})`,color:type===t.id?WHITE:MUTED,fontSize:11,fontWeight:700,cursor:'pointer',boxShadow:N.raisedSm}}>
                {t.e} {t.id}
              </button>
            ))}
          </div>
          {type==='challenge'&&<Surface inset style={{padding:'10px 12px',borderRadius:10,marginBottom:12}}><div style={{fontSize:11,color:PURPLE,lineHeight:1.6}}>🆘 Describe your challenge in detail. 0rion AI will provide practical Nigerian-specific advice and publish solutions to help others in the same situation.</div></Surface>}
          <Surface inset style={{padding:'10px 12px',borderRadius:10,marginBottom:10}}>
            <input value={title} onChange={e=>setTitle(e.target.value)} placeholder={type==='challenge'?'Describe your challenge briefly...':'Title'} style={{background:'none',border:'none',outline:'none',color:WHITE,fontSize:13,width:'100%',fontFamily:'inherit'}}/>
          </Surface>
          <Surface inset style={{padding:'10px 12px',borderRadius:10,marginBottom:10}}>
            <textarea value={body} onChange={e=>setBody(e.target.value)} placeholder={type==='challenge'?'Give full details — what happened, where you are, what you have tried...':'Share your thoughts, information, or story...'} rows={5} style={{background:'none',border:'none',outline:'none',color:WHITE,fontSize:12,width:'100%',fontFamily:'inherit',resize:'none',lineHeight:1.65}}/>
          </Surface>
          <div style={{display:'flex',gap:8,marginBottom:12,alignItems:'center'}}>
            <Surface inset style={{padding:'8px 12px',borderRadius:10,flex:1}}>
              <select value={state} onChange={e=>setState(e.target.value)}>
                <option value="">State (optional)</option>
                {NG_STATES.map(s=><option key={s} value={s.toLowerCase()}>{s}</option>)}
              </select>
            </Surface>
            <label style={{display:'flex',alignItems:'center',gap:6,cursor:'pointer',fontSize:12,color:MUTED,flexShrink:0}}>
              <input type="checkbox" checked={anon} onChange={e=>setAnon(e.target.checked)} style={{accentColor:CYAN}}/>
              Anonymous
            </label>
          </div>
          <div style={{display:'flex',gap:8}}>
            <Btn variant="primary" full onClick={submit} disabled={submitting||!title||!body}>
              {aiWorking?'🤖 AI processing...':submitting?'Posting...':'Publish'}
            </Btn>
            <Btn onClick={()=>setShowCompose(false)} style={{flexShrink:0}}>Cancel</Btn>
          </div>
        </Surface>
      )}

      {/* Category filters */}
      <div style={{display:'flex',gap:6,marginBottom:12,overflowX:'auto',paddingBottom:2}}>
        {CATEGORIES.map(c=>(
          <button key={c.id} onClick={()=>setCat(c.id)} style={{flex:'0 0 auto',padding:'6px 12px',borderRadius:10,border:'none',background:cat===c.id?`linear-gradient(135deg,${PURPLE},#7C3AED)`:`linear-gradient(145deg,${BGL},${BG})`,color:cat===c.id?WHITE:MUTED,fontSize:11,fontWeight:700,cursor:'pointer',boxShadow:N.raisedSm,whiteSpace:'nowrap'}}>
            {c.emoji} {c.label}
          </button>
        ))}
      </div>

      {msg&&<div style={{padding:'10px 14px',borderRadius:12,marginBottom:12,background:msg.type==='error'?`${DANGER}22`:`${SUCCESS}22`,border:`1px solid ${msg.type==='error'?DANGER:SUCCESS}44`,color:msg.type==='error'?DANGER:SUCCESS,fontSize:13,fontWeight:600}}>{msg.text}</div>}

      {loading&&<div style={{textAlign:'center',padding:24,color:MUTED,fontSize:13}}>Loading community content...</div>}
      {!loading&&items.length===0&&(
        <Surface inset style={{padding:30,textAlign:'center'}}>
          <div style={{fontSize:32,marginBottom:10}}>📣</div>
          <div style={{fontSize:14,color:WHITE,fontWeight:700,marginBottom:6}}>No posts yet</div>
          <div style={{fontSize:12,color:MUTED,marginBottom:16}}>Be the first to share something with the community</div>
          <Btn variant="primary" onClick={()=>setShowCompose(true)}>Post Something</Btn>
        </Surface>
      )}

      {items.map(item=>(
        <ContentCard key={item.id} item={item} onVote={vote} onExpand={toggleExpand} expanded={expanded===item.id} userId={user.id}/>
      ))}
    </div>
  )
}
