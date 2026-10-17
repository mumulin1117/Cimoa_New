import { clone_data } from './seed.js'
import * as s from './selectors.js'
import { choose_match_candidate } from './localMatching.js'
import { matching_distance } from './matchingCatalog.js'
import { connection_for } from './connectionEntities.js'
import { apply_priority, match_route } from './matchState.js'
import { get_runtime, transact, operation, make_id, failure, unavailable, require_student, require_target, add_transaction, connect_users } from './transactions.js'
const own_match = (data,id) => { const row=data.match_sessions.find(m=>m.match_id===id&&m.owner_user_id===s.owner_id(data));s.ensure(row,'This match session is unavailable.');return row }
const allowed = { searching:['paused','left'], paused:['searching','left'], found:['waiting','passed','left'], waiting:['left'] }
const require_pool = data => { require_student(data);s.ensure(s.privacy_for(data,s.owner_id(data)).auto_match_visible!==false,'Enable Auto Match visibility in Privacy before joining the pool.') }
const require_distance = data => {const prefs=data.match_preferences.find(p=>p.owner_user_id===s.owner_id(data)),me=data.users.find(u=>u.user_id===s.owner_id(data));s.ensure(prefs&&(prefs.distance_max>=100||data.users.some(u=>u.user_id!==me.user_id&&matching_distance(data,me,u)!==null)),'Distance information is unavailable. Set Distance to 100+ km to continue.')}
const admission = (data,row) => {
  const root=data.match_sessions.find(m=>m.match_id===(row.pool_id||row.match_id)&&m.owner_user_id===row.owner_user_id)
  s.ensure(root,'This pool admission is unavailable.');return root
}
const close_pool = (data,row,now) => { admission(data,row).pool_closed_at=now }
const set_candidate = (data,row,now) => {
  row.preference_snapshot=clone_data(data.match_preferences.find(p=>p.owner_user_id===row.owner_user_id))
  const previous=data.match_sessions.filter(m=>m.match_id!==row.match_id&&(m.pool_id||m.match_id)===(row.pool_id||row.match_id)).map(m=>m.candidate_id).filter(Boolean)
  row.candidate_id=choose_match_candidate(data,now,row.match_id,previous)?.user_id||null
  row.expires_at=row.candidate_id&&row.status!=='paused'?row.search_ready_at+45000:null
}
export const auto_match_actions = {
  start_match(operation_id) {
    const available=get_runtime(this).services.matching_available
    if(available===false)return unavailable('Auto Match service')
    return transact(this,operation(operation_id,'match',[]),(data,now)=>{
      require_pool(data);s.ensure(!s.active_match(data,now),'A match session is already active.')
      require_distance(data)
      const match_id=make_id('match'),date_key=s.utc_date_key(now),owner=s.owner_id(data)
      let quota=data.match_quota.find(q=>q.owner_user_id===owner&&q.date_key===date_key)
      if(!quota){quota={owner_user_id:owner,date_key,used_count:0};data.match_quota.push(quota)}
      const admission_cost=quota.used_count<data.quota_policy.free_daily_limit?0:data.quota_policy.standard_cost
      if(admission_cost===0)quota.used_count++
      else add_transaction(data,-data.quota_policy.standard_cost,`match:${match_id}`,'spend',match_id,now)
      // A deliberate new admission supersedes terminal retry chains, never their history or receipts.
      for(const previous of data.match_sessions.filter(m=>m.owner_user_id===owner&&(m.pool_id||m.match_id)===m.match_id&&m.pool_closed_at==null))previous.pool_closed_at=now
      const row={match_id,pool_id:match_id,admission_cost,admission_date_key:date_key,pool_closed_at:null,owner_user_id:owner,candidate_id:null,status:'searching',created_at:now,started_at:now,paused_at:null,expires_at:null,priority_until:null,self_accepted:false,peer_accepted:false,queue_position:null,estimated_wait_seconds:available===undefined?9:null,fixture:false,search_revision:0,...(available===undefined?{engine:'device',search_ready_at:now+9000}: {})}
      if(row.engine==='device')set_candidate(data,row,now)
      data.match_sessions.push(row);return match_id
    })
  },
  retry_match(id,operation_id) {
    const available=get_runtime(this).services.matching_available
    if(available===false)return unavailable('Auto Match service')
    return transact(this,operation(operation_id,'match-retry',id),(data,now)=>{
      require_pool(data);require_distance(data)
      const previous=own_match(data,id),root=admission(data,previous),status=s.match_status(previous,now)
      s.ensure(root.pool_closed_at==null,'This pool admission has ended. Join the pool again to start a new search.')
      if(previous.next_match_id){const next=own_match(data,previous.next_match_id);s.ensure((next.pool_id||next.match_id)===root.match_id,'This retry is unavailable.');return next.match_id}
      s.ensure(['passed','expired','no_match'].includes(status),'This match is not ready for another search.')
      s.ensure(!s.active_match(data,now),'A match session is already active.')
      previous.status=status;previous.resolved_at??=now
      const match_id=make_id('match'),priority_until=root.priority_until>now?root.priority_until:null,duration=priority_until?5000:9000
      const row={match_id,pool_id:root.match_id,retry_of_match_id:id,owner_user_id:root.owner_user_id,candidate_id:null,status:'searching',created_at:now,started_at:now,paused_at:null,expires_at:null,priority_until,self_accepted:false,peer_accepted:false,queue_position:null,estimated_wait_seconds:available===undefined?duration/1000:null,fixture:false,search_revision:0,...(available===undefined?{engine:'device',search_ready_at:now+duration,...(priority_until?{standard_search_ready_at:now+9000}: {})}: {})}
      if(row.engine==='device')set_candidate(data,row,now)
      previous.next_match_id=match_id;data.match_sessions.push(row);return match_id
    })
  },
  transition_match(id,status) {
    return transact(this,null,(data,now)=>{
      const row=own_match(data,id),current=s.match_status(row,now)
      s.ensure(allowed[current]?.includes(status),'This match action is no longer available.')
      if(status==='searching'){require_pool(data);require_distance(data)}
      if(row.engine==='device'&&status==='paused'){row.search_remaining_ms=Math.max(0,row.search_ready_at-now);if(row.standard_search_ready_at!=null)row.standard_search_remaining_ms=Math.max(0,row.standard_search_ready_at-now)}
      if(row.engine==='device'&&current==='paused'&&status==='searching'){
        const remaining=(row.priority_until<=now?row.standard_search_remaining_ms:null)??row.search_remaining_ms??Math.max(0,row.search_ready_at-row.paused_at)
        s.ensure(Number.isFinite(remaining),'The saved search time is unavailable. Leave this session and start again.')
        row.search_ready_at=now+remaining;set_candidate(data,row,now)
        if(row.standard_search_remaining_ms!=null)row.standard_search_ready_at=now+row.standard_search_remaining_ms
      }
      if(status==='waiting'){
        require_pool(data);require_target(data,row.candidate_id)
        s.ensure(s.match_visible(data,row.candidate_id)&&s.social_eligible(data,row.candidate_id)&&!s.connected(data,row.candidate_id),'This person is no longer available for a new match.')
        s.ensure(!data.requests.some(r=>r.status==='pending'&&[r.sender_id,r.recipient_id].includes(s.owner_id(data))&&[r.sender_id,r.recipient_id].includes(row.candidate_id)),'An introduction is already pending.');row.self_accepted=true
      }
      row.status=status;row.paused_at=status==='paused'?now:null;row.search_revision=(row.search_revision||0)+1
      if(row.engine==='device'&&status==='searching')row.expires_at=row.candidate_id?row.search_ready_at+45000:null
      if(['left','passed'].includes(status))row.resolved_at=now
      if(status==='left')close_pool(data,row,now)
      return id
    })
  },
  respond_to_match(id,decision) {
    return transact(this,null,(data,now)=>{
      const row=data.match_sessions.find(m=>m.match_id===id&&m.candidate_id===s.owner_id(data))
      s.ensure(row&&s.match_status(row,now)==='waiting'&&row.self_accepted&&['accepted','declined'].includes(decision),'This match invitation is no longer available.')
      require_target(data,row.owner_user_id)
      s.ensure(decision!=='accepted'||s.social_eligible(data)&&s.social_eligible(data,row.owner_user_id)&&s.match_visible(data,row.owner_user_id)&&s.privacy_for(data,s.owner_id(data)).auto_match_visible!==false,'Both profiles must be available for a new connection.')
      row.status=decision==='accepted'?'connected':'passed';row.peer_accepted=decision==='accepted';row.resolved_at=now
      if(decision==='accepted')close_pool(data,row,now)
      return decision==='accepted'?connect_users(data,row.owner_user_id,now,{match_id:id}):id
    })
  },
  async apply_match_event(event,{is_current=()=>true}={}) {
    const owner=s.owner_id(this.data)
    let valid=false;try{valid=!!await get_runtime(this).services.verify_match_event?.(event)}catch{/* Fail closed. */}
    if(!valid)return unavailable('Verified matching events')
    if(!is_current())return failure('cancelled','The matching update was cancelled.')
    return transact(this,operation(event.event_id,'match-event',event),(data,now)=>{
      const row=own_match(data,event.match_id),status=s.match_status(row,now)
      if(event.search_revision!=null)s.ensure(event.search_revision===(row.search_revision||0),'This matching update is out of date.')
      if(event.sequence!=null){s.ensure(Number.isInteger(event.sequence)&&event.sequence>(row.last_event_sequence??-1),'This matching update is out of order.');row.last_event_sequence=event.sequence}
      if(event.type==='queue'){
        s.ensure(status==='searching'&&Number.isInteger(event.queue_position)&&event.queue_position>0&&(event.estimated_wait_seconds==null||Number.isFinite(event.estimated_wait_seconds)&&event.estimated_wait_seconds>=0),'Invalid queue update.')
        row.queue_position=event.queue_position;row.estimated_wait_seconds=event.estimated_wait_seconds??null
      }else if(event.type==='found'){
        s.ensure(status==='searching'&&s.match_visible(data,event.user_id)&&s.social_eligible(data,event.user_id)&&!s.connected(data,event.user_id),'This person is unavailable for Auto Match.');require_target(data,event.user_id)
        row.candidate_id=event.user_id;row.status='found';row.expires_at=now+45000
      }else if(event.type==='accepted'){
        s.ensure(status==='waiting'&&row.self_accepted&&row.candidate_id===event.user_id,'This match invitation is no longer available.')
        require_pool(data);require_target(data,event.user_id);s.ensure(s.social_eligible(data,event.user_id),'This person is unavailable for a new connection.')
        row.peer_accepted=true;row.status='connected';row.resolved_at=now;close_pool(data,row,now);connect_users(data,event.user_id,now,{match_id:row.match_id})
      }else{s.ensure(event.type==='no_match'&&status==='searching','Invalid queue event.');row.status='no_match';row.resolved_at=now}
      return row.match_id
    },{expected_owner:owner})
  },
  boost_match(id,operation_id) {
    return transact(this,operation(operation_id,'priority',id),(data,now)=>{
      const row=own_match(data,id);require_pool(data)
      s.ensure(['searching','paused'].includes(s.match_status(row,now))&&!(row.priority_until>now),'Priority Match is not available for this session.')
      add_transaction(data,-20,`priority:${operation_id}`,'spend',id,now);apply_priority(row,now);admission(data,row).priority_until=row.priority_until;return id
    })
  },
  update_match_preferences(patch) {
    return transact(this,null,(data,now)=>{
      const row=data.match_preferences.find(p=>p.owner_user_id===s.owner_id(data))
      s.ensure(row&&patch&&Object.keys(patch).every(k=>k!=='owner_user_id'&&k in row),'Invalid matching preference.')
      Object.assign(row,clone_data(patch));validate_match_preferences(data,row)
      for(const match of data.match_sessions.filter(m=>m.owner_user_id===s.owner_id(data)&&m.engine==='device'&&['searching','paused'].includes(s.match_status(m,now)))){set_candidate(data,match,now);match.search_revision=(match.search_revision||0)+1}
    })
  },
}
export function validate_match_preferences(data,p) {
  s.ensure([p.age_min,p.age_max,p.height_min,p.height_max,p.distance_max].every(Number.isFinite)&&Number.isInteger(p.age_min)&&Number.isInteger(p.age_max)&&p.age_min>=18&&p.age_min<=p.age_max&&p.age_max<=100&&p.height_min>=100&&p.height_min<=p.height_max&&p.height_max<=250&&p.distance_max>=0&&p.distance_max<=100,'Check your matching ranges.')
  s.ensure(Array.isArray(p.interest_ids)&&p.interest_ids.length<=5&&new Set(p.interest_ids).size===p.interest_ids.length&&p.interest_ids.every(id=>data.interests.some(i=>i.item_id===id)),'Choose up to five valid interests.')
  for(const key of['university','major','mbti','religion','drinking','gender','language','goal_id'])s.ensure(typeof p[key]==='string'&&p[key].length>0&&p[key].length<100,'Check your matching preferences.')
}
export function matching_context(data,id,now,hydration='ready') {
  const empty=error=>({error,match:null,route:null,active:null,preferences:null,candidate:null,pool:[],history:[]})
  if(hydration!=='ready')return empty('Saved data could not be loaded. Please retry.')
  if(!s.authenticated(data,now))return empty('Your session has expired. Please sign in again.')
  const active=s.active_match(data,now),match=id?s.owned_matches(data,now).find(m=>m.match_id===id):null
  if(id&&!match)return empty('This match session is unavailable.')
  if(match?.status==='connected'){
    const connection=connection_for(data,match.candidate_id,now)
    if(!connection?.conversation_id||connection.source_match_id!==match.match_id)return empty('This connection is no longer available. Return Home to view your current connections.')
  }
  return clone_data({error:'',match,route:match?match_route(match):null,active,preferences:data.match_preferences.find(p=>p.owner_user_id===s.owner_id(data)),candidate:match?.candidate_id?s.user_by_id(data,match.candidate_id):null,history:s.owned_matches(data,now).filter(m=>m.created_at>=now-30*86400000),pool:[]})
}
