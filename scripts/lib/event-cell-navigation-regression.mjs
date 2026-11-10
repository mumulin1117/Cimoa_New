// Self-contained driver shared by the built H5 browser and isolated WKWebView.
export async function event_cell_navigation_regression({ mode = 'navigation', event_ids = ['event_picnic', 'event_mic'], event_id = 'event_picnic' } = {}) {
  if (!['navigation', 'joined', 'join', 'disabled', 'cover-error'].includes(mode)) throw Error('Invalid event cell regression mode')
  const key = 'cimoa_app_state_v2', checks = [], delay = ms => new Promise(resolve => setTimeout(resolve, ms))
  const check = (value, message) => { if (!value) throw Error(message); checks.push(message) }
  const wait = async (predicate, message) => { for (let attempt = 0; attempt < 360; attempt++) { const result = predicate(); if (result) return result; await delay(25) } throw Error(message + ': ' + location.hash) }
  const current = selector => [...document.querySelectorAll(selector)].find(element => {
    const pages = [...document.querySelectorAll('uni-page')], page = element.closest('uni-page'), rect = element.getBoundingClientRect()
    return (!page || page === pages.at(-1)) && rect.width > 0 && rect.height > 0 && getComputedStyle(element).visibility !== 'hidden'
  })
  const settle = async root => {
    await document.fonts?.ready
    if (root) await Promise.all(root.getAnimations({ subtree: true }).filter(animation => animation.effect?.getTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => {})))
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  }
  const enter = element => { element.focus(); element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true })) }
  const space = element => { element.focus(); element.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true, cancelable: true })) }
  const root = await wait(() => current('.main-tab-frame') && !current('.content-skeleton') && current('.event-card') && current('.main-tab-frame'), 'Events did not finish its initial content skeleton')
  await settle(root)
  const initial_route = location.hash, before = localStorage.getItem(key), initial_data = JSON.parse(before).data
  const depth = Number(root.dataset.pageDepth), order = [...root.querySelectorAll('.event-card')].map(card => card.dataset.eventId)
  const card_for = id => root.querySelector(`[data-event-id="${id}"]`)
  const carousel = root.querySelector('.events-carousel')
  const scroller = [...carousel.querySelectorAll('*')].find(element => element.scrollWidth > element.clientWidth + 20 && ['auto', 'scroll'].includes(getComputedStyle(element).overflowX))
  const position = async id => { const card = card_for(id); check(!!card, `${id}: the fixture renders the canonical event card`); if (scroller) scroller.scrollLeft = Math.max(0, card.offsetLeft - carousel.offsetLeft - 20); await settle(root); return scroller?.scrollLeft || 0 }
  const original_set = Storage.prototype.setItem, original_remove = Storage.prototype.removeItem, original_clear = Storage.prototype.clear
  let writes = 0, loading_seen = false, dialog_seen = false
  const observe = () => { loading_seen ||= !!current('.event-loading,.event-filter-loading'); dialog_seen ||= !!current('.event-dialog--open') }
  const observer = new MutationObserver(observe)
  observer.observe(document.body, { childList: true, subtree: true, attributes: true })
  Storage.prototype.setItem = function (name, value) { if (name === key) writes++; return original_set.call(this, name, value) }
  Storage.prototype.removeItem = function (name) { if (name === key) writes++; return original_remove.call(this, name) }
  Storage.prototype.clear = function () { writes++; return original_clear.call(this) }
  const back_to_list = async (scroll_left, label) => {
    current('[data-interaction="evDetail.goBack.click.1"]').click()
    await wait(() => current('.main-tab-frame') === root && location.hash === initial_route, 'Detail Back did not restore the original Events instance')
    await settle(root)
    check(Number(root.dataset.pageDepth) === depth && depth === 1, `${label}: Back restores the single Events root`)
    check(JSON.stringify([...root.querySelectorAll('.event-card')].map(card => card.dataset.eventId)) === JSON.stringify(order), `${label}: Back retains event card order`)
    check(!scroller || Math.abs(scroller.scrollLeft - scroll_left) <= 2, `${label}: Back retains the actual horizontal carousel position`)
    check(!current('.content-skeleton'), `${label}: warm Back does not replay the Events skeleton`)
  }
  const open_detail = async (id, element, activation, label) => {
    const scroll_left = await position(id)
    if (activation === 'enter') enter(element)
    else if (activation === 'space') space(element)
    else { element.click(); element.click(); element.click() }
    const detail = await wait(() => current('.event-detail-page') && !current('.content-skeleton') && current('.event-detail-page .event-page-title') && current('.event-detail-page'), `${label}: cell activation did not open event detail (after ${checks.length} checks)`)
    await settle(detail); observe()
    check(location.hash.split('?')[0] === '#/pages/events/detail' && new URLSearchParams(location.hash.split('?')[1]).get('event_id') === id, `${label}: opens the exact event detail`)
    check(Number(detail.dataset.pageDepth) === depth + 1 && document.querySelectorAll('.event-detail-page').length === 1, `${label}: activation pushes exactly one detail page`)
    check(!current('.event-participants-page,.event-group-page,.event-dialog--open'), `${label}: the cell opens detail without participants, group chat or attendance confirmation`)
    check(!loading_seen && !dialog_seen && writes === 0 && localStorage.getItem(key) === before, `${label}: pure navigation has no business Loading or storage write`)
    await back_to_list(scroll_left, label)
  }
  try {
    if (mode === 'navigation' || mode === 'joined') {
      const regions = mode === 'joined'
        ? [['group text', '.event-manage > :first-child'], ['Manage text', '.event-manage > :last-child'], ['management blank', '.event-manage'], ['Joined primary', '.event-join']]
        : [['cover', '.event-cover'], ['title', '.event-title'], ['time', '.event-info'], ['location', '.event-location'], ['participant avatars', '.event-avatars'], ['participant count', '.event-count'], ['body blank', '.event-body'], ['card blank', null]]
      for (const id of event_ids) {
        const card = card_for(id)
        check(card?.getAttribute('role') === 'button' && card.getAttribute('tabindex') === '0', `${id}: the whole cell is a focusable semantic detail entry`)
        check(card.querySelectorAll('[role="button"][tabindex="0"]').length === 1 && card.querySelector('.event-join[role="button"][tabindex="0"]'), `${id}: only the unchanged Join primary is a separate keyboard action`)
        if (mode === 'joined') {
          check(card.querySelector('.event-join').textContent.trim() === 'Joined', `${id}: existing attendance keeps its Joined primary label`)
          space(card.querySelector('.event-join')); await settle(root)
          check(location.hash === initial_route && !current('.event-dialog--open') && writes === 0, `${id}: Space on Joined retains its existing inactive behavior without bubbling`)
        }
        for (const [label, selector] of regions) await open_detail(id, selector ? card.querySelector(selector) : card, 'repeat-click', `${id} ${label}`)
        await open_detail(id, card, 'enter', `${id} whole-cell Enter`)
        await open_detail(id, card, 'space', `${id} whole-cell Space`)
      }
    } else if (mode === 'cover-error') {
      const card = card_for(event_id)
      await wait(() => card.querySelector('.profile-photo[data-media-status="error"] .photo-retry'), 'The fixture did not render the real failed-cover Retry control')
      for (const activation of ['repeat-click', 'enter', 'space']) await open_detail(event_id, card.querySelector('.photo-retry'), activation, `failed-cover Retry ${activation}`)
      check(card.querySelector('.profile-photo').dataset.mediaStatus === 'error', 'Failed-cover activation navigates without retrying or replacing the source media')
    } else if (mode === 'disabled') {
      const card = card_for(event_id), join = card?.querySelector('.event-join')
      check(join?.textContent.trim() === 'Event full' && join.getAttribute('aria-disabled') === 'true', 'Full-event primary retains its canonical disabled state')
      join.click(); enter(join); space(join); join.click(); enter(join); space(join)
      await delay(700); await settle(root); observe()
      check(location.hash === initial_route && Number(root.dataset.pageDepth) === depth, 'Disabled Join click, Enter and Space cannot bubble into detail navigation')
      check(!loading_seen && !dialog_seen && writes === 0 && localStorage.getItem(key) === before, 'Disabled Join never starts confirmation, Loading or persistence')
      await open_detail(event_id, card.querySelector('.event-count'), 'repeat-click', 'full-event participant text')
    } else {
      await position(event_id)
      const join = card_for(event_id).querySelector('.event-join')
      check(join.getAttribute('aria-disabled') !== 'true' && join.textContent.trim() === 'Join event', 'Join fixture begins with the real available primary action')
      space(join); await settle(root)
      check(location.hash === initial_route && !current('.event-dialog--open,.event-detail-page') && writes === 0 && localStorage.getItem(key) === before, 'Space on Join retains its existing inactive behavior without bubbling or writing')
      for (const activation of ['click', 'enter']) {
        if (activation === 'click') { join.click(); join.click() } else enter(join)
        await wait(() => current('[data-interaction="sheetEvJoin.closeSheet.click.2"]'), 'Join did not open its existing confirmation')
        check(location.hash === initial_route && !current('.event-detail-page') && Number(root.dataset.pageDepth) === depth, `${activation}: Join stops card navigation and keeps the current stack`)
        check(writes === 0 && localStorage.getItem(key) === before, `${activation}: opening Join confirmation writes nothing`)
        current('[data-interaction="sheetEvJoin.closeSheet.click.2"]').click()
        await wait(() => !current('.event-dialog'), 'Cancelled Join confirmation did not release')
        check(writes === 0 && localStorage.getItem(key) === before, `${activation}: cancelling Join preserves every persisted byte`)
      }
      join.click()
      const confirm = await wait(() => current('[data-interaction="sheetEvJoin.confirmJoin.click.1"]'), 'Repeat Join confirmation did not open')
      confirm.click(); confirm.click(); enter(confirm)
      await wait(() => current('.event-loading'), 'Confirmed Join did not display its existing business Loading')
      check(writes === 0 && localStorage.getItem(key) === before && location.hash === initial_route, 'Confirmed Join shows Loading before any admission write or navigation')
      await delay(250)
      check(writes === 0 && localStorage.getItem(key) === before, 'Join does not write during the early part of its existing pre-write delay')
      const success = await wait(() => current('.event-success-page'), 'Confirmed Join did not reach the existing success page')
      await settle(success)
      const after = JSON.parse(localStorage.getItem(key)).data, owner = after.session.current_user_id
      check(writes === 1 && after.memberships.filter(row => row.event_id === event_id && row.user_id === owner && row.status === 'joined').length === 1, 'Repeated confirmation creates exactly one persisted admission')
      check(Number(success.dataset.pageDepth) === depth + 1 && new URLSearchParams(location.hash.split('?')[1]).get('event_id') === event_id, 'Join preserves the existing one-page success route for the exact event')
      for (const name of ['relationships', 'requests', 'messages', 'coin_transactions', 'event_preferences']) check(JSON.stringify(after[name]) === JSON.stringify(initial_data[name]), `Join preserves unrelated ${name}`)
      check(!document.querySelector('.event-detail-page'), 'Join never opens detail through card bubbling')
    }
    if (mode !== 'join') check(writes === 0 && localStorage.getItem(key) === before, 'Every cell detail and Back round trip preserves persistent bytes')
    return { passed: true, mode, event_ids, event_id, checks, writes, card_order: order, route: location.hash, loading_seen, dialog_seen, input: 'Actual uni-app controls with DOM click and bubbling Enter' }
  } finally {
    observer.disconnect(); Storage.prototype.setItem = original_set; Storage.prototype.removeItem = original_remove; Storage.prototype.clear = original_clear
  }
}
