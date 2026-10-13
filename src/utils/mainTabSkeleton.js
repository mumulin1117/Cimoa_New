import { MAIN_TABS, route_path } from '../config/navigation.js'

const eligible = new Set()
export function prepare_main_tab_skeleton() {
  eligible.clear()
  MAIN_TABS.forEach((tab) => eligible.add(tab.path))
}
export function consume_main_tab_skeleton(route) {
  const path = route_path(route)
  return eligible.delete(path)
}
