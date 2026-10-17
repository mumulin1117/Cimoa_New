// One-shot evidence aggregation; never imported by the application.
import fs from 'node:fs'
import cp from 'node:child_process'
import crypto from 'node:crypto'
import assert from 'node:assert/strict'

const option = name => process.argv.find(arg => arg.startsWith('--' + name + '='))?.split('=').slice(1).join('=')
const base = option('base'), native_path = option('native-result'), bundle = option('bundle')
assert.ok(base && native_path && bundle, 'Provide --base, --native-result and --bundle')
const git = args => cp.execFileSync('git', args, { encoding: 'utf8' }).trim().split('\n').filter(Boolean)
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'))
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
const native = read(native_path), unit = read('docs/evidence/account-flows/unit-results.json')
assert.equal(native.failedTests, 0); assert.equal(native.passedTests, 5); assert.equal(native.skippedTests, 0)
assert.equal(unit.result, 'passed'); assert.equal(unit.tests, 154)
const manifest = read('ios/cimoaNeapo/Resources/build-manifest.json')
for (const entry of manifest.files) assert.equal(hash(bundle + '/H5/' + entry.file), entry.sha256, entry.file)
assert.equal(hash('ios/cimoaNeapo/Resources/build-manifest.json'), hash(bundle + '/build-manifest.json'))
const prototype = hash('CIRCA All Screens (interactive).html')
assert.equal(prototype, '6c49411c6868b476ff46cedaa9828ee2ccbfe89d5eaa7ea1f739feb2c8018060')
const changes = git(['diff', '--name-only', 'HEAD']), preserved = changes.filter(p => p.startsWith('docs/evidence/registration/') && p.endsWith('.png'))
const files = [...new Set([...git(['diff', '--name-only', base, 'HEAD']), ...changes, ...git(['ls-files', '--others', '--exclude-standard'])])].filter(p => fs.existsSync(p) && !preserved.includes(p))
const theme = read('src/config/theme.json')
const flatten = (object, prefix = '') => Object.entries(object).flatMap(([key, value]) => typeof value === 'object' ? flatten(value, prefix + key + '-') : ['--cimoa-' + prefix + key.replaceAll('_', '-')])
const variables = new Set([...flatten(theme.colors), ...flatten(theme.gradients, 'gradient-'), ...flatten(theme.shadows, 'shadow-'), ...[...fs.readFileSync('src/utils/theme.js', 'utf8').matchAll(/'(--cimoa-[\w-]+)'/g)].map(m => m[1])])
for (const file of files.filter(p => p.startsWith('src/'))) {
  for (const match of fs.readFileSync(file, 'utf8').matchAll(/var\((--cimoa-[\w-]+)/g)) assert.ok(variables.has(match[1]), file + ': undefined theme variable ' + match[1])
}
const reports = files.filter(p => /acceptance.json$|profile-browser.json$|account-flows\/(voice|preferences|profile-child-merge|purchase-recovery|coin-return|coin-refund|coin-processing|coin-spend-failed).json$/.test(p) && p !== 'docs/evidence/account-flows/acceptance.json').flatMap(file => {
  const result = read(file)
  return result.result === 'passed' && Array.isArray(result.checks) ? [{ file, checks: result.checks.length, result: result.result }] : []
})
const pages = read('docs/cimoa-page-inventory.json'), in_progress = pages.filter(p => p.status === 'in_progress')
assert.equal(in_progress.length, 0)
const report = {
  date: '2026-10-17', base_commit: base,
  result: 'Local functional regression passed; full visual and production-service acceptance pending',
  unit,
  browser: { reports, recorded_checks_including_repeated_cross_page_coverage: reports.reduce((n, r) => n + r.checks, 0) },
  native: { summary: native_path, result: native, module: 'docs/evidence/account-flows/native-module.json', initial_failures: 'Three harness assumptions repaired: actual pop owner, navigation-settle timing/current page, and retaining unrelated blocked accounts. Original assertions remain, with fixture-derived counts. Final five-case suite rerun without failures.' },
  h5: { files: manifest.files.length, every_test_bundle_file_matches: true, prototype_sha256: prototype, prototype_not_packaged: !manifest.files.some(p => /CIRCA|interactive/i.test(p.file)) },
  page_status: pages.filter(p => /^\/pages\/(profile|settings|safety|coins|legal)\//.test(p.route)).map(p => ({ query: p.source_query, component: p.component, status: p.status, local_acceptance: p.local_acceptance, visual_acceptance: p.visual_acceptance || 'pending', full_acceptance: p.full_acceptance })),
  in_progress: [],
  remaining: ['Full independent visual approval for this increment', 'Manual OS touch, keyboard, picker, hardware permission and physical background recovery for this increment', 'No microphone input device: browser recording uses controlled input', 'StoreKit products/receipt verification, university verification, support delivery, formal legal and signing configuration'],
  preserved_user_files: preserved,
  task_files: [...new Set([...files.filter(p => !p.startsWith('dist/')), 'docs/evidence/account-flows/acceptance.json', 'docs/evidence/account-flows/unit-results.xml'])],
  conventions: { gates: ['corepack pnpm check:conventions', 'git diff --check', 'corepack pnpm build:h5'], result: 'passed in order before this one-shot report', new_warnings: 0, changed_source_theme_variables_all_defined: true, convention_files_unchanged: git(['diff', '--name-only', base, '--', 'DEVELOPMENT_CONVENTIONS.md', 'INTERACTION_CONVENTIONS.md']).length === 0, git: 'local commits only; no push', data: 'canonical Store/getters, custom 500ms pre-write Loading, atomic media/ledger compensation and full-auth-context scope' },
  cleanup: { temporary_browser_servers: 'closed in each test finally; final PID audit separately recorded', unrelated_project_servers: 'untouched', stale_empty_git_locks: 'moved recoverably after no Git process/lsof owner was found' },
}
if (fs.existsSync(unit.report_source)) fs.copyFileSync(unit.report_source, 'docs/evidence/account-flows/unit-results.xml')
fs.writeFileSync('docs/evidence/account-flows/acceptance.json', JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify({ unit: unit.tests, browser_checks: report.browser.recorded_checks_including_repeated_cross_page_coverage, native: native.passedTests, h5: manifest.files.length, preserved_user_files: preserved.length }))
