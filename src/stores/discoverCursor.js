// Browsing position is UI state, not a relationship, skip record or saved profile.
// Keep the stable ID across Tab page replacement without persisting business data.
export function discover_cursor_index(cursor, auth_context, ids) {
  if (!ids.length || cursor?.auth_context !== auth_context) return 0
  const retained = ids.indexOf(cursor.user_id)
  if (retained >= 0) return retained
  const index = Number.isInteger(cursor.index) && cursor.index >= 0 ? cursor.index : 0
  return index % ids.length
}

export const discover_cursor_actions = {
  remember_discover_card(user_id) {
    if (!this.session.is_authenticated) return false
    const index = this.discover_people.findIndex(person => person.user_id === user_id)
    if (index < 0) return false
    this.discover_cursor = { auth_context: this.auth_context, user_id, index }
    return true
  },
  reconcile_discover_cursor() {
    if (!this.session.is_authenticated) return
    const person = this.discover_people[this.discover_card_index]
    if (person) this.remember_discover_card(person.user_id)
    else this.discover_cursor = null
  },
}
