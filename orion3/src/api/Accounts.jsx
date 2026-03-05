// Account Screen — Profile, Settings, Password, Notifications
import { useState, useEffect, useCallback } from 'react'

const BG='#0D1117',BGL='#141B24',WHITE='#F0F6FC',MUTED='#5A7A96',CYAN='#22D3EE',SUCCESS='#10B981',DANGER='#EF4444',WARNING='#F59E0B',BLUE='#3B82F6'
const SD='rgba(0,0,0,0.45)',SL='rgba(255,255,255,0.06)'
const N={raised:`3px 3px 8px ${SD},-2px -2px 6px ${SL}`,inset:`inset 2px 2px 6px ${SD},inset -1px -1px 4px ${SL}`,raisedSm:`2px 2px 5px ${SD},-1px -1px 4px ${SL}`}

function Surface({children,style={},inset,onClick,glow,glowC=CYAN}){
  return <div onClick={onClick} style={{background:`linear-gradient(145deg,${BGL},${BG})`,borderRadius:16,boxShadow:inset?N.inset:glow?`${N.raised},0 0 16px ${glowC}22`:N.raised,border:`1px solid ${SL}`,cursor:onClick?'pointer':'default',...style}}>{children}</div>
}
function Btn({children,onClick,variant='default',disabled,full,style={}}){
  const bg=variant==='primary'?`linear-gradient(135deg,${BLUE},#2563EB)`:variant==='danger'?`linear-gradient(135deg,${DANGER},#DC2626)`:`linear-gradient(145deg,${BGL},${BG})`
  return <button onClick={onClick} disabled={disabled} style={{background:bg,border:'none',borderRadius:12,padding:'10px 18px',color:WHITE,fontWeight:700,fontSize:13,cursor:disabled?'not-allowed':'pointer',opacity:disabled?0.5:1,width:full?'100%':'auto',boxShadow:N.raised,...style}}>{children}</button>
}
function Field({label,value,onChange,type='text',placeholder='',multiline,disabled}){
  return (
    <div style={{marginBottom:14}}>
      <div style={{fontSize:11,color:MUTED,fontWeight:600,letterSpacing:'0.06em',textTransform:'uppercase',marginBottom:6}}>{label}</div>
      <Surface inset style={{padding:'10px 14px',borderRadius:12}}>
        {multiline
          ? <textarea value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} disabled={disabled} rows={3} style={{background:'none',border:'none',outline:'none',color:disabled?MUTED:WHITE,fontSize:13,width:'100%',fontFamily:'inherit',resize:'none',lineHeight:1.6}}/>
          : <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} disabled={disabled} style={{background:'none',border:'none',outline:'none',color:disabled?MUTED:WHITE,fontSize:13,width:'100%',fontFamily:'inherit'}}/>
        }
      </Surface>
    </div>
  )
}

const NG_STATES=['Lagos','Abuja (FCT)','Kano','Rivers','Kaduna','Oyo','Edo','Delta','Enugu','Anambra','Imo','Abia','Cross River','Akwa Ibom','Borno','Yobe','Adamawa','Gombe','Bauchi','Plateau','Niger','Kwara','Ogun','Ondo','Ekiti','Osun','Kogi','Benue','Nassarawa','Taraba','Sokoto','Kebbi','Zamfara','Katsina','Jigawa','Bayelsa','Ebonyi']

export default function Account({user, supabase, onUpdateUser, onSignOut, initialTab='profile', onTabChange}){
  const [tab,setTab]=useState(initialTab)

  useEffect(()=>{ setTab(initialTab) },[initialTab])
  const [name,setName]=useState(user.name||'')
  const [bio,setBio]=useState(user.bio||'')
  const [state,setState]=useState(user.state||'')
  const [lga,setLga]=useState(user.lga||'')
  const [phone,setPhone]=useState(user.phone||'')
  const [saving,setSaving]=useState(false)
  const [msg,setMsg]=useState(null)
  const [msgType,setMsgType]=useState('success')

  // Password change
  const [curPwd,setCurPwd]=useState('')
  const [newPwd,setNewPwd]=useState('')
  const [confPwd,setConfPwd]=useState('')
  const [pwdSaving,setPwdSaving]=useState(false)

  // Notifications
  const [notifSecurity,setNotifSecurity]=useState(user.notify_security!==false)
  const [notifElection,setNotifElection]=useState(user.notify_election!==false)
  const [notifEconomy,setNotifEconomy]=useState(user.notify_economy||false)
  const [radius,setRadius]=useState(user.notification_radius||50)
  const [notifSaving,setNotifSaving]=useState(false)

  // Notifications list
  const [notifications,setNotifications]=useState([])
  const [notifsLoading,setNotifsLoading]=useState(false)

  const toast=(m,type='success')=>{setMsg(m);setMsgType(type);setTimeout(()=>setMsg(null),3500)}

  useEffect(()=>{
    if(tab==='notifications') loadNotifications()
  },[tab])

  const loadNotifications=async()=>{
    if(!supabase||user.id==='guest') return
    setNotifsLoading(true)
    try {
      const {data}=await supabase.from('notifications').select('*').eq('user_id',user.id).order('created_at',{ascending:false}).limit(50)
      setNotifications(data||[])
      // Mark all read
      await supabase.from('notifications').update({is_read:true}).eq('user_id',user.id).eq('is_read',false)
    } catch{}
    setNotifsLoading(false)
  }

  const saveProfile=async()=>{
    setSaving(true)
    try {
      const updates={name,bio,state,lga,phone,updated_at:new Date().toISOString()}
      if(supabase&&user.id!=='guest'){
        const {error}=await supabase.from('profiles').update(updates).eq('id',user.id)
        if(error) throw error
      }
      const updated={...user,...updates}
      localStorage.setItem('orion_user',JSON.stringify(updated))
      onUpdateUser(updated)
      toast('Profile saved ✓')
    } catch(e){toast('Save failed: '+e.message,'error')}
    setSaving(false)
  }

  const changePassword=async()=>{
    if(!supabase||user.id==='guest'){toast('Sign in to change password','error');return}
    if(newPwd!==confPwd){toast('Passwords do not match','error');return}
    if(newPwd.length<8){toast('Password must be at least 8 characters','error');return}
    setPwdSaving(true)
    try {
      const {error}=await supabase.auth.updateUser({password:newPwd})
      if(error) throw error
      toast('Password changed ✓')
      setCurPwd('');setNewPwd('');setConfPwd('')
    } catch(e){toast(e.message,'error')}
    setPwdSaving(false)
  }

  const saveNotifPrefs=async()=>{
    setNotifSaving(true)
    try {
      const updates={notify_security:notifSecurity,notify_election:notifElection,notify_economy:notifEconomy,notification_radius:radius}
      if(supabase&&user.id!=='guest') await supabase.from('profiles').update(updates).eq('id',user.id)
      const updated={...user,...updates}
      localStorage.setItem('orion_user',JSON.stringify(updated))
      onUpdateUser(updated)
      toast('Preferences saved ✓')
    } catch{}
    setNotifSaving(false)
  }

  const isGuest=user.id==='guest'
  const credScore=user.credibility_score||0
  const credColor=credScore>70?SUCCESS:credScore>40?WARNING:MUTED
  const reportsCount=user.reports_count||0
  const contentCount=user.content_count||0

  const tabs=[
    {id:'profile',label:'Profile',emoji:'👤'},
    {id:'security',label:'Security',emoji:'🔒'},
    {id:'notifications',label:'Alerts',emoji:'🔔'},
    {id:'stats',label:'Stats',emoji:'📊'},
  ]

  return (
    <div style={{paddingBottom:8}}>
      <style>{`select{background:${BGL};color:${WHITE};border:none;outline:none;font-family:inherit;font-size:13px;width:100%}`}</style>

      {/* Header */}
      <Surface style={{padding:'20px',marginBottom:14,textAlign:'center'}}>
        <div style={{width:72,height:72,borderRadius:'50%',background:`radial-gradient(circle at 35% 35%,${BGL},${BG})`,boxShadow:`${N.raised},0 0 20px ${CYAN}33`,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 12px',fontSize:30}}>
          {user.avatar_emoji||'👤'}
        </div>
        <div style={{fontSize:18,fontWeight:800,color:WHITE}}>{user.name||'Anonymous'}</div>
        <div style={{fontSize:12,color:MUTED,marginTop:2}}>{user.email||'Guest user'}</div>
        {!isGuest&&<div style={{display:'flex',gap:12,justifyContent:'center',marginTop:12}}>
          <div style={{textAlign:'center'}}>
            <div style={{fontSize:16,fontWeight:800,color:credColor}}>{credScore}</div>
            <div style={{fontSize:10,color:MUTED}}>Credibility</div>
          </div>
          <div style={{textAlign:'center'}}>
            <div style={{fontSize:16,fontWeight:800,color:CYAN}}>{reportsCount}</div>
            <div style={{fontSize:10,color:MUTED}}>Reports</div>
          </div>
          <div style={{textAlign:'center'}}>
            <div style={{fontSize:16,fontWeight:800,color:BLUE}}>{contentCount}</div>
            <div style={{fontSize:10,color:MUTED}}>Posts</div>
          </div>
        </div>}
        {isGuest&&<div style={{marginTop:10,fontSize:12,color:WARNING}}>⚠️ Guest mode — sign up to save your data</div>}
      </Surface>

      {/* Tab bar */}
      <div style={{display:'flex',gap:6,marginBottom:14,overflowX:'auto',paddingBottom:2}}>
        {tabs.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{flex:'0 0 auto',padding:'8px 14px',borderRadius:12,border:'none',background:tab===t.id?`linear-gradient(135deg,${BLUE},#2563EB)`:`linear-gradient(145deg,${BGL},${BG})`,color:tab===t.id?WHITE:MUTED,fontSize:12,fontWeight:700,cursor:'pointer',boxShadow:N.raisedSm,whiteSpace:'nowrap'}}>
            {t.emoji} {t.label}
          </button>
        ))}
      </div>

      {/* Toast */}
      {msg&&<div style={{padding:'10px 14px',borderRadius:12,marginBottom:12,background:msgType==='error'?`linear-gradient(135deg,${DANGER}22,${BGL})`:`linear-gradient(135deg,${SUCCESS}22,${BGL})`,border:`1px solid ${msgType==='error'?DANGER:SUCCESS}44`,color:msgType==='error'?DANGER:SUCCESS,fontSize:13,fontWeight:600}}>{msg}</div>}

      {/* Profile Tab */}
      {tab==='profile'&&(
        <div>
          <div style={{display:'flex',gap:8,marginBottom:16}}>
            {['😊','👤','🦁','🔥','⚡','🇳🇬','🎯','🛡️'].map(e=>(
              <button key={e} onClick={()=>{if(!isGuest){const u={...user,avatar_emoji:e};localStorage.setItem('orion_user',JSON.stringify(u));onUpdateUser(u)}}} style={{width:40,height:40,borderRadius:10,border:user.avatar_emoji===e?`2px solid ${CYAN}`:'none',background:`linear-gradient(145deg,${BGL},${BG})`,boxShadow:N.raisedSm,cursor:'pointer',fontSize:20}}>{e}</button>
            ))}
          </div>
          <Field label="Full Name" value={name} onChange={setName} placeholder="Your name" disabled={isGuest}/>
          <Field label="Bio" value={bio} onChange={setBio} placeholder="Tell the community about yourself..." multiline disabled={isGuest}/>
          <div style={{marginBottom:14}}>
            <div style={{fontSize:11,color:MUTED,fontWeight:600,letterSpacing:'0.06em',textTransform:'uppercase',marginBottom:6}}>State</div>
            <Surface inset style={{padding:'10px 14px',borderRadius:12}}>
              <select value={state} onChange={e=>setState(e.target.value)} disabled={isGuest}>
                <option value="">Select your state</option>
                {NG_STATES.map(s=><option key={s} value={s.toLowerCase()}>{s}</option>)}
              </select>
            </Surface>
          </div>
          <Field label="LGA" value={lga} onChange={setLga} placeholder="e.g. Ikeja, Eti-Osa" disabled={isGuest}/>
          <Field label="Phone (optional)" value={phone} onChange={setPhone} placeholder="+234..." type="tel" disabled={isGuest}/>
          <Field label="Email" value={user.email||''} onChange={()=>{}} disabled/>
          <Btn variant="primary" full onClick={saveProfile} disabled={saving||isGuest} style={{marginTop:4}}>{saving?'Saving...':'Save Profile'}</Btn>
          {isGuest&&<div style={{marginTop:10,textAlign:'center',fontSize:12,color:MUTED}}>Create an account to save your profile</div>}
          <div style={{marginTop:20,paddingTop:16,borderTop:`1px solid ${SL}`}}>
            <Btn variant="danger" full onClick={onSignOut}>Sign Out</Btn>
          </div>
        </div>
      )}

      {/* Security Tab */}
      {tab==='security'&&(
        <div>
          <Surface inset style={{padding:'12px 14px',borderRadius:12,marginBottom:16}}>
            <div style={{fontSize:12,color:MUTED,lineHeight:1.6}}>🔒 Change your account password. You must be signed in with email/password (not social login).</div>
          </Surface>
          {isGuest
            ? <div style={{textAlign:'center',padding:20,color:MUTED,fontSize:13}}>Create an account to manage security settings</div>
            : <>
                <Field label="New Password" value={newPwd} onChange={setNewPwd} type="password" placeholder="Minimum 8 characters"/>
                <Field label="Confirm New Password" value={confPwd} onChange={setConfPwd} type="password" placeholder="Repeat new password"/>
                <Btn variant="primary" full onClick={changePassword} disabled={pwdSaving||!newPwd||!confPwd}>{pwdSaving?'Changing...':'Change Password'}</Btn>
              </>
          }
          <div style={{marginTop:20}}>
            <Surface style={{padding:'14px 16px',marginBottom:10}}>
              <div style={{fontSize:13,fontWeight:700,color:WHITE,marginBottom:4}}>Account Status</div>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:12,color:MUTED,marginBottom:4}}><span>Account type</span><span style={{color:WHITE}}>{isGuest?'Guest':'Registered'}</span></div>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:12,color:MUTED,marginBottom:4}}><span>Member since</span><span style={{color:WHITE}}>{user.created_at?new Date(user.created_at).toLocaleDateString('en-NG',{year:'numeric',month:'long'}):'—'}</span></div>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:12,color:MUTED}}><span>Credibility score</span><span style={{color:credColor,fontWeight:700}}>{credScore}/100</span></div>
            </Surface>
          </div>
        </div>
      )}

      {/* Notifications Tab */}
      {tab==='notifications'&&(
        <div>
          <Surface style={{padding:'16px',marginBottom:12}}>
            <div style={{fontSize:13,fontWeight:700,color:WHITE,marginBottom:12}}>Alert Preferences</div>
            {[
              {key:'security',label:'🚨 Security incidents',sub:'Kidnappings, attacks, clashes near you',val:notifSecurity,set:setNotifSecurity},
              {key:'election',label:'🗳️ Election updates',sub:'Results, INEC announcements',val:notifElection,set:setNotifElection},
              {key:'economy',label:'📈 Economy alerts',sub:'Naira rate, fuel prices, FAAC releases',val:notifEconomy,set:setNotifEconomy},
            ].map(item=>(
              <div key={item.key} style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
                <div><div style={{fontSize:13,color:WHITE,fontWeight:600}}>{item.label}</div><div style={{fontSize:11,color:MUTED,marginTop:2}}>{item.sub}</div></div>
                <button onClick={()=>item.set(v=>!v)} style={{width:44,height:24,borderRadius:12,border:'none',cursor:'pointer',background:item.val?`linear-gradient(135deg,${SUCCESS},#059669)`:`linear-gradient(145deg,${BGL},${BG})`,boxShadow:N.raisedSm,position:'relative',transition:'all 0.2s'}}>
                  <div style={{width:18,height:18,borderRadius:'50%',background:WHITE,position:'absolute',top:3,transition:'all 0.2s',left:item.val?22:4,boxShadow:'0 1px 3px rgba(0,0,0,0.3)'}}/>
                </button>
              </div>
            ))}
            <div style={{marginBottom:14}}>
              <div style={{fontSize:13,color:WHITE,fontWeight:600,marginBottom:6}}>📍 Alert radius: {radius}km</div>
              <input type="range" min={10} max={200} step={10} value={radius} onChange={e=>setRadius(+e.target.value)} style={{width:'100%',accentColor:CYAN}}/>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:10,color:MUTED,marginTop:4}}><span>10km</span><span>200km</span></div>
            </div>
            <Btn variant="primary" full onClick={saveNotifPrefs} disabled={notifSaving||isGuest}>{notifSaving?'Saving...':'Save Preferences'}</Btn>
          </Surface>

          {/* Notification inbox */}
          <div style={{fontSize:13,fontWeight:700,color:WHITE,marginBottom:10}}>Recent Notifications</div>
          {notifsLoading&&<div style={{textAlign:'center',padding:20,color:MUTED}}>Loading...</div>}
          {!notifsLoading&&notifications.length===0&&<Surface inset style={{padding:20,textAlign:'center'}}><div style={{fontSize:24,marginBottom:8}}>🔔</div><div style={{fontSize:12,color:MUTED}}>No notifications yet</div></Surface>}
          {notifications.map(n=>(
            <Surface key={n.id} style={{padding:'12px 14px',marginBottom:8,opacity:n.is_read?0.7:1,borderLeft:n.is_read?'none':`3px solid ${CYAN}`}}>
              <div style={{fontSize:13,fontWeight:600,color:WHITE,marginBottom:4}}>{n.title}</div>
              <div style={{fontSize:12,color:MUTED}}>{n.body}</div>
              <div style={{fontSize:10,color:MUTED,marginTop:4}}>{new Date(n.created_at).toLocaleString('en-NG')}</div>
            </Surface>
          ))}
        </div>
      )}

      {/* Stats Tab */}
      {tab==='stats'&&(
        <div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:14}}>
            {[
              {label:'Credibility Score',value:credScore,unit:'/100',color:credColor,emoji:'⭐'},
              {label:'Reports Filed',value:reportsCount,unit:'',color:CYAN,emoji:'📋'},
              {label:'Content Posted',value:contentCount,unit:'',color:BLUE,emoji:'✍️'},
              {label:'Alert Radius',value:radius,unit:'km',color:WARNING,emoji:'📍'},
            ].map(s=>(
              <Surface key={s.label} style={{padding:'16px',textAlign:'center'}}>
                <div style={{fontSize:28,marginBottom:4}}>{s.emoji}</div>
                <div style={{fontSize:22,fontWeight:900,color:s.color,fontFamily:"'SF Mono',monospace"}}>{s.value}<span style={{fontSize:13,color:MUTED}}>{s.unit}</span></div>
                <div style={{fontSize:11,color:MUTED,marginTop:4}}>{s.label}</div>
              </Surface>
            ))}
          </div>
          <Surface inset style={{padding:'14px 16px',borderRadius:14}}>
            <div style={{fontSize:12,color:MUTED,lineHeight:1.7}}>
              <div style={{fontWeight:700,color:WHITE,marginBottom:8}}>How credibility is earned:</div>
              {['✅ Verified report: +10 pts','👥 3+ confirmations on your report: +5 pts','✍️ Featured content: +15 pts','🗳️ Verified election result: +20 pts','❌ Flagged false report: -20 pts'].map(r=><div key={r} style={{marginBottom:4}}>{r}</div>)}
            </div>
          </Surface>
        </div>
      )}
    </div>
  )
}
