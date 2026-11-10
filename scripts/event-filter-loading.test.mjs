import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { MOTION } from '../src/config/navigation.js'

const read = file => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
const section = (source, tag) => source.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`))?.[1] || ''
const block = (source, start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)))
const flatten = (object, prefix = '') => Object.entries(object).flatMap(([key, value]) => typeof value === 'object' ? flatten(value, `${prefix}${key}-`) : [[`--cimoa-${prefix}${key.replaceAll('_', '-')}`, value]])

test('category loading is a presentational component reusing the controlled encounter orbit', () => {
  const component = read('src/components/EventFilterLoading.vue'), script = section(component, 'script')
  assert.match(script, /defineProps\([\s\S]*\bvisible\b[\s\S]*\bcategory\b/)
  assert.match(component, /<BrandRefresh\b[^>]*:refreshing="visible"/)
  assert.match(component, /:label="[^"\n]*Updating events[^"\n]*category[^"\n]*"/)
  assert.match(component, /<template\s+#copy\b/)
  assert.doesNotMatch(script, /\b(?:use_app_store|localStorage|indexedDB|setTimeout|setInterval|requestAnimationFrame|fetch)\b/)
  assert.doesNotMatch(script, /(?:@\/stores\/|\.\/stores\/)/)
  assert.match(component, /pointer-events:\s*none/)
  assert.match(component, /@media\s*\(prefers-reduced-motion:\s*reduce\)/)
  assert.doesNotMatch(section(component, 'style'), /position:\s*fixed/)
})

test('category feedback belongs to the existing business content, never the fixed overlays', () => {
  const page = read('src/pages/events/index.vue'), template = section(page, 'template')
  const content = page.indexOf('class="events-content"'), filter = page.indexOf('<EventFilterLoading'), footer = page.indexOf('<template #footer>'), overlays = page.indexOf('<template #overlays>')
  assert.ok(content > 0 && filter > content && footer > filter && overlays > footer)
  assert.match(page.slice(filter, page.indexOf('/>', filter)), /:visible="is_loading\s*&&\s*(?:!!)?pending_tab"/)
  assert.match(page.slice(filter, page.indexOf('/>', filter)), /:category="pending_tab"/)
  assert.doesNotMatch(page.slice(overlays, page.indexOf('</MainTabFrame>', overlays)), /EventFilterLoading/)
  assert.match(page, /<EventActionLoading\b[^>]*:visible="is_loading\s*&&\s*!pending_tab"/)
  // Existing data remains in the ordinary content branches rather than becoming skeletons.
  assert.ok(template.length > 0)
  assert.match(page, /<scroll-view\s+v-else[^>]*class="events-carousel"/)
  assert.doesNotMatch(page, /<MainTabSkeleton|prepare_main_tab_skeleton|\.hydrate\(\)/)
})

test('category selection keeps the write operation, account guard, busy guard and stale-result generation', () => {
  const page = read('src/pages/events/index.vue')
  const select = block(page, 'const select_tab =', 'const submit =')
  assert.match(page, /pending_tab\s*=\s*ref\(['"]['"]\)/)
  assert.match(page, /filter_generation\s*=\s*0/)
  assert.match(page, /use_write_loading\(\)/)
  assert.match(select, /if\s*\([^)]*is_loading\.value[^)]*sheet_locked\.value[^)]*store\.active_event_tab\s*===\s*label[^)]*\)\s*return/)
  assert.match(select, /\+\+filter_generation/)
  assert.match(select, /pending_tab\.value\s*=\s*label/)
  assert.match(select, /await write\([^\n]*store\.select_event_tab\(label\)/)
  assert.match(select, /(?:token|generation)\s*!==\s*filter_generation/)
  assert.match(select, /pending_tab\.value\s*=\s*['"]['"]/)
  assert.match(select, /result\.reason\s*!==\s*['"]cancelled['"]/)
  assert.match(page, /return run\(\(\) => store\.session\.current_user_id !== owner/)
  assert.doesNotMatch(page, /\b(?:setTimeout|setInterval|localStorage|indexedDB)\b/)
  const operation = read('src/utils/writeOperation.js')
  assert.match(operation, /run\(action, duration = 500\)/)
  assert.match(operation, /requested_duration = Number\.isFinite\(duration\) \? duration : 500/)
  assert.match(operation, /Math\.max\(400, Math\.min\(600, requested_duration\)\)/)
})

test('hide, unmount and account changes clear category UI and terminate pending work', () => {
  const page = read('src/pages/events/index.vue')
  const reset = block(page, 'const reset_transient =', '</script>')
  assert.match(reset, /filter_generation\+\+|\+\+filter_generation/)
  assert.match(reset, /pending_tab\.value\s*=\s*['"]['"]/)
  assert.match(reset, /cancel\(\)/)
  assert.match(reset, /onHide\(reset_transient\)/)
  assert.match(reset, /watch\(\(\) => store\.session\.current_user_id, reset_transient\)/)
  const unmount = block(read('src/composables/useWriteLoading.js'), 'onUnmounted(() => {', 'return { is_loading')
  assert.match(unmount, /disposed = true[\s\S]*operation\.cancel\(\)/)
  for (const event of ['visibilitychange', 'pagehide', 'pageshow']) assert.match(unmount, new RegExp(`removeEventListener\\?\\.\\('` + event + `'`))
})

test('optional orbit label is used for accessibility and copy, without changing the Home call', () => {
  const brand = read('src/components/BrandRefresh.vue')
  assert.match(brand, /label:\s*(?:String|\{\s*type:\s*String)/)
  assert.match(brand, /const display_label = computed\(\(\) => props\.label\s*\|\|\s*model\.value\.label\)/)
  assert.match(brand, /:aria-label="display_label"/)
  assert.match(brand, /<slot\s+name="copy"[^>]*>/)
  assert.match(brand, /\{\{\s*display_label\s*\}\}/)
  const frame = read('src/components/MainTabFrame.vue')
  assert.equal((frame.match(/<BrandRefresh\b/g) || []).length, 1)
  assert.match(frame, /<BrandRefresh\s+:refreshing="refreshing"\s+:progress="pull_progress"\s*\/>/)
  assert.doesNotMatch(brand, /\b(?:setTimeout|setInterval|localStorage|indexedDB|use_app_store)\b/)
})

test('category loading colors, gradients, shadow and motion have semantic central configuration', () => {
  const theme = JSON.parse(read('src/config/theme.json'))
  const tokens = Object.fromEntries([...flatten(theme.colors), ...flatten(theme.gradients, 'gradient-'), ...flatten(theme.shadows, 'shadow-')])
  const component = read('src/components/EventFilterLoading.vue'), styles = section(component, 'style')
  const variables = [...component.matchAll(/var\((--cimoa-[\w-]+)/g)].map(match => match[1])
  assert.ok(variables.length > 0)
  for (const variable of variables) assert.ok(Object.hasOwn(tokens, variable), `Missing theme token: ${variable}`)
  for (const [group, prefix] of [[theme.gradients, 'gradient'], [theme.shadows, 'shadow']]) {
    const keys = Object.keys(group).filter(key => key.startsWith('event_filter'))
    assert.ok(keys.length > 0, `Missing ${prefix} event_filter token`)
    assert.ok(keys.some(key => variables.includes(`--cimoa-${prefix}-${key.replaceAll('_', '-')}`)))
  }
  assert.ok(variables.some(variable => variable.includes('event-filter')))
  assert.doesNotMatch(styles, /#[\da-fA-F]{3,8}\b|\b(?:rgb|rgba|hsl|hsla)\(/)
  for (const name of ['event_filter_enter', 'event_filter_leave']) {
    assert.ok(Number.isFinite(MOTION[name]) && MOTION[name] > 0 && MOTION[name] < 500)
    assert.ok(component.includes(`MOTION.${name}`))
  }
})

test('join and cancellation retain their existing confirmation and action-loading contract', () => {
  const page = read('src/pages/events/index.vue')
  assert.match(page, /<EvJoinConfirmDialog\b[^>]*:busy="is_loading"/)
  assert.match(page, /<EvCancelConfirmDialog\b[^>]*:busy="is_loading"/)
  const submit = block(page, 'const submit =', 'const reset_transient =')
  assert.match(submit, /await write\(kind === 'join' \? 'Joining event…' : 'Cancelling attendance…'/)
  assert.match(submit, /store\.join_event\(id\)\s*:\s*store\.leave_event\(id\)/)
  const loading = read('src/components/EventActionLoading.vue')
  assert.match(loading, /import ActionLoading from/)
  assert.match(loading, /<ActionLoading :visible="visible" :label="label" scope="event"/)
  assert.doesNotMatch(loading, /position:\s*fixed|event-loading-ring|EventFilterLoading|BrandRefresh|pending_tab/)
})
