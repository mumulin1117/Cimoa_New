// Shared browser/WKWebView assertions. Run only in a fresh, isolated website data store.
export async function auth_feedback_regression() {
  const checks = [], metrics = []
  const wait = async predicate => {
    for (let i = 0; i < 240; i++) { if (predicate()) return; await new Promise(resolve => setTimeout(resolve, 25)) }
    throw Error(`Auth feedback timed out: ${location.hash}`)
  }
  const active = selector => [...document.querySelectorAll(selector)].find(element => element.getBoundingClientRect().height > 0 && !element.closest('[aria-hidden="true"]'))
  const click = id => { const element = active(`[data-interaction="${id}"]`); if (!element) throw Error(`Missing ${id}`); element.click() }
  const raw = () => localStorage.getItem('cimoa_app_state_v2')
  const card = () => document.querySelector('.brand-toast:not(.brand-toast-leave-active)')
  const geometry = busy => {
    const element = card(), rect = element.getBoundingClientRect(), style = getComputedStyle(element)
    const safe = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--native-safe-area-top')) || 0
    const message = element.querySelector('.brand-toast-message').textContent
    if (Math.abs(rect.x + rect.width / 2 - innerWidth / 2) > 1 || rect.top < safe || rect.x < 0 || rect.right > innerWidth + 1) throw Error('Auth card is not centered inside the safe area')
    if (!style.backgroundImage.includes('gradient') || !element.querySelector('.brand-toast-icon svg')) throw Error('Missing gradient brand border/status icon')
    if (!getComputedStyle(element.querySelector('.brand-toast-card')).backgroundColor.includes('rgba')) throw Error('Missing translucent card')
    if (element.closest('uni-page,.page-transition,.event-dialog') || document.querySelectorAll('#cimoa-toast-root').length !== 1) throw Error('Auth feedback is not in the one global host')
    if (/\b(?:local|saving|saved|records?|drafts?|demo|injected)\b/i.test(message)) throw Error('Implementation wording leaked into auth feedback')
    if ((element.getAttribute('aria-busy') === 'true') !== busy) throw Error('Busy state is incorrect')
    if (!!element.querySelector('.brand-toast-close') === busy) throw Error('Pending/closable feedback semantics are incorrect')
    const front = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)
    if (!element.contains(front)) throw Error('EULA covers the brand feedback')
    return { message, safe, tone: element.dataset.toastTone, rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }, gradient: style.backgroundImage }
  }
  await wait(() => !!active('.eula-dialog.event-dialog--open'))
  if (raw() !== null) throw Error('This regression requires a fresh isolated account store')
  const original = Storage.prototype.setItem
  let writes = 0, failing = false
  Storage.prototype.setItem = function(key, value) {
    if (key === 'cimoa_app_state_v2') { writes++; if (failing) throw Error('Injected localStorage adapter failure') }
    return original.call(this, key, value)
  }
  try {
    click('welcome.eula.accept.click.1'); click('welcome.eula.accept.click.1')
    await wait(() => card()?.dataset.toastTone === 'progress')
    await wait(() => +getComputedStyle(card()).opacity > .99)
    if (raw() !== null || writes !== 0) throw Error('Agreement was written before its request state')
    metrics.push(geometry(true))
    if (metrics.at(-1).message !== 'Confirming your agreement…') throw Error('EULA uses the wrong request copy')
    await wait(() => active('.welcome-consent-toggle')?.getAttribute('aria-checked') === 'true' && !card())
    const accepted = JSON.parse(raw()).data
    if (writes !== 1 || !accepted.app_consent.accepted_at || accepted.session.current_user_id) throw Error('EULA duplicate click changed account/session or wrote twice')
    checks.push('EULA uses a visible safe-area brand card before one guarded agreement write; no account/session side effects')
    click('welcome.toggleAgreement.click.1')
    await wait(() => active('.welcome-consent-toggle')?.getAttribute('aria-checked') === 'false')
    click('welcome.toggleAgreement.click.1'); await wait(() => !!active('.eula-dialog.event-dialog--open'))
    const before = raw(); failing = true
    click('welcome.eula.accept.click.1')
    await wait(() => card()?.dataset.toastTone === 'error'); await wait(() => +getComputedStyle(card()).opacity > .99)
    metrics.push(geometry(false))
    if (raw() !== before || !active('.event-dialog-error') || active('.welcome-consent-toggle')?.getAttribute('aria-checked') !== 'false') throw Error('A failed agreement was treated as accepted')
    click('toast.dismiss.click.1'); await wait(() => !card())
    if (!active('.event-dialog-error')) throw Error('Closing the short notification removed the recoverable EULA error')
    checks.push('Failed agreement retains unchecked consent and persistent retry context; error Toast can be closed')
    click('welcome.eula.accept.click.1')
    await wait(() => card()?.dataset.toastTone === 'error'); await wait(() => +getComputedStyle(card()).opacity > .99)
    metrics.push(geometry(false))
    if (raw() !== before) throw Error('Retry failure modified agreement data')
    checks.push('The same failure can be triggered again; no false acceptance or debug wording')
    // Leave a real error Toast visible for browser/native screenshots and timeout assertions.
    return { passed: true, checks, metrics, persistent_error: active('.event-dialog-error').textContent }
  } finally { Storage.prototype.setItem = original }
}
