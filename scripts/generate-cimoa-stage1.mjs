import fs from 'node:fs'
import { read_circa_source, read_catalog } from './lib/circa-source.mjs'

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
  return /Confirm|Block|Leaving|Accepting|Boost|Cancel|Discard|logout|FoundLeave/.test(params.sheet)
    ? `${name}ConfirmDialog` : `${name}Sheet`
}
const records = read_catalog(source.catalog).flatMap((group) => group.screens.map((screen) => {
  const { route: key, ...state } = screen.params
  const route = plan_route(key)
  const component = component_name(screen.params)
  const is_tab = tab_keys.includes(key) && !component
  const source_lines = audit.sections.filter((section) => section.route === key).map((section) => section.source_line)
  return { source_screen: screen.source_screen, source_query: screen.source_query, source_lines,
    page_level: component ? (component.endsWith('ConfirmDialog') ? '确认弹窗' : screen.params.pop ? 'Popover' : 'Sheet') : is_tab ? '主 Tab' : '二级/三级（随入口）',
    route: component ? 'component' : route, component: component ? `src/components/${component}.vue` : null,
    parent_route: component ? route : null,
    entry_points: audit.transitions.filter((edge) => edge.target === JSON.stringify(key)).map((edge) => `${edge.handler}@${edge.source_line}`),
    return_owner: component ? '关闭后恢复宿主页' : is_tab ? 'replace_route 切换，不 Push' : '普通返回本次来源实例；root 成功分支才清栈',
    fixed_regions: key === 'photo' ? 'DiscoverHeroHeader 接管顶部安全区; CustomTabBar' : is_tab ? 'TopSafeArea; 主功能栏; CustomTabBar' : 'TopSafeArea; SecondaryPageHeader; 有输入/操作栏时固定在滚动区外',
    scroll_region: component ? '面板内容滚动，背景不可交互' : '唯一 scroll-view; min-height: calc(100% + 2rpx)',
    top_safe_area_owner: key === 'photo' ? 'DiscoverHeroHeader（计划）' : 'TopSafeArea',
    bottom_safe_area_owner: tab_keys.includes(key) ? 'CustomTabBar' : 'BottomSafeArea',
    interaction_ids: audit.interactions.filter((item) => item.route === key).map((item) => item.interaction_id),
    entities: entities[route.split('/')[2]], assets: 'circa-source-audit.json resources（全部逐项，不用通配目录代替）',
    states: state, status: 'pending', mapping_status: 'planned; requires per-entry contract review' }
}))
const clean = (value) => String(value).replaceAll('|', '\\|').replaceAll('\n', ' ')
const opening = fs.readFileSync('docs/cimoa-stage1-source-findings.md', 'utf8')
const output = [opening.trim(), '', '## 全量画板映射', '',
  '下表为计划路由，不表示已注册或已实现。所有必填字段、安全区所有者、来源行号、interaction_ids 见 [结构化清单](./cimoa-page-inventory.json)。', '',
  '| source_screen | 原型定位参数 | page_level | 计划 route 或 component | status |', '| --- | --- | --- | --- | --- |',
  ...records.map((record) => `| ${clean(record.source_screen)} | ${clean(record.source_query)} | ${record.page_level} | ${record.component || record.route} | pending |`), '',
  '生成方式：先运行 `node scripts/audit-circa-source.mjs`，再运行 `node scripts/generate-cimoa-stage1.mjs`。只做静态解析，不执行原型脚本。', '' ].join('\n')
fs.writeFileSync('docs/cimoa-page-inventory.json', JSON.stringify(records, null, 2) + '\n')
fs.writeFileSync('docs/cimoa-stage1-page-inventory.md', output)
console.log(`Corrected ${records.length} source states; no restoration status was promoted.`)
