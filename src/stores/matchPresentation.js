import { matching_context } from './autoMatching.js'
import { match_candidates } from './localMatching.js'
import { MATCH_UNIVERSITIES, MATCH_MAJORS, MATCH_MBTI, MATCH_RELIGION, MATCH_DRINKING } from './matchingCatalog.js'
import { match_route } from './matchState.js'
import * as s from './selectors.js'
const token=name=>`var(--cimoa-${name})`
const chip=(value,label,selected,key)=>({value,label,key,bg:token(selected?'gradient-primary':'surface-card'),ink:token(selected?'text-inverse':'text-title'),border:`1px solid ${token(selected?'surface-transparent':'surface-border')}`})
const pct=(value,min,max)=>Math.max(0,Math.min(100,(value-min)/(max-min)*100))
const timer=ms=>{const seconds=Math.max(0,Math.ceil(ms/1000));return `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`}
export function match_presentation(data,id,now,hydration,draft=null,query='') {
  const context=matching_context(data,id,now,hydration)
  if(context.error)return {...context,access_error:context.error,history_rows:[]}
  const me=s.user_by_id(data,s.owner_id(data)),m=context.match,p=draft||context.preferences,candidate=context.candidate,pool=match_candidates(data,now,id),quota=data.match_quota.find(q=>q.owner_user_id===me.user_id&&q.date_key===s.utc_date_key(now)),free=Math.max(0,data.quota_policy.free_daily_limit-(quota?.used_count||0)),balance=s.balance(data),priority=!!m&&m.priority_until>now
  const shared=candidate?data.interests.filter(i=>me.interest_ids.includes(i.item_id)&&candidate.interest_ids.includes(i.item_id)):[]
  const shared_chips=shared.map((i,index)=>({...i,bg:token(['surface-settings-blue','surface-settings-purple','surface-event-people'][index%3]),ink:token(['text-settings-blue','text-settings-purple','text-event-people'][index%3])}))
  const person_name=candidate?.user_name||'',snapshot=m?.preference_snapshot||p
  return {...context,access_error:!s.social_eligible(data)?'Complete account verification and profile setup before joining Auto Match.':s.privacy_for(data,me.user_id).auto_match_visible===false?'Enable Auto Match visibility in Privacy before joining the pool.':'',
    me,person_name,me_img:me.avatar_url,am_img:candidate?data.profile_photos.find(photo=>photo.photo_id===candidate.photo_ids[0])?.media_url||candidate.avatar_url:'',candidate_avatar:candidate?.avatar_url||'',search_avatar:candidate?.avatar_url||pool[0]?.avatar_url||'',
    am_name:candidate?`${person_name}, ${candidate.age}`:'',am_uni:candidate?.university||'',am_major:candidate?.major||'',am_mbti:candidate?.mbti||'',am_bio:candidate?.bio||'',candidate_verified:candidate?.verification_status==='verified',
    join_pool_label:context.active?'Open Active Match':'Join the Pool',join_pool_tag:context.active?'Resume':free?`Free · ${free}/3 left`:'10 coins',
    am_cost_note:free?`You get 3 free matches every day — ${free} left today. After that, each match costs 10 coins.`:'You’ve used today’s 3 free matches. Each match now costs 10 coins; free matches reset tomorrow.',
    entry_wait:'About 9 seconds',available_now:`${pool.length} ${pool.length===1?'student':'students'}`,balance_text:`${balance} coins`,boost_cost:'20 coins',boost_after:`${Math.max(0,balance-20)} coins`,
    insufficient_feature:'Priority Match',insufficient_missing:`${Math.max(0,20-balance)} coins missing`,insufficient_required:'20 coins',free_alt_label:'Continue Standard Match',
    queue_pos:m?.queue_position??'—',wait_text:m?.estimated_wait_seconds==null?'Wait time unavailable':`About ${m.estimated_wait_seconds<60?`${Math.ceil(m.estimated_wait_seconds)} sec`:`${Math.ceil(m.estimated_wait_seconds/60)} min`}`,
    priority_on:priority,priority_off:!priority,priority_timer:`Priority active · ${timer((m?.priority_until||0)-now)}`,found_timer:timer((m?.expires_at||now)-now),
    pref_summary:`${snapshot.age_min}–${snapshot.age_max} · ${snapshot.university} · ${snapshot.interest_ids.length} interests`,goal_label:data.goals.find(g=>g.item_id===snapshot.goal_id)?.label||'All goals',university_label:snapshot.university,interest_label:snapshot.interest_ids.length?'Shared interests':'All interests',
    shared_chips,shared_title:shared.length?'You have a lot in common':'Meet someone new',shared_copy:shared.length?`You both enjoy ${new Intl.ListFormat('en',{style:'long',type:'conjunction'}).format(shared.map(i=>i.label.toLowerCase()))}.`:'Explore their profile to learn more.',
    waiting_title:`Waiting for ${person_name}`,waiting_copy:`We’ll let you know when ${person_name} responds. You can leave this screen — your request stays active.`,connected_copy:`You and ${person_name} can now start a conversation.`,connect_title:`Connect with ${person_name}?`,connect_copy:`If ${person_name} also accepts, you’ll be able to message and video call each other.`,leave_copy:`You won’t connect with ${person_name} this time. This can’t be undone.`,
    age_label:`${p.age_min}–${p.age_max}`,age_min_pct:pct(p.age_min,18,35),age_max_pct:pct(p.age_max,18,35),age_max_pct_inv:100-pct(p.age_max,18,35),height_label:`${p.height_min}–${p.height_max} cm`,height_min_pct:pct(p.height_min,140,200),height_max_pct:pct(p.height_max,140,200),height_max_pct_inv:100-pct(p.height_max,140,200),distance_label:p.distance_max>=100?'100+ km':`${p.distance_max} km`,distance_pct:p.distance_max,distance_pct_inv:100-p.distance_max,
    pref_university:p.university,interest_count2:p.interest_ids.length,uni_search:query,selected_interest_chips:data.interests.filter(i=>p.interest_ids.includes(i.item_id)),
    major_chips:MATCH_MAJORS.map(([v,e])=>chip(v,`${e?e+' ':''}${v}`,p.major===v,'major')),mbti_chips:MATCH_MBTI.map(v=>chip(v,v,p.mbti===v,'mbti')),religion_chips:MATCH_RELIGION.map(v=>chip(v,v,p.religion===v,'religion')),drink_chips:MATCH_DRINKING.map(v=>chip(v,v,p.drinking===v,'drinking')),
    uni_chips:MATCH_UNIVERSITIES.filter(v=>v.toLowerCase().includes(query.trim().toLowerCase())).map(v=>chip(v,v,p.university===v,'university')),interest_picker_chips:data.interests.map(i=>({...i,...chip(i.item_id,i.label,p.interest_ids.includes(i.item_id),'interest_ids')})),
    history_rows:context.history.sort((a,b)=>b.created_at-a.created_at||a.match_id.localeCompare(b.match_id)).map(row=>{const person=row.candidate_id?s.user_by_id(data,row.candidate_id):null;return {match_id:row.match_id,img:person?.avatar_url||'',no_img:!person?.avatar_url,name:person?.user_name||'Auto Match',meta:`${new Date(row.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric'})}${person?' · '+person.university:''}`,pill:token(row.status==='connected'?'status-connected-bg':'surface-connection-waiting'),pill_ink:token(row.status==='connected'?'status-connected-ink':'text-connection-status'),pill_text:{searching:'Searching',paused:'Paused',found:'Decision pending',waiting:'Pending',connected:'Connected',passed:'Skipped',expired:'Expired',no_match:'No match',left:'Left'}[row.status],route:match_route(row)}}),
  }
}
