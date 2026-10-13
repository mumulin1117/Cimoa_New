import { clone_data } from './seed.js'
import * as select from './selectors.js'
import { default_persistence, STATE_KEY } from '../utils/statePersistence.js'
import { media_repository } from '../utils/mediaRepository.js'
import { inspect_media } from '../utils/mediaCapabilities.js'

const runtimes = new WeakMap()
export const get_runtime = (store) => runtimes.get(store) || { persistence: default_persistence, media: media_repository, inspect_media, clock: Date.now, services: {} }
export const configure_store_runtime = (store, options) => runtimes.set(store, { ...get_runtime(store), ...options })
export const make_id = (prefix = 'op') => `${prefix}_${globalThis.crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2)}`}`
export const failure = (reason, message) => ({ success: false, reason, message })
export const unavailable = (label) => failure('service_unavailable', `${label} is not configured. No changes were made.`)
export const require_auth = (data, now) => select.ensure(select.authenticated(data, now), 'Your session has expired. Please log in again.')
export const require_target = (data, target) => select.ensure(target !== select.owner_id(data) && select.visible(data, target), 'This profile is unavailable.')
export const require_student = (data) => select.ensure(data.users.find((row) => row.user_id === select.owner_id(data))?.verification_status === 'verified', 'Student verification is required.')

export function transact(store, operation, mutation, options = {}) {
  if (store.hydration_status !== 'ready') return failure('storage_not_ready', 'Saved data is unavailable. Please retry loading it.')
  try {
    const data = clone_data(store.data)
    const now = get_runtime(store).clock()
    if (!options.public) require_auth(data, now)
    if (options.expected_owner) select.ensure(options.expected_owner === select.owner_id(data), 'The account changed. Please retry.')
    if (operation) {
      select.ensure(typeof operation.id === 'string' && operation.id.length > 0, 'An operation ID is required.')
      const existing = data.operation_receipts.find((row) => row.owner_user_id === select.owner_id(data) && row.operation_id === operation.id)
      if (existing) {
        select.ensure(existing.fingerprint === operation.fingerprint, 'This operation ID was already used for another request.')
        return { success: true, data: clone_data(existing.result), repeated: true }
      }
    }
    const result = mutation(data, now) ?? null
    if (operation) data.operation_receipts.push({ owner_user_id: select.owner_id(data), operation_id: operation.id, fingerprint: operation.fingerprint, result, created_at: now })
    data.revision += 1
    data.updated_at = now
    select.validate_data(data)
    get_runtime(store).persistence.write(STATE_KEY, clone_data(data))
    store.data = data
    store.clock_ms = now
    store.last_error = ''
    return { success: true, data: result }
  } catch (error) {
    store.last_error = error.message || 'Unable to save changes. Please retry.'
    return failure('operation_failed', store.last_error)
  }
}
export const operation = (id, type, payload) => ({ id, fingerprint: JSON.stringify([type, payload]) })
export function add_transaction(data, amount, key, kind, related_id, now) {
  const owner = select.owner_id(data)
  select.ensure(Number.isInteger(amount) && amount !== 0, 'Invalid coin amount.')
  select.ensure(!data.coin_transactions.some((row) => row.owner_user_id === owner && row.business_key === key), 'This coin operation was already completed.')
  select.ensure(select.balance(data) + amount >= 0, 'Not enough coins.')
  const row = { transaction_id: make_id('txn'), owner_user_id: owner, business_key: key, kind, related_id, amount, status: 'completed', created_at: now }
  data.coin_transactions.push(row)
  return row
}
export function connect_users(data, other, now) {
  const owner = select.owner_id(data)
  for (const [from_user_id, to_user_id] of [[owner, other], [other, owner]]) if (!data.relationships.some((row) => row.from_user_id === from_user_id && row.to_user_id === to_user_id)) data.relationships.push({ relationship_id: make_id('rel'), from_user_id, to_user_id, created_at: now })
  let conversation = data.conversations.find((row) => row.kind === 'direct' && row.participant_ids.includes(owner) && row.participant_ids.includes(other))
  if (!conversation) {
    conversation = { conversation_id: make_id('conversation'), kind: 'direct', participant_ids: [owner, other], event_id: null }
    data.conversations.push(conversation)
  }
  return conversation.conversation_id
}
export const password_hash = async (password) => {
  select.ensure(globalThis.crypto?.subtle, 'Secure authentication is unavailable.')
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`cimoa-fixture:${password}`))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}
