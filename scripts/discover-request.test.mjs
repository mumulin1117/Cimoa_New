import test from 'node:test'
import assert from 'node:assert/strict'
import { createPinia, setActivePinia } from 'pinia'
import { use_app_store, configure_store_runtime } from '../src/stores/store.js'
import { create_seed } from '../src/stores/seed.js'
import { discover_destination } from '../src/utils/discoverNavigation.js'
const make = change => {
  setActivePinia(createPinia()); const store = use_app_store(), data = create_seed(); change?.(data)
  configure_store_runtime(store, { persistence: { read: () => data, write() {} } }); store.hydrate(); return store
}
test('deck/profile next action is one canonical read-only decision for unconnected, pending and connected', async () => {
  const store = make(), original = JSON.stringify(store.data), context = store.introduction_context('user_zane')
  assert.equal(context.user.user_name, 'Zane'); assert.equal(context.questions.length, 3); assert.equal(context.primary.label, 'Send shot')
  assert.equal(discover_destination(store,'primary','user_zane'), '/pages/discover/icebreaker/select?user_id=user_zane')
  assert.equal(JSON.stringify(store.data),original)
  const sent = await store.send_introduction({ user_id:'user_zane', question_id:context.questions[0].question_id, text:'What is your favourite campus court?', operation_id:'deck-request' })
  assert.ok(sent.success); assert.equal(store.introduction_context('user_zane').primary.label,'Request sent')
  assert.equal(discover_destination(store,'primary','user_zane'),`/pages/connections/sent?request_id=${sent.data}`)
  assert.equal(store.introduction_context('user_chloe').primary.label,'Chat'); assert.match(discover_destination(store,'primary','user_chloe'),/conversation_chloe/)
})
test('missing chat, account isolation, blocked/expired/error states do not leak a private destination', () => {
  assert.equal(make(d=>{d.conversations=d.conversations.filter(r=>r.conversation_id!=='conversation_chloe');d.messages=d.messages.filter(r=>r.conversation_id!=='conversation_chloe')}).introduction_context('user_chloe').primary.destination,'')
  for(const change of [d=>{d.session.expires_at=1},d=>{d.blocked_users.push({block_id:'test',owner_user_id:'user_zane',user_id:'user_cimoa',created_at:Date.now()})}])assert.equal(make(change).introduction_context('user_zane').primary,null)
  const store=make();store.hydration_status='error';assert.equal(store.introduction_context('user_zane').primary,null)
})
test('preparing the same target keeps one draft and stable operation; valid updates restore on hydration', () => {
  const store=make(),q=store.questions_for_user('user_zane')[0].question_id,first=store.prepare_introduction('user_zane',q)
  assert.ok(first.success);const operation=store.introduction_context('user_zane',first.data).draft.payload.operation_id
  assert.ok(store.update_introduction_draft(first.data,{text:'Coffee after your match?',mode:'voice'}).success)
  assert.equal(store.prepare_introduction('user_zane',q,'text').data,first.data)
  const c=store.introduction_context('user_zane',first.data);assert.equal(c.draft.payload.text,'Coffee after your match?');assert.equal(c.draft.payload.operation_id,operation)
  assert.equal(store.data.drafts.filter(r=>r.kind==='introduction'&&r.target_id==='user_zane').length,1)
  assert.equal(store.update_introduction_draft(first.data,{text:'a'.repeat(301)}).success,false)
  assert.equal(store.update_introduction_draft(first.data,{audio_id:'invented'}).success,false)
  const saved=JSON.parse(JSON.stringify(store.data));setActivePinia(createPinia());const reloaded=use_app_store();configure_store_runtime(reloaded,{persistence:{read:()=>saved,write(){}}});reloaded.hydrate();assert.equal(reloaded.introduction_context('user_zane',first.data).draft.payload.text,c.draft.payload.text)
})
test('draft writes reject wrong question, other owner, expired session and pending request atomically', async () => {
  const store=make(),q=store.questions_for_user('user_zane')[0].question_id,id=store.prepare_introduction('user_zane',q).data
  assert.equal(store.prepare_introduction('user_zane',store.questions_for_user('user_linden')[0].question_id).success,false)
  assert.equal(store.update_introduction_draft('not-mine',{text:'no'}).success,false)
  await store.send_introduction({user_id:'user_zane',question_id:q,text:'Would you like coffee?',operation_id:'already-pending'})
  const bytes=JSON.stringify(store.data);assert.equal(store.update_introduction_draft(id,{text:'duplicate'}).success,false);assert.equal(JSON.stringify(store.data),bytes)
  store.data.session.expires_at=1;const expired=JSON.stringify(store.data);assert.equal(store.prepare_introduction('user_linden',store.data.users.find(r=>r.user_id==='user_linden').icebreaker_ids[0]).success,false);assert.equal(JSON.stringify(store.data),expired)
})
test('saved audio and draft reference publish together; discard clears its draft and stale coin context', async () => {
  const store=make(),files=new Map();configure_store_runtime(store,{media:{get:async id=>files.get(id),put:async(id,blob)=>files.set(id,blob),delete:async id=>files.delete(id)},inspect_media:async()=>({duration_ms:1000})})
  const id=store.prepare_introduction('user_zane',store.questions_for_user('user_zane')[0].question_id,'voice').data,blob=new Blob(['recorded test sample'],{type:'audio/wav'})
  const saved=await store.save_media(blob,'audio',1000,{introduction_draft_id:id});assert.ok(saved.success);assert.equal(store.introduction_context('user_zane',id).audio.media_id,saved.data.media_id)
  store.save_draft('coin_spend',id,{kind:'voice_introduction',audio_id:saved.data.media_id})
  assert.ok((await store.discard_media(saved.data.media_id)).success);assert.equal(store.introduction_context('user_zane',id).audio,null);assert.equal(store.data.drafts.filter(d=>d.kind==='coin_spend').length,0);assert.equal(files.size,0)
  const bytes=JSON.stringify(store.data);const failed=await store.save_media(blob,'audio',1000,{introduction_draft_id:'invalid'});assert.equal(failed.success,false);assert.equal(files.size,0);assert.equal(JSON.stringify(store.data),bytes)
})
