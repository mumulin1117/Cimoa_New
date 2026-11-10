// Self-contained driver shared by the browser runner and controlled WKWebView fixtures.
export async function ux_entry_flow_regression({ kind, action = 'inspect', visual_height = 500 } = {}) {
  if (!['basic', 'about', 'expired', 'runtime-expiry'].includes(kind) || !['inspect', 'back', 'continue'].includes(action)) throw Error('Invalid entry flow scenario')
  const checks = [], key = 'cimoa_app_state_v2'
  const check = (condition, message) => { if (!condition) throw Error(message); checks.push(message) }
  const delay = duration => new Promise(resolve => setTimeout(resolve, duration))
  const frame = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  const wait = async (predicate, message) => { for (let index = 0; index < 320; index++) { const value = predicate(); if (value) return value; await delay(25) } throw Error(message) }
  const current = selector => [...document.querySelectorAll(selector)].find(element => {
    const page = element.closest('uni-page'), pages = [...document.querySelectorAll('uni-page')]
    return (!page || page === pages.at(-1)) && element.getBoundingClientRect().height > 0 && getComputedStyle(element).visibility !== 'hidden'
  })
  const raw = () => localStorage.getItem(key), data = () => JSON.parse(raw()).data
  const box = element => { const rect = element.getBoundingClientRect(); return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, right: rect.right, bottom: rect.bottom } }
  const settle = async root => {
    await document.fonts?.ready
    await Promise.all(root.getAnimations({ subtree: true }).filter(animation => animation.effect?.getTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => {})))
    await frame()
  }

  if (kind === 'expired' || kind === 'runtime-expiry') {
    const before = raw(), originalNow = Date.now, welcomeRoots = new Set(), samples = []
    const capture = () => {
      for (const root of document.querySelectorAll('.welcome-page')) welcomeRoots.add(root)
      const guard = current('.main-setup-guard')
      if (guard) samples.push({ guard: guard.innerText, protected_content: !!current('.home-header,.home-content,.main-tab-scroll,.tabbar') })
    }
    const observer = new MutationObserver(capture)
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true })
    try {
      capture()
      if (kind === 'runtime-expiry') {
        const home = await wait(() => current('.home-content'), 'The authenticated Home fixture did not show its initial content')
        await settle(home)
        check(!!current('.home-header'), 'A valid session initially renders the authenticated Home header')
        check(home.innerText.trim().length > 0, 'The runtime expiry fixture starts with actual Home content')
        const expiry = data().session.expires_at
        check(Number.isFinite(expiry), 'The session uses a persisted expiry deadline')
        Date.now = () => expiry + 1
      }
      const welcome = await wait(() => current('.welcome-page'), 'The expired session did not return to Welcome without leaving the current Tab')
      await settle(welcome); capture()
      await delay(1200); capture()
      check(location.hash.split('?')[0] === '#/pages/auth/welcome', 'An expired session returns to the registered Welcome route')
      check(!current('.home-header,.home-content,.main-tab-scroll,.tabbar'), 'Welcome exposes no authenticated Tab header, content, scroll area or Tabbar')
      check(samples.every(sample => !sample.protected_content), 'No observed authentication guard retains the protected Tab content')
      check(welcomeRoots.size === 1, 'The expiry guard mounts Welcome once and does not repeat navigation on later ticks')
      check(!/navigation is already in progress/i.test(document.body.innerText), 'Concurrent expiry checks do not surface a navigation-lock error')
      check(raw() === before, 'Session expiry and redirect do not rewrite account, relationship or session data')
      const session = data().session
      check(!!session.account_id && !!session.current_user_id, 'Retained account IDs alone do not grant access after expiry')
      return { passed: true, kind, checks, route: location.hash, welcome_mounts: welcomeRoots.size, guard_samples: samples, controlled_clock: kind === 'runtime-expiry', writes: 0 }
    } finally { observer.disconnect(); Date.now = originalNow }
  }

  const root = await wait(() => current(`.onboarding-${kind}-page`), 'The intended incomplete onboarding step is unavailable')
  await settle(root)
  const before = raw(), originalSetItem = Storage.prototype.setItem, viewport = window.visualViewport
  check(!!viewport, 'The environment exposes a visual viewport for the controlled keyboard scenario')
  const descriptor = Object.getOwnPropertyDescriptor(viewport, 'height')
  let writes = 0
  Storage.prototype.setItem = function (name, value) { if (name === key) writes++; return originalSetItem.call(this, name, value) }
  const field = label => [...root.querySelectorAll('input,textarea')].find(input => input.getAttribute('aria-label') === label || input.closest('[aria-label]')?.getAttribute('aria-label') === label)
  const type = (input, value) => {
    check(!!input, 'The intended editable field is available')
    Object.getOwnPropertyDescriptor(input.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value').set.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  }
  try {
    let input
    if (kind === 'basic') {
      type(field('Display name'), 'Flow Member')
      const pick = label => [...root.querySelectorAll('.onboarding-chip')].find(element => element.innerText.trim() === label)?.click()
      pick('Self-describe'); pick('Add your own'); await frame()
      type(field('Describe your gender'), 'Questioning')
      type(field('Your pronouns'), 'they / them')
      input = field('Your pronouns')
    } else {
      input = field('About you')
      type(input, 'Campus conversations and quiet afternoons. '.repeat(8).slice(0, 300))
    }
    input.focus(); await frame()
    Object.defineProperty(viewport, 'height', { configurable: true, get: () => visual_height })
    viewport.dispatchEvent(new Event('resize'))
    await wait(() => root.classList.contains('onboarding-page--keyboard') && Math.abs(root.getBoundingClientRect().height - visual_height) < 1, 'The onboarding frame did not follow the measured keyboard viewport')
    const primary = root.querySelector('.onboarding-footer .auth-primary'), back = root.querySelector('.onboarding-back')
    check(!!primary && getComputedStyle(primary.parentElement).display !== 'none', 'Continue remains displayed while the keyboard viewport is reduced')
    const scroll = [...root.querySelectorAll('.secondary-page-scroll .uni-scroll-view')].find(element => element.scrollHeight > element.clientHeight + 1)
    check(!!scroll, 'The reduced viewport exposes the existing content scroll owner')
    scroll.scrollTop = scroll.scrollHeight
    if (kind === 'about') { input.scrollTop = input.scrollHeight; input.setSelectionRange(input.value.length, input.value.length) }
    await frame()
    const metrics = { viewport_height: viewport.height, emulated_keyboard: true, system_keyboard_tested: false, root: box(root), back: box(back), primary: box(primary), scroll: box(scroll), input: box(input), scroll_top: scroll.scrollTop, safe_bottom: getComputedStyle(root).getPropertyValue('--app-safe-bottom').trim() }
    check(metrics.primary.height > 0 && metrics.primary.y >= 0 && metrics.primary.bottom <= visual_height + 1, 'Continue remains inside the visible keyboard viewport')
    check(metrics.back.height > 0 && metrics.back.y >= 0 && metrics.back.bottom <= visual_height + 1, 'Back remains inside the visible keyboard viewport')
    check(metrics.safe_bottom === '0px', 'Keyboard layout removes the physical bottom safe area from its height budget')
    check(metrics.scroll_top > 0 && metrics.input.y >= metrics.scroll.y - 1 && metrics.input.bottom <= metrics.scroll.bottom + 1, 'The final editable field is reachable in the real content scroll area')
    const hit = element => { const rect = element.getBoundingClientRect(), point = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2); return point === element || element.contains(point) }
    check(hit(primary) && hit(back), 'The visible Continue and Back controls can receive pointer input')
    if (kind === 'about') {
      const counter = root.querySelector('.about-counter')
      metrics.counter = box(counter)
      check(/300\s*\/\s*300/.test(counter.innerText), 'The biography counter reflects the actual typed draft')
      check(metrics.counter.y >= metrics.scroll.y - 1 && metrics.counter.bottom <= metrics.scroll.bottom + 1, 'The biography counter is reachable above the fixed Continue control')
    }
    check(raw() === before && writes === 0, 'Typing, choices, keyboard layout and scrolling do not save profile data or advance progress')
    if (action === 'back') {
      back.click()
      await wait(() => current(kind === 'basic' ? '.verification-success-page' : '.onboarding-photos-page'), 'Back did not return to the registered prior setup step')
      check(raw() === before && writes === 0, 'Back preserves the persisted profile and onboarding progress')
    } else if (action === 'continue') {
      primary.click(); primary.click()
      await wait(() => current('.brand-toast[data-toast-tone="progress"]'), 'Continue did not show the existing profile progress before committing')
      check(raw() === before && writes === 0, 'Continue shows profile progress before the first write')
      await wait(() => current(kind === 'basic' ? '.onboarding-uni-page' : '.onboarding-interests-page'), 'Continue did not reach the next real onboarding step')
      const after = data(), account = after.accounts.find(row => row.account_id === after.session.account_id), user = after.users.find(row => row.user_id === after.session.current_user_id)
      check(writes === 1, 'Repeated Continue taps commit the profile step exactly once')
      check(account.onboarding.step === (kind === 'basic' ? 'uni' : 'interests') && account.onboarding.completed_steps.includes(kind), 'Only the submitted onboarding step advances')
      check(kind === 'basic' ? user.user_name === 'Flow Member' && user.gender === 'Questioning' && user.pronouns === 'they / them' : user.bio.length === 300, 'The next step reads the submitted profile draft from the Store')
    }
    return { passed: true, kind, action, checks, metrics, destination: location.hash, writes }
  } finally {
    Storage.prototype.setItem = originalSetItem
    if (descriptor) Object.defineProperty(viewport, 'height', descriptor)
    else delete viewport.height
    viewport.dispatchEvent(new Event('resize'))
  }
}
