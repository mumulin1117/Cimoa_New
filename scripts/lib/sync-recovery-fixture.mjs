import fs from 'node:fs'
import { create_scenario } from '../../src/stores/scenarios.js'
import { discover_test_audio } from './discover-test-audio.mjs'

export function sync_recovery_fixture(now = Date.now()) {
  const data = create_scenario('event_joined', now), audio = discover_test_audio()
  data.settings.push({ owner_user_id: 'user_zoe', privacy: { event_visible: false } })
  const media = [
    { media_id: 'sync_audio', kind: 'audio', mime: audio.mime, byte_size: audio.byte_size, duration_ms: audio.duration_ms, base64: audio.base64 },
    { media_id: 'sync_image', kind: 'image', mime: 'image/png', byte_size: fs.statSync('static/assets/head/maya-card.png').size, duration_ms: 0, source: '/static/assets/head/maya-card.png' },
  ]
  for (const row of media) data.media_files.push({ media_id: row.media_id, owner_user_id: 'user_chloe', kind: row.kind, mime: row.mime, byte_size: row.byte_size, duration_ms: row.duration_ms, media_url: 'indexeddb://' + row.media_id })
  for (const [conversation_id, prefix] of [['conversation_chloe', 'private'], ['group_picnic', 'group']]) {
    for (const row of media) data.messages.push({ message_id: 'sync_' + prefix + '_' + row.kind, conversation_id, sender_id: 'user_chloe', kind: row.kind, body: '', media_id: row.media_id, sent_at: now - 2000 + (row.kind === 'image' ? 1000 : 0), read_by: ['user_chloe'] })
  }
  return { data, media, scope: 'Controlled message fixtures; encoded test tone, not a microphone recording or a real peer response' }
}
