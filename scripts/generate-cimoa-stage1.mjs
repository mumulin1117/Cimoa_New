import fs from 'node:fs'
import { read_circa_source, read_catalog, walk_html, attribute, binding } from './lib/circa-source.mjs'
import { page_contracts, level_labels, sheet_owners, parameters_for, completion_for } from './lib/page-contracts.mjs'

// Only generates planning documents; neither this module nor the source HTML is
// imported into the application. Source route keys are not production routes.
const source = read_circa_source()
const audit = JSON.parse(fs.readFileSync('docs/circa-source-audit.json', 'utf8'))
if (audit.source_sha256 !== source.source_hash) throw new Error('Run audit-circa-source.mjs first')
const kebab = (value) => value.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()
const explicit = {
  home: 'home/index', photo: 'discover/index', expanded: 'discover/profile', events: 'events/index',
  profile: 'profile/index', profilePreview: 'profile/preview', settings: 'settings/index',
  splash: 'auth/splash', welcome: 'auth/welcome', age: 'auth/age', agree: 'auth/community', signup: 'auth/signup', login: 'auth/login',
  chat: 'messages/chat', msgList: 'messages/index', safetyReport: 'safety/report-user', blockedList: 'settings/blocked',
  reportsSubmitted: 'safety/reports', reportDetail: 'safety/report-detail', verified: 'profile/verification', reverify: 'profile/reverify',
  amEntry: 'auto-match/index', amPrefs: 'auto-match/preferences', coinStore: 'coins/index',
  coinApple: 'coins/purchasing', editAll: 'profile/edit', setSupport: 'settings/support', logoutConfirm: 'settings/index',
  callIncoming: 'messages/call/waiting', callActive: 'messages/call/waiting', callEnded: 'messages/call/waiting',
}
const domains = { legal: 'legal', ver: 'auth/verification', fp: 'auth/reset', ob: 'onboarding', perm: 'permissions',
  ib: 'discover/icebreaker', req: 'connections', am: 'auto-match', ev: 'events', coin: 'coins', edit: 'profile',
  set: 'settings', del: 'settings/delete', sys: 'system', call: 'messages/call' }
const plan_route = (key) => {
  if (explicit[key]) return `/pages/${explicit[key]}`
  const prefix = Object.keys(domains).find((candidate) => key.startsWith(candidate) && /^[A-Z]/.test(key.slice(candidate.length)))
  if (!prefix) throw new Error(`Missing explicit route plan for ${key}`)
  return `/pages/${domains[prefix]}/${kebab(key.slice(prefix.length))}`
}
const tab_keys = ['home', 'photo', 'events']
const entities = { home: 'users; user_relationships; connection_requests; match_sessions; goals; blocked_users',
  discover: 'users; profile_photos; icebreakers; introductions; interests; goals; coin_transactions',
  events: 'events; event_memberships; organizers; group_list; group_messages; reports',
  auth: 'user_accounts; session; verification; agreements', legal: 'legal_documents; agreements',
  onboarding: 'users; profile_drafts; profile_photos; interests; goals; icebreakers', permissions: 'permissions; media_files',
  connections: 'connection_requests; user_relationships; dm_conversations; users',
  'auto-match': 'match_sessions; match_preferences; match_quota; users; user_relationships; coin_transactions',
  messages: 'users; dm_conversations; dm_messages; call_sessions; user_relationships; blocked_users',
  coins: 'coin_packages; purchase_requests; coin_transactions', profile: 'users; profile_photos; interests; goals; icebreakers; profile_song',
  settings: 'settings; user_accounts; session; permissions; blocked_users; support_requests',
  safety: 'reports; blocked_users; users', system: 'session; service_state' }
const component_name = (params) => {
  if (params.pop) return 'ConnectionGoalsPopover'
  if (params.ea) return 'ProfilePickerSheet'
  if (!params.sheet) return null
  const name = params.sheet[0].toUpperCase() + params.sheet.slice(1)
  return /Confirm|Block|Leaving|Accepting|Boost|Cancel|Discard|logout|FoundLeave|coinVoice/.test(params.sheet)
    ? `${name.replace(/Confirm$/, '')}ConfirmDialog` : `${name}Sheet`
}
const source_markup = {}
walk_html(source.html, (node) => {
  if (node.tag !== 'sc-if') return
  const key = audit.route_conditions[binding(attribute(node, 'value'))]
  if (key) source_markup[key] = (source_markup[key] || '') + node.loc.source
})
const inventory_path = 'docs/cimoa-page-inventory.json'
const previous = fs.existsSync(inventory_path) ? JSON.parse(fs.readFileSync(inventory_path, 'utf8')) : []
const owned_interactions = (key) => audit.interactions.filter((entry) => entry.route === key || sheet_owners[entry.route]?.includes(key))
const records = read_catalog(source.catalog).flatMap((group) => group.screens.map((screen) => {
  const { route: key, ...state } = screen.params
  const route = plan_route(key)
  const component = component_name(screen.params)
  const is_tab = tab_keys.includes(key) && !component
  const source_lines = audit.sections.filter((section) => section.route === key).map((section) => section.source_line)
  const contract = page_contracts[key]
  if (!contract) throw new Error(`Missing page contract: ${key}`)
  const prior = previous.find((row) => row.source_query === screen.source_query)
  const parent_routes = contract.parents.map(plan_route)
  const interactions = owned_interactions(key)
  const asset_text = (source_markup[key] || '') + interactions.flatMap((entry) => entry.definitions.map((definition) => definition.body)).join('\n')
  const input_bar = ['chat', 'evGroup'].includes(key)
  const cta = ['photo', 'expanded', 'evDetail', 'ibText', 'ibVoice', 'ibPreview', 'reqReceived', 'amFound'].includes(key)
  return { source_screen: screen.source_screen, source_query: screen.source_query, source_lines,
    page_level: component ? (component.endsWith('ConfirmDialog') ? '确认弹窗' : screen.params.pop ? 'Popover' : 'Sheet') : level_labels[contract.level],
    route: component ? 'component' : route, component: component ? `src/components/${component}.vue` : null,
    parent_route: component ? route : parent_routes[0],
    allowed_origin_routes: component ? [route] : parent_routes,
    required_parameters: parameters_for(key),
    entry_points: audit.transitions.filter((edge) => edge.target === JSON.stringify(key)).map((edge) => `${edge.handler}@${edge.source_line}`),
    return_owner: component ? `关闭后恢复 ${route} 的原实体和滚动位置` : is_tab ? 'replace_route 在 Home/Discover/Events 间切换，不 Push' : `pop origin_route（允许来源：${parent_routes.join('、')}）；无历史实例时 replace ${parent_routes[0]}，不创建伪造实体`,
    completion_navigation: completion_for(key),
    fixed_regions: component ? `宿主页 ${route} 保持；面板/遮罩常驻挂载` : key === 'photo' ? 'DiscoverHeroHeader; CustomTabBar; Send shot CTA' : is_tab ? 'TopSafeArea; 主功能栏和标题; CustomTabBar' : `TopSafeArea; SecondaryPageHeader; ${input_bar ? 'MessageComposer' : cta ? '底部 CTA' : 'BottomSafeArea'}`,
    scroll_region: component ? '面板内部唯一滚动区；不滚动背景' : input_bar ? 'Header 与输入栏之间的消息 scroll-view；flex:1; min-height:0' : '固定区域之间唯一 scroll-view；flex:1; min-height:0',
    top_safe_area_owner: key === 'photo' ? 'DiscoverHeroHeader（计划）' : 'TopSafeArea',
    bottom_safe_area_owner: tab_keys.includes(key) ? 'CustomTabBar' : input_bar ? 'MessageComposer' : cta ? 'BottomCTA' : 'BottomSafeArea',
    interaction_ids: interactions.map((item) => item.interaction_id),
    entities: entities[route.split('/')[2]],
    assets: { media: audit.resources.filter((resource) => asset_text.includes(resource.source_id) || asset_text.includes(resource.bundle_id)).map(({ source_id, local_path, mime }) => ({ source_id, local_path, mime })),
      svg_source_lines: audit.svg_resources.filter((resource) => resource.route === key || sheet_owners[resource.route]?.includes(key)).map((resource) => resource.line),
      fonts: 'static/assets/fonts/source-fonts.css',
      dynamic_media: '以用户/照片/活动/歌曲实体引用 manifest 中的本地图片；音频不存在时明确不可用' },
    states: { ...state, required_checks: ['default', 'loading', 'empty', 'error', 'long-content', 'refresh', 'back'] }, status: prior?.status || 'pending',
    ...(key === 'home' ? { local_acceptance: prior?.local_acceptance || 'pending', full_acceptance: prior?.full_acceptance || 'pending',
      acceptance_policy: 'Home 本页可先验收；待依赖时回 pending；完整闭环与推送完成后才 verified' } : {}),
    ...(key.startsWith('call') ? { implementation_override: '用户确认仅等待接通模拟；非真实接通状态，按开发约定 12.5 合并实现' } : {}),
    mapping_status: 'source-mapped; implementation pending; ten-field contract required before page work' }
}))
const clean = (value) => String(value).replaceAll('|', '\\|').replaceAll('\n', ' ')
const opening = fs.readFileSync('docs/cimoa-stage1-source-findings.md', 'utf8')
const output = [opening.trim(), '', '## 全量画板映射', '',
  '下表为计划路由，不表示已注册或已实现。所有必填字段、安全区所有者、来源行号、interaction_ids 见 [结构化清单](./cimoa-page-inventory.json)。', '',
  '| source_screen | 原型定位参数 | page_level | 计划 route 或 component | status |', '| --- | --- | --- | --- | --- |',
  ...records.map((record) => `| ${clean(record.source_screen)} | ${clean(record.source_query)} | ${record.page_level} | ${record.component || record.route} | ${record.status} |`), '',
  '生成方式：先运行 `node scripts/audit-circa-source.mjs`，再运行 `node scripts/generate-cimoa-stage1.mjs`。只做静态解析，不执行原型脚本。', '' ].join('\n')
fs.writeFileSync('docs/cimoa-page-inventory.json', JSON.stringify(records, null, 2) + '\n')
fs.writeFileSync('docs/cimoa-stage1-page-inventory.md', output)
const owners = audit.interactions.map((entry) => ({ interaction_id: entry.interaction_id,
  source_line: entry.source_line, owner_routes: entry.route === 'showJumper' ? [] : (sheet_owners[entry.route] || [entry.route]).map(plan_route),
  scope: entry.route === 'showJumper' ? 'prototype-catalog-only; excluded from app' : entry.route.startsWith('sheet') || entry.route === 'unblockOpen' ? 'overlay' : 'app',
}))
fs.writeFileSync('docs/cimoa-interaction-owners.json', JSON.stringify(owners, null, 2) + '\n')
console.log(`Corrected ${records.length} source states; no restoration status was promoted.`)
