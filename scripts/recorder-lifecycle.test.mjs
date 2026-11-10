import test from 'node:test'
import assert from 'node:assert/strict'
import { create_recorder } from '../src/utils/mediaCapabilities.js'
import { fake_clock } from './lib/fake-clock.mjs'

const deferred = () => {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const capture = ({ audio = true, ended = false } = {}) => {
  const track = { kind: audio ? 'audio' : 'video', readyState: ended ? 'ended' : 'live', stopped: 0, stop() { this.stopped++; this.readyState = 'ended' } }
  return { track, stream: { getTracks: () => [track], getAudioTracks: () => audio ? [track] : [] } }
}
const recorder_fixture = (options = {}) => {
  const instances = []
  class Recorder {
    static isTypeSupported(type) { return (options.supported || ['audio/mp4']).includes(type) }
    constructor(stream, configuration) {
      if (options.constructor_error) throw new Error('Device constructor failure')
      this.stream = stream; this.configuration = configuration; this.mimeType = configuration?.mimeType || options.default_type || ''; this.state = 'inactive'; this.stop_calls = 0
      instances.push(this)
    }
    start() { if (options.start_error) throw new Error('Device start failure'); this.state = 'recording' }
    stop() {
      this.stop_calls++
      if (options.stop_error) throw new Error('Device stop failure')
      this.state = 'inactive'
      if (!options.manual_stop) queueMicrotask(() => this.complete())
    }
    complete() {
      this.ondataavailable?.({ data: new Blob(options.empty ? [] : ['actual encoded bytes'], { type: this.mimeType || options.chunk_type || '' }) })
      this.onstop?.()
    }
  }
  return { Recorder, instances }
}
const setup = async (options = {}) => {
  const input = capture(options), clock = fake_clock(), native = recorder_fixture(options), controller = new AbortController()
  const recorder = await create_recorder({ devices: { getUserMedia: () => Promise.resolve(input.stream) }, Recorder: native.Recorder, clock: clock.now, timers: clock, signal: controller.signal })
  return { ...input, ...native, clock, controller, recorder, native: native.instances[0] }
}

test('getUserMedia starts in the original caller stack without a timer or microtask', async () => {
  const input = capture(), clock = fake_clock(), native = recorder_fixture()
  let called = false
  const pending = create_recorder({ devices: { getUserMedia(constraints) { called = true; assert.deepEqual(constraints, { audio: true }); return Promise.resolve(input.stream) } }, Recorder: native.Recorder, timers: clock })
  assert.equal(called, true)
  const recorder = await pending
  assert.equal(clock.pending(), 0)
  recorder.dispose(); assert.equal(input.track.stopped, 1)
})

test('a previously aborted permission request never opens a microphone', async () => {
  const controller = new AbortController(), clock = fake_clock(); controller.abort()
  let calls = 0
  await assert.rejects(create_recorder({ devices: { getUserMedia() { calls++ } }, Recorder: class {}, signal: controller.signal, timers: clock }), { name: 'AbortError' })
  assert.equal(calls, 0); assert.equal(clock.pending(), 0)
})

test('permission rejection, missing hardware, and unreadable hardware keep distinct safe errors', async () => {
  for (const [name, message] of [['NotAllowedError', /denied/], ['SecurityError', /denied/], ['NotFoundError', /found/], ['NotReadableError', /opened/]]) {
    for (const synchronous of [false, true]) {
      const clock = fake_clock()
      await assert.rejects(create_recorder({ devices: { getUserMedia() { const error = Object.assign(new Error('private OS diagnostic'), { name }); if (synchronous) throw error; return Promise.reject(error) } }, Recorder: class {}, timers: clock }), error => error.name === name && message.test(error.message) && !error.message.includes('private OS'))
      assert.equal(clock.pending(), 0)
    }
  }
})

test('the unchanged 15-second opening timeout and cancellation stop late streams', async () => {
  for (const mode of ['timeout', 'abort']) {
    const clock = fake_clock(), stream = deferred(), controller = new AbortController(), input = capture()
    const pending = create_recorder({ devices: { getUserMedia: () => stream.promise }, Recorder: class {}, timers: clock, signal: controller.signal })
    const rejection = assert.rejects(pending, { name: mode === 'abort' ? 'AbortError' : 'TimeoutError' })
    if (mode === 'abort') controller.abort()
    else { await clock.advance(14999); assert.equal(clock.pending(), 1); await clock.advance(1) }
    await rejection; assert.equal(clock.pending(), 0)
    stream.resolve(input.stream); await Promise.resolve(); await Promise.resolve()
    assert.equal(input.track.stopped, 1)
  }
})

test('missing or ended audio tracks cannot create a recording and are released', async () => {
  for (const options of [{ audio: false }, { ended: true }]) {
    const input = capture(options), native = recorder_fixture(), clock = fake_clock()
    await assert.rejects(create_recorder({ devices: { getUserMedia: () => Promise.resolve(input.stream) }, Recorder: native.Recorder, timers: clock }), { name: 'NotFoundError' })
    assert.equal(input.track.stopped, 1); assert.equal(native.instances.length, 0); assert.equal(clock.pending(), 0)
  }
})

test('Apple-compatible MP4 and supported WebM retain their real MIME and encoded bytes', async () => {
  for (const type of ['audio/mp4', 'audio/webm;codecs=opus']) {
    const subject = await setup({ supported: [type] }); subject.recorder.start()
    await subject.clock.advance(2100)
    const result = await subject.recorder.stop()
    assert.deepEqual(subject.native.configuration, { mimeType: type })
    assert.equal(result.blob.type, type); assert.equal(await result.blob.text(), 'actual encoded bytes'); assert.equal(result.duration_ms, 2100)
    assert.equal(subject.track.stopped, 1); assert.equal(subject.clock.pending(), 0)
    subject.recorder.dispose(); subject.recorder.dispose(); assert.equal(subject.track.stopped, 1)
  }
})

test('default encoders use emitted audio MIME instead of labelling unknown bytes as WebM', async () => {
  const subject = await setup({ supported: [], chunk_type: 'audio/mp4' }); subject.recorder.start()
  const result = await subject.recorder.stop()
  assert.equal(subject.native.configuration, undefined); assert.equal(result.blob.type, 'audio/mp4'); assert.equal(subject.clock.pending(), 0)
  for (const options of [{ supported: [] }, { empty: true }, { supported: [], chunk_type: 'video/mp4' }]) {
    const invalid = await setup(options); invalid.recorder.start()
    await assert.rejects(invalid.recorder.stop(), /No playable audio/)
    assert.equal(invalid.track.stopped, 1); assert.equal(invalid.clock.pending(), 0)
  }
})

test('constructor and start failures release capture without pending timers', async () => {
  const input = capture(), native = recorder_fixture({ constructor_error: true }), clock = fake_clock()
  await assert.rejects(create_recorder({ devices: { getUserMedia: () => Promise.resolve(input.stream) }, Recorder: native.Recorder, timers: clock }), /could not be started/)
  assert.equal(input.track.stopped, 1); assert.equal(clock.pending(), 0)
  const subject = await setup({ start_error: true })
  assert.throws(() => subject.recorder.start(), /could not be started/)
  await assert.rejects(subject.recorder.stop(), /could not be started/)
  subject.recorder.dispose(); assert.equal(subject.track.stopped, 1); assert.equal(subject.clock.pending(), 0)
})

test('stop exceptions and recorder error events settle exactly once and release the input', async () => {
  const throws = await setup({ stop_error: true }); throws.recorder.start()
  await assert.rejects(throws.recorder.stop(), /could not be completed/)
  assert.equal(throws.track.stopped, 1); assert.equal(throws.clock.pending(), 0)
  const errors = await setup({ manual_stop: true }); errors.recorder.start()
  const pending = errors.recorder.stop(), rejected = assert.rejects(pending, /failed/)
  errors.native.onerror({ error: new Error('private diagnostic') })
  await rejected; errors.native.complete()
  assert.equal(errors.track.stopped, 1); assert.equal(errors.clock.pending(), 0)
  await assert.rejects(errors.recorder.stop(), /failed/)
})

test('a recorder that never emits stop cannot leave the review flow pending forever', async () => {
  const subject = await setup({ manual_stop: true }); subject.recorder.start()
  const pending = subject.recorder.stop(), rejected = assert.rejects(pending, { name: 'TimeoutError' })
  await subject.clock.advance(7999); assert.equal(subject.clock.pending(), 1)
  await subject.clock.advance(1); await rejected
  subject.native.complete()
  assert.equal(subject.track.stopped, 1); assert.equal(subject.clock.pending(), 0)
})

test('cancel while finishing or recording removes handlers, stops tracks and rejects pending work', async () => {
  for (const mode of ['dispose', 'signal']) {
    const subject = await setup({ manual_stop: true }); subject.recorder.start()
    const pending = subject.recorder.stop(), rejected = assert.rejects(pending, { name: 'AbortError' })
    mode === 'dispose' ? subject.recorder.dispose() : subject.controller.abort()
    await rejected; subject.native.complete(); subject.recorder.dispose()
    assert.equal(subject.track.stopped, 1); assert.equal(subject.clock.pending(), 0)
    assert.equal(subject.native.onstop, null); assert.equal(subject.native.ondataavailable, null)
  }
  const subject = await setup(); subject.recorder.start(); subject.controller.abort()
  await assert.rejects(subject.recorder.stop(), { name: 'AbortError' }); assert.equal(subject.track.stopped, 1)
})

test('repeated stop does not replace the first result and a released stream cannot restart', async () => {
  const subject = await setup({ manual_stop: true }); subject.recorder.start()
  const first = subject.recorder.stop()
  await assert.rejects(subject.recorder.stop(), /not active/)
  subject.native.complete(); assert.equal((await first).blob.size > 0, true)
  assert.throws(() => subject.recorder.start(), /new recording/)
  assert.equal(subject.track.stopped, 1); assert.equal(subject.clock.pending(), 0)
})
