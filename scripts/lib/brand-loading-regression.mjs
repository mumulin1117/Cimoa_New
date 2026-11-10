// Self-contained browser/WKWebView driver. Use only an isolated fixture store.
export async function brand_loading_regression({ mode = 'group', event_id = 'event_picnic', conversation_id = 'group_picnic', match_id = 'match_liam', profile_name = 'Cimoa Member', message = 'See you at the campus picnic.' } = {}) {
  const checks = [], metrics = [], key = 'cimoa_app_state_v2'
  const check = (value, label) => { if (!value) throw Error(label); checks.push(label) }
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
  const visible = element => { const box = element?.getBoundingClientRect(); return !!box && box.width > 0 && box.height > 0 && getComputedStyle(element).display !== 'none' && getComputedStyle(element).visibility !== 'hidden' }
  const current = selector => [...document.querySelectorAll(selector)].find(element => {
    const page = element.closest('uni-page'), pages = [...document.querySelectorAll('uni-page')]
    return (element.closest('#cimoa-toast-root') || !page || page === pages.at(-1)) && visible(element)
  })
  const wait = async (predicate, label) => { for (let i = 0; i < 320; i++) { const value = predicate(); if (value) return value; await delay(20) } throw Error(`${label} on ${location.hash}`) }
  const settled = async selector => {
    const root = await wait(() => current(selector), `Missing ${selector}`)
    await document.fonts?.ready
    await Promise.all(root.getAnimations({ subtree: true }).filter(animation => animation.effect?.getTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => {})))
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    return root
  }
  const raw = () => localStorage.getItem(key), data = () => JSON.parse(raw()).data
  const card = () => current('#cimoa-toast-root .brand-toast:not(.brand-toast-leave-active)')
  const blocker = () => current('#cimoa-toast-root .auth-notice-blocker,#cimoa-toast-root .brand-action-blocker')
  const tap = id => { const element = current(`[data-interaction="${id}"]`); check(!!element, `Visible action ${id}`); element.click(); return element }
  const repeat = element => { element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); element.click() }
  const fill = async (root, label, value) => {
    const find = () => root.querySelector(`input[aria-label="${label}"], [aria-label="${label}"] input`), input = find()
    check(!!input, `Editable ${label} input exists`)
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true })); await delay(0)
    // uni-input may replace its native input when disabled changes.
    return find
  }
  const formal = text => check(!/\b(?:saving|saved|local|demo|fixture|injected|records?|draft)\b|TypeError|ReferenceError|setItem/i.test(text), 'Feedback uses formal operation copy without implementation details')
  const geometry = (expected, scope) => {
    const element = card(), box = element.getBoundingClientRect(), style = getComputedStyle(element)
    const safe = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--native-safe-area-top')) || 0
    const message = element.querySelector('.brand-toast-message')?.textContent.trim()
    check(message === expected, `Exact operation label: ${expected}`); formal(message)
    check(document.querySelectorAll('#cimoa-toast-root').length === 1 && [...document.querySelectorAll('.brand-toast')].filter(visible).length === 1, 'Exactly one global brand feedback card is visible')
    check(!element.closest('uni-page,.page-transition,.event-dialog'), 'Busy card is outside page transforms, scroll regions and dialogs')
    check(element.classList.contains('brand-action-loading') && element.classList.contains('loading') && element.classList.contains(`${scope}-action-loading`) || scope === 'event' && element.classList.contains('brand-action-loading') && element.classList.contains('loading') && element.classList.contains('event-loading'), 'Global and business loading markers remain available')
    check(element.dataset.loadingScope === scope && element.dataset.toastTone === 'progress' && element.getAttribute('aria-busy') === 'true', 'Busy tone, accessibility and exact business scope are exposed')
    check(!element.querySelector('.brand-toast-close,[data-interaction="toast.dismiss.click.1"]') && !!blocker(), 'Busy feedback has a real input blocker and no dismiss control')
    check(box.top >= safe && box.top < safe + 90 && box.left >= -1 && box.right <= innerWidth + 1 && Math.abs(box.left + box.width / 2 - innerWidth / 2) <= 1, 'Card stays top-centered inside the measured safe area')
    check(style.backgroundImage.includes('gradient') && getComputedStyle(element.querySelector('.brand-toast-card')).backgroundColor.includes('rgba'), 'Card retains the gradient fine edge and translucent light surface')
    check(!!element.querySelector('.brand-progress-mark svg,svg.brand-progress-mark'), 'Busy feedback uses the shared SVG brand progress mark')
    const front = document.elementFromPoint(innerWidth / 2, innerHeight - 100)
    check(blocker()?.contains(front) || blocker() === front, 'Busy blocker receives pointer hits outside the card')
    check(!current('.loading-mask,.loading-card,.event-loading-ring,.profile-loading-ring,.coin-loading-ring,.uni-loading,.uni-toast__loading'), 'No legacy centered loading card, CSS ring or native spinner is visible')
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) check(element.querySelectorAll('.brand-progress-mark').length > 0 && !element.querySelector('.brand-progress-mark').getAnimations({ subtree: true }).some(animation => animation.playState === 'running' && animation.effect?.getTiming().iterations === Infinity), 'Reduced motion keeps the brand mark static')
    const result = { message, scope, safe_top: safe, viewport: { width: innerWidth, height: innerHeight }, rect: { x: box.x, y: box.y, width: box.width, height: box.height }, gradient: style.backgroundImage }
    metrics.push(result); return result
  }
  const initial = data(), before = raw(), original = Storage.prototype.setItem, writes = []
  const failing = mode.endsWith('_failure'); let started = 0
  Storage.prototype.setItem = function (name, value) { if (name === key) { writes.push({ elapsed: performance.now() - started }); if (failing) throw Error('Injected storage adapter failure for isolated brand loading regression') } return original.call(this, name, value) }
  const assert_delayed = async (expected, scope, control) => {
    await wait(() => card()?.getAttribute('aria-busy') === 'true', 'Busy brand card did not appear')
    await wait(() => +getComputedStyle(card()).opacity > .99, 'Busy card did not finish entering')
    geometry(expected, scope); repeat(control)
    const remaining = 275 - (performance.now() - started); if (remaining > 0) await delay(remaining)
    check(writes.length === 0 && raw() === before, 'Busy feedback precedes business writes through the existing 500ms delay')
    await wait(() => writes.length > 0 && !blocker(), 'Operation did not release its busy owner')
    check(writes.length === 1 && writes[0].elapsed >= 400, 'Rapid click and Enter attempt exactly one write after the required delay')
    await wait(() => !current('#cimoa-toast-root .brand-action-loading'), 'Completed operation left a stale busy card')
  }
  try {
    if (['group', 'group_failure', 'group_photo', 'group_voice'].includes(mode)) {
      const kind = mode === 'group_photo' ? 'image' : mode === 'group_voice' ? 'audio' : 'text'
      const root = await settled('.event-group-page'), input = kind === 'text' ? await fill(root, 'Message event group', message) : null
      check(initial.memberships.some(row => row.event_id === event_id && row.user_id === initial.session.current_user_id && row.status === 'joined'), 'Fixture grants real membership for this exact event')
      check(initial.messages.filter(row => row.conversation_id === conversation_id).every(row => row.read_by.includes(initial.session.current_user_id)), 'Fixture isolates sending from unread-status writes')
      if (kind !== 'text') check(!!current('[data-interaction="eventGroup.media.send.click.1"]'), 'Valid selected media is ready in the real review dialog')
      started = performance.now(); const control = tap(kind === 'text' ? 'evGroup.sendGroup.click.1' : 'eventGroup.media.send.click.1'); repeat(control)
      if (kind === 'audio') {
        const mark = await wait(() => current('.voice-send .chat-action-loading'), 'Group voice send has no inline brand progress')
        check(!!mark.querySelector('.brand-progress-mark svg,svg.brand-progress-mark') && !card() && !blocker(), 'Group voice shares the private studio inline mark without a second global busy card')
        repeat(control)
        await delay(250); check(writes.length === 0 && raw() === before, 'Inline group voice send keeps the established write wait')
        await wait(() => writes.length > 0 && !current('.voice-send .chat-action-loading'), 'Inline group voice send did not settle')
        check(writes.length === 1 && writes[0].elapsed >= 400, 'Repeated group voice activation attempts one delayed write')
      } else await assert_delayed(kind === 'image' ? 'Sending your photo…' : 'Sending your message…', 'event', control)
      if (failing) {
        await wait(() => card()?.dataset.toastTone === 'error', 'Failed message did not show brand error feedback'); formal(card().textContent)
        check(raw() === before && input()?.value === message, 'Failed group send preserves the full message draft and all persisted state')
      } else {
        await wait(() => kind === 'text' ? input()?.value === '' : !current('[data-interaction="eventGroup.media.send.click.1"]'), 'Successful send did not clear its draft')
        const after = data(), added = after.messages.filter(row => !initial.messages.some(old => old.message_id === row.message_id))
        check(added.length === 1 && added[0].conversation_id === conversation_id && added[0].kind === kind && added[0].body === (kind === 'text' ? message : ''), 'Exactly one message persists to the intended event group')
        if (kind !== 'text') {
          const media = after.media_files.find(row => row.media_id === added[0].media_id)
          check(after.media_files.length === initial.media_files.length + 1 && media?.kind === kind && media.owner_user_id === initial.session.current_user_id && media.byte_size > 0 && media.media_url === `indexeddb://${media.media_id}`, 'Message references one real, owned IndexedDB attachment without embedding its data in localStorage')
          if (kind === 'audio') check(media.duration_ms > 0 && media.duration_ms <= 120000, 'Voice message duration comes from the decoded recording')
        }
        check(after.revision === initial.revision + 1, 'Group send commits one revision')
      }
    } else if (mode === 'profile' || mode === 'profile_failure') {
      const root = await settled('.profile-basic-page'), input = await fill(root, 'Display name', profile_name)
      started = performance.now(); const control = tap('editBasic.saveBasic.click.1'); repeat(control)
      await assert_delayed('Updating your profile…', 'profile', control)
      if (failing) {
        await wait(() => card()?.dataset.toastTone === 'error', 'Failed profile update did not show brand error feedback'); formal(card().textContent)
        check(raw() === before && input()?.value === profile_name && !!current('.profile-basic-page'), 'Failed profile update retains editable draft, page and all persisted state')
      } else {
        await wait(() => card()?.dataset.toastTone === 'success', 'Successful profile update did not show its brand feedback')
        check(card().querySelector('.brand-toast-message').textContent.trim() === 'Profile updated', 'Success names the completed profile operation')
        check(data().users.find(row => row.user_id === initial.session.current_user_id).user_name === profile_name, 'Profile action persists the changed current-user name')
        check(data().revision === initial.revision + 1, 'Profile update commits one revision')
      }
    } else if (mode === 'match_pause' || mode === 'match_resume') {
      const pause = mode === 'match_pause', previous = pause ? 'searching' : 'paused', next = pause ? 'paused' : 'searching'
      await settled(`.auto-match-${previous}`)
      check(initial.match_sessions.some(row => row.match_id === match_id && row.status === previous), 'Control targets the persisted matching session')
      started = performance.now(); const control = tap(pause ? 'amSearching.pauseQueue.click.1' : 'amPaused.resumeQueue.click.1'); repeat(control)
      await assert_delayed(pause ? 'Pausing your search…' : 'Resuming your search…', 'event', control)
      await settled(`.auto-match-${next}`)
      check(data().match_sessions.find(row => row.match_id === match_id)?.status === next && data().revision === initial.revision + 1, 'Match transition updates the same session exactly once')
      check(JSON.stringify(data().coin_transactions) === JSON.stringify(initial.coin_transactions) && JSON.stringify(data().match_quota) === JSON.stringify(initial.match_quota), 'Pause/resume preserve coins and daily quota')
    } else if (mode === 'welcome') {
      await settled('.eula-dialog.event-dialog--open')
      started = performance.now(); const control = tap('welcome.eula.accept.click.1'); repeat(control)
      await assert_delayed('Confirming your agreement…', 'auth', control)
      await wait(() => !current('.eula-dialog.event-dialog--open'), 'Accepted agreement dialog did not close')
      check(!!data().app_consent.accepted_at && !data().session.current_user_id && data().revision === initial.revision + 1, 'Agreement consent commits once without creating an account session')
    } else if (mode === 'private_chat') {
      const root = await settled('.direct-chat-page'), input = await fill(root, 'Message', message)
      started = performance.now(); const control = tap('chat.send.click.1'); repeat(control)
      const mark = await wait(() => current('.chat-send .chat-action-loading'), 'Private send has no inline progress mark')
      check(!!mark.querySelector('.brand-progress-mark svg,svg.brand-progress-mark') && !card() && !blocker(), 'Private chat shares the brand SVG while preserving inline, nonblocking feedback')
      const header = root.querySelector('.chat-header'), rect = header.getBoundingClientRect()
      check(header.contains(document.elementFromPoint(rect.x + 20, rect.y + 20)), 'Private sending leaves the fixed header unobscured')
      await delay(250); check(writes.length === 0 && raw() === before, 'Inline private send keeps the required delay before writing')
      await wait(() => input()?.value === '' && !current('.chat-send .chat-action-loading'), 'Private send did not finish')
      const added = data().messages.filter(row => !initial.messages.some(old => old.message_id === row.message_id))
      check(writes.length === 1 && writes[0].elapsed >= 400 && added.length === 1 && added[0].body === message && added[0].conversation_id === conversation_id, 'Inline private send persists one correctly targeted message')
    } else throw Error(`Unknown brand loading mode: ${mode}`)
    check(!blocker() && !current('#cimoa-toast-root .brand-action-loading'), 'Completed flow releases global loading ownership and blocker')
    return { passed: true, mode, checks, metrics, write_attempts: writes.length, first_write_ms: writes[0]?.elapsed, actual_microphone_requested: false, route: location.hash }
  } finally { Storage.prototype.setItem = original }
}
