// Shared browser / WKWebView regression against actual UI and bundled images.
// The harness supplies an isolated signed-in account already joined to Picnic.
export async function event_data_regression(covers) {
  const checks = [], delay = ms => new Promise(resolve => setTimeout(resolve, ms))
  const wait = async predicate => { for (let i = 0; i < 350; i++) { if (predicate()) return; await delay(20) } throw Error('Event data condition timed out at ' + location.hash) }
  const find = selector => [...document.querySelectorAll(selector)].find(node => node.getBoundingClientRect().width > 0)
  const click = selector => { const node = find(selector); if (!node) throw Error('Missing event control ' + selector); node.click() }
  const assert = (condition, text) => { if (!condition) throw Error(text); checks.push(text) }
  const persisted = () => JSON.parse(localStorage.getItem('cimoa_app_state_v2')).data
  const image = selector => find(selector)?.querySelector('img')?.currentSrc || ''
  await wait(() => !!find('.event-card .profile-photo[data-media-status=ready]'))
  const cards = () => [...document.querySelectorAll('.event-card')].filter(node => node.getBoundingClientRect().width > 0)
  assert(find('.events-chip--active')?.textContent === 'My campus' && cards().length === 1 && cards()[0].dataset.eventId === 'event_picnic', 'Restored My campus contains only the current account’s joined event')
  assert(image('.event-card').includes('/static/assets/events/picnic.jpg'), 'A legacy saved event receives its own new cover without reseeding attendance')
  const before = JSON.stringify(persisted())
  click('.event-cover'); await wait(() => !!find('.event-detail-cover .profile-photo[data-media-status=ready]'))
  assert(image('.event-detail-cover').includes('/static/assets/events/picnic.jpg'), 'Card and activity detail resolve the same event-specific cover')
  click('[data-interaction="evDetail.goBack.click.1"]'); await wait(() => !!find('.events-header'))
  assert(JSON.stringify(persisted()) === before, 'Cover migration and read-only navigation do not rewrite business storage')
  const dimensions = await Promise.all(covers.map(src => new Promise((resolve, reject) => {
    const photo = new Image()
    photo.onload = () => resolve({ src, width: photo.naturalWidth, height: photo.naturalHeight })
    photo.onerror = () => reject(Error('Bundled event image failed: ' + src))
    photo.src = src
  })))
  assert(dimensions.length === 22 && new Set(dimensions.map(row => row.src)).size === 22 && dimensions.every(row => row.width >= 700 && row.height >= 450), 'All 22 distinct themed event covers decode from the offline bundle')
  click('[data-interaction="events.manageAttendance.click.1"]')
  await wait(() => !!find('.event-detail-page'))
  click('[data-interaction="evDetail.manageAttendance.click.1"]')
  await wait(() => !!find('.event-dialog--open'))
  const confirm = [...document.querySelectorAll('[role=button]')].find(node => node.textContent.trim() === 'Cancel attendance' && node.getBoundingClientRect().width > 0)
  if (!confirm) throw Error('Missing cancel attendance confirmation')
  confirm.click()
  await wait(() => !!find('.event-loading'))
  assert(JSON.stringify(persisted()) === before, 'Cancelling attendance respects the existing pre-write Loading')
  await wait(() => !find('.event-loading') && !find('.event-dialog--open'))
  click('[data-interaction="evDetail.goBack.click.1"]')
  await wait(() => !!find('.events-empty'))
  const after = persisted()
  assert(cards().length === 0 && after.memberships.find(row => row.event_id === 'event_picnic' && row.user_id === after.session.current_user_id)?.status === 'left', 'Leaving removes the event from My campus and keeps the canonical membership history')
  for (const key of ['requests', 'messages', 'coin_transactions', 'session']) assert(JSON.stringify(after[key]) === JSON.stringify(JSON.parse(before)[key]), `Event cancellation preserves ${key}`)
  return { passed: true, checks, dimensions }
}
