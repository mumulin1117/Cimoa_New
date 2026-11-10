export function toast_geometry() {
  const card = document.querySelector('.brand-toast:not(.brand-toast-leave-active)')
  if (!card) throw Error('No active brand Toast')
  const rect = card.getBoundingClientRect()
  const message = card.querySelector('.brand-toast-message')
  const close = card.querySelector('[data-interaction="toast.dismiss.click.1"]')
  const style = getComputedStyle(card), region = card.closest('.brand-toast-region')
  const top = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--native-safe-area-top')) || 0
  if (Math.abs(rect.x + rect.width / 2 - innerWidth / 2) > 1) throw Error('Toast is not horizontally centered')
  if (rect.y < top || rect.right > innerWidth + 1 || rect.x < 0 || rect.bottom > innerHeight) throw Error('Toast crosses viewport/safe-area bounds')
  if (/\b(?:local|saving|saved|records?|drafts?|demo)\b/i.test(message.textContent)) throw Error('Development wording leaked into Toast')
  if (region.closest('uni-page,.page-transition,.event-dialog')) throw Error('Toast is trapped inside a transformed page')
  if (!style.backgroundImage.includes('gradient') || !card.querySelector('.brand-toast-icon svg')) throw Error('Missing brand border or state icon')
  if (getComputedStyle(region).pointerEvents !== 'none' || style.pointerEvents !== 'auto') throw Error('Toast overlay blocks the rest of the page')
  const designScale = parseFloat(getComputedStyle(message).fontSize) / 15
  if (close.getBoundingClientRect().width < 43 * designScale) throw Error('Toast close target is too small')
  return { viewport: { width: innerWidth, height: innerHeight }, rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }, top, text: message.textContent, tone: card.dataset.toastTone, live: card.getAttribute('aria-live'), background: style.backgroundImage }
}

export async function toast_report_regression() {
  const visible = selector => [...document.querySelectorAll(selector)].find(element => element.closest('uni-page') === [...document.querySelectorAll('uni-page')].at(-1) && element.getBoundingClientRect().height > 0)
  const wait = async predicate => { for (let i = 0; i < 200; i++) { if (predicate()) return; await new Promise(resolve => setTimeout(resolve, 25)) } throw Error(`Report Toast timed out: ${location.hash}`) }
  const click = id => { const element = visible(`[data-interaction="${id}"]`); if (!element) throw Error(`Missing ${id}`); element.click() }
  const read = () => JSON.parse(localStorage.getItem('cimoa_app_state_v2')).data
  const before = read(), eventId = new URLSearchParams(location.hash.split('?')[1]).get('event_id')
  click('evDetail.openEventMore.click.1'); await wait(() => !!visible('.event-report-page'))
  click('evReport.r.pick.click.1'); await new Promise(resolve => setTimeout(resolve, 30))
  click('evReport.submitEvReport.click.1')
  await wait(() => !!document.querySelector('.brand-toast:not(.brand-toast-leave-active):not([aria-busy="true"])'))
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  await Promise.all(document.querySelector('.brand-toast').getAnimations().map(animation => animation.finished))
  await new Promise(resolve => requestAnimationFrame(resolve))
  const after = read()
  if (JSON.stringify(after) !== JSON.stringify(before)) throw Error(`Reporting ${eventId} changed persisted application data`)
  const metrics = toast_geometry()
  if (metrics.text !== 'Thank you for sharing your concern. We’ll review it as soon as possible.' || metrics.tone !== 'info') throw Error('Report acknowledgement uses the wrong copy or state')
  return { metrics, checks: ['acknowledgement after validation', 'all persisted data unchanged', 'source page restored', 'one safe-area brand host outside pages'] }
}
