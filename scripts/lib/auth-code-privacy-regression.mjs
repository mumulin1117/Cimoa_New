export async function auth_code_privacy_regression({ kind, mode = 'inspect', code = '009789' } = {}) {
  if (!['registration', 'reset'].includes(kind) || !['inspect', 'verify'].includes(mode)) throw Error('Invalid authentication privacy scenario')
  const key = 'cimoa_app_state_v2', checks = [], selector = kind === 'registration' ? '.verification-page' : '.reset-code-page'
  const submitID = kind === 'registration' ? 'verCode.goVerSuccess.click.1' : 'fpCode.goFpNew.click.1'
  const targetSelector = kind === 'registration' ? '.verification-success-page' : '.reset-new-page'
  const check = (condition, message) => { if (!condition) throw Error(message); checks.push(message) }
  const wait = async (predicate, message) => { for (let index = 0; index < 240; index++) { const value = predicate(); if (value) return value; await new Promise(resolve => setTimeout(resolve, 25)) } throw Error(message) }
  const current = query => [...document.querySelectorAll(query)].find(element => {
    const page = element.closest('uni-page'), pages = [...document.querySelectorAll('uni-page')], rect = element.getBoundingClientRect()
    return (!page || page === pages.at(-1)) && rect.height > 0 && getComputedStyle(element).visibility !== 'hidden'
  })
  const frame = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  const box = element => { const value = element.getBoundingClientRect(); return { x: value.x, y: value.y, width: value.width, height: value.height, right: value.right, bottom: value.bottom } }
  const raw = () => localStorage.getItem(key), decode = value => JSON.parse(value).data
  const root = await wait(() => current(selector), 'The intended empty code page is unavailable')
  await document.fonts?.ready
  await Promise.all([...root.getAnimations({ subtree: true })].filter(animation => animation.effect?.getTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => {})))
  await frame()
  const input = root.querySelector('input'), submit = root.querySelector(`[data-interaction="${submitID}"]`), before = raw()
  check(!!input && !!submit, 'Manual code field and existing confirmation action remain available')
  check(input.value === '', 'Code field starts empty and never supplies the built-in code')
  const text = root.innerText, attributes = [...root.querySelectorAll('*')].flatMap(element => ['aria-label', 'title', 'placeholder'].map(name => element.getAttribute(name)).filter(Boolean))
  check(!/009789|show code again|your reset code is|code shown on the next screen|\bcode\s*:/i.test(text + '\n' + attributes.join('\n')), 'Visible copy, accessibility labels and placeholders do not disclose the built-in code or a reveal instruction')
  check(!root.querySelector('.verification-code-hint,.verification-info,.reset-resend,[data-interaction="fpCode.resend.click.1"]'), 'Removed reveal, resend and explanatory help controls are absent')
  check(!/(?:email|code|message) (?:has been |was |is )?sent|we(?:’ve|'ve| have) sent|check your (?:inbox|email)/i.test(text), 'Code entry does not claim that an email or message was sent')
  check(!root.querySelector('.auth-error-box[role="alert"]'), 'A fresh verification page has no manufactured failure or confirmation')
  const documentStyle = getComputedStyle(document.documentElement)
  const metrics = { kind, viewport: { width: innerWidth, height: innerHeight }, safe_area: { top: parseFloat(documentStyle.getPropertyValue('--native-safe-area-top')) || 0, bottom: parseFloat(documentStyle.getPropertyValue('--native-safe-area-bottom')) || 0 }, page: box(root), header: box(root.querySelector('.auth-header')), back: box(root.querySelector('.auth-back')), footer: box(root.querySelector('.auth-footer')), input: box(input), primary: box(submit), text, attributes, empty: input.value === '' }
  check(metrics.input.x >= -1 && metrics.input.right <= innerWidth + 1, 'Code entry fits the viewport without horizontal clipping')
  check(metrics.primary.width > 0 && metrics.primary.right <= innerWidth + 1, 'Confirmation action remains inside the viewport')
  check(metrics.header.y >= metrics.safe_area.top - 1 && metrics.back.y >= metrics.safe_area.top - 1 && metrics.back.bottom <= innerHeight - metrics.safe_area.bottom + 1, 'Header and Back remain below the actual injected top safe area')
  check(metrics.footer.bottom <= innerHeight - metrics.safe_area.bottom + 1 && metrics.primary.bottom <= innerHeight - metrics.safe_area.bottom + 1, 'Footer and confirmation action remain above the actual injected bottom safe area')
  check(raw() === before, 'Inspection leaves all persistent account data unchanged')
  if (mode === 'inspect') return { passed: true, kind, mode, checks, metrics }
  const stateBefore = decode(before), originalSetItem = Storage.prototype.setItem
  let writes = 0
  Storage.prototype.setItem = function (name, value) { if (name === key) writes++; return originalSetItem.call(this, name, value) }
  const type = value => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  }
  try {
    type('111111'); await frame(); submit.click()
    const error = await wait(() => root.querySelector('.auth-error-box[role="alert"]')?.innerText, 'Incorrect manual code did not retain an actionable error')
    await wait(() => !document.querySelector('.brand-toast:not(.brand-toast-leave-active)[data-toast-tone="progress"]'), 'Incorrect code progress did not finish')
    check(/incorrect|match|invalid/i.test(error) && !error.includes(code), 'Incorrect input retains a useful error without revealing the accepted code')
    check(!!current(selector) && !current(targetSelector), 'Incorrect manual input cannot advance to success or password editing')
    check(raw() === before && writes === 0, 'Incorrect code creates zero account writes and leaves original state byte-for-byte unchanged')
    await new Promise(resolve => setTimeout(resolve, 160))
    check(root.querySelector('.auth-error-box[role="alert"]')?.innerText === error, 'Incorrect-code feedback persists until the user tries again')
    type(code); await frame(); submit.click(); submit.click()
    const progress = await wait(() => document.querySelector('.brand-toast:not(.brand-toast-leave-active)[data-toast-tone="progress"]'), 'Correct manual input did not display branded progress before committing')
    check(progress.innerText.includes('Checking code'), 'Correct manual input uses the existing Checking code brand feedback')
    check(raw() === before && writes === 0, 'Brand progress is visible before any verification data is written')
    await wait(() => current(targetSelector), 'Correct code did not reach its intended confirmation destination')
    await frame()
    const stateAfter = decode(raw())
    check(writes === 1, 'Repeated confirmation taps produce exactly one successful verification write')
    check(JSON.stringify(stateAfter.users) === JSON.stringify(stateBefore.users) && JSON.stringify(stateAfter.session) === JSON.stringify(stateBefore.session), 'Code confirmation does not invent a student identity or authenticated session')
    if (kind === 'registration') {
      const accountID = stateBefore.auth_flow.pending_registration_account_id
      check(stateAfter.accounts.find(account => account.account_id === accountID)?.local_verification?.status === 'verified', 'The real pending registration account records its verified code status')
      check(JSON.stringify(stateAfter.coin_transactions) === JSON.stringify(stateBefore.coin_transactions) && JSON.stringify(stateAfter.relationships) === JSON.stringify(stateBefore.relationships), 'Registration code confirmation leaves coins and social relationships unchanged')
    } else {
      check(stateAfter.auth_flow.password_reset?.reset_id === stateBefore.auth_flow.password_reset?.reset_id && Number.isFinite(stateAfter.auth_flow.password_reset?.verified_at), 'The existing password-reset request alone receives its verification timestamp')
      check(JSON.stringify(stateAfter.accounts) === JSON.stringify(stateBefore.accounts), 'Verification cannot reset credentials before the separate password submission')
    }
    check(!input.isConnected || input.value === '', 'Code input is cleared when the verification page is hidden or unloaded')
    check(!/(?:email|code|message) (?:has been |was |is )?sent|we(?:’ve|'ve| have) sent|check your (?:inbox|email)/i.test(current(targetSelector).innerText), 'The confirmation destination also makes no false email-delivery claim')
    return { passed: true, kind, mode, checks, metrics, wrong_code: { error, writes: 0, unchanged: true }, writes, progress_before_write: true, cleared: !input.isConnected || input.value === '', destination: location.hash, verified: true }
  } finally { Storage.prototype.setItem = originalSetItem }
}
