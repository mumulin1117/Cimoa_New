import { h, render } from 'vue'
import SendSurfaceHost from '@/components/SendSurfaceHost.vue'
import { auto_match_surface, match_preferences_surface, send_surface } from './sendSurface.js'

const installed = new Map()
export function install_send_surface_host({ document: doc = globalThis.document, window: win = globalThis.window, controller = send_surface } = {}) {
  if (!doc?.body || !win?.addEventListener) return () => {}
  if (installed.has(controller)) return installed.get(controller)
  const root = doc.createElement('div')
  root.id = controller.presentation.root_id; root.style.pointerEvents = 'none'
  doc.body.appendChild(root); render(h(SendSurfaceHost, { controller }), root)
  const resize = () => controller.clear('viewport-changed')
  const hide = () => controller.clear('background')
  const visibility = () => { if (doc.visibilityState === 'hidden') hide() }
  const route = () => controller.route_changed()
  const media = win.matchMedia?.('(prefers-reduced-motion: reduce)')
  const reduced = () => { if (controller.current.busy) controller.clear('motion-preference-changed') }
  for (const event of ['resize', 'orientationchange']) win.addEventListener(event, resize)
  for (const event of ['hashchange', 'popstate']) win.addEventListener(event, route)
  win.addEventListener('pagehide', hide)
  doc.addEventListener('visibilitychange', visibility)
  media?.addEventListener?.('change', reduced)
  const dispose = () => {
    if (installed.get(controller) !== dispose) return
    controller.clear('host-removed')
    for (const event of ['resize', 'orientationchange']) win.removeEventListener(event, resize)
    for (const event of ['hashchange', 'popstate']) win.removeEventListener(event, route)
    win.removeEventListener('pagehide', hide)
    doc.removeEventListener('visibilitychange', visibility)
    media?.removeEventListener?.('change', reduced)
    render(null, root); root.remove(); installed.delete(controller)
  }
  installed.set(controller, dispose)
  return dispose
}

export const install_auto_match_surface_host = options => install_send_surface_host({ ...options, controller: auto_match_surface })
export const install_match_preferences_surface_host = options => install_send_surface_host({ ...options, controller: match_preferences_surface })
