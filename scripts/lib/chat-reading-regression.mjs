// Self-contained browser/WKWebView driver; all message injection uses the existing Store.
export async function chat_reading_regression({ kind = 'direct', mode = 'history' } = {}) {
  if (!['direct', 'group'].includes(kind)) throw Error('Unknown chat reading scenario')
  const checks = [], key = 'cimoa_app_state_v2', conversation_id = kind === 'direct' ? 'conversation_chloe' : 'group_picnic'
  const selector = kind === 'direct' ? '.direct-chat-page' : '.event-group-page'
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
  const wait = async (predicate, label) => {
    for (let index = 0; index < 240; index++) { const result = predicate(); if (result) return result; await delay(25) }
    throw Error('Chat reading timeout: ' + label + ' at ' + location.hash)
  }
  const check = (condition, label) => { if (!condition) throw Error(label); checks.push(label) }
  const current = query => [...document.querySelectorAll(query)].find(element => {
    const page = element.closest('uni-page'), pages = [...document.querySelectorAll('uni-page')]
    return (!page || page === pages.at(-1)) && element.getBoundingClientRect().height > 0 && getComputedStyle(element).visibility !== 'hidden'
  })
  const root = await wait(() => current(selector), 'current conversation')
  await document.fonts?.ready
  await Promise.all(root.getAnimations({ subtree: true }).filter(animation => animation.effect?.getTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => {})))
  const frame = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  const scroll = root.querySelector('.secondary-page-scroll .uni-scroll-view-scrollbar-hidden')
  check(!!scroll, `${kind}: the message list has one scroll viewport`)
  const metrics = () => ({ top: scroll.scrollTop, height: scroll.clientHeight, scrollHeight: scroll.scrollHeight, bottom_gap: scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight })
  const bytes = () => localStorage.getItem(key)
  const data = () => JSON.parse(bytes()).data
  const count = () => data().messages.filter(row => row.conversation_id === conversation_id).length
  const store = document.querySelector('#app')?.__vue_app__?.config.globalProperties.$pinia?._s.get('app') || root.__vueParentComponent?.appContext.config.globalProperties.$pinia?._s.get('app')
  check(!!store, `${kind}: the fixture uses the existing application Store`)
  window.__cimoaChatReading ||= {}
  const state = window.__cimoaChatReading[kind] ||= {}
  const remember = () => Object.assign(state, { top: scroll.scrollTop, bytes: bytes(), message_count: count() })
  const history = async () => {
    const before = bytes()
    const target = Math.floor((scroll.scrollHeight - scroll.clientHeight) * .4)
    check(target > scroll.clientHeight, `${kind}: the fixture supplies a genuinely long history (${JSON.stringify(metrics())})`)
    scroll.scrollTop = target
    scroll.dispatchEvent(new Event('scroll'))
    await wait(() => Math.abs(scroll.scrollTop - target) < 2, 'history scroll')
    await frame(); await delay(60)
    check(bytes() === before, `${kind}: scrolling through history makes no business write`)
    remember()
  }
  const unchanged = async label => {
    await frame(); await delay(60)
    check(Math.abs(scroll.scrollTop - state.top) <= 2, `${kind}: ${label} preserves the history reading position`)
    check(bytes() === state.bytes, `${kind}: ${label} makes no business write`)
  }
  const append = async label => {
    const body = `Controlled ${kind} ${label} append. ` + 'A new campus conversation message with enough lines to move the end of the list. '.repeat(8)
    const before = count(), operation_id = `chat_reading_${kind}_${label}`
    const result = kind === 'direct'
      ? await store.send_direct_message(conversation_id, body, null, operation_id)
      : await store.send_event_message('event_picnic', conversation_id, body, null, operation_id)
    check(result.success, `${kind}: a controlled Store append succeeds`)
    await wait(() => !!root.querySelector(`[id="${result.data}"]`), 'appended message render')
    check(count() === before + 1, `${kind}: the controlled append persists exactly one message`)
    return result.data
  }
  if (mode === 'history' || mode === 'initial') {
    const before = state.bytes || bytes()
    await wait(() => metrics().bottom_gap <= 3, 'initial entry reaches the actual tail')
    check(metrics().bottom_gap <= 3, `${kind}: first entry reaches the actual end of the history`)
    check(bytes() === before, `${kind}: entering or resizing the conversation makes no business write`)
    if (mode === 'history') await history(); else remember()
  } else if (mode === 'append-history') {
    const top = state.top
    await append('history')
    await frame(); await delay(60)
    check(Math.abs(scroll.scrollTop - top) <= 2, `${kind}: appending a new message while reading history does not jump to the end`)
    remember()
  } else if (mode === 'photo-ready') {
    const photo = root.querySelector(kind === 'direct' ? '.chat-image .profile-photo' : '.event-message-image .profile-photo')
    await wait(() => photo?.dataset.mediaStatus === 'ready', 'saved image decoded')
    const image = photo.querySelector('img')
    check(!!image && image.naturalWidth > 0, `${kind}: the saved photo is a real decoded image`)
    // A new blob-URL fragment triggers the real H5 image load callback again.
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error('Photo reload did not finish')), 6000)
      image.addEventListener('load', () => { clearTimeout(timer); resolve() }, { once: true })
      image.addEventListener('error', () => { clearTimeout(timer); reject(Error('Photo reload failed')) }, { once: true })
      image.src = image.src.split('#')[0] + '#chat-reading-' + kind
    })
    await unchanged('a completed photo load')
  } else if (mode === 'layout' || mode === 'return') {
    await unchanged(mode === 'layout' ? 'a viewport/keyboard layout change' : 'returning from a child page')
  } else if (mode === 'remember-history') {
    await history()
  } else if (mode === 'near-bottom') {
    scroll.scrollTop = scroll.scrollHeight - scroll.clientHeight - 24
    scroll.dispatchEvent(new Event('scroll'))
    await frame(); await delay(60)
    const top = scroll.scrollTop
    await append('near_bottom')
    await wait(() => metrics().bottom_gap <= 3, 'near-bottom append follows tail')
    check(scroll.scrollTop > top && metrics().bottom_gap <= 3, `${kind}: a new message follows the actual tail when already near it`)
    remember()
  } else if (mode === 'send-long') {
    await history()
    const input = root.querySelector('input'), text = 'A long message still needs its final line visible. '.repeat(45).slice(0, 2000)
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, text)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await frame()
    const before = bytes(), before_count = count()
    const send_id = kind === 'direct' ? 'chat.send.click.1' : 'evGroup.sendGroup.click.1'
    root.querySelector(`[data-interaction="${send_id}"]`).click()
    check(bytes() === before, `${kind}: sending still waits for the existing business Loading before writing`)
    await wait(() => count() === before_count + 1 && root.querySelector('input')?.value === '', 'long send commits and clears draft')
    await wait(() => metrics().bottom_gap <= 3, 'long send reaches tail')
    const last = [...root.querySelectorAll(kind === 'direct' ? '.chat-message' : '.event-message')].at(-1)
    check(last.getBoundingClientRect().height > scroll.clientHeight, `${kind}: the last message is taller than the scroll viewport`)
    check(metrics().bottom_gap <= 3, `${kind}: sending a long message reveals its final line rather than only its top`)
    check(data().messages.filter(row => row.conversation_id === conversation_id && row.body === text.trim()).length === 1, `${kind}: the long message is saved once`)
    remember()
  } else throw Error('Unknown chat reading driver mode: ' + mode)
  return { kind, mode, checks, metrics: metrics(), message_count: count() }
}
