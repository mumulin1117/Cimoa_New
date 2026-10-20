import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import crypto from 'node:crypto'
import { createPinia } from 'pinia'
import { use_app_store, configure_store_runtime } from '../src/stores/store.js'
import { create_seed, clone_data, DISCOVER_PROFILE_IDS } from '../src/stores/seed.js'
import { AVATAR_PROFILE_IDS } from '../src/stores/peopleCatalog.js'
import { upgrade_additive_data } from '../src/stores/migration.js'
import { validate_data } from '../src/stores/selectors.js'
import { STATE_KEY } from '../src/utils/statePersistence.js'
import { startup_destination } from '../src/utils/authNavigation.js'
import { home_destination } from '../src/utils/homeNavigation.js'

const epoch = Date.UTC(2026, 9, 17, 10)
function fixture(saved = null) {
  let now = epoch, writes = 0, fail = false
  const disk = new Map(saved ? [[STATE_KEY, clone_data(saved)]] : []), blobs = new Map()
  const persistence = { read: key => clone_data(disk.get(key) ?? null), write: (key, value) => { if (fail) throw Error('Storage full'); writes++; disk.set(key, clone_data(value)) } }
  const store = use_app_store(createPinia())
  configure_store_runtime(store, { persistence, clock: () => now, media: { put: async (id, blob) => blobs.set(id, blob), get: async id => blobs.get(id), delete: async id => blobs.delete(id) }, inspect_media: async (_, kind) => ({ duration_ms: kind === 'audio' ? 1000 : 0 }) })
  assert.equal(store.hydrate().success, true)
  return { store, disk, blobs, persistence, advance: ms => { now += ms; store.tick() }, writes: () => writes, fail: value => { fail = value } }
}
async function register(store, email, name) {
  assert.equal(store.save_registration_age('2004-03-12').success, true)
  assert.equal(store.save_registration_agreements({ terms: true, privacy: true, community: true }).success, true)
  const registration = await store.register_local_account({ email, password: 'campus123', confirmation: 'campus123', date_of_birth: '2004-03-12', agreements: { terms: true, privacy: true, community: true } })
  assert.equal(registration.success, true)
  const { account_id, user_id } = registration.data
  assert.equal(store.apply_verification('9789', account_id).success, false)
  assert.equal(store.apply_verification('009789', account_id).success, true)
  assert.equal(store.begin_onboarding(account_id).success, true)
  for (const [step, patch] of [['basic', { user_name: name, date_of_birth: '2004-03-12', gender: 'Non-binary', pronouns: 'they / them' }], ['uni', { university: 'HKUST', year: 'Year 3', major: '', graduation_year: '2027' }], ['major', { major: 'Engineering' }]]) assert.equal((await store.save_onboarding_step(step, patch, account_id)).success, true)
  assert.equal((await store.add_onboarding_photos([new Blob(['decoded image 1'], { type: 'image/png' }), new Blob(['decoded image 2'], { type: 'image/png' })], null, account_id)).success, true)
  for (const [step, patch] of [['photos', {}], ['about', { bio: 'Looking for a campus photo-walk buddy.' }], ['interests', { interest_ids: ['coffee', 'photography', 'music'] }], ['goal', { goal_ids: ['friends'] }], ['ice', { questions: ['What is your favorite campus walk?', 'Which album should I try?', 'What is your weekend plan?'] }], ['notif', { notification_permission: 'skipped' }], ['complete', {}]]) assert.equal((await store.save_onboarding_step(step, patch, account_id)).success, true, step)
  assert.equal(startup_destination(store), '/pages/home/index')
  assert.equal(store.social_eligible, true)
  assert.equal(store.current_user.verified, false)
  return { user_id, account_id }
}
test('23 supplied unique portraits resolve to complete shared profiles; original six Discover media stay intact', () => {
  const { store } = fixture(create_seed(epoch)), manifest = JSON.parse(fs.readFileSync('docs/cimoa-avatar-assets.json'))
  assert.equal(manifest.unique_count, 23); assert.equal(new Set(manifest.assets.map(row => row.sha256)).size, 23)
  assert.deepEqual(store.discover_people.slice(0, 6).map(row => row.user_id), DISCOVER_PROFILE_IDS)
  assert.equal(store.discover_people.length, 29)
  for (const row of manifest.assets) {
    const bytes = fs.readFileSync('.' + row.target), person = store.user_by_id(row.user_id)
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), row.sha256)
    assert.equal(person.avatar_url, row.target); assert.equal(store.photos_for_user(row.user_id)[0].media_url, row.target)
    assert.equal(store.questions_for_user(row.user_id).length, 3)
    assert.ok(person.bio.length > 90 && person.bio.length <= 300); assert.ok(person.interest_ids.length >= 3 && person.goal_ids.length >= 3)
    assert.equal(person.voice_intro, undefined); assert.equal(store.photos_for_user(row.user_id).length, 1)
  }
  assert.ok(store.event_people('event_sketch').some(row => AVATAR_PROFILE_IDS.includes(row.user_id)))
  const original = clone_data(store.data)
  store.user_by_id('user_noah').interest_ids.push('art'); store.goals_for_user('user_noah')[0].label = 'Changed only in the detached view'
  assert.deepEqual(clone_data(store.data), original)
  assert.equal(validate_data(store.data), true)
})
test('additive upgrade preserves profile edits, all relationships, sessions and account data without writes or duplicate reseeding', () => {
  const old = create_seed(epoch), avatar_ids = new Set(AVATAR_PROFILE_IDS)
  old.users = old.users.filter(row => !avatar_ids.has(row.user_id)); old.profile_photos = old.profile_photos.filter(row => !avatar_ids.has(row.user_id)); old.icebreakers = old.icebreakers.filter(row => !avatar_ids.has(row.user_id)); old.memberships = old.memberships.filter(row => !avatar_ids.has(row.user_id))
  old.users.find(row => row.user_id === 'user_zane').bio = 'Keep this edited biography.'
  const { store, writes } = fixture(old)
  assert.equal(writes(), 0); assert.equal(store.user_by_id('user_zane').bio, 'Keep this edited biography.')
  for (const key of ['accounts', 'session', 'requests', 'relationships', 'conversations', 'coin_transactions', 'blocked_users']) assert.deepEqual(clone_data(store.data[key]), old[key])
  assert.deepEqual(upgrade_additive_data(store.data), clone_data(store.data))
  store.data.users.find(row => row.user_id === 'user_noah').bio = 'Edited portrait profile.'
  store.data.memberships = store.data.memberships.filter(row => row.user_id !== 'user_noah')
  const next = upgrade_additive_data(store.data)
  assert.equal(next.users.find(row => row.user_id === 'user_noah').bio, 'Edited portrait profile.')
  assert.equal(next.memberships.some(row => row.user_id === 'user_noah'), false)
})
test('two real local registrations share requests, friendship, introduction and chat while retaining account isolation across reload', async () => {
  const f = fixture(), { store } = f
  const alice = await register(store, 'alice@campus.edu', 'Alice Student')
  assert.deepEqual(store.home_connections, []); assert.equal(store.coin_balance, 0)
  assert.equal(store.join_event('event_picnic').success, true)
  store.save_draft('support', null, { body: 'Only Alice can read this draft.' })
  store.logout()
  const bob = await register(store, 'bob@campus.edu', 'Bob Student')
  assert.equal(store.my_events.some(row => row.event_id === 'event_picnic'), false)
  assert.equal(store.current_drafts.length, 0); assert.equal(store.discover_people.some(row => row.user_id === alice.user_id), true)
  // Explicit test-only funding; newly registered production accounts still start at zero.
  assert.equal((await store.send_introduction({ user_id: alice.user_id, question_id: store.questions_for_user(alice.user_id)[0].question_id, text: 'Not funded yet', operation_id: 'bob-unfunded' })).success, false)
  store.data.coin_transactions.push({ transaction_id: 'txn_bob_test_credit', owner_user_id: bob.user_id, business_key: 'fixture:bob-credit', kind: 'purchase', related_id: null, amount: 10, status: 'completed', created_at: epoch, fixture: true })
  const intro = await store.send_introduction({ user_id: alice.user_id, question_id: store.questions_for_user(alice.user_id)[0].question_id, text: 'The seafront walk after class. Want to join?', operation_id: 'bob-intro' })
  assert.equal(intro.success, true); assert.equal(store.coin_balance, 0); assert.equal(store.coin_transactions.length, 2)
  assert.equal(store.relationship_state(alice.user_id).status, 'outgoing_request')
  assert.equal(home_destination(store, 'card', alice.user_id), `/pages/connections/sent?request_id=${intro.data}`)
  store.logout(); await store.login('alice@campus.edu', 'campus123')
  assert.equal(store.relationship_state(bob.user_id).status, 'incoming_request')
  assert.equal(store.received_requests.length, 1); assert.equal(store.current_drafts.length, 1)
  const before = clone_data(store.data); f.fail(true)
  assert.equal(store.accept_request(intro.data).success, false); assert.deepEqual(clone_data(store.data), before)
  f.fail(false)
  const accepted = store.accept_request(intro.data)
  assert.equal(accepted.success, true); assert.equal(store.friends.length, 1); assert.equal(store.current_conversations.length, 1)
  assert.equal(store.messages_for_conversation(accepted.data)[0].body, 'The seafront walk after class. Want to join?')
  assert.equal(store.messages_for_conversation(accepted.data)[0].sender_id, bob.user_id)
  assert.equal(store.accept_request(intro.data).success, false)
  assert.equal((await store.send_direct_message(accepted.data, 'Let’s meet after the lecture.', null, 'alice-message')).success, true)
  const restored = fixture(f.disk.get(STATE_KEY)).store
  assert.equal(restored.current_user.user_name, 'Alice Student'); assert.equal(restored.relationship_state(bob.user_id).conversation_id, accepted.data)
  assert.equal(restored.save_profile_section('basic', { user_name: 'Alice Updated', pronouns: 'they / them', year: 'Year 3', major: 'Engineering' }, alice.account_id).success, true)
  restored.logout(); await restored.login('bob@campus.edu', 'campus123')
  assert.equal(restored.user_by_id(alice.user_id).user_name, 'Alice Updated'); assert.equal(restored.current_drafts.length, 0)
  assert.equal(restored.direct_conversation(accepted.data).messages.length, 2)
  assert.equal(restored.block_user(alice.user_id).success, true)
  assert.equal(restored.relationship_state(alice.user_id).status, 'blocked'); assert.equal(restored.friends.length, 0); assert.equal(restored.current_conversations.length, 0)
  assert.equal(restored.unblock_user(alice.user_id).success, true); assert.equal(restored.can_chat(alice.user_id), false)
})
test('device matching retains search/pause/expiry deadlines and only a signed-in peer can complete the connection', async () => {
  const f = fixture(), { store } = f
  const alice = await register(store, 'match.alice@campus.edu', 'Match Alice')
  store.logout(); const bob = await register(store, 'match.bob@campus.edu', 'Match Bob')
  store.logout(); await store.login('match.alice@campus.edu', 'campus123')
  store.update_match_preferences({ university: 'HKUST', major: 'Engineering', gender: 'Non-binary', language: 'All' })
  const match = store.start_match('device-match')
  assert.equal(match.success, true); assert.equal(store.free_matches_remaining, 2)
  assert.equal(store.match_by_id(match.data).candidate_id, bob.user_id)
  f.advance(3000); assert.equal(store.transition_match(match.data, 'paused').success, true)
  f.advance(20000); assert.equal(store.match_by_id(match.data).status, 'paused')
  assert.equal(store.transition_match(match.data, 'searching').success, true)
  const restored = fixture(f.disk.get(STATE_KEY)); restored.advance(23000)
  assert.equal(restored.store.match_by_id(match.data).status, 'searching')
  f.advance(5999); assert.equal(store.match_by_id(match.data).status, 'searching')
  f.advance(1); assert.equal(store.match_by_id(match.data).status, 'found')
  assert.equal(store.transition_match(match.data, 'waiting').success, true)
  assert.match(store.introduction_blocker(bob.user_id), /match invitation.*pending/)
  assert.equal(store.can_chat(bob.user_id), false)
  assert.equal(store.respond_to_match(match.data, 'accepted').success, false)
  store.logout(); await store.login('match.bob@campus.edu', 'campus123')
  assert.equal(store.match_invitation(match.data).other.user_id, alice.user_id)
  assert.equal(home_destination(store, 'card', alice.user_id), `/pages/connections/received?match_id=${match.data}`)
  assert.equal(store.respond_to_match(match.data, 'accepted').success, true); assert.equal(store.can_chat(alice.user_id), true)
  store.logout(); await store.login('match.alice@campus.edu', 'campus123')
  assert.equal(store.match_by_id(match.data).status, 'connected'); assert.equal(store.can_chat(bob.user_id), true)
})
test('credential work cannot resurrect a session after logout and invalid entity ownership is rejected', async () => {
  const f = fixture(create_seed(epoch)), { store } = f
  const pending = store.login('cimoa@gmail.com', '12341234')
  assert.equal(store.logout().success, true)
  assert.equal((await pending).success, false); assert.equal(store.session.is_authenticated, false)
  const data = create_seed(epoch)
  data.users[1].photo_ids = data.users[2].photo_ids
  assert.throws(() => validate_data(data), /belong to another user/)
})
test('a voice introduction stays readable by its real recipient and becomes the same media message on acceptance', async () => {
  const { store } = fixture(create_seed(epoch))
  const media = await store.save_media(new Blob(['decoded voice'], { type: 'audio/webm' }), 'audio')
  const request = await store.send_introduction({ user_id: 'user_noah', question_id: 'user_noah_q_0', kind: 'voice', audio_id: media.data.media_id, operation_id: 'voice-to-noah' })
  assert.equal(request.success, true); assert.equal(store.coin_balance, 250)
  store.data.accounts.push({ ...store.data.accounts[0], account_id: 'account_noah_voice', user_id: 'user_noah', email: 'noah.voice@campus.test' })
  await store.login('noah.voice@campus.test', '12341234')
  assert.equal(store.media_by_id(media.data.media_id), null)
  assert.equal(store.request_detail(request.data).audio.media_id, media.data.media_id)
  const accepted = store.accept_request(request.data)
  assert.equal(accepted.success, true)
  assert.equal(store.direct_conversation(accepted.data).messages[0].media.media_id, media.data.media_id)
  assert.equal(store.direct_conversation(accepted.data).messages[0].sender_id, 'user_cimoa')
})
