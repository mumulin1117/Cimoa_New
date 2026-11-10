import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { create_discover_entrance } from '../src/utils/discoverEntrance.js'
import { prepare_image } from '../src/utils/imagePreparation.js'
import { DISCOVER_DECK } from '../src/config/discoverDeck.js'
import { MOTION } from '../src/config/navigation.js'

const lifecycle = () => {
  const phases = [], jobs = new Map(); let index = 0
  const entrance = create_discover_entrance({ change: phase => phases.push(phase), schedule: (fn, ms) => { jobs.set(++index, { fn, ms }); return index }, clear: id => jobs.delete(id) })
  return { entrance, phases, jobs }
}
test('readiness never replaces or extends the existing 600ms skeleton', () => {
  const { entrance, phases, jobs } = lifecycle()
  entrance.set_person('a'); entrance.set_loading(true); entrance.photo_ready('a')
  assert.deepEqual(phases, ['prepared']); assert.equal(jobs.size, 0)
  entrance.set_loading(false)
  assert.deepEqual(phases, ['prepared', 'running'])
  assert.equal([...jobs.values()][0].ms, DISCOVER_DECK.entrance.sweep_ms)
  assert.equal(MOTION.skeleton, 600)
})
test('slow photos stay unblocked after skeleton and reveal once ready', () => {
  const { entrance, phases } = lifecycle()
  entrance.set_person('a'); entrance.set_loading(true); entrance.set_loading(false)
  assert.deepEqual(phases, ['prepared'])
  entrance.photo_ready('a'); entrance.photo_ready('a')
  assert.deepEqual(phases, ['prepared', 'running'])
})
test('warm returns and person changes do not acquire another entrance', () => {
  const { entrance, phases, jobs } = lifecycle()
  entrance.set_person('a'); entrance.set_loading(false); entrance.photo_ready('a')
  assert.deepEqual(phases, [])
  entrance.set_loading(true); entrance.set_loading(false); [...jobs.values()][0].fn()
  entrance.set_person('b'); entrance.photo_ready('b'); entrance.set_loading(false)
  assert.deepEqual(phases, ['prepared', 'running', 'complete'])
})
test('touch, hide, error and disposal consume the entrance without waiting or mutating a cursor', () => {
  for (const method of ['interrupt', 'dispose', 'photo_failed']) {
    const { entrance, phases, jobs } = lifecycle()
    entrance.set_person('a'); entrance.set_loading(true)
    entrance[method]('a'); entrance.set_loading(false); entrance.photo_ready('a')
    assert.deepEqual(phases, ['prepared', 'complete']); assert.equal(jobs.size, 0)
  }
})
test('stale image identity and cancelled timers cannot animate the next account/photo', () => {
  const { entrance, phases, jobs } = lifecycle()
  entrance.set_person('account-a:person:photo-a'); entrance.set_loading(true)
  entrance.set_person('account-a:person:photo-b'); entrance.photo_ready('account-a:person:photo-a'); entrance.set_loading(false)
  assert.deepEqual(phases, ['prepared'])
  entrance.photo_ready('account-a:person:photo-b')
  const stale = [...jobs.values()][0].fn
  entrance.interrupt(); entrance.set_person('account-b:person:photo-b'); entrance.set_loading(true)
  stale(); assert.equal(phases.at(-1), 'prepared')
})

const fake_image = ({ cached = false, decode } = {}) => {
  const instances = []
  class Image {
    naturalWidth = 40
    complete = cached
    constructor() { instances.push(this); if (decode) this.decode = decode }
  }
  return { Image, instances }
}
test('image preparation waits for actual decode, including cached first photos', async () => {
  let finish, decodes = 0
  const { Image, instances } = fake_image({ cached: true, decode: () => { decodes++; return new Promise(resolve => { finish = resolve }) } })
  const photo = prepare_image('/photo.jpg', Image)
  let ready = false; photo.ready.then(value => { ready = value })
  await Promise.resolve(); assert.equal(ready, false); assert.equal(decodes, 1)
  finish(); assert.equal(await photo.ready, true)
  assert.equal(instances[0].onload, null)
  photo.cancel(); assert.equal(instances[0].src, '/photo.jpg')
  const warm = prepare_image('/photo.jpg', Image)
  assert.equal(warm.cached, true); assert.equal(await warm.ready, true); assert.equal(instances.length, 1)
})
test('decode or network failure is a real error, not a fake ready image', async () => {
  const broken = fake_image({ decode: () => Promise.reject(Error('decode failed')) })
  const first = prepare_image('/broken.jpg', broken.Image)
  broken.instances[0].onload()
  await assert.rejects(first.ready, /could not be decoded/)
  const network = fake_image(), second = prepare_image('/404.jpg', network.Image)
  network.instances[0].onerror(); await assert.rejects(second.ready, /could not be loaded/)
})
test('cancelling an outstanding read/decode settles it and detaches media handlers', async () => {
  for (const decoding of [false, true]) {
    let finish
    const { Image, instances } = fake_image({ decode: () => new Promise(resolve => { finish = resolve }) })
    const photo = prepare_image('/photo.jpg', Image)
    if (decoding) instances[0].onload()
    photo.cancel(); assert.equal(await photo.ready, false)
    assert.equal(instances[0].onload, null); assert.equal(instances[0].onerror, null)
    if (decoding) finish()
  }
})
test('image load fallback works without decode, but never accepts an empty image', async () => {
  const fallback = fake_image(), good = prepare_image('/photo.jpg', fallback.Image)
  fallback.instances[0].onload(); assert.equal(await good.ready, true)
  const empty = prepare_image('/empty.jpg', fallback.Image)
  fallback.instances[1].naturalWidth = 0; fallback.instances[1].onload()
  await assert.rejects(empty.ready, /could not be decoded/)
})
test('decoded-photo memory is bounded and cancelled decodes are never cached', async () => {
  const pool = fake_image({ cached: true })
  for (let i = 0; i < 7; i++) await prepare_image(`/photo-${i}.jpg`, pool.Image).ready
  assert.equal(prepare_image('/photo-6.jpg', pool.Image).cached, true)
  assert.equal(prepare_image('/photo-0.jpg', pool.Image).cached, false)
  let finish
  const pending = fake_image({ decode: () => new Promise(resolve => { finish = resolve }) })
  const cancelled = prepare_image('/cancelled.jpg', pending.Image)
  pending.instances[0].onload(); cancelled.cancel(); finish(); await Promise.resolve()
  assert.equal(await cancelled.ready, false)
  assert.equal(prepare_image('/cancelled.jpg', pending.Image).cached, false)
})
test('Discover reuses exact card geometry while preloading and keeps gesture transform independent', () => {
  const page = fs.readFileSync('src/pages/discover/index.vue', 'utf8'), card = fs.readFileSync('src/components/DiscoverProfileCard.vue', 'utf8')
  assert.match(page, /eager-content/); assert.match(page, /:skeleton="!ready"/)
  assert.match(card, /discover-card-face--enter/); assert.match(card, /prefers-reduced-motion: reduce/)
  assert.match(card, /\.discover-edge-sweep \{ display: none; animation: none;/)
  assert.doesNotMatch(card, /\.discover-photo-card(?:--[\w-]+)?\s*\{[^}]*animation: discover-fan/)
  assert.match(card, /animation: discover-edge[^;]+ both/)
  assert.doesNotMatch(card, /animation: discover-edge[^;]+infinite/)
})
