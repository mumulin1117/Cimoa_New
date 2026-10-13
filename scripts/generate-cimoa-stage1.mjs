import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

const root = process.cwd()
const source = fs.readFileSync(path.join(root, 'CIRCA All Screens (interactive).html'), 'utf8')
const readScript = (html, type) => {
  const match = html.match(new RegExp(`<script type="${type}">([\\s\\S]*?)</script>`))
  if (!match) throw new Error(`Missing ${type}`)
  return JSON.parse(match[1])
}
const manifest = readScript(source, '__bundler/manifest')
const standalone = zlib.gunzipSync(Buffer.from(manifest[Object.keys(manifest)[0]].data, 'base64')).toString('utf8')
const template = readScript(source, '__bundler/template')
const groups = []
let current = null
const groupSource = template.slice(template.indexOf('groups: ['), template.indexOf('];', template.indexOf('groups: [')))
for (const line of groupSource.split('\n')) {
  const title = line.match(/title:\s*"([^"]+)"/)
  if (title) {
    current = { title: title[1], screens: [] }
    groups.push(current)
  }
  const screen = line.match(/s\("([^"]+)",\s*"([^"]+)"\)/)
  if (screen && current) current.screens.push({ name: screen[1], route: screen[2].replace('route=', '') })
}
const assetManifest = JSON.parse(fs.readFileSync(path.join(root, 'static/assets/manifest.json'), 'utf8'))
const entities = {
  'LAUNCH & AUTH': 'session, legal, verification', ONBOARDING: 'profile, preferences, media', PERMISSIONS: 'permission',
  'MAIN LEVEL': 'user, connection, event', 'DISCOVER · ICEBREAKER': 'user, icebreaker, coin_transaction', CONNECTION: 'connection_request, user',
  'AUTO MATCH': 'match_queue, match_preference, connection', 'MESSAGES & CALLS': 'conversation, message, call', EVENTS: 'event, participant, report',
  COINS: 'wallet, coin_package, coin_transaction', PROFILE: 'profile, media, verification', SETTINGS: 'settings, blocked_user, permission', SAFETY: 'report, blocked_user',
  'SYSTEM STATES': 'system_state, session', 'POPUPS & SHEETS': 'sheet, confirmation', 'EDIT PROFILE · PICKERS': 'profile, picker_option',
}
const interactions = (group, route) => {
  const ids = ['route_transition', 'back']
  if (group.includes('AUTH')) ids.push('continue', 'create_account', 'log_in', 'verify_email')
  if (group === 'ONBOARDING') ids.push('save_profile', 'select_option', 'upload_photo')
  if (group === 'PERMISSIONS') ids.push('request_permission')
  if (group.includes('ICEBREAKER')) ids.push('select_question', 'send_text', 'record_voice', 'spend_coins')
  if (group === 'CONNECTION') ids.push('send_request', 'accept_request', 'decline_request')
  if (group === 'AUTO MATCH') ids.push('set_preferences', 'join_queue', 'pause_queue', 'leave_queue', 'accept_match', 'pass_match')
  if (group === 'MESSAGES & CALLS') ids.push('send_message', 'start_call', 'accept_call', 'end_call')
  if (group === 'EVENTS') ids.push('filter_events', 'join_event', 'cancel_attendance', 'open_group_chat', 'report_event')
  if (group === 'COINS') ids.push('select_package', 'purchase_coins', 'confirm_spend', 'open_transaction_detail')
  if (group === 'PROFILE' || group.includes('EDIT PROFILE')) ids.push('edit_profile', 'save_profile', 'select_picker_option')
  if (group === 'SETTINGS') ids.push('toggle_setting', 'manage_blocked_accounts', 'logout', 'delete_account')
  if (group === 'SAFETY') ids.push('submit_report', 'block_user')
  if (route.includes('sheet=')) ids.push('dismiss_sheet')
  return ids.join(', ')
}
const pageLevel = (group, route) => group === 'SYSTEM STATES' ? 'system' : (group.includes('SHEET') || group.includes('PICKER') || route.includes('sheet=') || route.includes('pop=') ? 'sheet' : (group === 'MAIN LEVEL' ? 'main_tab' : 'secondary'))
const assetText = (group) => group.includes('EVENT') ? 'static/assets/img/*' : (group.includes('PROFILE') || group.includes('MATCH') || group.includes('MESSAGES') ? 'static/assets/head/*; static/assets/songs/*' : (group.includes('COIN') ? 'static/assets/coins/*' : 'none'))
const rows = groups.flatMap((group) => group.screens.map((screen) => `| ${screen.name} | ${pageLevel(group.title, screen.route)} | ${screen.route} | ${group.title.toLowerCase()} sibling state and tab/header actions | TopSafeArea; header; ${pageLevel(group.title, screen.route) === 'main_tab' ? 'CustomTabBar' : 'back control'} | one main scroll-view; fixed sheets where present | ${interactions(group.title, screen.route)} | ${entities[group.title] ?? 'unknown'} | ${assetText(group.title)} | ${screen.route.includes('sheet=') ? 'sheet_open' : 'default'} | pending |`))
const output = [
  '# Cimoa 阶段一：CIRCA 原型页面恢复清单', '',
  '来源：CIRCA All Screens (interactive).html。本文件只描述 Vue/uni-app 的恢复目标，运行时不加载原 HTML。', '',
  `- 屏幕状态：${rows.length}`, `- 业务分组：${groups.length}`, `- 本地资源：${assetManifest.assets.length}`,
  '- 实现边界：颜色只来自 src/config/theme.json；业务写入归 Pinia Store；交互通过路由工具、Store action、Loading 和自定义确认组件完成。', '',
  '## 分组摘要', '', '| group | screens | entities | status |', '|---|---:|---|---|',
  ...groups.map((group) => `| ${group.title} | ${group.screens.length} | ${entities[group.title]} | pending |`), '',
  '## 屏幕清单', '',
  '| source_screen | page_level | route | entry_points | fixed_regions | scroll_region | interaction_ids | entities | assets | states | status |',
  '|---|---|---|---|---|---|---|---|---|---|---|', ...rows, '',
  '## 缺失或需适配的原型资源', '',
  '原型使用内联 emoji 与颜色；这些不直接移植。已提取的 29 个图片资源见 static/assets/manifest.json，缺失的系统图标由 @element-plus/icons-vue 或现有图片资源承载。', '',
].join('\n')
fs.mkdirSync(path.join(root, 'docs'), { recursive: true })
fs.writeFileSync(path.join(root, 'docs/cimoa-stage1-page-inventory.md'), output)
console.log(`Generated ${rows.length} screen inventory rows.`)
