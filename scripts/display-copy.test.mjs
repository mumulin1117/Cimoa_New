import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { report_status_label } from '../src/utils/reportPresentation.js'
import { LOCAL_VERIFICATION_CODE } from '../src/config/local-auth.js'

const files = []
function walk(dir) { for (const row of fs.readdirSync(dir, { withFileTypes: true })) { const file = path.join(dir, row.name); if (row.isDirectory()) walk(file); else if (/\.(vue|js|json)$/.test(file)) files.push(file) } }
walk('src'); files.push('ios/cimoaNeapo/Sources/WebViewController.swift')
test('runtime copy has no development-mode phrases; internal identifiers and real event names remain', () => {
  const bad = /\b(?:local (?:data|demo|social|account|build|mode|verification|storage|draft|profile|session|media)|local-only|saved locally|stored locally|local coin mode|this build|development and testing)\b/i
  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8').split('\n').filter(line => !line.trim().startsWith('//')).join('\n')
    assert.doesNotMatch(source, bad, file)
  }
  assert.equal(LOCAL_VERIFICATION_CODE, '009789')
  assert.equal(report_status_label('local_saved'), 'Not delivered')
  const store = fs.readFileSync('src/stores/store.js', 'utf8')
  assert.match(store, /register_local_account/); assert.match(fs.readFileSync('src/stores/selectors.js', 'utf8'), /status === 'local_saved'/)
  assert.match(fs.readFileSync('src/stores/seed.js', 'utf8'), /Robotics Demo Day/)
  const login = fs.readFileSync('src/pages/auth/login.vue', 'utf8')
  assert.match(login, /show_test_states = import.meta.env.DEV/); assert.match(login, /v-if="show_test_states" class="auth-test-states"/)
})
test('both Report entry buttons use the requested label with unchanged interaction IDs', () => {
  const user = fs.readFileSync('src/pages/safety/report-user.vue', 'utf8'), event = fs.readFileSync('src/pages/events/report.vue', 'utf8')
  assert.match(user, /action-label="Submit report"/)
  assert.match(event, /data-interaction="evReport.submitEvReport.click.1"[^>]*>Submit report</)
  assert.match(user, /safetyReport.submitReport.click.1/)
  for (const source of [user, event]) { assert.match(source, /run_with_loading/); assert.match(source, /store.submit_report/); assert.doesNotMatch(source, /Under Review|Report submitted successfully/) }
  assert.match(user, /return_after_report/); assert.doesNotMatch(user, /class="report-saved"/)
  assert.match(event, /return_after_report/); assert.doesNotMatch(event, /class="event-report-saved"/)
})
