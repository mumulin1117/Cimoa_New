import { MAIN_TABS, route_path } from '../config/navigation.js'

// Presentation-only, process-lifetime cache. Never persist this or hydrate business data here.
export function create_content_loading_registry() {
  let scope = null, generation = 0
  const eligible = new Set(), entities = new Set()
  const prepare = (next_scope = null) => {
    scope = next_scope; generation++; eligible.clear(); entities.clear()
    MAIN_TABS.forEach(tab => eligible.add(tab.path))
  }
  const synchronize = next_scope => {
    if (next_scope === scope) return
    prepare(next_scope)
    if (!next_scope) eligible.clear()
  }
  return {
    prepare, synchronize,
    consume: route => eligible.delete(route_path(route)),
    cached: (kind, id) => entities.has(`${kind}:${id}`),
    ticket: () => generation,
    complete: (kind, id, ticket) => {
      if (!id || ticket !== generation) return false
      entities.add(`${kind}:${id}`); return true
    },
  }
}
export const content_loading = create_content_loading_registry()
export const prepare_main_tab_skeleton = (scope = null) => content_loading.prepare(scope)
export const consume_main_tab_skeleton = route => content_loading.consume(route)
