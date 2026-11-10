import test from 'node:test'
import assert from 'node:assert/strict'
import { createPinia } from 'pinia'
import { use_app_store, configure_store_runtime } from '../src/stores/store.js'
import { create_seed, clone_data } from '../src/stores/seed.js'
const now = Date.UTC(2026,9,13,1)
const make = transform => {
  let disk = create_seed(now); transform?.(disk)
  const blobs = new Map(), store = use_app_store(createPinia())
  const persistence = {read:()=>clone_data(disk),write:(_,data)=>{disk=clone_data(data)}}
  configure_store_runtime(store,{clock:()=>now,persistence,media:{put:async(id,blob)=>blobs.set(id,blob),get:async id=>blobs.get(id),delete:async id=>blobs.delete(id)},inspect_media:async()=>({duration_ms:1200})})
  assert.equal(store.hydrate().success,true); return {store,blobs,persistence}
}
test('participants filter real memberships, privacy, blocking and search; joining does not connect',()=>{
  const {store}=make();const before=clone_data(store.data.relationships);store.join_event('event_picnic')
  assert.equal(store.event_people('event_picnic').length,4);assert.equal(store.event_people('event_picnic','ethan')[0].relationship_label,'You')
  store.block_user('user_chloe');assert.equal(store.event_people('event_picnic','chloe').length,0);assert.equal(store.event_detail('event_picnic').available_count,16);assert.ok(store.data.relationships.length<before.length)
  store.leave_event('event_picnic');assert.equal(store.event_people('event_picnic','ethan').length,0)
})
test('detail derives host, zoned schedule, unique notes and count without reseeding old data',()=>{
  const {store}=make(), before=clone_data(store.data), detail=store.event_detail('event_picnic')
  assert.equal(detail.organizer.name,'HKUST Student Union');assert.equal(detail.schedule[1].time_label,'6:00 PM');assert.equal(detail.notes.filter(n=>n==='Free to join').length,1);assert.match(detail.share_text,/Asia\/Hong_Kong/);assert.deepEqual(store.data,before)
  detail.organizer.name='Changed';assert.equal(store.event_detail('event_picnic').organizer.name,'HKUST Student Union')
  const legacy=make(d=>{delete d.events[0].schedule;delete d.events[0].notes;d.events[0].description='Old saved text'})
  assert.deepEqual(legacy.store.event_detail('event_picnic').schedule,[]);assert.equal(legacy.store.event_detail('event_picnic').description,'Old saved text');assert.equal(store.event_detail('missing'),null)
})
test('My Events sorts only own active memberships into campus-week, later and past',()=>{
  const {store}=make();store.join_event('event_picnic');store.join_event('event_mic');assert.equal(store.my_event_groups.featured.event_id,'event_picnic');assert.equal(store.my_event_groups.sections[0].label,'This week')
  Object.assign(store.data.events.find(e=>e.event_id==='event_mic'),{starts_at:now-7200000,ends_at:now-1});assert.equal(store.my_event_groups.sections[0].label,'Past')
  store.leave_event('event_picnic');assert.equal(store.my_event_groups.featured,null);assert.equal(store.my_event_groups.sections[0].events.length,1)
})
test('group validates membership and event/conversation pair; text is idempotent and blocking is read-filtered',async()=>{
  const {store}=make();assert.equal(store.event_group('event_picnic','group_picnic'),null);assert.equal((await store.send_event_message('event_picnic','group_picnic','hello')).success,false)
  store.join_event('event_picnic');assert.equal(store.event_group('event_mic','group_picnic'),null)
  const before=store.data.messages.length;assert.equal((await store.send_event_message('event_picnic','group_picnic','hello',null,'same')).success,true);assert.equal((await store.send_event_message('event_picnic','group_picnic','hello',null,'same')).repeated,true);assert.equal(store.data.messages.length,before+1)
  assert.equal((await store.send_event_message('event_picnic','group_picnic','x'.repeat(2001))).success,false)
  store.data.messages.push({message_id:'incoming',conversation_id:'group_picnic',sender_id:'user_chloe',kind:'text',body:'hello',media_id:null,sent_at:now,read_by:[]});assert.equal(store.event_group('event_picnic','group_picnic').messages.length,2)
  store.block_user('user_chloe');assert.equal(store.event_group('event_picnic','group_picnic').messages.length,1);store.leave_event('event_picnic');assert.equal(store.event_group('event_picnic','group_picnic'),null)
})
test('group media publishes Blob and message metadata together, refreshes and reuses operation result',async()=>{
  const {store,blobs}=make();store.join_event('event_picnic');const payload={kind:'image',blob:new Blob(['test decoded by injected adapter'],{type:'image/png'}),duration_ms:0}
  const result=await store.send_event_message('event_picnic','group_picnic','',payload,'photo-once');assert.equal(result.success,true);assert.equal(blobs.size,1);const meta=store.event_group('event_picnic','group_picnic').messages[0].media;assert.ok(blobs.has(meta.media_id))
  assert.equal((await store.send_event_message('event_picnic','group_picnic','',payload,'photo-once')).repeated,true);assert.equal(blobs.size,1);store.hydration_status='idle';store.hydrate();assert.equal(store.event_group('event_picnic','group_picnic').messages[0].media.media_id,meta.media_id)
})
test('group media failure/cancellation/attendance change compensates only its new Blob',async()=>{
  for(const mode of ['storage','cancel','left','account','rejoin','reauth']) {
    const {store,blobs,persistence}=make();store.join_event('event_picnic');blobs.set('unrelated',new Blob(['keep']));const before=clone_data(store.data);let current=true
    configure_store_runtime(store,{media:{put:async(id,blob)=>{blobs.set(id,blob);if(mode==='cancel')current=false;if(mode==='left')store.leave_event('event_picnic');if(mode==='account'){store.data.session.current_user_id='user_chloe';store.data.session.account_id='changed'}if(mode==='rejoin'){store.leave_event('event_picnic');store.join_event('event_picnic')}if(mode==='reauth'){store.logout();await store.login('cimoa@connect.edu','12341234')}},delete:async id=>blobs.delete(id)},...(mode==='storage'?{persistence:{...persistence,write(){throw Error('Storage full')}}}:{})})
    const result=await store.send_event_message('event_picnic','group_picnic','',{kind:'image',blob:new Blob(['decoded fixture'],{type:'image/png'})},'failure',{is_current:()=>current});assert.equal(result.success,false);assert.deepEqual([...blobs.keys()],['unrelated']);assert.deepEqual(store.data.messages,before.messages);assert.deepEqual(store.data.media_files,before.media_files)
    if(mode==='storage')assert.deepEqual(store.data,before)
  }
})
test('mute is owned, persistent and does not imply push delivery or alter other preferences',()=>{
  const {store}=make();store.join_event('event_picnic');const before=clone_data(store.data.event_preferences[0]);assert.equal(store.set_event_group_muted('event_picnic','group_picnic',true).success,true);assert.equal(store.event_group('event_picnic','group_picnic').muted,true);assert.deepEqual(store.data.event_preferences[0].filters,before.filters);store.hydration_status='idle';store.hydrate();assert.equal(store.event_group('event_picnic','group_picnic').muted,true);store.leave_event('event_picnic');assert.equal(store.set_event_group_muted('event_picnic','group_picnic',false).success,false)
})

test('each admission has a stable unique generation; group read state derives only visible messages',()=>{
  const {store}=make();store.join_event('event_picnic')
  const first=store.event_group('event_picnic','group_picnic').access_key
  store.set_event_group_muted('event_picnic','group_picnic',true)
  assert.equal(store.event_group('event_picnic','group_picnic').access_key,first)
  store.leave_event('event_picnic');store.join_event('event_picnic')
  assert.notEqual(store.event_group('event_picnic','group_picnic').access_key,first)
  const stamp=store.data.memberships.find(m=>m.user_id==='user_cimoa'&&m.event_id==='event_picnic').admission_id
  store.hydration_status='idle';assert.equal(store.hydrate().success,true)
  assert.equal(store.data.memberships.find(m=>m.admission_id===stamp).status,'joined')
  store.data.messages.push({message_id:'unread_group',conversation_id:'group_picnic',sender_id:'user_zoe',body:'Hello everyone',kind:'text',media_id:null,sent_at:now,read_by:['user_zoe']})
  assert.equal(store.event_group('event_picnic','group_picnic').unread_count,1)
  assert.equal(store.mark_read('group_picnic').success,true)
  assert.equal(store.event_group('event_picnic','group_picnic').unread_count,0)
  assert.equal(store.data.messages.find(m=>m.message_id==='unread_group').read_by.includes('user_cimoa'),true)
  store.hydration_status='idle';store.hydrate();assert.equal(store.event_group('event_picnic','group_picnic').unread_count,0)
})
test('duplicate event groups and invalid admission metadata are recoverable read failures',()=>{
  for(const mode of ['duplicate','admission']){
    let disk=create_seed(now)
    if(mode==='duplicate')disk.conversations.push({...disk.conversations.find(c=>c.kind==='group'),conversation_id:'duplicate_group'})
    else disk.memberships[0].admission_id=123
    const store=use_app_store(createPinia())
    configure_store_runtime(store,{clock:()=>now,persistence:{read:()=>disk,write(){throw Error('Must not overwrite')}}})
    assert.equal(store.hydrate().success,false);assert.equal(store.hydration_status,'error')
  }
})
