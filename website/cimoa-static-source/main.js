// Progressive enhancement only. Every public page and policy is real HTML.
(() => {
  'use strict'
  const $ = selector => document.querySelector(selector)
  const $$ = selector => [...document.querySelectorAll(selector)]
  // Only the unqualified entry URL follows a remembered language. Explicit
  // document URLs remain stable for sharing, search results and hreflang.
  try {
    if (/^\/(?:index\.html)?$/.test(location.pathname) && localStorage.getItem('cimoa-language') === 'en') {
      location.replace($('.header-actions [lang="en"]').dataset.languageUrl + location.hash)
      return
    }
  } catch { /* The French entry remains usable when preference access is denied. */ }
  const motion = matchMedia('(prefers-reduced-motion: reduce)')
  const menu = $('.menu-toggle'), nav = $('#main-nav')
  const closeMenu = () => { nav?.classList.remove('open'); menu?.setAttribute('aria-expanded', 'false'); if (menu) { menu.ariaLabel = menu.dataset.openLabel; menu.querySelector('i')?.setAttribute('class', 'ph ph-list') } }
  menu?.addEventListener('click', () => {
    const open = menu.getAttribute('aria-expanded') !== 'true'
    nav?.classList.toggle('open', open); menu.setAttribute('aria-expanded', String(open))
    menu.ariaLabel = open ? menu.dataset.closeLabel : menu.dataset.openLabel
    menu.querySelector('i')?.setAttribute('class', `ph ph-${open ? 'x' : 'list'}`)
  })
  nav?.addEventListener('click', event => { if (event.target.closest('a')) closeMenu() })
  addEventListener('keydown', event => { if (event.key === 'Escape') closeMenu() })
  $$('[data-language-url]').forEach(button => button.addEventListener('click', () => {
    try { localStorage.setItem('cimoa-language', button.lang) } catch { /* Navigation does not require storage. */ }
    if (button.getAttribute('aria-pressed') !== 'true') location.assign(button.dataset.languageUrl + location.hash)
  }))
  const tabs = $$('.feature-tabs [role="tab"]'), panels = $$('.feature-panel')
  const selectTab = (index, focus = false) => {
    tabs.forEach((tab, i) => { tab.setAttribute('aria-selected', String(i === index)); tab.tabIndex = i === index ? 0 : -1 })
    panels.forEach((panel, i) => { panel.hidden = i !== index })
    if (focus) tabs[index]?.focus()
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => selectTab(index))
    tab.addEventListener('keydown', event => {
      if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return
      event.preventDefault()
      selectTab(event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length, true)
    })
  })
  const dialog = $('dialog'), main = $('#main'), footer = $('footer'), header = $('.header')
  let dialogTrigger = null, oldOverflow = ''
  const closeDialog = () => {
    dialog?.close(); document.body.style.overflow = oldOverflow
    ;[main, footer, header].forEach(node => { if (node) node.inert = false })
    dialogTrigger?.focus()
  }
  $$('[data-open-download]').forEach(button => button.addEventListener('click', () => {
    if (!dialog || dialog.open) return
    dialogTrigger = button; oldOverflow = document.body.style.overflow
    dialog.showModal(); document.body.style.overflow = 'hidden'
    ;[main, footer, header].forEach(node => { if (node) node.inert = true })
  }))
  dialog?.addEventListener('cancel', event => { event.preventDefault(); closeDialog() })
  dialog?.addEventListener('click', event => { if (event.target === dialog) closeDialog() })
  $$('[data-close-download]').forEach(button => button.addEventListener('click', closeDialog))
  const meet = $('.meet-section'), pause = $('.meet-motion')
  let manuallyPaused = false, meetVisible = true
  const updateMotion = () => {
    if (!meet) return
    meet.dataset.paused = String(manuallyPaused || !meetVisible || document.hidden || motion.matches)
    if (pause) {
      pause.setAttribute('aria-pressed', String(manuallyPaused))
      pause.ariaLabel = manuallyPaused ? pause.dataset.resumeLabel : pause.dataset.pauseLabel
      pause.title = pause.ariaLabel; pause.textContent = manuallyPaused ? '▶' : 'Ⅱ'
    }
  }
  pause?.addEventListener('click', () => { manuallyPaused = !manuallyPaused; updateMotion() })
  let meetObserver, revealObserver, sectionObserver
  if ('IntersectionObserver' in window && meet) {
    meetObserver = new IntersectionObserver(entries => { meetVisible = entries[0].isIntersecting; updateMotion() }, { threshold: 0 })
    meetObserver.observe(meet)
  }
  const reveals = $$('.hero-copy,.screen-stage,.promise,.section-heading,.feature-tabs,.feature-panel,.safety-grid article,.student-copy,.student-visual,.faq-section>div,.download-inner,.info-heading,.about-story,.about-values section,.contact-card,.policy-notice')
  const reveal = () => {
    revealObserver?.disconnect()
    if (motion.matches || !('IntersectionObserver' in window)) { reveals.forEach(node => node.classList.remove('scroll-reveal')); return }
    revealObserver = new IntersectionObserver(entries => entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('is-revealed'); revealObserver.unobserve(entry.target) } }), { threshold: .06, rootMargin: '0px 0px -24px 0px' })
    reveals.forEach(node => { if (!node.hidden) { node.classList.add('scroll-reveal'); revealObserver.observe(node) } })
  }
  if ('IntersectionObserver' in window) {
    sectionObserver = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) $$('#main-nav a[data-section]').forEach(link => link.classList.toggle('active', link.dataset.section === entry.target.id))
    }), { rootMargin: '-15% 0px -60% 0px' })
    $$('[data-nav-section]').forEach(node => sectionObserver.observe(node))
  }
  const motionChanged = () => { updateMotion(); reveal() }
  document.addEventListener('visibilitychange', updateMotion); motion.addEventListener('change', motionChanged)
  updateMotion(); reveal()
  // Keep previously distributed fragment URLs working without a SPA fallback.
  const oldRoute = location.hash.match(/^#\/(about|privacy|terms)(?:\/section-(\d+))?$/)
  if (oldRoute) location.replace(oldRoute[1] + '.html' + (oldRoute[2] ? '#legal-section-' + oldRoute[2] : ''))
  addEventListener('pagehide', event => {
    if (event.persisted) return
    meetObserver?.disconnect(); revealObserver?.disconnect(); sectionObserver?.disconnect()
    document.removeEventListener('visibilitychange', updateMotion); motion.removeEventListener('change', motionChanged)
  })
})()
