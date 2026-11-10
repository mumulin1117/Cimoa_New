import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = new URL('../', import.meta.url)
const read = file => fs.readFileSync(new URL(file, root), 'utf8')
const vue_files = directory => fs.readdirSync(new URL(directory, root), { withFileTypes: true }).flatMap(entry => {
  const file = path.posix.join(directory, entry.name)
  return entry.isDirectory() ? vue_files(file) : file.endsWith('.vue') ? [file] : []
})

test('page feedback uses action language without legacy persistence or development copy', () => {
  const files = vue_files('src/pages').filter(file => file !== 'src/pages/events/group.vue')
  files.push('src/components/DeleteAccountConfirmDialog.vue', 'src/components/AutoMatchHelpConfirmDialog.vue', 'src/components/ProfileBioConfirmDialog.vue')
  const legacy = /\bSaving\b|\bSaved (?:data|coin data|purchase data|queue position|preferences)\b|\bsaved (?:profile|private records|feature reference|student status|draft audio)\b|\b(?:local (?:data|account|build|demo|social)|demo mode)\b|could not be saved/i
  for (const file of files) assert.doesNotMatch(read(file), legacy, file)
})

test('Auto Match pages consume action-specific progress rather than a fixed match update', () => {
  for (const file of vue_files('src/pages/auto-match')) {
    const source = read(file)
    assert.match(source, /const\s*\{[^\n]*\bloading_label\b[^\n]*\}\s*=\s*use_auto_match_page/, file)
    assert.match(source, /<EventActionLoading\b[^>]*:label="loading_label"/, file)
    assert.doesNotMatch(source, /Updating your match|Saved queue position|Saved preferences/, file)
  }
})

test('support sending uses formal action language, preserves failure and hides internal draft identifiers', () => {
  const source = read('src/pages/settings/support.vue')
  const template = source.slice(source.indexOf('<template>'), source.indexOf('<style'))
  assert.match(template, /loading-label="Sending your message…"/)
  assert.match(template, /data-interaction="setSupport.submitDraft.click.1"[^>]*>Send message</)
  assert.doesNotMatch(template, /\{\{\s*draft_id\s*\}\}|Draft:/)
  assert.match(source, /Your message has not been sent\. It is still available to edit\. Please try again later\./)
  assert.match(source, /store\.save_draft\('support'/)
  assert.match(source, /store\.submit_support\(\{ draft_id: saved.data \}\)/)
  assert.doesNotMatch(source, /message (?:was )?delivered|support ticket (?:created|number)/i)
})

test('purchase feedback keeps App Store confirmation and unavailable outcomes accurate', () => {
  for (const file of ['src/pages/coins/index.vue', 'src/pages/coins/failed.vue']) assert.match(read(file), /label="Preparing purchase…"/)
  const purchasing = read('src/pages/coins/purchasing.vue')
  assert.match(purchasing, /label="Checking purchase…"/)
  assert.match(read('src/utils/purchaseLoadingHost.js'), /label: 'Confirming your purchase…'/)
  assert.match(purchasing, /Waiting for the App Store…/)
  assert.match(purchasing, /You can leave this page and return later\. Verified coins will be added once\./)
  assert.match(purchasing, /Back to Coin Store/)
  const leave_action = purchasing.slice(purchasing.indexOf('const cancel ='), purchasing.indexOf('const release ='))
  assert.match(leave_action, /navigate_store\(\)/)
  assert.doesNotMatch(leave_action, /cancel_purchase_request|settle_purchase|status\s*=\s*['"]cancelled/)
  assert.doesNotMatch(purchasing, />\s*Cancel purchase\s*</i)
  assert.match(read('src/components/PurchaseRecoveryConfirmDialog.vue'), /The original purchase may still complete\. A new purchase is separate and may result in a separate charge\./)
  assert.match(read('src/pages/coins/cancelled.vue'), /request\.phase === 'abandoned' \? 'Request released' : 'Purchase cancelled'/)
  const success = read('src/pages/coins/success.vue')
  assert.match(success, /This purchase hasn’t been confirmed by the App Store\. No coins were added\./)
  assert.match(success, /Purchases require confirmation from the App Store\./)
  assert.doesNotMatch(success, /StoreKit product IDs|verified StoreKit success/)
  assert.match(read('src/pages/coins/purchase-detail.vue'), /This balance entry does not represent an App Store payment\./)
})

test('real recording controls and report outcomes retain their product meanings', () => {
  const voice = read('src/pages/discover/icebreaker/voice.vue')
  assert.match(voice, /Record a playable voice introduction first\./)
  assert.match(voice, /'Stop recording' : 'Start recording'/)
  assert.match(read('src/components/ProfileBioConfirmDialog.vue'), /Record a playable voice bio first, or switch to Text\./)
  for (const file of ['src/pages/safety/report-user.vue', 'src/pages/events/report.vue']) {
    const source = read(file)
    assert.doesNotMatch(source, /Report saved|Under Review|Report submitted successfully/)
  }
  assert.doesNotMatch(read('src/pages/safety/report-user.vue'), /class="report-saved"/)
  assert.match(read('src/pages/events/report.vue'), /return_after_report/)
  assert.match(read('src/utils/toast.js'), /Thank you for sharing your concern\. We’ll review it as soon as possible\./)
})
