import test from 'node:test'
import assert from 'node:assert/strict'
import { MAIN_TABS } from '../src/config/navigation.js'
import { prepare_main_tab_skeleton, consume_main_tab_skeleton } from '../src/utils/mainTabSkeleton.js'
import { switch_tab_route, current_route, push_route, back_route } from '../src/utils/routeTransition.js'

test('only successful auth prepares three independent one-use skeletons', () => {
  assert.equal(consume_main_tab_skeleton('/pages/home/index'), false)
  prepare_main_tab_skeleton()
  assert.equal(consume_main_tab_skeleton('/pages/profile/index'), false)
  for (const tab of MAIN_TABS) { assert.equal(consume_main_tab_skeleton(tab.path), true); assert.equal(consume_main_tab_skeleton(tab.path), false) }
  prepare_main_tab_skeleton()
  assert.equal(consume_main_tab_skeleton('pages/home/index'), true)
})
test('navigation rejects repeats, resets after failure, and replaces only known main tabs', async () => {
  let pages = [{ route: 'pages/home/index' }], callback, count = 0
  globalThis.getCurrentPages = () => pages
  globalThis.uni = { redirectTo: (args) => { callback = args; count++ }, navigateTo: (args) => { callback = args }, navigateBack: (args) => { pages.pop(); args.success() } }
  await switch_tab_route('/pages/home/index'); assert.equal(count, 0)
  const pending = switch_tab_route('/pages/discover/index')
  await assert.rejects(switch_tab_route('/pages/events/index'), /progress/)
  assert.equal(callback.animationType, 'none'); callback.fail({ errMsg: 'guard rejected' }); await assert.rejects(pending, /guard rejected/)
  const retry = switch_tab_route('/pages/discover/index'); pages = [{ route: 'pages/discover/index' }]; callback.success(); await retry
  assert.equal(current_route(), 'pages/discover/index'); assert.equal(pages.length, 1)
  await assert.rejects(switch_tab_route('/pages/profile/index'), /Unknown/)
  for (const route of ['pages/profile/index', 'pages/system/index']) { const forward = push_route(`/${route}`); pages.push({ route }); callback.success(); await forward }
  assert.equal(pages.length, 3); await back_route(); await back_route(); assert.equal(pages.length, 1)
  delete globalThis.uni; delete globalThis.getCurrentPages
})
