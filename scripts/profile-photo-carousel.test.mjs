import test from 'node:test'
import assert from 'node:assert/strict'
import { create_profile_photo_carousel } from '../src/utils/profilePhotoCarousel.js'

function setup(count = 3) {
  let time = 0, next = 0, index = 0, visible = true
  const jobs = new Map()
  const controller = create_profile_photo_carousel({
    can_advance: () => visible && count > 1,
    advance: () => { index = (index + 1) % count },
    schedule: (fn, delay) => { const id = ++next; jobs.set(id, { fn, due: time + delay }); return id },
    cancel: id => jobs.delete(id),
  })
  return { controller, jobs, index: () => index, visible: value => { visible = value }, tick(ms) { const end = time + ms; while (true) { const job = [...jobs].sort((a, b) => a[1].due - b[1].due)[0]; if (!job || job[1].due > end) break; time = job[1].due; jobs.delete(job[0]); job[1].fn() } time = end } }
}
test('photo cadence is exactly 3000ms and wraps actual count', () => {
  const s = setup(); s.controller.restart(); s.tick(2999); assert.equal(s.index(), 0); s.tick(1); assert.equal(s.index(), 1); s.tick(6000); assert.equal(s.index(), 0); assert.equal(s.jobs.size, 1)
})
test('manual restart grants a full interval and leaves only one job', () => {
  const s = setup(); s.controller.restart(); s.tick(2900); for (let i = 0; i < 8; i++) s.controller.restart(); s.tick(2999); assert.equal(s.index(), 0); s.tick(1); assert.equal(s.index(), 1); assert.equal(s.jobs.size, 1)
})
test('pause/dispose cancels; resume does not catch up hidden time', () => {
  const s = setup(); s.controller.restart(); s.tick(2000); s.visible(false); s.controller.restart(); assert.equal(s.jobs.size, 0); s.tick(9000); assert.equal(s.index(), 0); s.visible(true); s.controller.restart(); s.tick(2999); assert.equal(s.index(), 0); s.tick(1); assert.equal(s.index(), 1); s.controller.stop(); s.controller.stop(); s.tick(9000); assert.equal(s.index(), 1); assert.equal(s.jobs.size, 0)
})
test('zero/one photos never schedule; obsolete callback rechecks visibility', () => {
  for (const count of [0, 1]) { const s = setup(count); s.controller.restart(); assert.equal(s.jobs.size, 0) }
  const s = setup(); s.controller.restart(); s.visible(false); s.tick(3000); assert.equal(s.index(), 0); assert.equal(s.jobs.size, 0)
})
