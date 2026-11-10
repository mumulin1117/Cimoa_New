// Self-contained so the same driver can run in Chrome and the packaged WKWebView.
export async function group_chat_report_regression({ mode = 'flow', event_id = 'event_picnic', conversation_id = 'group_picnic', baseline_style = null } = {}) {
  const checks = [], check = (value, label) => { if (!value) throw Error(label); checks.push(label) }
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
  const visible = element => { const rect = element?.getBoundingClientRect(); return !!rect && rect.width > 0 && rect.height > 0 && getComputedStyle(element).visibility !== 'hidden' }
  const current = selector => [...document.querySelectorAll(selector)].find(element => (!element.closest('uni-page') || element.closest('uni-page') === [...document.querySelectorAll('uni-page')].at(-1)) && visible(element))
  const wait = async (selector, absent = false) => {
    for (let attempt = 0; attempt < 240; attempt++) { const element = current(selector); if (absent ? !element : element) return element; await delay(25) }
    throw Error(`Waiting for ${selector} (${absent ? 'absent' : 'visible'}) on ${location.hash}`)
  }
  const settled = async selector => {
    const root = await wait(selector); await document.fonts.ready
    await Promise.all(root.getAnimations({ subtree: true }).filter(animation => animation.effect?.getTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => {})))
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    return root
  }
  const bytes = () => localStorage.getItem('cimoa_app_state_v2')
  const data = () => JSON.parse(bytes()).data
  const before = bytes(), initial = data(), original_set = Storage.prototype.setItem, original_push = history.pushState
  const writes = [], pushes = [], forbidden = []
  let started = 0
  Storage.prototype.setItem = function (key, value) {
    if (key === 'cimoa_app_state_v2') writes.push({ elapsed: performance.now() - started })
    return original_set.call(this, key, value)
  }
  history.pushState = function (...args) { pushes.push(String(args[2] || '')); return original_push.apply(this, args) }
  const observe = () => {
    for (const selector of ['.event-dialog--open', '[role="menu"]', '[data-interaction="evGroup.reportGroup.click.1"]', '[data-interaction="evGroup.leaveGroup.click.1"]', '[data-interaction="evGroup.muteGroup.click.1"]', '.uni-loading', '.uni-toast__loading']) {
      if ([...document.querySelectorAll(selector)].some(visible)) forbidden.push(selector)
    }
  }
  const observer = new MutationObserver(observe); observer.observe(document.body, { subtree: true, attributes: true, childList: true })
  const tap = id => { const element = current(`[data-interaction="${id}"]`); check(!!element, `Visible control ${id}`); element.click(); return element }
  const enter = element => element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
  const unchanged = () => check(bytes() === before && writes.length === 0, 'Opening, selecting and returning perform zero business writes')
  const same_business = after => check(JSON.stringify(after) === JSON.stringify(initial), 'Reporting leaves all persisted application data unchanged')
  const style = root => {
    const read = (element, properties) => { check(!!element, 'Report style source exists'); const css = getComputedStyle(element); return Object.fromEntries(properties.map(property => [property, css[property]])) }
    const row = root.querySelector('.event-report-reason'), dot = row?.querySelector('.event-report-dot')
    return {
      header: read(root.querySelector('.event-page-header'), ['display', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'gap', 'backgroundColor']),
      title: read(root.querySelector('.event-page-header-title'), ['fontFamily', 'fontSize', 'fontWeight', 'letterSpacing', 'color']),
      back: read(root.querySelector('.event-page-round'), ['width', 'height', 'borderRadius', 'backgroundColor', 'boxShadow', 'color']),
      row: read(row, ['display', 'minHeight', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'gap', 'borderTopWidth', 'borderTopStyle', 'borderTopColor', 'borderRadius', 'backgroundColor', 'boxShadow']),
      text: read(row?.querySelector('uni-text,text'), ['fontFamily', 'fontSize', 'fontWeight', 'letterSpacing', 'lineHeight', 'color']),
      dot: read(dot, ['width', 'height', 'borderTopWidth', 'borderTopColor', 'borderRadius', 'backgroundColor']),
      submit: read(root.querySelector('[data-interaction="evReport.submitEvReport.click.1"]'), ['fontFamily', 'fontSize', 'fontWeight', 'minHeight', 'paddingTop', 'paddingBottom', 'borderRadius', 'backgroundImage', 'backgroundColor', 'color', 'boxShadow']),
    }
  }
  // Native dictionaries need not preserve JavaScript insertion order.
  const canonical_style = value => value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical_style(value[key])]))
    : value
  const inspect = async group => {
    const root = await settled('.event-report-page'), rect = root.getBoundingClientRect(), header = root.querySelector('.event-page-header'), title = header.querySelector('.event-page-header-title')
    check(title.textContent.trim() === (group ? 'Report group chat' : 'Report event'), 'Report title identifies its exact entity type')
    check(root.classList.contains('event-group-report-page') === group, 'The shared report view identifies group mode without separate styling')
    check(rect.width <= innerWidth + 1 && document.documentElement.scrollWidth <= innerWidth + 1, 'Report stays within the viewport without horizontal overflow')
    const back = header.querySelector('[aria-label="Back"]').getBoundingClientRect(), submit = root.querySelector('[data-interaction="evReport.submitEvReport.click.1"]')?.getBoundingClientRect()
    check(back.x >= 0 && back.right <= innerWidth + 1 && back.y >= 0, 'Back remains visible within the safe viewport')
    if (submit) check(submit.x >= 0 && submit.right <= innerWidth + 1 && submit.bottom <= innerHeight + 1, 'Submit remains fixed and accessible within the safe viewport')
    check(!!root.querySelector('.secondary-page-scroll') && header.querySelectorAll('[role="button"]').length === 1, 'Shared fixed header, one scroll region and Back-only header remain intact')
    const signature = root.querySelector('.event-report-reason') ? style(root) : null
    if (baseline_style && signature) check(JSON.stringify(canonical_style(signature)) === JSON.stringify(canonical_style(baseline_style)), 'Group report header, font, reason row, dot and submit exactly match Report event styles')
    return { root, signature, width: rect.width }
  }
  try {
    if (mode === 'baseline' || mode === 'inspect') {
      const info = await inspect(mode !== 'baseline'); unchanged()
      return { passed: true, mode, checks, style: info.signature, width: info.width, route: location.hash }
    }
    if (mode === 'invalid') {
      const root = await settled('.event-report-page'); await wait('.event-page-state[role="alert"]')
      check(!root.querySelector('[data-interaction="evReport.submitEvReport.click.1"]') && !root.querySelector('[role="radio"]'), 'Mismatched or unjoined group has a readable error and no submit or reason controls')
      unchanged(); return { passed: true, mode, checks, route: location.hash }
    }
    if (mode === 'history') {
      const root = await settled('.safety-reports-page'), event = initial.events.find(row => row.event_id === event_id)
      const labels = [...root.querySelectorAll('.report-target')].map(element => element.textContent.trim())
      check(labels.includes(`${event.title} · Group chat`) && labels.includes(event.title), 'Report history resolves group and event names from their distinct real entities')
      check(!root.textContent.includes('Under Review') && !root.textContent.includes('Resolved'), 'Report history does not invent moderation or delivery status')
      unchanged(); return { passed: true, mode, checks, labels }
    }
    if (mode === 'restored') {
      const root = await settled('.event-group-page')
      const rows = initial.reports.filter(row => row.target_type === 'group' && row.target_id === conversation_id && row.context_id === event_id)
      check(rows.length === 0, 'Refresh creates no group report history record')
      check(!current('.event-group-report-page') && !current('.event-report-saved'), 'Refresh remains on the group and does not restore a report result page')
      unchanged(); return { passed: true, mode, checks }
    }
    if (mode === 'flow') {
      const group = await settled('.event-group-page'), depth = Number(group.dataset.pageDepth)
      const more = current('[data-interaction="evGroup.openGroupMenu.click.1"]')
      check(more?.getAttribute('aria-label') === 'Report group chat', 'More exposes the direct Report group chat accessibility action')
      more.click(); enter(more); more.click()
      let report = await settled('.event-group-report-page')
      const query = new URLSearchParams(location.hash.split('?')[1])
      check(location.hash.startsWith('#/pages/events/report?') && query.get('target_type') === 'group' && query.get('event_id') === event_id && query.get('origin_conversation_id') === conversation_id, 'Rapid click and Enter open the exact group report route')
      check(Number(report.dataset.pageDepth) === depth + 1 && pushes.length === 1, 'Repeated More triggers add exactly one real page and history entry')
      check(forbidden.length === 0 && !current('.event-loading'), 'More opens no intermediate menu or navigation Loading')
      const rows = [...report.querySelectorAll('[role="radio"]')]
      check(rows.length === 5 && rows[0].textContent.trim() === 'Harassment or discrimination', 'Group reasons come from the canonical group report catalog')
      rows[1].click(); enter(rows[0]); await delay(0)
      check(rows[0].getAttribute('aria-checked') === 'true', 'Reason selection supports click and Enter')
      unchanged()
      if (mode === 'flow') {
        tap('evReport.goBack.click.1'); const returned = await settled('.event-group-page')
        check(returned === group && Number(returned.dataset.pageDepth) === depth, 'Actual Back returns to the same group chat instance and stack depth')
        check(location.hash.includes(`conversation_id=${conversation_id}`) && location.hash.includes(`event_id=${event_id}`), 'Back retains the exact original group and event context')
        unchanged()
        const reopened = tap('evGroup.openGroupMenu.click.1'); enter(reopened)
        report = await settled('.event-group-report-page')
        check(Number(report.dataset.pageDepth) === depth + 1 && pushes.length === 2, 'Reopening by click and Enter adds one page again')
        const info = await inspect(true); unchanged()
        return { passed: true, mode, checks, style: info.signature, width: info.width, pushes: pushes.length, writes: writes.length }
      }
    }
    if (mode === 'submit') {
      const root = await settled('.event-group-report-page'), reason = root.querySelectorAll('[role="radio"]')[0]
      reason.click(); await delay(0)
      const selected = reason.textContent.trim(), submit = root.querySelector('[data-interaction="evReport.submitEvReport.click.1"]')
      check(submit.getAttribute('aria-disabled') === 'false', 'A canonical reason enables submit')
      started = performance.now()
      submit.click(); enter(submit); submit.click()
      await wait('.event-loading'); await delay(250)
      check(writes.length === 0 && bytes() === before && !!current('.event-loading'), 'Branded report Loading precedes all writes and blocks repeated submit')
      await wait('.event-loading', true)
      check(writes.length === 0 && bytes() === before, 'Report completion creates no persistence write or report record')
      await wait('.event-group-page'); const toast = await wait('.brand-toast--info')
      await Promise.all(toast.getAnimations({ subtree: true }).map(animation => animation.finished.catch(() => {})))
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      const after = data()
      const reports = after.reports.filter(row => row.target_type === 'group' && row.target_id === conversation_id && row.context_id === event_id)
      check(reports.length === 0 && selected.length > 0, 'A valid group reason completes without adding report history')
      same_business(after)
      check(!current('.event-group-report-page') && !current('.event-report-saved'), 'Success returns to the group without a standalone report result page')
      check(toast.textContent.includes('Thank you for sharing your concern.') && toast.textContent.includes('review it as soon as possible'), 'Success shows the single branded acknowledgement Toast after return')
      check(!current('[data-interaction="evReport.submitEvReport.click.1"]') && writes.length === 0 && bytes() === before, 'The returned source exposes no duplicate submit and keeps persistence unchanged')
      return { passed: true, mode, checks, writes: writes.length }
    }
    throw Error(`Unknown group report regression mode: ${mode}`)
  } finally { observer.disconnect(); Storage.prototype.setItem = original_set; history.pushState = original_push }
}
