// Mechanical source audit/evidence generation, not application runtime.
import fs from 'node:fs'
import path from 'node:path'
import { read_circa_source, walk_html, attribute } from './lib/circa-source.mjs'
import { sha256 } from './lib/pixel-acceptance.mjs'
export const phases = {
  deck: ['photo', 'isPhoto', 360, 399, '/pages/discover/index', 'src/pages/discover/index.vue'],
  profile: ['expanded', 'isExpanded', 401, 531, '/pages/discover/profile?user_id=user_zane', 'src/pages/discover/profile.vue'],
  select: ['ibSelect', 'isIbSelect', 609, 654, '/pages/discover/icebreaker/select?user_id=user_zane', 'src/pages/discover/icebreaker/select.vue'],
  text: ['ibText', 'isIbText', 656, 689, '/pages/discover/icebreaker/text?user_id=user_zane&draft_id=draft_discover', 'src/pages/discover/icebreaker/text.vue'],
  voice: ['ibVoice', 'isIbVoice', 691, 745, '/pages/discover/icebreaker/voice?user_id=user_zane&draft_id=draft_discover', 'src/pages/discover/icebreaker/voice.vue'],
  preview: ['ibPreview', 'isIbPreview', 747, 797, '/pages/discover/icebreaker/preview?user_id=user_zane&draft_id=draft_discover&media_id=media_discover', 'src/pages/discover/icebreaker/preview.vue'],
}
const source = read_circa_source(), audit = JSON.parse(fs.readFileSync('docs/circa-source-audit.json'))
if (process.argv[1]?.endsWith('discover-request-contracts.mjs')) for (const [phase, [route, condition, start, end, destination, component]] of Object.entries(phases)) {
  const folder = path.resolve(`docs/ui-restoration/discover-request-${phase}`); fs.mkdirSync(folder, { recursive: true })
  let root; walk_html(source.html, node => { if (node.tag === 'sc-if' && attribute(node, 'value') === `{{ ${condition} }}`) root = node })
  const geometry = [], copy = [], svg = [], interactions = []
  walk_html(root, node => {
    if (node.type === 2 && node.content.trim()) copy.push({ line: node.loc.start.line, text: node.content.trim() })
    if (node.type !== 1) return
    const style = attribute(node, 'style'); if (style) geometry.push({ line: node.loc.start.line, tag: node.tag, style })
    if (node.tag === 'svg') svg.push({ line: node.loc.start.line, fragment: node.loc.source })
  })
  const bindings = audit.interactions.filter(row => row.route === route)
  for (const row of bindings) interactions.push({ interaction_id: row.interaction_id, source_screen: `${route} decoded HTML ${start}–${end}`, trigger: row.interaction_id.includes('.change.') ? 'input' : 'click', preconditions: 'Ready authenticated account; current user_id and account-owned draft/question/media; submit revalidates consent, privacy, balance and blocks.', visible_feedback: 'Pure navigation has no Loading; selection is transient. Business writes show custom 500ms Loading, lock duplicates, preserve input on failure. Source control/animation retained.', success_result: 'Same user_id → question_id → draft_id → request_id; only accepting account establishes Connection/Conversation. Navigation returns to actual origin.', failure_result: 'Readable inline error; no partial request, consent or ledger mutation; cancelled/obsolete work cannot submit.', persistence: 'Store metadata for saved draft/request; IndexedDB for recorded Blob; browsing/selection/navigation none.', sync_scope: 'Discover, profile, Home, sent/received, Connection and authorized Conversation; current account only.', acceptance: `scripts/discover-request-browser.test.mjs --page=${phase}; corresponding HostTests native pixel/flow test; source/actual/overlay/diff in this folder.` })
  const fragment = source.template.split('\n').slice(start - 1, end).join('\n')
  const contract = { page: phase, component, route: destination, source: { file: source.filename, file_sha256: source.source_hash, query: `route=${route}`, condition, lines: [start, end], fragment_sha256: sha256(fragment), fragment, geometry, copy, svg }, source_lock: 'locked', reference_viewport: { width: 393, height: 852, top: 54, bottom: 0 }, animation: { name: 'cRise', duration_ms: ['deck','profile'].includes(phase) ? 260 : 240, capture: 'end frame; no fake audio progress or wave animation' }, approved_deltas: ['Cimoa brand; canonical six user identities/photos/questions/audio replace conflicting source names', 'Actual safe areas, fixed header/footer and one scroll region; deck remains non-scrolling/responsive per user', 'Text is free, 300 characters; no payment branch', 'Actual recording/decoded duration replaces hardcoded playing 00:12; missing capability fails', 'Existing connection/pending request/match routes to canonical entity; never creates on navigation', 'Saved drafts are account-scoped; Loading before writes; no automatic consent or reply'], states: ['default','loading','empty','error','long','refresh','back','blocked','session_expired'], interaction_ids: interactions.map(row => row.interaction_id) }
  fs.writeFileSync(path.join(folder, 'source-contract.json'), JSON.stringify(contract, null, 2) + '\n')
  fs.writeFileSync(path.join(folder, 'interactions.json'), JSON.stringify(interactions, null, 2) + '\n')
  console.log(`${phase}: ${interactions.length} source bindings locked`)
}
