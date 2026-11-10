// One-shot engineering evidence; never imported by the shipped application.
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import crypto from 'node:crypto'
import cp from 'node:child_process'
import assert from 'node:assert/strict'
import { campusHeritageCatalog, campusHeritageIndex, campusHeritagePathway } from './lib/campusHeritagePathway.mjs'

const option = name => process.argv.find(a => a.startsWith('--' + name + '='))?.slice(name.length + 3)
const bundle = option('bundle'), mainResult = option('native-result'), extraResult = option('native-extra')
assert.ok(bundle && mainResult && extraResult, 'Provide built --bundle and both current native result summaries')
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'))
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
const git = args => cp.execFileSync('git', args, { encoding: 'utf8' }).trim().split('\n').filter(Boolean)
const base = 'e6325bce', output = 'docs/evidence/sync-recovery', unit = read(output + '/unit-results.json')
assert.equal(unit.result, 'passed'); assert.equal(unit.tests, 165); assert.equal(unit.failures, 0); assert.equal(unit.skipped, 0)
const native = [read(mainResult), read(extraResult)]
for (const summary of native) { assert.equal(summary.failedTests, 0); assert.equal(summary.skippedTests, 0) }
assert.equal(native[0].passedTests, 4); assert.equal(native[1].passedTests, 2)
const nativeModule = read(output + '/native-cross-page.json')
assert.equal(nativeModule.result, 'passed'); assert.equal(nativeModule.checks.length, 21); assert.equal(nativeModule.original_storage_restored, true)
const background = read(output + '/native-background.json'), matchFlow = read('docs/evidence/auto-match/flow-wkwebview.json')
assert.equal(background.result, 'passed'); assert.equal(matchFlow.passed, true)
for (const name of ['ready', 'done']) assert.equal(fs.readFileSync('docs/evidence/auto-match/native-background-' + name + '.txt', 'utf8').trim(), background.token)
const browserFiles = [
  ...['profile', 'chat', 'group'].map(p => output + '/' + p + '-browser.json'),
  'docs/ui-restoration/event-group/source-browser-acceptance.json',
  'docs/evidence/social-entities/browser-acceptance.json',
  'docs/evidence/auto-match/flow-browser.json',
  ...['voice', 'profile-child-merge', 'coin-processing'].map(p => 'docs/evidence/account-flows/' + p + '.json'),
]
const browser = browserFiles.map(file => {
  const report = read(file); assert.ok(report.result === 'passed' || report.passed === true, file)
  assert.deepEqual(report.errors, [], file); assert.equal(report.cleaned_up, true, file)
  return { file, checks: report.checks, temporary_pid: report.server_pid }
})
const resources = 'ios/cimoaNeapo/CimomusicOrientationPathfinder'
const festivalPackage = fs.readFileSync(path.join(bundle, campusHeritagePathway))
assert.equal(hash(path.join(resources, campusHeritagePathway)), campusHeritageIndex(festivalPackage))
const catalog = campusHeritageCatalog(festivalPackage)
const manifest = catalog.manifest
const academicFiles = new Map(catalog.files.map(entry => [entry.file, entry.data]))
for (const entry of manifest.files) {
  assert.equal(crypto.createHash('sha256').update(academicFiles.get(entry.file)).digest('hex'), entry.sha256, entry.file)
  if (entry.file !== 'startup-motion.json') assert.equal(hash(path.join('dist/build/h5', entry.file)), entry.sha256, entry.file)
}
assert.ok(!manifest.files.some(p => /CIRCA|interactive/i.test(p.file)))
assert.equal(hash('CIRCA All Screens (interactive).html'), read(output + '/source-audit.json').source_sha256)
const extraction = fs.mkdtempSync(path.join(os.tmpdir(), 'cimoa-sync-archive-check-'))
try {
  cp.execFileSync('/usr/bin/ditto', ['-x', '-k', 'artifacts/cimoaNeapo-ios.zip', extraction])
  const root = path.join(extraction, 'cimoaNeapo')
  const archivePackage = fs.readFileSync(path.join(root, 'CimomusicOrientationPathfinder', campusHeritagePathway))
  assert.equal(campusHeritageIndex(archivePackage), campusHeritageIndex(festivalPackage))
  const archiveFiles = new Map(campusHeritageCatalog(archivePackage).files.map(entry => [entry.file, entry.data]))
  for (const entry of manifest.files) assert.equal(crypto.createHash('sha256').update(archiveFiles.get(entry.file)).digest('hex'), entry.sha256)
  assert.equal(hash(path.join(root, 'Tests/HostTests.swift')), hash('ios/cimoaNeapo/Tests/HostTests.swift'))
} finally { fs.rmSync(extraction, { recursive: true, force: true }) }
const inventory = read('docs/cimoa-page-inventory.json')
assert.equal(inventory.filter(row => row.status === 'in_progress').length, 0)
const conventionFiles = git(['diff', '--name-only', base, '--', 'DEVELOPMENT_CONVENTIONS.md', 'INTERACTION_CONVENTIONS.md'])
assert.deepEqual(conventionFiles, [])
const preserved = git(['diff', '--name-only']).filter(f => /^docs\/evidence\/registration\/.+\.png$/.test(f))
assert.equal(preserved.length, 10, 'Keep all ten pre-existing user screenshot changes unstaged')
const taskFiles = [...new Set([...git(['diff', '--name-only', base, 'HEAD']), ...git(['diff', '--name-only']), ...git(['ls-files', '--others', '--exclude-standard'])])].filter(f => fs.existsSync(f) && !preserved.includes(f))
const report = {
  date: '2026-10-17', base_commit: base,
  result: 'Scoped functional regression passed; full visual and manual hardware acceptance pending',
  unit, browser: { reports: browser, recorded_checks_including_repeated_coverage: browser.reduce((n, p) => n + p.checks.length, 0) },
  native: { summaries: native, module: nativeModule, background, match_flow: matchFlow, simulator: 'iPhone 17 Pro / iOS 26.5', tested_safe_area: '62 / 34',
    initial_harness_corrections: ['Synthetic DOM click cannot satisfy the unchanged WKWebView trusted-touch playback policy; assert the real denial and independently decode persisted bytes without autoplay', 'HTMLMediaElement metadata may be deferred before a trusted touch; use a non-playing Web Audio decoder in the test only, not a product policy override', 'The existing Auto Match test requires an actual OS background round trip. Its initial missing-handshake run failed; rerun with the bounded Settings companion, keeping the original assertion'],
    additional_regressions: ['Full Auto Match recovery and explicit peer acceptance', 'Fresh registration, owned photos, profile/preview/settings/account loop, relogin and first-visit-only Tab skeletons'],
  },
  h5: { files: manifest.files.length, built_test_bundle_matches_every_file: true, archive_matches_every_file: true, archive: 'artifacts/cimoaNeapo-ios.zip', prototype_runtime_embedded: false },
  implemented: [
    'One visible-members selector for event card/detail/group header/participant list; actual occupancy and capacity are not reduced by privacy or block',
    'Full auth generation checked before delayed media/introduction/spend publication and receipt replay; staged media is compensated without resurrecting deleted accounts',
    'Fresh hydration does not recreate intentionally removed catalog photos/questions or populate deleted profiles',
    'Retained profile/chat instances close private overlays, cancel Loading and reject replacement logins; group preview derives from visible message_id instead of a stale URL',
    'Block filters Home/Discover/profiles/requests/matching/private/group media; unblock restores visibility only, not old consent or conversations',
  ],
  ui: { unchanged_layout_and_copy: true, visual_acceptance: 'pending', source_audit: output + '/source-audit.json',
    affected_pages: inventory.filter(p => ['route=expanded', 'route=chat', 'route=evGroup&joined=1'].includes(p.source_query)).map(p => ({ query: p.source_query, component: p.component, status: p.status, local_acceptance: p.local_acceptance, visual_acceptance: p.visual_acceptance, full_acceptance: p.full_acceptance })),
  },
  conventions: { unchanged_convention_files: true, canonical_store_getters_only: true, prewrite_custom_loading: '500ms', page_order: 'source audit, one page, browser regression, three gates and local commit before next page', required_gates: ['corepack pnpm check:conventions', 'git diff --check', 'corepack pnpm build:h5'], gates: 'passed in order', convention_warnings: 0, xcode_note: 'Non-blocking SDK AppIntents metadata extraction skipped because no AppIntents dependency exists', git: 'local commits only; no push' },
  remaining: ['Full independent visual/pixel acceptance, including known baseline source/actual differences', 'Trusted OS-touch playback, physical microphone/camera, system keyboard/picker and real hardware background recovery for this increment', 'No production payment, university verification or remote messaging service success is claimed'],
  preserved_user_files: preserved, task_files: [...new Set([...taskFiles, output + '/acceptance.json'])],
  cleanup: { temporary_previews: 'Each finally block closed its server/browser; final PID audit recorded separately', native_media: 'Unique test Blob keys removed and exact pre-test storage restored', unrelated_project_services: 'untouched' },
}
fs.writeFileSync(output + '/acceptance.json', JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify({ tests: unit.tests, browser_checks: report.browser.recorded_checks_including_repeated_coverage, native: native.reduce((n, s) => n + s.passedTests, 0), h5_files: manifest.files.length, preserved_user_files: preserved.length }))
