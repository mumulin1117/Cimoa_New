import test from 'node:test'
import assert from 'node:assert/strict'
import { createPinia } from 'pinia'
import { use_app_store, configure_store_runtime } from '../src/stores/store.js'
import { create_scenario } from '../src/stores/scenarios.js'
import { clone_data, HOME_REQUEST_USER_ID } from '../src/stores/seed.js'
import { home_feed, home_cards } from '../src/stores/homeFeed.js'
import { home_destination } from '../src/utils/homeNavigation.js'
const epoch = Date.UTC(2026,9,17,12)
function fixture(scenario = 'default', change = () => {}) {
  let now = epoch, fail = false, writes = 0, saved = create_scenario(scenario, now)
  change(saved)
  const store = use_app_store(createPinia())
  configure_store_runtime(store, { clock: () => now, persistence: { read: () => clone_data(saved), write: (_, next) => { if (fail) throw Error('Storage full'); writes++; saved = clone_data(next) } } })
  assert.equal(store.hydrate().success,true)
  return { store, get writes() { return writes }, fail(value) { fail = value }, tick(value) { now = value; store.tick() }, reload() { store.hydration_status = 'idle'; assert.equal(store.hydrate().success,true) } }
}
const row = (store,id) => store.home_feed.cards.find(card => card.user_id === id)
test('one canonical read projection provides source card order, IDs, goals, statistics and routes without writes', () => {
  const f=fixture(),{store}=f,before=JSON.stringify(store.data),feed=store.home_feed
  assert.deepEqual(feed.cards.map(x=>[x.user.user_name,x.user.university,x.kind]),[['Chloe Lin','HKUST','connected'],['Liam Park','Stanford','auto_match'],['Grace Miller','HKUST','invite']])
  assert.equal(feed.cards[0].connection_id,store.connection_by_user('user_chloe').connection_id)
  assert.equal(feed.cards[0].conversation_id,store.direct_conversation('conversation_chloe').conversation_id)
  assert.deepEqual(feed.cards[2].goals,store.goals_for_user(HOME_REQUEST_USER_ID))
  assert.equal(feed.counts.total,3);assert.equal(feed.counts.connected,1);assert.equal(feed.counts.incoming_requests,1);assert.equal(feed.counts.match_candidates,1)
  assert.equal(feed.counts.unread_messages,store.unread_count)
  assert.strictEqual(store.home_connections,feed.cards);assert.strictEqual(store.home_match_card,feed.match_card)
  for(const card of feed.cards)assert.equal(home_destination(store,'card',card.user_id),card.destination)
  assert.equal(JSON.stringify(store.data),before);assert.equal(f.writes,0)
})
test('backing-array permutations never change latest-candidate selection or card ordering', () => {
  const data=create_scenario('default',epoch)
  data.match_sessions.push({...clone_data(data.match_sessions[0]),match_id:'latest_liam',created_at:epoch+1,expires_at:epoch+45000})
  const expected=home_feed(data,epoch)
  for(const key of ['users','relationships','requests','match_sessions','conversations','messages'])data[key].reverse()
  assert.deepEqual(home_feed(data,epoch),expected)
  assert.equal(expected.cards.find(x=>x.user_id==='user_liam').match_id,'latest_liam')
})
test('request outranks candidate, explicit acceptance outranks requests, and old histories cannot override the current generation', async () => {
  const {store}=fixture()
  assert.equal((await store.send_introduction({user_id:'user_liam',question_id:'user_liam_q_0',text:'A campus coffee walk?',operation_id:'home-intro'})).success,true)
  assert.equal(row(store,'user_liam').kind,'sent');assert.equal(row(store,'user_liam').request_id,store.sent_requests[0].request_id)
  const accepted=store.accept_request('request_lina','home-accept');assert.equal(accepted.success,true)
  assert.equal(row(store,HOME_REQUEST_USER_ID).kind,'connected');assert.equal(row(store,HOME_REQUEST_USER_ID).conversation_id,accepted.data)
  assert.equal(store.home_feed.cards.filter(x=>x.user_id===HOME_REQUEST_USER_ID).length,1);assert.equal(store.home_feed.counts.incoming_requests,0)
})
test('failed decisions leave the exact feed unchanged; successful decisions survive a new hydration', () => {
  const f=fixture(),before=clone_data(f.store.home_feed)
  f.fail(true);assert.equal(f.store.accept_request('request_lina','home-fail').success,false);assert.deepEqual(f.store.home_feed,before);assert.equal(f.writes,0)
  f.fail(false);assert.equal(f.store.decline_request('request_lina','home-decline').success,true);assert.equal(row(f.store,HOME_REQUEST_USER_ID),undefined)
  const after=clone_data(f.store.home_feed);f.reload();assert.deepEqual(f.store.home_feed,after)
})
test('unread/preview and activity follow the real Conversation, and merely reading Home marks nothing read', async () => {
  const f=fixture(),{store}=f,before=JSON.stringify(store.data),chat=store.direct_conversation('conversation_chloe')
  assert.equal(row(store,'user_chloe').unread_count,chat.unread_count);assert.equal(row(store,'user_chloe').preview,chat.preview)
  assert.equal(JSON.stringify(store.data),before)
  assert.equal(store.mark_read('conversation_chloe').success,true);assert.equal(store.home_feed.counts.unread_messages,0)
  f.tick(epoch+1000);assert.equal((await store.send_direct_message('conversation_chloe','Meet near the library.',null,'home-message')).success,true)
  assert.equal(row(store,'user_chloe').preview,'Meet near the library.');assert.equal(row(store,'user_chloe').activity_at,epoch+1000)
  f.reload();assert.equal(row(store,'user_chloe').preview,'Meet near the library.')
})
test('both directions of block filter every Home state; unblocking never resurrects consent or a chat', () => {
  const f=fixture(),{store}=f
  assert.equal(store.block_user('user_chloe').success,true);assert.equal(row(store,'user_chloe'),undefined)
  assert.equal(store.unblock_user('user_chloe').success,true);assert.equal(row(store,'user_chloe'),undefined)
  const other=fixture('default',data=>data.blocked_users.push({block_id:'peer_block',owner_user_id:HOME_REQUEST_USER_ID,user_id:'user_cimoa',created_at:epoch})).store
  assert.equal(row(other,HOME_REQUEST_USER_ID),undefined);assert.equal(other.home_feed.counts.incoming_requests,0)
})
test('a valid Connection without a Conversation stays truthful and never manufactures a chat during navigation', () => {
  const f=fixture('default',data=>{data.conversations=data.conversations.filter(x=>x.conversation_id!=='conversation_chloe');data.messages=data.messages.filter(x=>x.conversation_id!=='conversation_chloe')})
  assert.equal(row(f.store,'user_chloe').kind,'connected');assert.equal(row(f.store,'user_chloe').conversation_id,null)
  assert.throws(()=>home_destination(f.store,'card','user_chloe'),/conversation is unavailable/);assert.equal(f.writes,0)
})
test('candidate-owned incoming match invitations have a unique same-ID received route without consent', () => {
  const {store}=fixture('default',data=>Object.assign(data.match_sessions[0],{owner_user_id:'user_liam',candidate_id:'user_cimoa',status:'waiting',self_accepted:true,peer_accepted:false}))
  assert.equal(row(store,'user_liam').kind,'match_invite');assert.equal(row(store,'user_liam').destination,'/pages/connections/received?match_id=match_liam')
  assert.equal(row(store,'user_liam').connection_id,null);assert.equal(store.home_feed.counts.match_invitations,1)
})
test('active status card and canonical active match use the newest exact session and never an already-connected candidate', () => {
  const {store}=fixture('match_waiting',data=>{
    data.match_sessions.push({...clone_data(data.match_sessions[0]),match_id:'old',status:'paused',candidate_id:null,created_at:epoch-2000})
    data.match_sessions.push({...clone_data(data.match_sessions[0]),match_id:'stale_connected',candidate_id:'user_chloe',created_at:epoch+1})
  })
  assert.equal(store.home_match_card.match_id,'match_liam');assert.equal(store.active_match.match_id,'match_liam')
  assert.equal(home_destination(store,'status'),store.home_match_card.destination)
})
test('deadline expiry and UTC quota rollover are read-only and do not restart timers or rewrite history', () => {
  const f=fixture('match_found'),before=JSON.stringify(f.store.data)
  f.tick(epoch+45001);assert.equal(row(f.store,'user_liam'),undefined);assert.equal(f.store.home_match_card,null)
  assert.equal(JSON.stringify(f.store.data),before);assert.equal(f.writes,0)
  const q=fixture('quota_used');assert.equal(q.store.home_feed.quota.is_paid,true)
  q.tick(Date.UTC(2026,9,18));assert.equal(q.store.home_feed.quota.remaining,3);assert.equal(q.store.home_feed.quota.date_key,'2026-10-18');assert.equal(q.writes,0)
})
test('zero estimate is not dropped and unknown queue metadata never invents a time or rank', () => {
  const f=fixture('match_searching',data=>Object.assign(data.match_sessions[0],{queue_position:2,estimated_wait_seconds:0}))
  assert.equal(f.store.home_match_card.subtitle,'Queue position 2 · under a min')
  const unknown=fixture('match_searching');assert.equal(unknown.store.home_match_card.subtitle,'Waiting for a queue update')
})
test('loading/error/session expiry/logout have zero private cards, quota, statistics or destinations', () => {
  const data=create_scenario('default',epoch)
  for(const status of ['loading','error']){const feed=home_feed(data,epoch,status,'Readable storage failure');assert.equal(feed.status,status);assert.deepEqual(feed.cards,[]);assert.equal(feed.quota,null);assert.deepEqual(feed.destinations,{})}
  const f=fixture();f.tick(epoch+31*86400000);assert.equal(f.store.home_feed.status,'session_expired');assert.deepEqual(f.store.home_connections,[])
  const g=fixture();g.store.logout();assert.equal(g.store.home_feed.owner_user_id,null);assert.equal(g.store.home_feed.counts.total,0)
  assert.equal(home_cards(data,epoch+31*86400000).length,0)
})
test('the projection is detached from persisted profile/goal/message data and reads latest edits', () => {
  const data=create_scenario('default',epoch),feed=home_feed(data,epoch),before=JSON.stringify(data)
  feed.cards[0].user.user_name='Not persisted';feed.cards[0].goals[0].label='Not persisted';feed.cards[0].last_message.body='Not persisted'
  assert.equal(JSON.stringify(data),before)
  data.users.find(x=>x.user_id==='user_chloe').user_name='Chloe Updated';assert.equal(home_feed(data,epoch).cards[0].user.user_name,'Chloe Updated')
})
