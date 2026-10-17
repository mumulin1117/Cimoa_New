// Isolated test fixture, never imported by the application.
import fs from 'node:fs'
import { create_seed } from '../src/stores/seed.js'
const data = create_seed(), now = Date.now(), request_id = 'request_native_voice', media_id = `media_native_voice_${crypto.randomUUID()}`
data.media_files.push({ media_id, owner_user_id: 'user_noah', kind: 'audio', media_url: `indexeddb://${media_id}`, mime: 'audio/wav', byte_size: 48044, duration_ms: 1500 })
data.requests = [{ request_id, sender_id: 'user_noah', recipient_id: 'user_cimoa', question_id: 'user_cimoa_q_0', question_text: 'How would you spend your ideal weekend?', kind: 'voice', text: '', audio_id: media_id, status: 'pending', created_at: now - 1000, resolved_at: null }]
for (const [suffix,amount,kind,key] of [['opening',10,'opening','native_voice_opening'],['spend',-10,'spend',`voice:${request_id}`]]) data.coin_transactions.push({ transaction_id: `native_voice_${suffix}`, owner_user_id: 'user_noah', business_key: key, amount, kind, status: 'completed', related_id: request_id, created_at: now, fixture: true })
fs.mkdirSync('docs/evidence/connection-core', { recursive: true })
fs.writeFileSync('docs/evidence/connection-core/native-lifecycle-fixture.json', JSON.stringify({ data, media_id, request_id }, null, 2) + '\n')
console.log('Prepared isolated, balanced native request fixture with a unique 1500 ms PCM recording ID.')
