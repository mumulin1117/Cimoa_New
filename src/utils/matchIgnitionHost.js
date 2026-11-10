import { h, render } from 'vue'
import MatchIgnitionHost from '@/components/MatchIgnitionHost.vue'
import { clear_match_ignition } from './matchIgnition.js'
export function install_match_ignition_host() {
  if (typeof document === 'undefined' || document.getElementById('cimoa-ignition-root')) return () => {}
  const root = document.createElement('div')
  root.id = 'cimoa-ignition-root'; document.body.appendChild(root)
  render(h(MatchIgnitionHost), root)
  const cancel = () => clear_match_ignition()
  const visibility = () => { if (document.hidden) cancel() }
  document.addEventListener('visibilitychange', visibility)
  for (const name of ['pagehide', 'resize', 'orientationchange']) window.addEventListener(name, cancel)
  return () => {
    cancel(); document.removeEventListener('visibilitychange', visibility)
    for (const name of ['pagehide', 'resize', 'orientationchange']) window.removeEventListener(name, cancel)
    render(null, root); root.remove()
  }
}
