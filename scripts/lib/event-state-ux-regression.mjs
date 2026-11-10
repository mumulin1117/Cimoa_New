// Runs inside the real H5 in either Chrome or an isolated WKWebView fixture.
export async function event_state_ux_regression({ mode, event_id = 'event_picnic', label = '', expected_user_ids = [], conversation_id = 'group_picnic' } = {}) {
  if (!['participants', 'blocked-list', 'blocked-detail', 'joined'].includes(mode)) throw Error('Invalid event state regression mode')
  const key = 'cimoa_app_state_v2', checks = [], delay = ms => new Promise(resolve => setTimeout(resolve, ms))
  const check = (condition, message) => { if (!condition) throw Error(message); checks.push(message) }
  const wait = async (predicate, message) => { for (let index = 0; index < 280; index++) { const value = predicate(); if (value) return value; await delay(25) } throw Error(message + ': ' + location.hash) }
  const current = selector => [...document.querySelectorAll(selector)].find(element => {
    const page = element.closest('uni-page'), rect = element.getBoundingClientRect()
    return (!page || page === [...document.querySelectorAll('uni-page')].at(-1)) && rect.width > 0 && rect.height > 0 && getComputedStyle(element).visibility !== 'hidden'
  })
  const idle = async () => {
    const root = current('.event-page,.main-tab-frame')
    if (root) await Promise.all(root.getAnimations({ subtree: true }).filter(animation => animation.effect?.getTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => {})))
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  }
  const raw = () => localStorage.getItem(key), route = location.hash
  const enter = element => element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
  const root_selector = mode === 'participants' || mode === 'blocked-list' ? '.main-tab-frame' : '.event-detail-page'
  await wait(() => current(root_selector) && !current('.content-skeleton'), 'The intended event content did not become ready')
  await idle()
  const before = raw(), original_set_item = Storage.prototype.setItem
  let writes = 0, observed_dialog = false, observed_loading = false
  const observe = () => { observed_dialog ||= !!current('.event-dialog'); observed_loading ||= !!current('.event-loading,.event-filter-loading') }
  const observer = new MutationObserver(observe)
  observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'style'] })
  Storage.prototype.setItem = function (name, value) { if (name === key) writes++; return original_set_item.call(this, name, value) }
  try {
    if (mode === 'participants') {
      const list = current('.events-carousel'), cards = [...list.querySelectorAll('.event-card')], card_ids = cards.map(card => card.dataset.eventId)
      check(cards[1]?.dataset.eventId === event_id, 'The exercised entry belongs to the second event card')
      const scroller = [...list.querySelectorAll('*')].find(element => element.scrollWidth > element.clientWidth + 20 && ['auto', 'scroll'].includes(getComputedStyle(element).overflowX))
      if (scroller) { scroller.scrollLeft = cards[1].offsetLeft; await idle() }
      const scroll_left = scroller?.scrollLeft || 0, depth = Number(current('.main-tab-frame').dataset.pageDepth)
      for (const trigger of ['click', 'Enter']) {
        const entry = current(`[data-event-id="${event_id}"] .event-participants`)
        const card = entry?.closest('.event-card')
        check(entry && !entry.hasAttribute('role') && !entry.hasAttribute('tabindex') && card?.getAttribute('role') === 'button', 'Participant summaries share the accessible whole-card detail action')
        if (trigger === 'click') { entry.click(); entry.click() } else enter(card)
        const detail = await wait(() => current('.event-detail-page'), 'Second-card participant summary did not open detail')
        await wait(() => current('[data-interaction="evDetail.openParticipantsList.click.1"]'), 'The existing detail participants entry did not render')
        await idle()
        check(new URLSearchParams(location.hash.split('?')[1]).get('event_id') === event_id && Number(detail.dataset.pageDepth) === depth + 1, `${trigger}: the participant summary first opens exactly one matching detail page`)
        check(!current('.event-participants-page,.event-group-page'), `${trigger}: list participant summaries do not open a secondary action directly`)
        current('[data-interaction="evDetail.openParticipantsList.click.1"]').click()
        const participants = await wait(() => current('.event-participants-page'), 'Second-card participants did not open')
        await idle()
        check(new URLSearchParams(location.hash.split('?')[1]).get('event_id') === event_id, `${trigger}: participants retain the second card event identity`)
        check(Number(participants.dataset.pageDepth) === depth + 2, `${trigger}: the unchanged detail participant action pushes one additional page`)
        check(JSON.stringify([...participants.querySelectorAll('.event-person')].map(person => person.dataset.userId).sort()) === JSON.stringify([...expected_user_ids].sort()), `${trigger}: participants come from the current event memberships`)
        check(!observed_loading && !observed_dialog, `${trigger}: participants navigation adds no booking dialog or write Loading`)
        current('[data-interaction="evParticipants.goBack.click.1"]').click()
        await wait(() => current('.event-detail-page') === detail, 'Participants Back did not restore its detail source')
        await idle()
        current('[data-interaction="evDetail.goBack.click.1"]').click()
        await wait(() => current('.events-carousel') && location.hash === route, 'Participants Back did not restore Events')
        await idle()
        check(Number(current('.main-tab-frame').dataset.pageDepth) === depth, `${trigger}: Back restores the original Events stack depth`)
        check(JSON.stringify([...current('.events-carousel').querySelectorAll('.event-card')].map(card => card.dataset.eventId)) === JSON.stringify(card_ids), `${trigger}: Back restores the same event card order`)
        check(!scroller || Math.abs(scroller.scrollLeft - scroll_left) <= 1, `${trigger}: Back retains the activity carousel position`)
      }
    } else if (mode === 'blocked-list' || mode === 'blocked-detail') {
      const selector = mode === 'blocked-list' ? `[data-event-id="${event_id}"] .event-join` : '[data-interaction="evDetail.askJoin.click.1"]'
      const submit = await wait(() => current(selector), 'Unavailable event booking control is missing')
      check(submit.textContent.trim() === label, 'Unavailable booking uses the canonical full or ended label')
      check(submit.getAttribute('aria-disabled') === 'true', 'Unavailable booking is announced as disabled')
      submit.click(); enter(submit); submit.click(); enter(submit)
      // Observe longer than the maximum existing pre-write delay, including transient dialogs.
      await delay(700); await idle(); observe()
      check(location.hash === route, 'Click and Enter on unavailable booking cannot navigate')
      check(!observed_dialog && !current('.event-dialog'), 'Click and Enter on unavailable booking never open confirmation')
      check(!observed_loading && !current('.event-loading'), 'Unavailable booking never starts business Loading')
    } else {
      check(!current('[data-interaction="evDetail.askJoin.click.1"]'), 'Existing attendance never becomes a new join action when full or ended')
      const chat = current('[data-interaction="evDetail.openGroup.click.1"]'), manage = current('[data-interaction="evDetail.manageAttendance.click.1"]')
      check(chat && manage && chat.getAttribute('aria-disabled') !== 'true' && manage.getAttribute('aria-disabled') !== 'true', 'Joined full or ended events retain group chat and attendance management')
      chat.click()
      await wait(() => current('.event-group-page .event-group-composer'), 'Existing attendance lost its group chat')
      await idle()
      const query = new URLSearchParams(location.hash.split('?')[1])
      check(query.get('event_id') === event_id && query.get('conversation_id') === conversation_id, 'Group chat retains the exact event and group identities')
      current('[data-interaction="evGroup.goBack.click.1"]').click()
      await wait(() => current('.event-detail-page .event-page-title') && location.hash === route, 'Group Back did not restore the joined event')
      await idle()
      enter(current('[data-interaction="evDetail.manageAttendance.click.1"]'))
      await wait(() => current('[data-interaction="sheetEvCancel.keepSpot.click.1"]'), 'Attendance management did not open its existing confirmation')
      check(!current('[data-interaction="sheetEvJoin.confirmJoin.click.1"]'), 'Managing existing attendance cannot reopen a join confirmation')
      current('[data-interaction="sheetEvCancel.keepSpot.click.1"]').click()
      await wait(() => !current('.event-dialog'), 'Keeping the existing place did not close attendance management')
      check(!observed_loading, 'Chat navigation and cancelling attendance management add no write Loading')
    }
    check(writes === 0 && raw() === before, 'Read-only entry, blocked booking and cancelled management leave persistence byte-for-byte unchanged')
    return { passed: true, mode, event_id, label, checks, writes, route: location.hash, observed_dialog, observed_loading, input: 'Actual uni-app controls activated with DOM click and Enter' }
  } finally { observer.disconnect(); Storage.prototype.setItem = original_set_item }
}
