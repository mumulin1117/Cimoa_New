import test from 'node:test'
import assert from 'node:assert/strict'
import {createPinia,setActivePinia} from 'pinia'
import {use_app_store,configure_store_runtime} from '../src/stores/store.js'
import {create_seed} from '../src/stores/seed.js'
import {matching_distance} from '../src/stores/matchingCatalog.js'
import {match_candidates} from '../src/stores/localMatching.js'
import {ensure_account_defaults} from '../src/stores/accountDefaults.js'
const epoch=Date.UTC(2026,9,17,12),fixture=(saved,services={})=>{
  setActivePinia(createPinia());const store=use_app_store();let now=epoch,disk=saved||create_seed(epoch)
  configure_store_runtime(store,{clock:()=>now,persistence:{read:()=>disk,write:(_key,data)=>{disk=data}},services});assert.ok(store.hydrate().success)
  return{store,advance:ms=>{now+=ms;store.tick()},saved:()=>JSON.parse(JSON.stringify(disk))}
}
test('canonical state, exact search/found expiry and recovery routes are read-only across hydration',()=>{
  const f=fixture(),id=f.store.start_match('start').data,original=JSON.stringify(f.store.data),deadline=f.store.match_by_id(id).search_ready_at
  assert.equal(f.store.matching_context(id).route,`/pages/auto-match/searching?match_id=${id}`);assert.equal(JSON.stringify(f.store.data),original)
  f.advance(9000);assert.equal(f.store.match_by_id(id).status,'found');assert.equal(f.store.match_by_id(id).expires_at,deadline+45000)
  const restored=fixture(f.saved());restored.advance(54000);assert.equal(restored.store.match_by_id(id).status,'expired');assert.match(restored.store.matching_context(id).route,/expired/)
  assert.equal(restored.store.transition_match(id,'waiting').success,false);assert.equal(restored.store.can_chat(f.store.match_by_id(id).candidate_id),false)
})
test('pause/preferences/reload/resume preserves the same ID and remaining search without quota/debit replay',()=>{
  const f=fixture(),id=f.store.start_match('start').data;f.advance(3210);assert.ok(f.store.transition_match(id,'paused').success)
  assert.ok(f.store.update_match_preferences({interest_ids:[],university:'HKUST'}).success)
  const g=fixture(f.saved());g.advance(200000);assert.equal(g.store.match_by_id(id).status,'paused');assert.ok(g.store.transition_match(id,'searching').success)
  assert.equal(g.store.match_by_id(id).search_ready_at,g.store.clock_ms+5790);g.advance(5789);assert.equal(g.store.match_by_id(id).status,'searching');g.advance(1);assert.equal(g.store.match_by_id(id).status,'found');assert.equal(g.store.free_matches_remaining,2);assert.equal(g.store.coin_balance,260)
})
test('priority has one atomic cost, caps search remaining at five seconds and never extends on pause/reload',()=>{
  const f=fixture(),id=f.store.start_match('start').data;assert.ok(f.store.boost_match(id,'priority').success);assert.equal(f.store.match_by_id(id).search_ready_at,epoch+5000);const end=f.store.match_by_id(id).priority_until
  assert.equal(f.store.boost_match(id,'priority').repeated,true);assert.equal(f.store.coin_balance,240);f.advance(1000);f.store.transition_match(id,'paused');f.advance(3000);f.store.transition_match(id,'searching');assert.equal(f.store.match_by_id(id).priority_until,end);assert.equal(f.store.match_by_id(id).search_ready_at,epoch+8000)
  f.advance(4000);assert.equal(f.store.boost_match(id,'late').success,false);assert.equal(f.store.coin_balance,240)
})
test('waiting is not fake acceptance and does not reuse the old found deadline',()=>{
  const f=fixture(),id=f.store.start_match('start').data;f.advance(9000);assert.ok(f.store.transition_match(id,'waiting').success);f.advance(120000)
  assert.equal(f.store.match_by_id(id).status,'waiting');assert.equal(f.store.can_chat(f.store.match_by_id(id).candidate_id),false)
  assert.equal(f.store.transition_match(id,'connected').success,false);assert.ok(f.store.transition_match(id,'left').success);assert.equal(f.store.active_match,null);assert.equal(f.store.transition_match(id,'searching').success,false)
})
test('priority expiry during a long pause resumes the saved standard time, not a renewed boost',()=>{
  const f=fixture(),id=f.store.start_match('start').data;f.advance(1000);f.store.boost_match(id,'boost');f.advance(1000);f.store.transition_match(id,'paused');assert.equal(f.store.match_by_id(id).standard_search_remaining_ms,7000);f.advance(900001);assert.ok(f.store.transition_match(id,'searching').success);assert.equal(f.store.match_by_id(id).search_ready_at,f.store.clock_ms+7000);assert.equal(f.store.coin_balance,240);assert.equal(f.store.free_matches_remaining,2)
})
test('late/out-of-order events and account changes cannot revive a paused or ended session',async()=>{
  const f=fixture(undefined,{matching_available:true,verify_match_event:async()=>true}),id=f.store.start_match('start').data
  assert.ok((await f.store.apply_match_event({event_id:'q1',type:'queue',match_id:id,queue_position:2,sequence:4,search_revision:0})).success)
  assert.equal((await f.store.apply_match_event({event_id:'q2',type:'queue',match_id:id,queue_position:1,sequence:3,search_revision:0})).success,false)
  f.store.transition_match(id,'paused');assert.equal((await f.store.apply_match_event({event_id:'found-stale',type:'found',match_id:id,user_id:'user_liam',search_revision:0})).success,false)
  f.store.transition_match(id,'left');assert.equal((await f.store.apply_match_event({event_id:'found-left',type:'found',match_id:id,user_id:'user_liam'})).success,false)
})
test('failed persistence rolls back ID/quota/coins/deadline together, and start retries are idempotent',()=>{
  const f=fixture(),before=JSON.stringify(f.store.data);configure_store_runtime(f.store,{persistence:{read:()=>null,write(){throw Error('Storage full')}}});assert.equal(f.store.start_match('failed').success,false);assert.equal(JSON.stringify(f.store.data),before)
  configure_store_runtime(f.store,{persistence:{read:()=>null,write(){}}});const one=f.store.start_match('once');assert.equal(f.store.start_match('once').data,one.data);assert.equal(f.store.free_matches_remaining,2)
})
test('invalid preference shape fails without publishing; unknown campus distance fails explicitly',()=>{
  const f=fixture();for(const p of[{age_min:NaN},{height_max:1},{distance_max:-1},{interest_ids:['missing']},{interest_ids:['coffee','coffee']}]){const before=JSON.stringify(f.store.data);assert.equal(f.store.update_match_preferences(p).success,false);assert.equal(JSON.stringify(f.store.data),before)}
  f.store.data.users.find(u=>u.user_id===f.store.current_user.user_id).university='Unknown campus'
  assert.ok(f.store.update_match_preferences({distance_max:5}).success);const before=JSON.stringify(f.store.data);const result=f.store.start_match('distance');assert.equal(result.success,false);assert.match(result.message,/Distance information/);assert.equal(JSON.stringify(f.store.data),before)
})
test('authorized campus-area distances are persisted, symmetric and genuinely filter candidates',()=>{
  const f=fixture(),me=f.store.current_user,rows=f.store.data.users.filter(u=>u.user_id!==me.user_id)
  assert.ok(f.store.data.match_distances.length>20)
  for(const person of rows){const a=matching_distance(f.store.data,me,person),b=matching_distance(f.store.data,person,me);assert.equal(a,b)}
  assert.ok(f.store.update_match_preferences({distance_max:5}).success)
  assert.ok(match_candidates(f.store.data,epoch).every(u=>matching_distance(f.store.data,me,u)<=5))
  assert.ok(f.store.start_match('nearby').success)
  const g=fixture(f.saved());assert.deepEqual(g.store.data.match_distances,f.store.data.match_distances)
})
test('a connected Boolean without current consent provenance and a Conversation cannot claim a valid result',()=>{
  const f=fixture(),id=f.store.start_match('start').data;f.advance(9000);const row=f.store.data.match_sessions.find(m=>m.match_id===id);row.status='connected';row.self_accepted=true;row.peer_accepted=true
  assert.match(f.store.matching_context(id).error,/connection is no longer available/);assert.equal(f.store.match_presentation(id).candidate, null)
})
test('skip, expiry and no-result retries share admission, exclude prior candidates and never charge again',()=>{
  for(const terminal of ['passed','expired','no_match']){
    const f=fixture(),id=f.store.start_match('admission').data;f.store.boost_match(id,'priority');f.advance(5000)
    const first=f.store.data.match_sessions.find(m=>m.match_id===id),candidate=first.candidate_id
    if(terminal==='passed')assert.ok(f.store.transition_match(id,'passed').success)
    else if(terminal==='expired')f.advance(45000)
    else{first.status='no_match';first.candidate_id=null}
    const before=JSON.stringify({quota:f.store.data.match_quota,ledger:f.store.data.coin_transactions}),deadline=first.priority_until
    const retry=f.store.retry_match(id,'retry');assert.ok(retry.success,retry.message)
    const next=f.store.match_by_id(retry.data);assert.equal(next.pool_id,id);assert.equal(next.retry_of_match_id,id);assert.equal(next.priority_until,deadline);if(terminal!=='no_match')assert.notEqual(next.candidate_id,candidate)
    assert.equal(next.search_ready_at,f.store.clock_ms+5000);assert.equal(f.store.retry_match(id,'another-click').data,next.match_id)
    assert.equal(JSON.stringify({quota:f.store.data.match_quota,ledger:f.store.data.coin_transactions}),before)
    const restored=fixture(f.saved());assert.equal(restored.store.match_by_id(next.match_id).pool_id,id);assert.equal(restored.store.coin_balance,240);assert.equal(restored.store.free_matches_remaining,2)
    assert.ok(restored.store.transition_match(next.match_id,'left').success);assert.equal(restored.store.retry_match(id,'after-leave').success,false)
  }
})
test('paid admission is debited once; retry failure rolls back links and never renews expired priority',()=>{
  const f=fixture();f.store.data.match_quota.push({owner_user_id:'user_cimoa',date_key:new Date(epoch).toISOString().slice(0,10),used_count:3})
  const id=f.store.start_match('paid').data;assert.equal(f.store.coin_balance,250);assert.equal(f.store.match_by_id(id).admission_cost,10)
  f.advance(9000);f.store.transition_match(id,'passed');const before=JSON.stringify(f.store.data)
  configure_store_runtime(f.store,{persistence:{read:()=>null,write(){throw Error('Storage full')}}});assert.equal(f.store.retry_match(id,'failed').success,false);assert.equal(JSON.stringify(f.store.data),before)
  configure_store_runtime(f.store,{persistence:{read:()=>null,write(){}}});f.advance(900001);const next=f.store.retry_match(id,'retry').data;assert.equal(f.store.match_by_id(next).priority_until,null);assert.equal(f.store.match_by_id(next).search_ready_at,f.store.clock_ms+9000);assert.equal(f.store.coin_balance,250);assert.equal(f.store.free_matches_remaining,0)
  assert.equal(f.store.retry_match(next,'active').success,false)
})
test('deleting an earlier candidate cannot corrupt another account admission/retry links',async()=>{
  const f=fixture(),id=f.store.start_match('start').data;f.advance(9000)
  const peer=f.store.match_by_id(id).candidate_id;f.store.transition_match(id,'passed');const next=f.store.retry_match(id,'retry').data
  const account={...f.store.data.accounts[0],account_id:'account_deleted_peer',user_id:peer,email:'peer@cimoa.test'};f.store.data.accounts.push(account);ensure_account_defaults(f.store.data,peer);f.store.data.session={account_id:account.account_id,current_user_id:peer,expires_at:epoch+86400000}
  const result=await f.store.delete_account('12341234');assert.ok(result.success,result.message)
  const root=f.store.data.match_sessions.find(m=>m.match_id===id);assert.equal(root.candidate_id,null);assert.equal(root.next_match_id,next);assert.equal(root.resolution,'account_deleted')
  f.store.data.session={account_id:'account_cimoa',current_user_id:'user_cimoa',expires_at:epoch+86400000};assert.equal(f.store.retry_match(id,'existing').data,next);assert.equal(f.store.hydrate().success,true)
})
