import test from 'node:test'
import assert from 'node:assert/strict'
import { create_audio_playback } from '../src/utils/audioPlayback.js'
class AudioProbe extends EventTarget {
  static instance
  constructor() { super(); AudioProbe.instance = this; this.currentTime = 0; this.duration = 5; this.fail = false }
  play() { if (this.fail) return Promise.reject(new DOMException('Blocked', 'NotAllowedError')); this.dispatchEvent(new Event('play')); return Promise.resolve() }
  pause() { this.dispatchEvent(new Event('pause')) }
  removeAttribute() { this.src = '' }
  load() { this.loaded = true }
}
test('audio is prepared without autoplay, and play rejection is observable rather than a fake playing state', async () => {
  let plays = 0, released = 0
  const player = await create_audio_playback('indexeddb://voice', { play: () => plays++ }, { acquire: async () => ({ url: 'blob:voice', release: () => released++ }), AudioConstructor: AudioProbe })
  assert.equal(plays,0); assert.equal(AudioProbe.instance.preload,'metadata')
  AudioProbe.instance.fail = true; await assert.rejects(player.play(), /Playback was blocked/); assert.equal(plays,0)
  AudioProbe.instance.fail = false; await player.play(); assert.equal(plays,1)
  player.seek(8); assert.equal(AudioProbe.instance.currentTime,5); player.destroy(); player.destroy(); assert.equal(released,1); await assert.rejects(player.play(), /ended/)
})
test('real media time and lifecycle listeners are removed when releasing a player', async () => {
  let seconds = 0, pauses = 0
  const player = await create_audio_playback('/voice.wav', { time: value => { seconds = value }, pause: () => pauses++ }, { acquire: async () => ({ url: 'blob:voice', release() {} }), AudioConstructor: AudioProbe })
  AudioProbe.instance.currentTime = 2; AudioProbe.instance.dispatchEvent(new Event('timeupdate')); assert.equal(seconds,2)
  player.pause(); assert.equal(pauses,1); player.destroy(); assert.equal(pauses,1)
  AudioProbe.instance.currentTime = 4; AudioProbe.instance.dispatchEvent(new Event('timeupdate')); assert.equal(seconds,2)
})
