import fs from 'node:fs'
import { read_circa_source, walk_html, attribute } from './circa-source.mjs'
const escape = value => String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;')
export function discover_reference(phase, contract, origin, data, sheet = '') {
  const source=read_circa_source(),user=data.users.find(row=>row.user_id==='user_zane'),questions=user.icebreaker_ids.map(id=>data.icebreakers.find(row=>row.question_id===id)),gradient='linear-gradient(95deg,#1ec8f5 0%,#4a7bf7 34%,#a855f7 64%,#f81ce5 100%)'
  let root;walk_html(source.html,node=>{if(node.tag==='sc-if'&&attribute(node,'value')===`{{ ${contract.source.condition} }}`)root=node})
  const values={qText:questions[0].text,replyText:'',replyCount:'0 / 300',continueBg:'#dfe5ee',continueInk:'#96a1b4',costText:phase==='preview'?'10 coins':'Free',balanceText:'260 coins',answerBtnBg:'#dfe5ee',answerBtnInk:'#96a1b4',modeTextBg:gradient,modeTextInk:'#fff',modeVoiceBg:'#fff',modeVoiceInk:'#0b1b3a',questionList:questions.map(q=>({text:q.text,bg:'#fff',border:'2px solid rgba(16,36,74,0.06)',shadow:'0 8px 22px rgba(16,36,74,0.06)',weight:'600',indBg:'#fff',indBorder:'2px solid #d7dee8',checkColor:'transparent'})),isPhoto0:true,isPhoto1:false,isPhoto2:false,otherPlayingNot:true,otherPlaying:false,profileDots:[{bg:'#fff'},{bg:'rgba(255,255,255,.4)'},{bg:'rgba(255,255,255,.4)'}],playing:false,paused:true,playWidth:'0%',playLabel:'Ready to play',voiceLen:'0:01',qIndex:1,voicePaused:true,voicePlaying:false,waveBars:[]}
  const resources=JSON.parse(fs.readFileSync('docs/circa-source-audit.json')).resources
  const balance=data.coin_transactions.filter(t=>t.owner_user_id===data.session.current_user_id&&t.status==='completed').reduce((n,t)=>n+t.amount,0)
  Object.assign(values,{balanceText:`${balance} coins`,introSheetTitle:'Send voice introduction?',introSheetSub:`Your voice answer will be sent to ${user.user_name}.`,introLabel:'Voice Introduction',introEditLabel:'Edit Recording',voiceCost:'10 coins',voiceAfter:`${Math.max(0,balance-10)} coins`,insufficientFeature:'Voice Introduction',insufficientMissing:`${Math.max(0,10-balance)} coins missing`,insufficientRequired:'10 coins',freeAltLabel:'Not Now'})
  const textByLine={375:`${user.user_name}, ${user.age}`,381:user.university,385:user.major,389:user.mbti,408:`${user.user_name}, ${user.age}`,436:`${user.height_cm} cm`,440:user.university,444:user.major,448:user.mbti,452:user.country.join(', '),456:user.drinking,460:user.smoking,464:user.religion,468:user.clubs,472:user.location,477:user.bio,616:`Say Hi to ${user.user_name}`,623:`${user.user_name}, ${user.age}`,624:`${user.university} · ${user.year}`,651:`Introduction costs 10 coins · balance ${data.coin_transactions.filter(t=>t.owner_user_id==='user_cimoa').reduce((sum,t)=>sum+t.amount,0)} coins`,672:`${user.user_name}, ${user.age}`,707:`${user.user_name} · ${user.age}`,709:user.location,759:`${user.user_name.toUpperCase()}’S QUESTION`}
  const fill=(value,scope)=>value.replace(/{{\s*([\w.]+)\s*}}/g,(_,key)=>escape(key.split('.').reduce((row,k)=>row?.[k],scope)))
  const render=(node,scope=values)=>{
    if(node.type===2)return fill(node.content.replaceAll('CIRCA uses your microphone','Cimoa uses your microphone'),scope)
    if(node.type===5)return fill(node.loc.source,scope)
    if(node.type!==1)return ''
    const children=()=>node.children.map(x=>render(x,scope)).join(''),line=node.loc.start.line
    if(phase==='voice'&&line===725)return '<div style="font-size:20px;font-weight:700;letter-spacing:-0.01em;font-variant-numeric:tabular-nums">00:00</div>'
    if(phase==='voice'&&line===730)return '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#4a7bf7" stroke-width="2" stroke-linecap="round"><rect x="9" y="2.5" width="6" height="11" rx="3"></rect><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3.5"></path></svg>'
    if(phase==='voice'&&line===708&&node.tag==='div'&&node.children.every(c=>c.type!==1)&&node.children.some(c=>c.type===2&&c.content.trim()))return `<div style="font-size:15.5px;color:#5b6b85">${escape(user.university===data.users.find(u=>u.user_id===data.session.current_user_id).university?'Same university':user.university)}</div>`
    if(phase==='profile'&&line===419&&!user.song_id)return ''
    if(phase==='profile'&&line===451&&node.tag==='div')return '<div style="font-size:17px;line-height:1;flex:none">🌏</div>'
    if(node.tag==='sc-if'){const key=attribute(node,'value').replace(/[{}\s]/g,'');return(scope[key]??attribute(node,'hint-placeholder-val').includes('true'))?children():''}
    if(node.tag==='sc-for')return(scope[attribute(node,'list').replace(/[{}\s]/g,'')]||[]).map(row=>node.children.map(x=>render(x,{...scope,[attribute(node,'as')]:row})).join('')).join('')
    const attrs=node.props.filter(p=>p.type===6&&!p.name.startsWith('sc-camel-on-')).map(p=>{
      let value=p.value?.content||''
      for(const a of resources)if(a.local_path)value=value.replaceAll(a.bundle_id,`${origin}/${a.local_path}`)
      if(p.name==='src'&&node.tag==='img'&&[371,416,417,418,621,668,705].includes(line))value=origin+([371,416,417,418].includes(line)?data.profile_photos.find(p=>p.photo_id===user.photo_ids[Math.max(0,line-416)]||p.photo_id===user.photo_ids[0]).media_url:user.avatar_url)
      if(line===371&&p.name==='style')value=value.replace('object-position:50% 22%',`object-position:${data.profile_photos.find(p=>p.photo_id===user.photo_ids[0]).focal_point}`)
      if(line===416&&p.name==='style')value=value.replace('object-position:50% 22%',`object-position:${data.profile_photos.find(p=>p.photo_id===user.photo_ids[0]).focal_point}`)
      if(line===678&&p.name==='placeholder')value=`Write your reply to ${user.user_name}…`
      if(phase==='voice'&&line===743&&p.name==='style')value=value.replaceAll('linear-gradient(95deg,#1ec8f5 0%,#4a7bf7 34%,#a855f7 64%,#f81ce5 100%)','#dfe5ee')
      if(phase==='voice'&&line===743&&p.name==='style')value=value.replace('color:#fff','color:#96a1b4')
      return ` ${p.name.replace('sc-camel-view-box','viewBox')}="${fill(value,scope)}"`
    }).join('')
    return `<${node.tag} data-source-line="${line}"${attrs}>${textByLine[line]!==undefined&&node.children.every(c=>c.type!==1)&&node.children.some(c=>c.type===2&&c.content.trim())?escape(textByLine[line]):children()}${['img','input','br'].includes(node.tag)?'':`</${node.tag}>`}`
  }
  let content=root.children.map(x=>render(x)).join('')
  if(sheet){let panel;walk_html(source.html,node=>{if(node.tag==='sc-if'&&attribute(node,'value')===`{{ ${sheet} }}`)panel=node});if(!panel)throw Error('Unknown source sheet '+sheet);content+=panel.children.map(x=>render(x)).join('')}
  if(phase==='deck'){
    const tabSource=JSON.parse(fs.readFileSync('docs/ui-restoration/home/source-contract.json')).source.tab_component
    const tab=tabSource.replaceAll(/onClick="[^"]*"/g,'').replaceAll(/{{\s*(\w+)\s*}}/g,(_,key)=>key==='discoverBg'? 'linear-gradient(120deg,#1ec8f5 0%,#4a7bf7 38%,#a855f7 68%,#f81ce5 100%)':key==='discoverInk'?'#fff':key.endsWith('Bg')?'transparent':'#0b1b3a')
    content+=`<div style="position:absolute;left:20px;right:20px;bottom:28px;height:62px">${tab}</div>`
  }
  return `<!doctype html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box}html,body{width:100%;height:100%;margin:0;overflow:hidden}body{font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text',sans-serif;color:#0b1b3a;background:linear-gradient(168deg,#e4f4fb 0%,#eaf0fd 44%,#f2ecfb 100%);-webkit-font-smoothing:antialiased}::-webkit-scrollbar{display:none}</style></head><body>${content}</body></html>`
}
