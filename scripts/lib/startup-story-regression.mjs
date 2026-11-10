// This driver uses real rendered state and can run unchanged in an isolated WKWebView.
export async function startup_story_regression(options = {}) {
  const { kind = 'accepted', require_trace = false, email = '', password = '', native = false, photo_blobs = [] } = options
  const checks = [], metrics = [], delay = ms => new Promise(resolve => setTimeout(resolve, ms)), key = 'cimoa_app_state_v2'
  const check = (value, message) => { if (!value) throw Error(`${message} (${location.hash})`); checks.push(message) }
  const current = selector => [...document.querySelectorAll(selector)].find(element => {
    const page = element.closest('uni-page'), bounds = element.getBoundingClientRect()
    return (!page || page === [...document.querySelectorAll('uni-page')].at(-1)) && bounds.width > 0 && bounds.height > 0 && getComputedStyle(element).display !== 'none' && getComputedStyle(element).visibility !== 'hidden'
  })
  const wait = async (predicate, message, count = 600) => { for (let index = 0; index < count; index++) { const value = predicate(); if (value) return value; await delay(16) } throw Error(`${message} (${location.hash})`) }
  const box = element => { const r = element.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height } }
  const raw = () => localStorage.getItem(key), before = raw(), original_write = Storage.prototype.setItem
  const trace = window.__startup_story_trace, phases = [], started = performance.now(), welcome_nodes = new Set()
  let writes = 0, observer
  Storage.prototype.setItem = function (name, value) { if (name === key) writes++; return original_write.call(this, name, value) }
  const record = () => {
    const welcome = current('.welcome-page')
    if (welcome) {
      welcome_nodes.add(welcome)
      const phase = welcome.dataset.startupPhase
      if (phase && phases.at(-1)?.phase !== phase) phases.push({ phase, at: performance.now() })
    }
  }
  const verify_main_tabs = async label => {
    const skeleton = name => current(`[data-skeleton="${name}"]`)
    const finish_skeleton = async name => {
      const placeholder = await wait(() => skeleton(name), `${label}: ${name} did not consume its first content skeleton`)
      const at = performance.now()
      check(!!current('.tabbar') && !!current(name === 'home' ? '.home-header' : name === 'discover' ? '.discover-header' : '.events-header'), `${label}: ${name} keeps its Header and Tabbar available during the skeleton`)
      if (name === 'discover') check(placeholder.querySelectorAll('.discover-photo-card').length === 3, `${label}: first Discover visit still uses the real three-layer deck skeleton`)
      await wait(() => !skeleton(name), `${label}: ${name} skeleton added unbounded waiting`)
      const elapsed = performance.now() - at
      check(elapsed >= 350 && elapsed < 1000, `${label}: ${name} retains its approximately 600ms first-content skeleton`)
      metrics.push({ stage: `${label}-${name}-skeleton`, observed_remaining_ms: elapsed })
    }
    await wait(() => current('.home-header'), `${label} did not clear the stack into Home`)
    check(location.hash.endsWith('/pages/home/index') && current('.main-tab-frame')?.dataset.pageDepth === '1', `${label} opens Home as the single root page`)
    await finish_skeleton('home')
    const bytes = raw(), write_count = writes
    for (const [name, id] of [['Discover', 'discover'], ['Events', 'events']]) {
      current(`.tabbar [aria-label="${name}"]`).click()
      await wait(() => location.hash.endsWith(`/pages/${id}/index`), `${label}: ${name} Tab did not navigate`)
      await finish_skeleton(id)
    }
    for (const name of ['Home', 'Discover', 'Events', 'Home']) {
      const id = name.toLowerCase()
      current(`.tabbar [aria-label="${name}"]`).click()
      await wait(() => location.hash.endsWith(`/pages/${id}/index`) && current(`.tabbar [aria-label="${name}"][aria-current="page"]`), `${label}: warm ${name} Tab did not restore`)
      await delay(280)
      check(!skeleton(id) && current('.main-tab-frame')?.dataset.pageDepth === '1', `${label}: warm ${name} return does not repeat the skeleton or grow the page stack`)
    }
    check(raw() === bytes && writes === write_count, `${label}: Tab switches preserve account, relationship, chat and coin persistence bytes`)
  }
  try {
    const splash = await wait(() => current('.splash-page'), 'The startup page did not mount')
    check(splash.dataset.startupPhase === 'gathering', 'Startup exposes its ephemeral arc-gathering phase')
    check(splash.querySelectorAll('.splash-arc-particle').length === 2, 'The brand arc has exactly two cyan/pink gathering lights')
    const progress = splash.querySelector('.splash-progress')
    check(!!progress && getComputedStyle(progress).backgroundImage.includes('gradient'), 'The existing colorful progress bar remains visible during startup')
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      check(getComputedStyle(progress).animationName === 'none', 'Reduced motion stops the repeated progress sweep')
      check([...splash.querySelectorAll('.splash-arc-particle')].every(element => getComputedStyle(element).animationName === 'none'), 'Reduced motion disables arc particle travel')
    }
    observer = new MutationObserver(record); observer.observe(document.documentElement, { attributes: true, childList: true, subtree: true }); record()
    if (kind === 'corrupt') {
      const error = await wait(() => current('.splash-error'), 'Corrupt storage did not preserve the real startup Retry')
      check(/Retry/.test(error.innerText), 'Corrupt storage presents Retry rather than pretending that a session loaded')
      check(!current('.welcome-page,.home-header,.discover-deck,.events-header') && raw() === before && writes === 0, 'Storage failure does not expose protected content or rewrite the damaged state')
      return { passed: true, kind, checks, route: location.hash, storage_writes: writes }
    }
    if (['valid', 'verification', 'onboarding', 'complete'].includes(kind)) {
      const selector = kind === 'valid' ? '.home-header' : kind === 'verification' ? '.verification-page' : kind === 'complete' ? '.onboarding-complete-page' : '.onboarding-uni-page'
      const target = await wait(() => current(selector), 'Startup did not resume its true account destination')
      check(location.hash.includes(kind === 'valid' ? '/pages/home/index' : kind === 'verification' ? '/pages/auth/verification/code' : kind === 'complete' ? '/pages/onboarding/complete' : '/pages/onboarding/uni'), 'Startup follows the authenticated account or unfinished setup step')
      if (kind === 'valid') await verify_main_tabs('Recovered session')
      else check(!/009789|Show code again/.test(target.innerText), 'Setup recovery does not disclose the built-in verification code')
      check(raw() === before && writes === 0, 'Session recovery and startup presentation do not mutate account, relationship, message or coin data')
      if (kind === 'complete') {
        const store = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('app')
        check(store.onboarding?.step === 'complete' && !store.onboarding.completed && photo_blobs.length >= 2, 'The registration completion fixture has genuinely finished all prerequisite steps, without submitting Complete')
        // Isolated QA fixture media is restored to the real repository. The page
        // still performs its own Blob ownership, size, MIME and image decode checks.
        await new Promise((resolve, reject) => {
          const request = indexedDB.open('cimoa_media_v2', 1)
          request.onupgradeneeded = () => request.result.createObjectStore('blobs')
          request.onerror = () => reject(Error('Isolated completion photos could not be opened'))
          request.onblocked = () => reject(Error('Isolated completion photo storage is blocked'))
          request.onsuccess = () => {
            const db = request.result, transaction = db.transaction('blobs', 'readwrite')
            for (const item of photo_blobs) transaction.objectStore('blobs').put(new Blob([Uint8Array.from(atob(item.base64), character => character.charCodeAt(0))], { type: item.mime }), item.media_id)
            transaction.oncomplete = () => { db.close(); resolve() }
            transaction.onerror = transaction.onabort = () => { const cause = transaction.error; db.close(); reject(Error(`Isolated completion photos could not be restored: ${cause?.name || 'UnknownError'}: ${cause?.message || 'No transaction detail'}`)) }
          }
        })
        const submit = target.querySelector('[data-interaction="obComplete.enterApp.click.1"]')
        await delay(280)
        const at = performance.now(); submit.click(); submit.click()
        await wait(() => current('.brand-action-loading'), 'Registration completion omitted its existing write progress')
        check(writes === 0 && raw() === before, 'Registration completion displays progress before committing the final profile step')
        await wait(() => current('.home-header'), 'Registration completion did not enter Home')
        check(performance.now() - at >= 400 && writes === 1, 'Repeated completion activation commits once after the existing 500ms write wait')
        check(store.onboarding.completed && store.current_user.verification_status === 'pending' && store.coin_balance === 0, 'Completion keeps the new account identity, pending student status and zero balance')
        await verify_main_tabs('Registration completion')
        const previous = JSON.parse(before).data, next = JSON.parse(raw()).data
        check(['relationships', 'requests', 'conversations', 'messages', 'coin_transactions', 'memberships', 'media_files', 'profile_photos'].every(name => JSON.stringify(previous[name]) === JSON.stringify(next[name])), 'Completing registration does not invent connections, chats, coins, event joins or replacement photos')
      }
      if (kind === 'valid') {
        const home = await wait(() => current('.home-header'), 'Recovered session did not retain Home'); await delay(280)
        home.querySelector('[data-interaction="home.openMe.click.1"]').click()
        const profile = await wait(() => current('.profile-header'), 'Home did not open the current account profile'); await delay(280)
        profile.querySelector('[data-interaction="profile.openAppSettings.click.1"]').click()
        const settings = await wait(() => current('.settings-page'), 'Profile did not open its real Settings'); await delay(280)
        settings.querySelector('[data-interaction="settings.openLogoutConfirm.click.1"]').click()
        const confirm = await wait(() => current('[data-interaction="sheetLogout.logOut2.click.1"]'), 'Log Out did not use its existing confirmation')
        confirm.click(); await wait(() => current('.brand-action-loading'), 'Confirmed logout did not retain its real write progress')
        check(writes === 0 && raw() === before, 'Logout still waits for the existing write-loading contract before changing the session')
        const returned = await wait(() => current('.welcome-page'), 'Confirmed logout did not return to Welcome')
        await delay(300)
        check(returned.dataset.startupPhase === 'warm' && !returned.querySelector('.welcome-campus-halo'), 'Logging out after direct session recovery does not play the unused cold-start campus expansion')
        check(!current('.eula-dialog') && writes === 1, 'Warm logout preserves consent and commits only the requested logout')
        const old_data = JSON.parse(before).data, next_data = JSON.parse(raw()).data
        check(['accounts', 'users', 'relationships', 'requests', 'conversations', 'messages', 'coin_transactions'].every(name => JSON.stringify(old_data[name]) === JSON.stringify(next_data[name])), 'Logout preserves profile, relationship, chat and coin entities')
      }
      return { passed: true, kind, checks, metrics, route: location.hash, storage_writes: writes }
    }
    const welcome = await wait(() => current('.welcome-page'), 'Guest startup did not reach Welcome')
    const region = welcome.querySelector('.welcome-photo-region'); let image = welcome.querySelector('.welcome-photo')
    // The source cRise moves the complete page by 14px; compare the photo in
    // that page's coordinates so its intentional route motion is not a jump.
    const photo_box = () => { const region_box = box(region), page_box = box(welcome.querySelector('.page-transition')); return { ...region_box, x: region_box.x - page_box.x, y: region_box.y - page_box.y } }
    const first_box = photo_box()
    check(!!region && !!image, 'Campus pixels use the existing final photo region without adding a layout layer')
    const arrival = performance.now()
    check(arrival - started < 2900, 'Welcome arrival stays inside the established startup/paint handoff without an extra photo wait')
    if (kind === 'background') {
      check(['waiting', 'running'].includes(welcome.dataset.startupPhase), 'The lifecycle diagnostic interrupts the actual unfinished Welcome presentation')
      const visibility = Object.getOwnPropertyDescriptor(document, 'visibilityState'), hidden = Object.getOwnPropertyDescriptor(document, 'hidden')
      let is_hidden = true
      try {
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => is_hidden ? 'hidden' : 'visible' })
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => is_hidden })
        document.dispatchEvent(new Event('visibilitychange')); await delay(180)
        check(!current('.eula-dialog.event-dialog--open'), 'An interrupted hidden presentation does not reveal the EULA prematurely')
        check(raw() === before && writes === 0, 'Diagnostic backgrounding does not create consent, account or business writes')
        is_hidden = false; document.dispatchEvent(new Event('visibilitychange'))
        await wait(() => current('.eula-dialog.event-dialog--open') && welcome.dataset.startupPhase === 'complete', 'Visible restoration did not finish Welcome and expose its first EULA')
        check(!!current('.eula-dialog.event-dialog--open') && welcome.dataset.startupPhase === 'complete', 'The first interrupted presentation really restores its complete page and visible EULA before the subsequent warm cycle')
        const runs = phases.filter(item => item.phase === 'running').length
        is_hidden = true; document.dispatchEvent(new Event('visibilitychange')); await delay(80)
        is_hidden = false; document.dispatchEvent(new Event('visibilitychange')); await delay(300); record()
        check(phases.filter(item => item.phase === 'running').length === runs, 'A subsequent warm foreground restoration does not replay the campus expansion')
        check(welcome.querySelector('.welcome-consent-toggle').getAttribute('aria-checked') === 'false' && writes === 0, 'Restored EULA still requires explicit manual acceptance')
      } finally {
        if (visibility) Object.defineProperty(document, 'visibilityState', visibility); else delete document.visibilityState
        if (hidden) Object.defineProperty(document, 'hidden', hidden); else delete document.hidden
        document.dispatchEvent(new Event('visibilitychange'))
      }
    }
    if (kind === 'slow') {
      check(welcome.dataset.campusStatus === 'loading', 'A slow campus image remains an honest content-only loading state')
      check(+getComputedStyle(image).opacity < .01, 'An undecoded campus image is not flashed before its pixels are ready')
    }
    if (kind === 'failure') {
      const retry = await wait(() => [...welcome.querySelectorAll('[role="button"]')].find(element => /Retry photo/.test(element.innerText)), 'Failed campus image did not expose Retry photo')
      check(welcome.dataset.campusStatus === 'error', 'A real image failure is not reported as a ready campus photo')
      check(!current('.brand-action-loading'), 'Campus failure does not add a Loading Toast or block the app startup')
      retry.click()
    }
    if (['guest', 'native-delay', 'slow'].includes(kind)) {
      const eula = await wait(() => current('.eula-dialog.event-dialog--open'), 'First-launch EULA did not appear after the page was actually presented')
      check(welcome.dataset.startupPhase === 'complete' || welcome.dataset.startupPhase === 'warm', 'EULA waits until the campus presentation has settled')
      if (kind === 'slow') check(welcome.dataset.campusStatus === 'loading', 'Slow image networking does not delay the real EULA or Welcome readiness')
      check(!!eula && raw() === before && writes === 0, 'Showing first-launch EULA does not implicitly consent or write business data')
      if (require_trace && native) {
        check(trace.native_requests.length === 1 && trace.native_acks.length === 1, 'Native startup dispatches and acknowledges finishLaunch exactly once')
        check(trace.eula_opens[0] >= trace.native_acks[0], 'EULA is rendered only after the genuine native fade-completion acknowledgment')
        check(trace.native_acks[0] - trace.native_requests[0].at >= 230, 'The diagnostic native cover uses the real 240ms handoff window before acknowledging completion')
        check(trace.early_eula === false, 'No EULA frame is shown while the native launch cover is still present')
      }
      if (kind === 'guest') {
        const click = id => welcome.querySelector(`[data-interaction="${id}"]`).click()
        click('welcome.eula.decline.click.1'); await wait(() => !current('.eula-dialog'), 'Not Now did not close the consent dialog')
        const checkbox = welcome.querySelector('.welcome-consent-toggle')
        check(checkbox.getAttribute('aria-checked') === 'false', 'Declining EULA leaves the Welcome checkbox unselected')
        click('welcome.goLogin.click.1'); await delay(60)
        check(location.hash.endsWith('/pages/auth/welcome') && writes === 0, 'Login cannot bypass the unchecked consent gate')
        checkbox.click(); await wait(() => current('.eula-dialog.event-dialog--open'), 'The unified checkbox did not reopen the same EULA')
        check(writes === 0, 'Reopening the EULA does not silently accept its content')
      }
    }
    await wait(() => welcome.dataset.campusStatus === 'ready', 'Campus image did not complete its genuine decode/retry', 900)
    await wait(() => welcome.dataset.startupPhase === 'complete' || welcome.dataset.startupPhase === 'warm', 'The campus handoff did not complete')
    image = welcome.querySelector('.welcome-photo')
    const real_image = image.querySelector('img')
    check(!!real_image && real_image.complete && real_image.naturalWidth > 0, 'The campus reveal contains real successfully decoded image pixels')
    await wait(() => +getComputedStyle(image).opacity > .99, 'Campus photo did not finish its gentle in-place reveal')
    const ready_box = photo_box()
    for (const field of ['x', 'y', 'width', 'height']) check(Math.abs(first_box[field] - ready_box[field]) < 1.1, `Campus ${field} does not change across image readiness`)
    check(!current('.brand-action-loading,.brand-action-blocker'), 'Startup presentation adds no business Loading Toast or interaction blocker')
    if (reduced) {
      const halo = welcome.querySelector('.welcome-campus-halo')
      check(!halo || getComputedStyle(halo).animationName === 'none', 'Reduced motion disables the expanding campus halo')
      const root = welcome.querySelector('.page-transition'), frames = root.getAnimations().flatMap(animation => animation.effect?.getKeyframes() || [])
      check(frames.every(frame => !frame.transform || frame.transform === 'none'), 'Reduced-motion startup keeps only the original-position fade')
    }
    if (require_trace) {
      const decoded = trace.decodes.find(item => item.url.includes('welcome-campus.png') && item.ended)
      const resource = performance.getEntriesByType('resource').find(item => item.name.includes('welcome-campus.png'))
      check(!!resource && resource.startTime < trace.welcome_at, 'Campus photo networking starts in parallel with startup rather than waiting for Welcome')
      check(!!decoded, 'The campus photo uses a real successful image decode rather than a timer-only reveal')
      if (!['slow', 'failure'].includes(kind)) check(decoded.started < trace.welcome_at, 'An available campus photo decodes before the welcome handoff')
      check(trace.welcome_at - trace.splash_at <= 2600, 'Observed automatic startup transition does not add a new image/loading delay')
      check(trace.eula_opens.every(at => !native || trace.native_acks.some(ack => ack <= at)), 'Observed consent frames are gated on native handoff completion')
      metrics.push({ stage: 'trace', trace })
    }
    check(raw() === before && writes === 0, 'All presentation-only phases preserve the exact persisted business bytes')
    if (kind === 'guest') {
      const accept = welcome.querySelector('[data-interaction="welcome.eula.accept.click.1"]')
      accept.click(); accept.click()
      await wait(() => current('.brand-action-loading'), 'Explicit EULA agreement did not retain the existing business write progress')
      check(writes === 0 && raw() === before, 'Agreeing shows the real progress feedback before the consent write')
      await wait(() => !current('.eula-dialog') && welcome.querySelector('.welcome-consent-toggle')?.getAttribute('aria-checked') === 'true', 'Accepted EULA did not synchronize the unified Welcome checkbox')
      check(writes === 1, 'Repeated explicit agreement writes consent once without navigating on the user’s behalf')
      const old_data = JSON.parse(before).data, next_data = JSON.parse(raw()).data
      check(['accounts', 'users', 'relationships', 'requests', 'conversations', 'messages', 'coin_transactions'].every(name => JSON.stringify(old_data[name]) === JSON.stringify(next_data[name])), 'Explicit consent changes neither profile nor relationships, chats or coins')
    }
    if (['accepted', 'reduced'].includes(kind)) {
      const snapshot_phase_count = phases.filter(item => item.phase === 'running').length
      welcome.querySelector('[data-interaction="welcome.goLogin.click.1"]').click()
      const login = await wait(() => current('.login-page'), 'Welcome could not open the existing Login page')
      await delay(280); login.querySelector('[data-interaction="login.goBack.click.1"]').click()
      await wait(() => current('.welcome-page'), 'Login Back did not return to its true Welcome source')
      await delay(300); record()
      check(welcome_nodes.size === 1 && current('.welcome-page') === welcome, 'Warm Login Back restores the same Welcome page and geometry')
      check(phases.filter(item => item.phase === 'running').length === snapshot_phase_count, 'Warm return does not replay the campus expand animation')
      check(!current('.eula-dialog') && writes === 0 && raw() === before, 'Warm return neither reopens accepted EULA nor rewrites its account data')
    }
    if (kind === 'login') {
      welcome.querySelector('[data-interaction="welcome.goLogin.click.1"]').click()
      const login = await wait(() => current('.login-page'), 'Login entry is unavailable')
      const type = (label, value) => {
        const input = [...login.querySelectorAll('input')].find(element => element.getAttribute('aria-label') === label || element.closest('[aria-label]')?.getAttribute('aria-label') === label)
        check(!!input, `${label} remains an editable manual input`)
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value)
        input.dispatchEvent(new Event('input', { bubbles: true }))
      }
      type('Email', email); type('Password', password); await delay(30)
      const submit = login.querySelector('[data-interaction="login.loginNow.click.1"]'); submit.click(); submit.click()
      await wait(() => current('.brand-action-loading'), 'Login did not retain its existing real write progress')
      check(raw() === before && writes === 0, 'Login progress is visible before the account/session write')
      await verify_main_tabs('Successful Login')
      check(writes === 1, 'Repeated Login activation commits the real session only once')
    }
    metrics.push({ stage: 'welcome', first_box, ready_box, phases, elapsed_ms: performance.now() - started })
    return { passed: true, kind, checks, metrics, route: location.hash, storage_writes: writes, native }
  } finally { observer?.disconnect(); Storage.prototype.setItem = original_write }
}
