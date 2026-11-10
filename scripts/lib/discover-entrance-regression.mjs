// Self-contained so the exact same assertions can run in an isolated WKWebView.
// Diagnostic instrumentation belongs to the test runner, not the application.
export async function discover_entrance_regression(options = {}) {
  const { mode = 'first', front_id = 'user_zane', next_id = 'user_linden', first_photo = '/static/assets/discover/zane/photo-1.jpg', require_trace = false } = options
  const checks = [], metrics = [], delay = ms => new Promise(resolve => setTimeout(resolve, ms)), key = 'cimoa_app_state_v2'
  const check = (value, label) => { if (!value) throw Error(`${label} (${location.hash})`); checks.push(label) }
  const visible = element => { const r = element?.getBoundingClientRect(); return !!r && r.width > 0 && r.height > 0 && getComputedStyle(element).display !== 'none' && getComputedStyle(element).visibility !== 'hidden' }
  const current = selector => [...document.querySelectorAll(selector)].find(element => { const page = element.closest('uni-page'); return (!page || page === [...document.querySelectorAll('uni-page')].at(-1)) && visible(element) })
  const wait = async (predicate, label, count = 600) => { for (let i = 0; i < count; i++) { const value = predicate(); if (value) return value; await delay(16) } throw Error(`${label} (${location.hash})`) }
  const front = () => current('.discover-photo-card--front'), deck = () => current('.discover-deck'), photo = () => front()?.querySelector('.profile-photo')
  const quiet = () => !current('.brand-toast,.brand-action-loading,.brand-action-blocker,uni-toast,.loading-mask')
  const raw = () => localStorage.getItem(key), before = raw(), original_write = Storage.prototype.setItem
  const original_decode = HTMLImageElement.prototype.decode, decode_calls = []
  HTMLImageElement.prototype.decode = function (...args) { decode_calls.push(this.src); return original_decode.apply(this, args) }
  const skeleton_surface = () => {
    const probe = document.createElement('span')
    probe.style.cssText = 'position:fixed;width:1px;height:1px;visibility:hidden;background:var(--cimoa-surface-skeleton)'
    document.body.append(probe)
    const value = getComputedStyle(probe).backgroundColor; probe.remove(); return value
  }
  let writes = 0, observer, sweep_starts = 0
  const phases = [], skeleton_at = performance.now()
  Storage.prototype.setItem = function (name, value) { if (name === key) writes++; return original_write.call(this, name, value) }
  const sweep_start = event => { if (event.target?.closest?.('.discover-edge-sweep')) sweep_starts++ }
  document.addEventListener('animationstart', sweep_start, true)
  const observe = () => { const phase = deck()?.dataset.entrancePhase; if (phase && phases.at(-1)?.phase !== phase) phases.push({ phase, at: performance.now() }) }
  const rect = element => { const r = element.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom } }
  const local_rect = (element, parent) => { const a = rect(element), b = rect(parent); return { x: a.x - b.x, y: a.y - b.y, width: a.width, height: a.height } }
  const layout = () => {
    const card = front(), info = card.querySelector('.discover-info')
    return { width: card.offsetWidth, height: card.offsetHeight, radius: getComputedStyle(card).borderRadius, info: local_rect(info, card), name: local_rect(card.querySelector('.discover-name'), card), tags: [...card.querySelectorAll('.discover-tag')].map(tag => local_rect(tag, card)) }
  }
  const same_box = (a, b, label) => { for (const name of ['x', 'y', 'width', 'height']) check(Math.abs(a[name] - b[name]) <= 1.1, `${label} ${name} does not jump`) }
  const settled = () => wait(() => deck() && deck().dataset.settling === 'false' && deck().dataset.resetting === 'false', 'Card gesture did not settle')
  const pointer = (element, type, x, y) => element.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 79, pointerType: 'touch', isPrimary: true, button: 0, clientX: x, clientY: y }))
  const gesture = async ratio => {
    const element = front(), box = rect(element), x = box.x + box.width / 2, y = box.y + box.height / 2
    pointer(element, 'pointerdown', x, y)
    for (let step = 1; step <= 6; step++) { pointer(element, 'pointermove', x + box.width * ratio * step / 6, y); await delay(12) }
    pointer(element, 'pointerup', x + box.width * ratio, y)
    // Vue flushes the pointer-up state after this native DOM callback returns.
    // Observe that flush before polling the animation's eventual settled state.
    await delay(20); await settled(); await delay(40)
  }
  const warm_photo = label => {
    const media = photo(), image = media?.querySelector('uni-image') || media?.querySelector('img')
    check(media?.dataset.mediaStatus === 'ready' && front().dataset.skeletonCard === 'false', `${label} immediately exposes the already prepared photo without a new placeholder`)
    check(!!image && +getComputedStyle(image).opacity > .99, `${label} shows the warm photo at full local opacity on its first available frame`)
    const fades = image.getAnimations({ subtree: true }).filter(animation => animation.playState === 'running' && animation.effect?.getKeyframes().some(frame => Object.hasOwn(frame, 'opacity')))
    check(fades.length === 0, `${label} does not replay a photo-opacity transition`)
    metrics.push({ stage: label, photo_status: media.dataset.mediaStatus, opacity: getComputedStyle(image).opacity, transition_duration: getComputedStyle(image).transitionDuration, active_photo_fades: fades.length })
  }
  const tab = async name => {
    const button = current(`.tabbar [aria-label="${name}"]`)
    check(!!button, `${name} remains reachable`); button.click()
    await wait(() => location.hash.includes(`/pages/${name.toLowerCase()}/index`) && current(name === 'Discover' ? '.discover-deck' : '.home-header'), `${name} navigation did not finish`)
    if (name === 'Discover') warm_photo('Warm Tab return')
    await delay(310)
  }
  try {
    await wait(() => deck() && front(), 'Discover deck did not mount during its skeleton')
    const initial_deck = deck(), initial_card = front(), initial_layout = layout()
    check(initial_card.dataset.userId === front_id, 'The existing Store cursor selects the expected first person')
    check(initial_deck.dataset.skeleton === 'discover', 'The real deck is already mounted inside the existing first-entry skeleton')
    check([...initial_deck.querySelectorAll('.discover-photo-card')].map(card => card.dataset.deckDepth).join(',') === '2,1,0', 'Skeleton and content use the same ordered three-card DOM')
    check(initial_layout.tags.length === 3, 'All three real tag positions are occupied during the skeleton')
    check([...initial_deck.querySelectorAll('.discover-photo-card')].every(card => card.dataset.skeletonCard === 'true'), 'Each actual deck layer exposes its skeleton state')
    check(!!current('.discover-hero-header,.discover-header') && !!current('.tabbar'), 'Header and fixed Tabbar stay available during content loading')
    check(quiet(), 'First-entry skeleton does not create a Loading Toast or interaction blocker')
    observer = new MutationObserver(observe); observer.observe(initial_deck, { attributes: true, subtree: true, childList: true }); observe()
    metrics.push({ stage: 'skeleton', at: performance.now(), layout: initial_layout, card: rect(initial_card), deck: rect(initial_deck), photo_status: photo()?.dataset.mediaStatus })
    await wait(() => deck()?.dataset.skeleton !== 'discover', 'The existing 600ms skeleton did not finish')
    const skeleton_ended = performance.now(), skeleton_elapsed = skeleton_ended - skeleton_at
    check(deck() === initial_deck && front() === initial_card, 'Skeleton removal reveals the same deck and front-card nodes in place')
    const ready_layout = layout()
    check(ready_layout.width === initial_layout.width && ready_layout.height === initial_layout.height && ready_layout.radius === initial_layout.radius, 'Deck width, height and radius do not change when the skeleton ends')
    same_box(initial_layout.info, ready_layout.info, 'Profile copy'); same_box(initial_layout.name, ready_layout.name, 'Name')
    ready_layout.tags.forEach((tag, index) => same_box(initial_layout.tags[index], tag, `Tag ${index + 1}`))
    metrics.push({ stage: 'skeleton-ended', at: skeleton_ended, observed_remaining_skeleton_ms: skeleton_elapsed, layout: ready_layout, photo_status: photo()?.dataset.mediaStatus })
    if (mode === 'slow') {
      check(photo()?.dataset.mediaStatus === 'loading', 'A slow photo does not extend the 600ms content skeleton')
      check(photo()?.classList.contains('profile-photo--deck'), 'Slow photo keeps the Discover-specific light placeholder')
      check(getComputedStyle(photo()).backgroundColor === skeleton_surface() && front().dataset.skeletonCard === 'true', 'Slow photo uses the actual light theme surface while the real pixels are unavailable')
      check(!photo()?.querySelector('.profile-photo-loading'), 'Slow photo does not reveal the previous deep card or redundant spinner')
      check(front().dataset.userId === front_id && quiet(), 'Photo preparation does not skip a person or show a Loading Toast')
    }
    if (mode === 'failure') {
      const retry = await wait(() => front()?.querySelector('.photo-retry'), 'Failed front photo did not offer Retry photo')
      check(photo().dataset.mediaStatus === 'error' && /Retry photo/.test(retry.textContent), 'Photo failure exposes an honest, usable retry state')
      check(getComputedStyle(photo()).backgroundColor === skeleton_surface(), 'Photo failure retains a light theme surface rather than a deep empty card')
      check(front().dataset.userId === front_id && quiet(), 'Photo failure retains the same card without a global Toast')
      retry.click()
    }
    await wait(() => photo()?.dataset.mediaStatus === 'ready' && photo()?.dataset.mediaDecoded === 'true', 'Front photo did not finish real decode and reveal')
    const image = photo().querySelector('img')
    check(!!image && image.complete && image.naturalWidth > 0, 'The revealed photo has real decoded pixels, not a timer-only success')
    if (mode === 'interrupt') {
      await wait(() => deck()?.dataset.entrancePhase === 'running', 'Entrance did not start for touch-interruption coverage')
      const box = rect(front()), x = box.x + box.width / 2, y = box.y + box.height / 2
      pointer(front(), 'pointerdown', x, y)
      await delay(20)
      check(deck().dataset.entrancePhase === 'complete', 'First pointer contact immediately completes the entrance ownership')
      check(!deck().querySelector('.discover-edge-sweep')?.getAnimations({ subtree: true }).some(animation => animation.playState === 'running'), 'Touch immediately stops the one-off edge light')
      pointer(front(), 'pointerup', x, y)
      check(front().dataset.userId === front_id, 'Touch takeover alone never advances or changes the person')
    }
    await wait(() => deck()?.dataset.entrancePhase === 'complete', 'Deck entrance did not finish')
    await wait(() => +getComputedStyle(photo().querySelector('uni-image') || image).opacity > .99, 'Decoded photo did not finish its gentle fade')
    if (mode === 'reduced' || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      check(!phases.some(item => item.phase === 'running'), 'Reduced motion does not enter the fan/sweep phase')
      check(!deck().querySelector('.discover-edge-sweep')?.getAnimations({ subtree: true }).length, 'Reduced motion keeps the decorative edge sweep disabled')
    } else if (mode === 'first' || mode === 'slow') {
      check(phases.some(item => item.phase === 'running'), 'First entry runs the one-time gentle deck presentation')
      check(sweep_starts === 1 || (window.__discover_entrance_trace?.sweeps || 0) === 1, 'The decorative edge light sweeps exactly once')
    } else if (mode === 'failure') {
      check(!phases.some(item => item.phase === 'running') && sweep_starts === 0, 'Retry reveals the real photo without replaying a consumed decorative entrance')
    }
    const after = layout()
    same_box(initial_layout.info, after.info, 'Settled profile copy')
    check(front().dataset.userId === front_id, 'Entrance animation never advances the current person')
    const card_box = rect(front()), footer = rect(current('.discover-send')), bar = rect(current('.tabbar')), content = rect(current('.discover-content'))
    check(card_box.y >= content.y - 1 && card_box.bottom < footer.y && footer.bottom <= bar.y + 1, 'The full card, action and Tabbar fit one viewport without vertical browsing')
    check(document.documentElement.scrollWidth <= innerWidth && [...document.querySelectorAll('.main-tab-scroll .uni-scroll-view')].every(element => element.scrollTop === 0), 'First entry adds neither horizontal overflow nor a scrolling card view')
    metrics.push({ stage: 'ready', card: card_box, footer, tabbar: bar, phases: [...phases], sweep_starts })
    if (require_trace) {
      const trace = window.__discover_entrance_trace, end = trace?.skeleton_ends?.[0]
      check(!!trace && Number.isFinite(end), 'Runner observed the real first-entry skeleton lifetime')
      const duration = end - trace.skeleton_starts[0]
      check(duration >= 450 && duration <= 850, 'Observed first-entry skeleton remains approximately 600ms with no added waiting')
      const resource = performance.getEntriesByType('resource').find(item => item.name.includes(first_photo))
      check(!!resource && resource.startTime < end, 'The first photo request starts in parallel with the 600ms skeleton')
      if (!['slow', 'failure'].includes(mode)) {
        const decoded = trace.decodes.find(item => item.url.includes(first_photo) && item.ended)
        check(!!decoded && decoded.started < end && decoded.ended <= end, 'An available first photo loads and decodes before the original skeleton finishes')
      }
      metrics.push({ stage: 'trace', trace, first_photo_resource: resource?.toJSON?.() })
    }
    await gesture(.2)
    check(front().dataset.userId === front_id, 'A short 20% drag returns to the same person')
    await gesture(-.34)
    check(front().dataset.userId === next_id, 'A one-third horizontal drag advances exactly one existing person')
    const selected = front().dataset.userId, selected_photo = front().querySelector('.profile-photo img').src, running_before_return = window.__discover_entrance_trace?.running || 0
    const decodes_before_return = decode_calls.filter(url => url === selected_photo).length
    await tab('Home'); await tab('Discover')
    check(front().dataset.userId === selected && !deck().dataset.skeleton && ['idle', 'complete'].includes(deck().dataset.entrancePhase), 'Warm Tab return retains the chosen person without replaying skeleton or deck presentation')
    front().click(); await wait(() => current('.expanded-profile-page'), 'Card tap did not open the selected profile')
    check(location.hash.includes(selected), 'Card detail navigation carries the actual current user ID')
    await delay(310)
    const back = current('[data-interaction="expanded.collapse.click.1"]'); check(!!back, 'Profile preserves its existing Back ownership'); back.click()
    await wait(() => front() && location.hash.includes('/pages/discover/index'), 'Profile Back did not restore Discover')
    warm_photo('Warm profile Back'); await delay(310)
    check(front().dataset.userId === selected && !deck().dataset.skeleton && ['idle', 'complete'].includes(deck().dataset.entrancePhase), 'Profile Back retains card position and does not replay first entry')
    check((window.__discover_entrance_trace?.running || 0) === running_before_return, 'Warm returns never start a second fan/sweep cycle')
    check(decode_calls.filter(url => url === selected_photo).length === decodes_before_return, 'Warm Tab and profile returns reuse decoded current-person pixels without another decode')
    check(raw() === before && writes === 0, 'Loading, decode, gestures and warm navigation make zero business persistence writes')
    check(quiet(), 'Presentation and navigation never create a Loading Toast')
    return { passed: true, mode, checks, metrics, route: location.hash, current_user_id: selected, storage_writes: writes, actual_microphone_requested: false }
  } finally { observer?.disconnect(); document.removeEventListener('animationstart', sweep_start, true); Storage.prototype.setItem = original_write; HTMLImageElement.prototype.decode = original_decode }
}
