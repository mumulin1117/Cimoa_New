// Isolated browser/non-persistent WKWebView QA. Audio is generated in memory;
// this driver never opens a physical microphone and is not production code.
export async function voice_message_regression(options = {}) {
  const { kind = 'idle', capture = false, group = false } = options
  const conversation_id = group ? 'group_picnic' : 'conversation_chloe', composer = group ? '.event-group-composer' : '.chat-composer'
  const entry_id = group ? 'evGroup.recordGroupVoice.click.1' : 'chat.sendVoiceMsg.click.1', prefix = group ? 'eventGroup.media' : 'chat.media'
  const action_id = (action, index = 1) => `${prefix}.${action}.click.${index}`
  const preview_id = group ? 'eventGroup.media.voicePreview.click.1' : action_id('preview')
  const playback_id = group ? 'eventGroup.media.play.click.1' : action_id('play')
  const checks = [], trace = [{ label: 'driver.begin', kind, at: performance.now(), route: location.hash }], key = 'cimoa_app_state_v2'
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
  const current = selector => [...document.querySelectorAll(selector)].find(element => {
    const pages = [...document.querySelectorAll('uni-page')], page = element.closest('uni-page')
    return (!page || page === pages.at(-1)) && element.getBoundingClientRect().height > 0 && getComputedStyle(element).visibility !== 'hidden' && getComputedStyle(element).display !== 'none'
  })
  const check = (value, label) => { if (!value) throw Error(label); checks.push(label) }
  const wait = async (predicate, label, timeout = 10000) => {
    const until = performance.now() + timeout
    while (performance.now() < until) { const value = predicate(); if (value) return value; await delay(20) }
    throw Error(`${label}; state=${current('.chat-voice-sheet')?.dataset.voiceState}; text=${document.body.innerText.slice(-1200)}`)
  }
  const state = () => current('.chat-voice-sheet')?.dataset.voiceState
  const bytes = () => localStorage.getItem(key)
  const data = () => JSON.parse(bytes()).data
  const audio_messages = () => data().messages.filter(row => row.conversation_id === conversation_id && row.kind === 'audio')
  const activate = async (id, repeat = false) => {
    const element = await wait(() => current(`[data-interaction="${id}"]`), `Missing ${id}`)
    trace.push({ label: 'control.before', id, at: performance.now(), touch: !!options.touch_controls })
    if (options.touch_controls) {
      check(typeof window.__cimoaVoiceQATouch === 'function', 'Isolated browser provides a real Playwright touch adapter, not production code')
      // Separate actual touches to the record/stop control intentionally change
      // state, so only the send action is physically repeated during its lock.
      await window.__cimoaVoiceQATouch(id, repeat && id === action_id('send'))
    } else {
      element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch' })); element.click(); if (repeat) element.click()
    }
    await delay(25)
    trace.push({ label: 'control.after', id, at: performance.now(), state: state() || null })
    return element
  }
  const render_diagnostic = () => ({
    route: location.hash, hidden: document.hidden, visibility: document.visibilityState, focused: document.hasFocus(), fonts: document.fonts.status,
    active: { tag: document.activeElement?.tagName, interaction: document.activeElement?.getAttribute('data-interaction') || null },
    state: state() || null,
    animations: document.getAnimations().map(animation => ({
      state: animation.playState, pending: animation.pending, current_time: String(animation.currentTime),
      duration: String(animation.effect?.getTiming().duration), iterations: String(animation.effect?.getTiming().iterations),
      target: animation.effect?.target?.tagName || null, target_class: animation.effect?.target?.getAttribute('class') || null,
    })),
  })
  const settle_stage = async (stage, work) => {
    let timer
    trace.push({ label: `settle.${stage}.begin`, at: performance.now(), diagnostic: render_diagnostic() })
    try {
      await Promise.race([work(), new Promise((_, reject) => {
        timer = setTimeout(() => {
          const diagnostic = render_diagnostic()
          trace.push({ label: `settle.${stage}.timeout`, at: performance.now(), diagnostic })
          reject(Error(`Voice QA render settlement timed out after 3000ms at ${stage}; render_diagnostic=${JSON.stringify(diagnostic)}`))
        }, 3000)
      })])
      trace.push({ label: `settle.${stage}.end`, at: performance.now() })
    } finally { clearTimeout(timer) }
  }
  const settle = async () => {
    await settle_stage('fonts', () => document.fonts.ready)
    await settle_stage('animations', () => Promise.all(document.getAnimations().filter(animation => animation.effect?.getTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => {}))))
    await settle_stage('frames', () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  }
  const sheet_layout = () => {
    const panel = current('.chat-voice-sheet .event-dialog-panel'), rect = panel.getBoundingClientRect(), cancel = current('.voice-cancel').getBoundingClientRect(), heading = current('.voice-title'), help = current('.voice-subtitle')
    check(rect.left >= 0 && rect.right <= innerWidth + 0.5 && rect.top >= 0 && rect.bottom <= innerHeight + 0.5, 'Floating voice sheet stays inside the viewport')
    check(cancel.top >= rect.top && cancel.bottom <= rect.bottom + 0.5, 'Cancel remains reachable without covering the bottom safe area')
    check(panel.scrollWidth <= panel.clientWidth + 1 && document.documentElement.scrollWidth <= innerWidth + 1, 'Voice layout has no horizontal overflow')
    check(parseFloat(getComputedStyle(heading).fontSize) > parseFloat(getComputedStyle(help).fontSize), 'Title and supporting copy have a coherent typography hierarchy')
    const recipient = group ? data().events.find(event => event.event_id === 'event_picnic')?.title : 'Chloe Lin'
    check(current('.voice-recipient').innerText.includes(recipient), group ? 'Voice recipient comes from the current event entity' : 'Voice recipient comes from the current conversation participant')
    if (group) {
      check(current('.chat-voice-sheet').classList.contains('event-group-voice-sheet'), 'Event group uses the same voice studio with an explicit group context')
      check(!current('.voice-recipient').innerText.includes('Chloe Lin'), 'Event group recipient never leaks a private-conversation participant')
      const avatar = current('.voice-recipient-avatar'), cover = avatar.querySelector('.profile-photo'), avatar_rect = avatar.getBoundingClientRect(), cover_rect = cover?.getBoundingClientRect()
      check(cover_rect && Math.abs(cover_rect.x - avatar_rect.x) < 0.5 && Math.abs(cover_rect.y - avatar_rect.y) < 0.5 && Math.abs(cover_rect.width - avatar_rect.width) < 0.5 && Math.abs(cover_rect.height - avatar_rect.height) < 0.5, 'Event cover is strictly contained inside its recipient avatar and cannot cover the voice sheet')
      for (const selector of ['.voice-title', '.voice-close', '.voice-record', '.voice-play', '.voice-send', '.voice-cancel']) {
        const element = current(selector)
        if (!element) continue
        const target = element.getBoundingClientRect(), hit = document.elementFromPoint(target.x + target.width / 2, target.y + target.height / 2)
        check(element === hit || element.contains(hit), `Voice layer hit testing reaches ${selector} without a covering photograph or overlay`)
      }
    }
    check(panel.getAttribute('aria-label') === 'Voice message' && panel.getAttribute('aria-modal') === 'true', 'Voice sheet keeps dialog semantics and an explicit accessible title')
    check(!/\b(?:local|demo|saved)\b/i.test(panel.innerText), 'Voice sheet uses formal product copy')
    return { panel: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }, cancel_bottom: cancel.bottom, viewport: { width: innerWidth, height: innerHeight }, title_size: getComputedStyle(heading).fontSize, subtitle_size: getComputedStyle(help).fontSize }
  }
  const read_blobs = () => new Promise((resolve, reject) => {
    const request = indexedDB.open('cimoa_media_v2', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('blobs')
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const db = request.result, tx = db.transaction('blobs', 'readonly'), store = tx.objectStore('blobs'), keys = store.getAllKeys(), blobs = store.getAll()
      tx.oncomplete = () => { db.close(); resolve(keys.result.map((id, index) => ({ id, size: blobs.result[index]?.size, type: blobs.result[index]?.type }))) }
      tx.onerror = () => { db.close(); reject(tx.error) }
    }
  })
  await wait(() => current(composer), 'Chat composer did not mount')
  await wait(() => !current('.chat-read-progress .chat-action-loading'), 'Read status did not settle')
  await settle()
  const initial = bytes(), initial_audio = audio_messages().length, initial_blobs = await read_blobs()
  let devices = navigator.mediaDevices, original_descriptor, original_set = Storage.prototype.setItem, pending_resolve, generated = [], contexts = [], oscillators = [], mode = ['denied', 'missing'].includes(kind) ? kind : 'synth', writes = 0, timing = []
  const errors = [], on_error = event => { errors.push(String(event.error?.stack || event.message)); trace.push({ label: 'window.error', message: event.message, at: performance.now() }) }, on_rejection = event => { errors.push(String(event.reason?.stack || event.reason)); trace.push({ label: 'window.rejection', message: String(event.reason), at: performance.now() }) }
  addEventListener('error', on_error); addEventListener('unhandledrejection', on_rejection)
  const make_stream = async () => {
    const AudioContext = window.AudioContext || window.webkitAudioContext
    if (!AudioContext) throw Error('AudioContext unavailable for generated QA audio')
    const context = new AudioContext(), oscillator = context.createOscillator(), gain = context.createGain(), destination = context.createMediaStreamDestination()
    contexts.push(context); oscillators.push(oscillator); oscillator.frequency.value = 440; gain.gain.value = 0.12
    oscillator.connect(gain); gain.connect(destination); oscillator.start(); await context.resume(); generated.push(destination.stream)
    return destination.stream
  }
  const configure = () => {
    if (!devices) throw Error('MediaDevices unavailable for isolated capability injection')
    original_descriptor = Object.getOwnPropertyDescriptor(devices, 'getUserMedia')
    Object.defineProperty(devices, 'getUserMedia', { configurable: true, value: async constraints => {
      trace.push({ label: 'capture.request', mode, constraints, at: performance.now() })
      if (mode === 'denied') throw new DOMException('Denied by isolated QA', 'NotAllowedError')
      if (mode === 'missing') throw new DOMException('No device in isolated QA', 'NotFoundError')
      if (mode === 'late') return new Promise(resolve => { pending_resolve = resolve })
      return make_stream()
    } })
  }
  const open = async () => {
    trace.push({ label: 'open.before', kind, state: state() || null, at: performance.now() })
    if (!current('.chat-voice-sheet')) await activate(entry_id)
    await wait(() => state() === 'idle' && current('.chat-voice-sheet.event-dialog--open'), 'Voice idle did not open'); await settle()
    check(Number(getComputedStyle(current('.chat-voice-sheet .event-dialog-panel')).opacity) > 0.99, 'Voice sheet reaches its actual visible end frame before validation')
    check(bytes() === initial && audio_messages().length === initial_audio, 'Opening voice composer never publishes a message or writes business data')
  }
  const record_preview = async () => {
    await activate(action_id('record'), true); await wait(() => state() === 'recording', 'Generated stream did not enter real MediaRecorder recording')
    await delay(1350)
    await activate(action_id('record'), true); await wait(() => state() === 'preview', 'Recorded Blob did not decode into a preview')
    await wait(() => current('.voice-play')?.getAttribute('aria-busy') === 'false', 'Preview source did not prepare')
    await settle()
    check(generated.at(-1).getTracks().every(track => track.readyState === 'ended'), 'Stopping real MediaRecorder releases every capture track')
    check(Number(current('.voice-track').getAttribute('aria-valuemax')) > 1000, 'Preview duration is decoded from a real nonempty generated audio Blob')
    check(bytes() === initial && audio_messages().length === initial_audio, 'Recording and preview never persist a message')
  }
  try {
    if (kind === 'recovery') {
      check(initial_audio === 1 && initial_blobs.length === 1 && initial_blobs[0].size > 0, 'Refreshing restores one audio message and its IndexedDB Blob')
      const control = await wait(() => current(`[data-interaction="${playback_id}"][aria-busy="false"]`), 'Restored audio player not prepared')
      control.click(); await wait(() => current(`[data-interaction="${playback_id}"][aria-label="Pause voice message"]`), 'Restored audio cannot play')
      await delay(200); await activate(entry_id); await wait(() => state() === 'idle' && current('.chat-voice-sheet.event-dialog--open'), 'Voice sheet cannot reopen during message playback')
      await wait(() => current(`[data-interaction="${playback_id}"]`)?.getAttribute('aria-label') === 'Play voice message', 'Opening the voice composer did not pause existing message audio')
      check(current(`[data-interaction="${playback_id}"]`).getAttribute('aria-disabled') === 'true', 'Voice composer prevents existing message playback from being captured')
      await activate(action_id('dismiss')); await wait(() => !current('.chat-voice-sheet'), 'Recovery voice composer cannot close')
      check(bytes() === initial, 'Restored media playback performs no business write')
      return { passed: true, checks, blobs: initial_blobs, errors }
    }
    if (!['idle', 'reduce'].includes(kind)) configure()
    await open()
    let layout = sheet_layout()
    if (kind === 'idle' || kind === 'reduce') {
      check(!current('.voice-send') && !current('.voice-player'), 'Idle state cannot send nonexistent audio')
      if (kind === 'reduce') check(document.querySelector('.chat-voice-sheet').getAnimations({ subtree: true }).every(animation => animation.playState !== 'running' || animation.effect?.getTiming().iterations !== Infinity), 'Reduced motion has no perpetual voice-studio animation')
      return { passed: true, checks, layout, state: state(), errors }
    }
    if (kind === 'denied' || kind === 'missing') {
      mode = kind; await activate(action_id('record'))
      await wait(() => state() === 'error', 'Capability rejection did not produce a persistent voice error')
      check(current('.voice-error')?.innerText.includes(kind === 'denied' ? 'Microphone permission was denied.' : 'No microphone was found.'), 'Permission/device rejection is accurately explained without success feedback')
      check(bytes() === initial && !current('.voice-send'), 'Rejected microphone never creates audio or a send action')
      await activate(action_id('dismiss')); await wait(() => !current('.chat-voice-sheet'), 'Close X cannot dismiss a capability error')
      check(bytes() === initial, 'Dismissing a microphone error leaves business bytes unchanged')
      return { passed: true, checks, layout, trace, errors }
    }
    if (kind === 'late-cancel') {
      mode = 'late'; await activate(action_id('record')); await wait(() => state() === 'requesting' && pending_resolve, 'Pending microphone state did not appear')
      await activate(action_id('close', 2)); await wait(() => !current('.chat-voice-sheet'), 'Pending permission cannot be cancelled')
      const stream = await make_stream(); pending_resolve(stream); await delay(100)
      check(stream.getTracks().every(track => track.readyState === 'ended'), 'A microphone stream arriving after cancellation is stopped immediately')
      check(bytes() === initial && audio_messages().length === initial_audio, 'Late permission completion cannot publish audio or resurrect the sheet')
      await open(); check(state() === 'idle', 'Reopening after cancelled permission starts cleanly')
      await activate(action_id('dismiss')); await wait(() => !current('.chat-voice-sheet'), 'Reopened sheet cannot close')
      return { passed: true, checks, layout, trace, errors }
    }
    if (group && kind === 'access-cancel') {
      await activate(action_id('record')); await wait(() => state() === 'recording', 'Generated group capture did not start')
      await delay(300)
      const store = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('app')
      const result = store.leave_event('event_picnic')
      check(result.success, 'The authoritative Store accepts the event membership change')
      await wait(() => !current('.chat-voice-sheet') && !current(composer), 'Revoked group access did not dismiss the voice composer')
      check(generated.every(stream => stream.getTracks().every(track => track.readyState === 'ended')), 'Losing event membership immediately stops every recording track')
      check(audio_messages().length === initial_audio && (await read_blobs()).length === initial_blobs.length, 'Revoked group access never publishes draft audio or orphan media')
      check(data().messages.length === JSON.parse(initial).data.messages.length, 'Leaving the event cannot create a group or direct message')
      check(!!current('.event-page-state[role="alert"]'), 'Revoked group access leaves a readable permission error and available Back control')
      return { passed: true, checks, layout, trace, errors }
    }
    await record_preview(); layout = sheet_layout()
    await activate(preview_id); await wait(() => current('.voice-player')?.dataset.playing === 'true', 'Preview does not play real audio')
    await wait(() => Number(current('.voice-track')?.getAttribute('aria-valuenow')) > 100, 'Preview progress is not driven by real playback time')
    await activate(preview_id); await wait(() => current('.voice-player')?.dataset.playing === 'false', 'Preview pause did not stop audio')
    const paused = Number(current('.voice-track').getAttribute('aria-valuenow')); await delay(150)
    check(Math.abs(Number(current('.voice-track').getAttribute('aria-valuenow')) - paused) < 100, 'Paused progress stays stable instead of continuing a synthetic timer')
    check(bytes() === initial && (await read_blobs()).length === initial_blobs.length, 'Preview playback does not upload or persist its draft')
    if (group) check([...document.querySelectorAll(`[data-interaction="${preview_id}"]`)].filter(element => element.getBoundingClientRect().height > 0).length === 1, 'Group voice preview has one distinct action ID, separate from shared-photo and message-audio controls')
    if (kind === 'preview') return { passed: true, checks, layout, state: state(), trace, errors }
    if (kind === 'cancel' || kind === 'rerecord') {
      if (kind === 'rerecord') { await activate(action_id('record')); await wait(() => state() === 'recording', 'Record again did not start a new real capture'); check(generated.length === 2, 'Record again replaces the previous draft with a new capture') }
      await activate(action_id('close', 2)); await wait(() => !current('.chat-voice-sheet'), 'Cancel did not close voice composer'); await delay(50)
      check(generated.every(stream => stream.getTracks().every(track => track.readyState === 'ended')), 'Cancel and rerecord release all generated capture tracks')
      check(bytes() === initial && (await read_blobs()).length === initial_blobs.length, 'Cancel never leaves a message or orphan IndexedDB media')
      return { passed: true, checks, layout, trace, errors }
    }
    let fail_write = kind === 'send-retry'
    Storage.prototype.setItem = function (name, value) {
      if (name === key) { writes++; timing.push({ at: performance.now(), failed: fail_write }); if (fail_write) throw Error('Storage full') }
      return original_set.call(this, name, value)
    }
    const start = performance.now(); await activate(action_id('send'), true)
    check(state() === 'sending' && current('.voice-send .chat-action-loading'), 'Sending is visible in the branded primary action')
    if (group) check(!current('.brand-action-loading'), 'Group voice send uses the same inline primary-action feedback as private chat, without a second global overlay')
    check(bytes() === initial && writes === 0, 'Sending begins before any business persistence')
    check(current('.voice-play').getAttribute('aria-disabled') === 'true' && current('.voice-close').getAttribute('aria-disabled') === 'true', 'Sending disables preview and close without losing the draft')
    await delay(250); check(bytes() === initial && writes === 0, 'Send retains the required minimum 400 ms write wait')
    if (fail_write) {
      await wait(() => state() === 'preview' && current('.voice-error'), 'Send failure did not keep the preview available')
      check(bytes() === initial && audio_messages().length === initial_audio, 'Failed send leaves no partial message or business write')
      check((await read_blobs()).length === initial_blobs.length, 'Failed metadata persistence compensates its uploaded Blob')
      check(timing[0].at - start >= 400, 'Failure still occurs after the established write wait')
      fail_write = false; await activate(action_id('send'), true)
    }
    await wait(() => audio_messages().length === initial_audio + 1 && !current('.chat-voice-sheet'), 'Voice send did not finish exactly once')
    check(audio_messages().length === initial_audio + 1, 'Repeated confirm sends exactly one audio message')
    const message = audio_messages().at(-1), metadata = data().media_files.find(row => row.media_id === message.media_id), blobs = await read_blobs()
    check(metadata && metadata.media_url?.startsWith('indexeddb://') && blobs.length === initial_blobs.length + 1 && blobs.at(-1).size > 0, 'Success commits one canonical media entity and a real IndexedDB Blob')
    if (group) {
      const before = JSON.parse(initial).data, after = data()
      const mutable = new Set(['messages', 'media_files', 'conversations', 'operation_receipts', 'revision', 'updated_at'])
      for (const name of Object.keys(before).filter(name => !mutable.has(name))) check(JSON.stringify(after[name]) === JSON.stringify(before[name]), `Group voice sending leaves ${name} unchanged`)
      for (const name of ['messages', 'conversations']) check(JSON.stringify(after[name].filter(row => row.conversation_id !== conversation_id)) === JSON.stringify(before[name].filter(row => row.conversation_id !== conversation_id)), `Group voice sending cannot alter another conversation's ${name}`)
      const receipts = after.operation_receipts.filter(row => !before.operation_receipts.some(old => old.owner_user_id === row.owner_user_id && old.operation_id === row.operation_id))
      check(receipts.length === 1 && receipts[0].owner_user_id === after.session.current_user_id && receipts[0].result === message.message_id && receipts[0].fingerprint.includes('event-message') && receipts[0].fingerprint.includes(conversation_id), 'One group-scoped idempotency receipt points to the single published audio message')
      check(JSON.stringify(after.operation_receipts.filter(row => !receipts.includes(row))) === JSON.stringify(before.operation_receipts), 'Publishing voice preserves every previous operation receipt')
    }
    check(!/Saving message|Saving event group|saved locally/i.test(document.body.innerText), 'Normal voice send does not display obsolete technical Loading copy')
    check(errors.length === 0, 'Voice flow has no uncaught errors or rejected promises')
    if (options.touch_controls) check(trace.some(row => row.label === 'capture.request') && timing.length === 1, 'Actual touch recording, stop, playback, pause and repeated send complete one canonical audio message')
    return { passed: true, checks, layout, trace, timing, writes, blobs, message_id: message.message_id, media_id: message.media_id, errors }
  } catch (error) {
    error.voice_message_diagnostic = { kind, checks, trace, timing, writes, state: state(), generated: generated.map(stream => stream.getTracks().map(track => ({ state: track.readyState, muted: track.muted, enabled: track.enabled }))), contexts: contexts.map(context => ({ state: context.state, time: context.currentTime })), errors }
    error.message += '; voice_diagnostic=' + JSON.stringify(error.voice_message_diagnostic)
    throw error
  }
  finally {
    Storage.prototype.setItem = original_set
    if (original_descriptor) Object.defineProperty(devices, 'getUserMedia', original_descriptor)
    else if (devices && !['idle', 'reduce', 'recovery'].includes(kind)) delete devices.getUserMedia
    for (const stream of generated) stream.getTracks().forEach(track => track.stop())
    for (const oscillator of oscillators) try { oscillator.stop() } catch {}
    for (const context of contexts) await context.close().catch(() => {})
    removeEventListener('error', on_error); removeEventListener('unhandledrejection', on_rejection)
  }
}
