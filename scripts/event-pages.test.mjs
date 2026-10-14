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
  store.block_user('user_chloe');assert.equal(store.event_people('event_picnic','chloe').length,0);assert.equal(store.event_detail('event_picnic').available_count,16);assert.deepEqual(store.data.relationships,before)
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
