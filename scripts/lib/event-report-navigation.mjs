// Runs against an isolated browser/WKWebView fixture, never against a user's account.
export async function event_report_navigation() {
  const visible = selector => [...document.querySelectorAll(selector)].find(element =>
    element.closest('uni-page') === [...document.querySelectorAll('uni-page')].at(-1) && element.getBoundingClientRect().height > 0)
  const wait = async predicate => {
    for (let i = 0; i < 160; i++) {
      if (predicate()) return
      await new Promise(resolve => setTimeout(resolve, 25))
    }
    throw Error(`Event report navigation timed out at ${location.hash}`)
  }
  const ensure = (value, message) => { if (!value) throw Error(message) }
  const idle = async () => {
    await Promise.all([...document.querySelectorAll('.page-transition')].flatMap(element => element.getAnimations().map(animation => animation.finished)))
  }
  const detail = '.event-detail-page'
  const more = '[data-interaction="evDetail.openEventMore.click.1"]'
  const back = '[data-interaction="evReport.goBack.click.1"]'
  const originalRoute = location.hash
  const originalTitle = visible(`${detail} .event-page-title`).textContent
  const originalDepth = Number(visible(detail).dataset.pageDepth)
  const before = localStorage.getItem('cimoa_app_state_v2')
  const checks = []
  for (const trigger of ['double click', 'keyboard']) {
    await idle()
    if (trigger === 'keyboard') visible(more).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    else { visible(more).click(); visible(more).click() }
    await wait(() => !!visible('.event-report-page'))
    await idle()
    ensure(visible('.event-report-page').querySelector('.event-page-header-title').textContent === 'Report event', 'Wrong report title')
    ensure(new URLSearchParams(location.hash.split('?')[1]).get('event_id') === new URLSearchParams(originalRoute.split('?')[1]).get('event_id'), 'Report changed the event identity')
    ensure(Number(visible('.event-report-page').dataset.pageDepth) === originalDepth + 1, 'Repeated activation pushed more than one report page')
    ensure(!visible('.event-dialog') && !visible('.event-loading'), 'More opened an intermediate menu or navigation Loading')
    ensure(!document.querySelector('[data-interaction="sheetEvMore.shareEvent.click.1"],[data-interaction="sheetEvMore.blockOrganizer.click.1"]'), 'Removed menu entries still exist')
    ensure(visible('[data-interaction="evReport.submitEvReport.click.1"]').getAttribute('aria-disabled') === 'true', 'Empty report should be disabled')
    visible('[data-interaction="evReport.r.pick.click.1"]').click()
    await wait(() => visible('[data-interaction="evReport.submitEvReport.click.1"]')?.getAttribute('aria-disabled') === 'false')
    visible(back).click()
    await wait(() => !!visible(detail) && location.hash === originalRoute)
    await idle()
    ensure(visible(`${detail} .event-page-title`).textContent === originalTitle, 'Back returned to a different event')
    ensure(Number(visible(detail).dataset.pageDepth) === originalDepth, 'Back did not pop the report page')
    ensure(localStorage.getItem('cimoa_app_state_v2') === before, 'Opening or cancelling a report changed business data')
    checks.push(`${trigger}: direct report, exact event, one push, no menu/Loading, selectable reasons, correct read-only Back`)
  }
  return { route: originalRoute, title: originalTitle, checks }
}
