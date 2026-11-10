import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createPinia } from 'pinia'
import { use_app_store } from '../src/stores/store.js'
import { terms_document, privacy_document, community_document, eula_document } from '../src/utils/legalDocuments.js'
import { community_rules, registration_agreements } from '../src/utils/registrationCatalog.js'

const documents = [terms_document, privacy_document, community_document]
test('all agreement entries use complete canonical documents, not registration summaries', () => {
  assert.deepEqual(registration_agreements.map(row => row.key), ['terms', 'privacy', 'community'])
  for (const document of documents) {
    const row = registration_agreements.find(row => row.key === document.id)
    for (const key of Object.keys(document)) assert.equal(row[key], document[key])
    assert.equal(Object.hasOwn(row, 'paragraphs'), false)
    assert.ok(document.updated && document.intro && document.footer && document.sections.length >= 8)
    assert.ok(Object.isFrozen(document) && Object.isFrozen(document.sections) && document.sections.every(Object.isFrozen))
    assert.throws(() => { document.sections[0][1] = 'Changed notice' }, TypeError)
  }
})
test('registration Store returns the same canonical content but no mutable references', () => {
  const store = use_app_store(createPinia()), catalog = store.registration_catalog
  assert.deepEqual(catalog.rules, community_rules)
  for (const row of catalog.agreements) {
    const canonical = documents.find(document => document.id === row.key)
    for (const key of Object.keys(canonical)) assert.deepEqual(row[key], canonical[key])
  }
  catalog.agreements[0].sections[0][1] = 'Caller mutation'
  assert.notEqual(terms_document.sections[0][1], 'Caller mutation')
  assert.notEqual(registration_agreements[0].sections[0][1], 'Caller mutation')
})
test('Guidelines cover campus social UGC safety without inventing moderation or contact services', () => {
  const text = JSON.stringify(community_document)
  for (const phrase of ['at least 18', 'university student', 'consent', 'Child sexual abuse', 'non-consensual intimate', 'AI-generated', 'Privacy', 'Auto Match', 'mutual connection', 'anonymous chat roulette', 'Events', 'scams', 'Reporting', 'Blocking']) assert.ok(text.includes(phrase), phrase)
  assert.match(text, /A report does not indicate human review/)
  assert.match(text, /do not guarantee human review or a response time/)
  assert.match(text, /not a service-wide moderation decision/)
  assert.doesNotMatch(text, /@|within 24 hours|Apple.approved|end-to-end encrypted/i)
  assert.equal(community_rules.length, 6, 'Keep source overview geometry unchanged')
})
test('formal legal copy removes environment labels without inventing server processing', () => {
  for (const doc of [...documents, eula_document]) assert.doesNotMatch(JSON.stringify(doc), /\bdemo\b|local (?:draft|data|account|build|demo|social|mode)|this build|development and testing|app storage|on this device|uploaded to a Cimoa server|no verification email is sent/i)
  const privacy = JSON.stringify(privacy_document)
  for (const phrase of ['within the app', 'does not confirm delivery, reading or a response', 'does not confirm delivery to a moderation or support team', 'do not establish email ownership or university enrollment', 'synchronization across devices are not provided']) assert.ok(privacy.includes(phrase), phrase)
  assert.doesNotMatch(privacy, /009789|email (?:has been|was) sent|university enrollment (?:has been|was) verified|cloud synchronization is available/i)
  assert.match(JSON.stringify(terms_document), /Account code confirmation is not proof of email ownership or university enrollment/)
})
test('formal document language preserves support and report boundaries without persistence captions', () => {
  for (const doc of [...documents, eula_document]) assert.doesNotMatch(JSON.stringify(doc), /\bsav(?:ing|ed)\b|\bdrafts?\b|\b(?:account|conversation|participation|private|safety) records?\b/i)
  const privacy = JSON.stringify(privacy_document)
  for (const phrase of ['Reports and support messages contain the subject, category, description and relevant context you provide', 'does not confirm delivery to a moderation or support team, create a support ticket or indicate human review', 'preparing a message does not contact a person']) assert.ok(privacy.includes(phrase), phrase)
  assert.match(privacy, /If a request cannot be completed, Cimoa shows an error rather than confirming delivery or success\./)
  assert.match(privacy, /Available coin purchases are processed by Apple\./)
  assert.match(privacy, /Store prices and currency are shown before purchase; coins are added only after Apple confirms the transaction\./)
  assert.match(privacy, /A payment awaiting approval may complete after you leave the purchase page\./)
  assert.match(JSON.stringify(terms_document), /A prepared support message is not a support ticket/)
  assert.match(JSON.stringify(terms_document), /reporting a concern does not guarantee human review/)
  assert.match(JSON.stringify(community_document), /Do not record, screenshot or redistribute intimate or private material without permission/)
})
test('standalone documents and Sheet share the read-only renderer; no inline content copies remain', () => {
  for (const file of ['src/pages/legal/terms.vue', 'src/pages/legal/privacy.vue', 'src/components/AgreementSheet.vue']) {
    const source = fs.readFileSync(file, 'utf8')
    assert.match(source, /LegalDocumentContent/)
    assert.doesNotMatch(source, /document\?\.paragraphs|No production .* contact is configured/)
  }
  const renderer = fs.readFileSync('src/components/LegalDocumentContent.vue', 'utf8')
  for (const property of ['updated', 'intro', 'sections', 'footer']) assert.ok(renderer.includes(`document.${property}`))
  assert.doesNotMatch(renderer, /localStorage|sessionStorage|v-html|setTimeout/)
})
