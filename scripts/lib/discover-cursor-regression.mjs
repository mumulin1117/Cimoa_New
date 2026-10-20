// Runs unchanged in Chromium and the bundled WKWebView. No production test hooks.
export async function discover_cursor_regression({ ids, empty_home = false }) {
  const checks = [], delay = ms => new Promise(resolve => setTimeout(resolve, ms))
  const assert = (value, message) => { if (!value) throw Error(message + ' at ' + location.hash) }
  const visible = selector => [...document.querySelectorAll(selector)].find(element => element.getBoundingClientRect().height > 0)
  const wait = async predicate => { for (let i = 0; i < 250; i++) { if (predicate()) return; await delay(25) } throw Error('Cursor regression timed out at ' + location.hash) }
  const front = () => visible('.discover-photo-card--front'), current = () => front()?.dataset.userId
  const click = interaction => { const element = visible(`[data-interaction="${interaction}"]`); assert(element, 'Missing ' + interaction); element.click() }
  const settled = () => wait(() => { const deck = visible('.discover-deck'); return deck && deck.dataset.settling === 'false' && deck.dataset.resetting === 'false' })
  const pointer = (element, type, x, y) => element.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 83, pointerType: 'touch', isPrimary: true, button: 0, clientX: x, clientY: y }))
  const gesture = async ({ cancel = false, interrupt = false } = {}) => {
    const element = front(), box = element.getBoundingClientRect(), x = box.x + box.width / 2, y = box.y + box.height / 2
    pointer(element, 'pointerdown', x, y)
    for (let step = 1; step <= 8; step++) { pointer(element, 'pointermove', x - box.width * .4 * step / 8, y); await delay(12) }
    if (interrupt !== 'drag') pointer(element, cancel ? 'pointercancel' : 'pointerup', x - box.width * .4, y)
    if (!interrupt) { await delay(20); await settled(); await delay(30) }
  }
  const tab = async name => {
    const selector = name === 'Discover' ? '.discover-photo-card--front' : name === 'Home' ? '.home-header' : '.events-header'
    visible(`.tab[aria-label="${name}"]`).click()
    await wait(() => location.hash.includes(`/pages/${name.toLowerCase()}/index`) && visible(selector)); await delay(310)
    assert(visible('.main-tab-frame').dataset.pageDepth === '1', 'Tab stack grew')
  }
  await wait(() => front()); await delay(350)
  const key = 'cimoa_app_state_v2', before = localStorage.getItem(key)
  let writes = 0, navigation_loading = false
  const original = Storage.prototype.setItem
  Storage.prototype.setItem = function (key, value) { if (key === 'cimoa_app_state_v2') writes++; return original.call(this, key, value) }
  const observer = new MutationObserver(() => { if (visible('.main-skeleton,.event-loading')) navigation_loading = true })
  observer.observe(document.body, { childList: true, attributes: true, subtree: true })
  try {
    assert(current() === ids[0], 'Unexpected initial person')
    await gesture(); await gesture(); const selected = ids[2]
    assert(current() === selected, 'Two settled swipes did not reach the third person')
    for (const name of ['Home', 'Events', 'Home', 'Events']) { await tab(name); await tab('Discover'); assert(current() === selected, name + ' reset the current person') }
    checks.push('Repeated Home / Events → Discover switches retain the third person by ID at root depth 1')
    await delay(1200); assert(current() === selected, 'Clock tick reset the cursor')
    front().click(); await wait(() => visible('.expanded-profile-page')); assert(location.hash.includes(selected), 'Wrong profile')
    await delay(300); click('expanded.collapse.click.1'); await wait(() => front()); await delay(300)
    assert(current() === selected, 'Profile Back reset the cursor')
    checks.push('Clock ticks and profile / Back retain the same person and correct route target')
    await gesture({ cancel: true }); assert(current() === selected, 'Cancelled swipe advanced')
    for (const phase of ['drag', 'exit']) {
      await gesture({ interrupt: phase }); await tab('Home'); await tab('Discover')
      assert(current() === selected, 'Interrupted ' + phase + ' committed a card')
    }
    assert(visible('.discover-deck').dataset.dragging === 'false' && visible('.discover-deck').dataset.settling === 'false', 'Gesture state leaked across Tabs')
    await delay(400); assert(current() === selected, 'Old timer advanced a hidden deck')
    checks.push('Cancellation and Tab interruption during drag / exit keep the last settled card and clean up interaction state')
    if (empty_home) {
      await tab('Home'); click('home.exploreDiscover.click.1'); await wait(() => front()); await delay(310)
      assert(current() === selected, 'Explore People reset the cursor')
      checks.push('Home empty-state Explore People restores the last browsed card without reseeding the pool')
    }
    assert(localStorage.getItem(key) === before && writes === 0, 'Browsing wrote business data')
    assert(!navigation_loading, 'Tab navigation showed Loading or repeated a skeleton')
    const browsing_storage_writes = writes, browsing_navigation_loading = navigation_loading
    observer.disconnect()
    checks.push('Browsing, Tab replacement and Back make zero storage writes and show no navigation Loading / repeated skeleton')
    if (!empty_home) {
      click('photo.sayHi.click.1'); await wait(() => visible('.ice-select-page')); await delay(300)
      visible('[data-interaction="ibSelect.q.pick.click.1"]').click(); click('ibSelect.answerGo.click.1'); await wait(() => visible('.ice-text-page'))
      const input = visible('textarea'); input.value = 'Would you like to take a campus walk?'; input.dispatchEvent(new Event('input', { bubbles: true })); await delay(50)
      click('ibText.continueText.click.1'); await wait(() => visible('[data-interaction="sheetTextCoin.spendText.click.1"]')); click('sheetTextCoin.spendText.click.1')
      await wait(() => visible('.connection-sent-page')); await delay(300); click('reqSent.doneSent.click.1'); await wait(() => front()); await delay(310)
      assert(current() === selected, 'Introduction Done reset the cursor')
      assert(visible('.discover-send').textContent === 'Waiting for reply' && visible('.discover-send').getAttribute('aria-disabled') === 'true', 'Current request state is stale')
      await tab('Events'); await tab('Discover'); assert(current() === selected && visible('.discover-send').textContent === 'Waiting for reply', 'Request state or position lost after Tab change')
      const data = JSON.parse(localStorage.getItem(key)).data, requests = data.requests.filter(row => row.sender_id === data.session.current_user_id && row.recipient_id === selected)
      assert(requests.length === 1 && data.coin_transactions.filter(row => row.related_id === requests[0].request_id && row.amount === -10).length === 1, 'Request or fee duplicated')
      checks.push('Real text send / Done relaunch keeps the same card with live grey Waiting for reply and one 10-coin ledger entry')
      await delay(350); front().click(); await wait(() => visible('.expanded-profile-page')); await delay(310)
      click('expanded.openSafetyMini.click.1'); await wait(() => visible('[data-interaction="sheetSafetyMini.openBlock.click.1"]')); click('sheetSafetyMini.openBlock.click.1')
      await wait(() => visible('[data-interaction="sheetBlock.confirmBlock.click.1"]')); click('sheetBlock.confirmBlock.click.1')
      await wait(() => front()); await delay(350)
      assert(current() === ids[3], 'Blocking did not choose the next valid person')
      assert(![...document.querySelectorAll('.discover-photo-card')].some(element => element.dataset.userId === selected), 'Blocked card leaked')
      const fallback = current(); await tab('Home'); await tab('Discover'); assert(current() === fallback, 'Fallback cursor was not retained')
      checks.push('Blocking the current person filters it globally, chooses the next valid card and retains that fallback across Tabs')
    }
    return { checks, current_user_id: current(), browsing_storage_writes, browsing_navigation_loading }
  } finally { observer.disconnect(); Storage.prototype.setItem = original }
}
