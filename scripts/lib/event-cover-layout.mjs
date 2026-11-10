// Shared browser/WebKit layout audit; no app state writes or timer simulation.
export function event_cover_layout() {
  const root = [...document.querySelectorAll('.event-detail-page')].find(element => element.getBoundingClientRect().height > 0)
  if (!root) throw Error('Event detail is not visible')
  const query = selector => root.querySelector(selector)
  const box = element => {
    const rect = element.getBoundingClientRect()
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, bottom: rect.bottom, right: rect.right }
  }
  const require = (condition, message) => { if (!condition) throw Error(message) }
  const close = (actual, expected) => Math.abs(actual - expected) < 1
  const cover = box(query('.event-detail-cover'))
  const header = box(query('.secondary-page-header'))
  const backElement = query('[data-interaction="evDetail.goBack.click.1"]')
  const moreElement = query('[data-interaction="evDetail.openEventMore.click.1"]')
  const back = box(backElement), more = box(moreElement)
  const footer = box(query('.event-page-footer'))
  const safeTop = parseFloat(getComputedStyle(query('.secondary-page-header')).paddingTop)
  const safeBottom = parseFloat(getComputedStyle([...root.children].find(element => element.classList.contains('safe-area'))).height)
  require(close(cover.x, 0) && close(cover.y, 0), 'Cover does not begin at the viewport origin')
  require(close(cover.width, innerWidth), 'Cover is not full width')
  const scale = back.width / 46
  require(close(cover.height, (204 + 66) * scale + safeTop), `Cover does not fill the former safe-area/header gap: ${JSON.stringify({ cover, scale, safeTop })}`)
  require(back.y >= safeTop && more.y >= safeTop, 'Header controls overlap the status area')
  require(back.bottom <= cover.bottom && more.bottom <= cover.bottom, 'Header controls are not over the cover')
  require(close(header.y, 0), 'Overlay header moved away from the top')
  require([...root.children].filter(element => element.classList.contains('safe-area')).length === 1, 'Top safe area is consumed twice')
  require(footer.bottom <= innerHeight - safeBottom + 1, 'Footer overlaps the bottom safe area')
  for (const [element, rect] of [[backElement, back], [moreElement, more]]) {
    const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)
    require(element.contains(hit), 'An overlay blocks a header control')
  }
  const middle = document.elementFromPoint(innerWidth / 2, (back.y + back.bottom) / 2)
  require(!query('.secondary-page-header').contains(middle), 'The empty header area intercepts cover gestures')
  require(document.documentElement.scrollWidth <= innerWidth + 1, 'Page has horizontal overflow')
  return { viewport: { width: innerWidth, height: innerHeight }, safeTop, safeBottom, cover, header, back, more, footer }
}
