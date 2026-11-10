// Self-contained so this same browser regression can run in WKWebView.
export async function ux_state_regression({ status, mode = 'inspect', match_id } = {}) {
  const expected = {
    searching: ['Your search is still in progress', 'Return to your search, or adjust your preferences to explore more people.', 'Return to search'],
    paused: ['Your search is paused', 'Your search is paused. Return when you’re ready to resume, or adjust your preferences.', 'View paused search'],
    no_match: ['No compatible matches are available right now', 'You can stay in the pool, adjust your preferences, or try again later.', 'Stay in Pool'],
  }
  if (!expected[status] || !['inspect', 'return'].includes(mode)) throw Error('Invalid search options scenario')
  const key = 'cimoa_app_state_v2', checks = []
  const check = (value, message) => { if (!value) throw Error(message); checks.push(message) }
  const frame = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  const wait = async (predicate, message) => {
    for (let attempt = 0; attempt < 240; attempt++) {
      const value = predicate()
      if (value) return value
      await new Promise(resolve => setTimeout(resolve, 25))
    }
    throw Error(message)
  }
  const current = selector => [...document.querySelectorAll(selector)].find(element => {
    const page = element.closest('uni-page'), pages = [...document.querySelectorAll('uni-page')], rect = element.getBoundingClientRect()
    return (!page || page === pages.at(-1)) && rect.height > 0 && getComputedStyle(element).visibility !== 'hidden'
  })
  const raw = () => localStorage.getItem(key), decode = value => JSON.parse(value).data
  const root = await wait(() => current('.auto-match-no-match'), 'Search options did not remain available for the existing match')
  await document.fonts?.ready
  await Promise.all(root.getAnimations({ subtree: true }).filter(animation => animation.effect?.getTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => {})))
  await frame()
  const before = raw(), data = decode(before), params = new URLSearchParams(location.hash.split('?')[1] || '')
  const id = match_id || params.get('match_id'), original = data.match_sessions.find(row => row.match_id === id)
  check(!!original, 'Search options reference a persisted match_id')
  check(params.get('match_id') === id && params.get('view') === 'options', 'Options navigation retains the original match_id and explicit options view')
  check(!root.querySelector('.am-error[role="alert"]'), 'The existing match remains accessible')
  const title = root.querySelector('[data-source-line="1878"]')?.innerText.trim(), copy = root.querySelector('[data-source-line="1879"]')?.innerText.trim()
  const primary = root.querySelector('[data-interaction="amNoMatch.findAnother.click.1"]')
  check(title === expected[status][0] && copy === expected[status][1] && primary?.innerText.trim() === expected[status][2], `${status} options show the matching title, explanation and return action`)
  if (status !== 'no_match') check(!/no compatible|no matches|nothing available/i.test(`${title} ${copy}`), 'An ongoing or paused search does not claim that no compatible matches exist')
  check(!!root.querySelector('[data-interaction="amNoMatch.adjustPrefs.click.1"]') && !!root.querySelector('[data-interaction="amNoMatch.returnHome.click.1"]'), 'Preferences and Home remain available beside the return action')
  const box = primary.getBoundingClientRect(), style = getComputedStyle(document.documentElement)
  const safeBottom = parseFloat(style.getPropertyValue('--native-safe-area-bottom')) || 0
  check(box.width > 0 && box.left >= -1 && box.right <= innerWidth + 1 && box.bottom <= innerHeight - safeBottom + 1, 'The return action fits the viewport above the actual bottom safe area')
  check(raw() === before, 'Reading search options does not change persistent data')
  const metrics = { status, match_id: id, viewport: { width: innerWidth, height: innerHeight }, title, copy, action: primary.innerText.trim(), route: location.hash }
  if (mode === 'inspect') return { passed: true, mode, checks, metrics }

  const originalSetItem = Storage.prototype.setItem
  let writes = 0
  Storage.prototype.setItem = function (name, value) { if (name === key) writes++; return originalSetItem.call(this, name, value) }
  try {
    primary.click(); primary.click()
    if (status === 'no_match') {
      await wait(() => current('.event-loading'), 'Retry did not show the existing business Loading before writing')
      check(raw() === before && writes === 0, 'Retry Loading appears before the match attempt is persisted')
    }
    await wait(() => current(status === 'paused' ? '.auto-match-paused' : '.auto-match-searching'), 'The return action did not open the appropriate match state')
    await frame()
    const after = decode(raw()), route = new URLSearchParams(location.hash.split('?')[1] || ''), targetID = route.get('match_id')
    check(JSON.stringify(after.match_quota) === JSON.stringify(data.match_quota), 'Returning or retrying does not consume another daily match')
    check(JSON.stringify(after.coin_transactions) === JSON.stringify(data.coin_transactions), 'Returning or retrying does not debit coins again')
    if (status === 'no_match') {
      const retry = after.match_sessions.find(row => row.match_id === targetID), source = after.match_sessions.find(row => row.match_id === id)
      check(targetID !== id && retry?.retry_of_match_id === id && retry.pool_id === (original.pool_id || id) && source.next_match_id === targetID, 'A true no-result retry links one new attempt to the original pool admission')
      check(writes === 1 && after.match_sessions.length === data.match_sessions.length + 1, 'Repeated retry taps create exactly one persisted attempt')
    } else {
      check(targetID === id, 'Returning to an active or paused search preserves the original match_id')
      check(raw() === before && writes === 0, 'Returning to an existing search performs zero business writes')
      check(!current('.event-loading'), 'Pure return navigation does not display business Loading')
    }
    return { passed: true, mode, checks, metrics, destination: location.hash, match_id: targetID, pool_id: original.pool_id || id, writes }
  } finally { Storage.prototype.setItem = originalSetItem }
}
