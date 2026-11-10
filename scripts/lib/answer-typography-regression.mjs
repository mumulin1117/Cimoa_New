// Shared browser/WKWebView assertions. Start on a blank Your answer page with safe-area values injected.
export async function answer_typography_regression() {
  const checks = []
  const wait = async predicate => {
    for (let i = 0; i < 200; i++) { if (predicate()) return; await new Promise(resolve => setTimeout(resolve, 25)) }
    throw Error(`Answer typography timed out: ${location.hash}`)
  }
  const lastPage = () => [...document.querySelectorAll('uni-page')].at(-1)
  const root = () => [...document.querySelectorAll('.ice-text-page')].find(element => element.closest('uni-page') === lastPage() && element.getBoundingClientRect().height > 0)
  await wait(() => !!root()?.querySelector('textarea'))
  const page = root(), field = page.querySelector('textarea'), wrapper = page.querySelector('.ice-textarea')
  if (field.value !== '') throw Error('This typography regression requires an empty unpublished answer')
  await document.fonts.ready
  await Promise.all([...page.querySelectorAll('.page-transition')].flatMap(element => element.getAnimations().filter(animation => animation.effect?.getComputedTiming().iterations !== Infinity).map(animation => animation.finished)))
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  const find = selector => { const element = page.querySelector(selector); if (!element) throw Error(`Missing answer element: ${selector}`); return element }
  const box = element => { const rect = element.getBoundingClientRect(); return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, right: rect.right, bottom: rect.bottom } }
  const type = element => {
    const style = getComputedStyle(element)
    return { font_size: parseFloat(style.fontSize), font_weight: style.fontWeight, line_height: parseFloat(style.lineHeight), font_family: style.fontFamily, letter_spacing: style.letterSpacing, word_break: style.wordBreak, overflow_wrap: style.overflowWrap, color: style.color }
  }
  const placeholder = find('.uni-textarea-placeholder')
  const scale = innerWidth / 393
  const typography = (element, size, weight, line, label) => {
    const value = type(element)
    if (Math.abs(value.font_size - size * scale) > 0.35 || value.font_weight !== String(weight) || Math.abs(value.line_height - line * scale) > 0.35) throw Error(`Incorrect ${label} typography: ${JSON.stringify(value)}`)
    return value
  }
  const metrics = {
    viewport: { width: innerWidth, height: innerHeight },
    safe_area: {
      top: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--native-safe-area-top')) || 0,
      bottom: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--native-safe-area-bottom')) || 0,
    },
    type: {
      header: typography(find('.ice-header-title'), 20, 600, 26, 'header'),
      name: typography(find('.ice-person--text .ice-person-name'), 14, 500, 20, 'identity'),
      question: typography(find('.ice-person-question'), 18, 600, 26, 'question'),
      heading: typography(find('.ice-write-title'), 22, 600, 28, 'write heading'),
      textarea: typography(field, 17, 400, 26, 'actual answer input'),
      placeholder: typography(placeholder, 17, 400, 26, 'placeholder'),
      counter: typography(find('.ice-counter'), 12, 400, 18, 'counter'),
      primary: typography(find('.ice-text-send'), 16, 600, 22, 'primary action'),
      secondary: typography(find('.ice-switch'), 14, 500, 20, 'secondary action'),
    },
    layout: {
      root: box(page), header: box(find('.ice-header')), back: box(find('.ice-back')), title: box(find('.ice-header-title')),
      scroll: box(find('.secondary-page-scroll')), footer: box(find('.ice-footer')), primary: box(find('.ice-text-send')), secondary: box(find('.ice-switch')),
    },
    placeholder_text: placeholder.textContent,
    question_text: find('.ice-person-question').textContent,
    storage_writes: 0,
  }
  for (const property of ['font_size', 'font_weight', 'line_height', 'font_family', 'letter_spacing', 'word_break']) {
    if (metrics.type.textarea[property] !== metrics.type.placeholder[property]) throw Error(`Placeholder and input differ: ${property}`)
  }
  if (metrics.type.textarea.word_break !== 'normal' || type(wrapper).word_break !== 'normal') throw Error('Answer text must wrap naturally, not break every letter')
  const secondaryColor = getComputedStyle(document.documentElement).getPropertyValue('--cimoa-text-secondary').trim()
  const probe = document.createElement('span'); probe.style.color = secondaryColor; page.appendChild(probe)
  const normalizedSecondary = getComputedStyle(probe).color; probe.remove()
  if (metrics.type.name.color !== normalizedSecondary) throw Error('Identity should use the secondary theme text color')
  if (!metrics.placeholder_text.includes('Zane') || metrics.question_text !== 'What is your ideal weekend hike?') throw Error('Answer does not use Zane and the selected second question')
  checks.push('Eight text roles use the intended responsive font hierarchy; placeholder and real input match')
  const layout = metrics.layout, safe = metrics.safe_area
  if (Math.abs(layout.title.y + layout.title.height / 2 - layout.back.y - layout.back.height / 2) > 1) throw Error('Header title is not centered alongside Back')
  if (layout.header.y < safe.top - 1 || layout.footer.bottom > innerHeight - safe.bottom + 1) throw Error('Header or footer crosses the safe area')
  if (layout.primary.height < 60 * scale - 1 || layout.primary.height < 44) throw Error('Primary action is too short')
  if (layout.scroll.bottom > layout.footer.y + 1 || layout.root.width > innerWidth + 1) throw Error('Content overlaps the fixed footer or viewport')
  for (const [name, rect] of Object.entries(layout)) if (rect.x < -1 || rect.right > innerWidth + 1) throw Error(`${name} overflows horizontally`)
  if (page.scrollWidth > page.clientWidth + 1) throw Error('Answer page overflows horizontally')
  checks.push('Header and controls remain safe-area bounded, with a fixed minimum-height primary action and separate scroll region')
  const before = localStorage.getItem('cimoa_app_state_v2'), original = Storage.prototype.setItem
  let writes = 0
  const setValue = value => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(field, value)
    field.dispatchEvent(new Event('input', { bubbles: true }))
  }
  Storage.prototype.setItem = function(key, value) { if (key === 'cimoa_app_state_v2') writes++; return original.call(this, key, value) }
  try {
    setValue('An easy trail, a sea view, and coffee after the hike.')
    await new Promise(resolve => setTimeout(resolve, 700))
    if (!find('.ice-counter').textContent.includes(String(field.value.length))) throw Error('Counter does not follow the answer')
    if (writes !== 0 || localStorage.getItem('cimoa_app_state_v2') !== before) throw Error('Typing unexpectedly persisted the answer')
    if ([...page.querySelectorAll('.event-loading')].some(element => element.getBoundingClientRect().height > 0)) throw Error('Typing displayed a redundant loading overlay')
    setValue('')
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    if (field.value !== '' || writes !== 0 || localStorage.getItem('cimoa_app_state_v2') !== before) throw Error('Clearing unpublished text changed persistent data')
    metrics.storage_writes = writes
    checks.push('Typing and clearing are immediate UI-only edits with zero storage writes and no loading; the page remains blank')
    return { passed: true, metrics, checks }
  } finally {
    if (field.isConnected && field.value !== '') setValue('')
    Storage.prototype.setItem = original
  }
}
