import { shallowRef } from 'vue'

// A short-lived presentation receipt, never another relationship table. Only
// successful consent actions can enqueue one; hydration/reads cannot celebrate.
export const connection_visual_revision = shallowRef(0)
const pending = new Map(), consumed = new Set()
let generation = 0
const accepting_actions = new Set(['resolve_request', 'accept_request', 'respond_to_match', 'apply_match_event'])
const receipt_key = (context, connection) => JSON.stringify([context, connection.connection_id])
export function clear_connection_visuals() { generation++; pending.clear(); consumed.clear(); connection_visual_revision.value++ }
export function install_connection_visuals(store) {
  return store.$onAction(({ name, after }) => {
    if (!accepting_actions.has(name)) return
    const context = store.auth_context, token = generation, previous = new Set(store.connections.map(row => row.connection_id))
    after(result => {
      if (!result?.success || result.repeated || token !== generation || context !== store.auth_context || globalThis.document?.hidden) return
      for (const connection of store.connections) {
        if (previous.has(connection.connection_id) || !connection.conversation_id || !(connection.source_request_id || connection.source_match_id)) continue
        const key = receipt_key(context, connection)
        if (consumed.has(key) || pending.has(key)) continue
        pending.set(key, { context, connection_id: connection.connection_id, user_id: connection.user_id })
        connection_visual_revision.value++
      }
    })
  }, true)
}
export function take_connection_visuals(context, cards) {
  const result = []
  for (const card of cards) {
    if (card.kind !== 'connected' || !card.connection_id) continue
    const key = receipt_key(context, card), cue = pending.get(key)
    if (!cue || cue.user_id !== card.user_id) continue
    pending.delete(key); consumed.add(key); result.push(card.user_id)
  }
  return result
}
