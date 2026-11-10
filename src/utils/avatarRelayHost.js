import { h, render } from 'vue'
import AvatarRelayHost from '@/components/AvatarRelayHost.vue'
import { avatar_relay } from './avatarRelay.js'

let installed = null
export function install_avatar_relay_host({ document: doc = globalThis.document, window: win = globalThis.window } = {}) {
  if (!doc?.body || !win?.addEventListener) return () => {}
  if (installed) return installed
  const root = doc.createElement('div')
  root.id = 'cimoa-avatar-relay-root'; root.setAttribute('aria-hidden', 'true')
  root.style.pointerEvents = 'none'
  doc.body.appendChild(root); render(h(AvatarRelayHost), root)
  const clear = () => avatar_relay.clear()
  const visibility = () => { if (doc.visibilityState === 'hidden') clear() }
  const take_over = () => { if (avatar_relay.current) clear() }
  const route = () => avatar_relay.route_changed(win.location.hash.slice(1) || win.location.pathname + win.location.search)
  for (const event of ['resize', 'orientationchange', 'pagehide']) win.addEventListener(event, clear)
  for (const event of ['hashchange', 'popstate']) win.addEventListener(event, route)
  doc.addEventListener('visibilitychange', visibility)
  doc.addEventListener('pointerdown', take_over, { capture: true, passive: true })
  installed = () => {
    clear()
    for (const event of ['resize', 'orientationchange', 'pagehide']) win.removeEventListener(event, clear)
    for (const event of ['hashchange', 'popstate']) win.removeEventListener(event, route)
    doc.removeEventListener('visibilitychange', visibility)
    doc.removeEventListener('pointerdown', take_over, { capture: true })
    render(null, root); root.remove(); installed = null
  }
  return installed
}
