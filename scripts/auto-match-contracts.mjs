// Offline design audit only. Never imported by the application.
import fs from 'node:fs'
import path from 'node:path'
import { read_circa_source, walk_html, attribute } from './lib/circa-source.mjs'
import { sha256 } from './lib/pixel-acceptance.mjs'
export const match_pages = {
  index: ['amEntry','isAmEntry',1460,1508], preferences: ['amPrefs','isAmPrefs',1511,1608],
  searching: ['amSearching','isAmSearching',1611,1667], paused: ['amPaused','isAmPaused',1670,1702],
  found: ['amFound','isAmFound',1705,1764], waiting: ['amWaiting','isAmWaiting',1767,1792],
  connected: ['amConnected','isAmConnected',1795,1817], passed: ['amPassed','isAmPassed',1820,1840],
  expired: ['amExpired','isAmExpired',1843,1863], 'no-match': ['amNoMatch','isAmNoMatch',1866,1887],
  history: ['amHistory','isAmHistory',1890,1915],
}
if (process.argv[1]?.endsWith('auto-match-contracts.mjs')) {
  const source=read_circa_source(), audit=JSON.parse(fs.readFileSync('docs/circa-source-audit.json'))
  for (const [page,[route,condition,start,end]] of Object.entries(match_pages)) {
    const folder=path.resolve(`docs/ui-restoration/auto-match-${page}`);fs.mkdirSync(folder,{recursive:true})
    let root;walk_html(source.html,node=>{if(node.tag==='sc-if'&&attribute(node,'value')===`{{ ${condition} }}`)root=node})
    const styles=[],copy=[],svg=[];walk_html(root,node=>{if(node.type===2&&node.content.trim())copy.push({line:node.loc.start.line,text:node.content.trim()});if(node.type===1){const style=attribute(node,'style');if(style)styles.push({line:node.loc.start.line,style});if(node.tag==='svg')svg.push({line:node.loc.start.line,fragment:node.loc.source})}})
    const fragment=source.template.split('\n').slice(start-1,end).join('\n'), interactions=audit.interactions.filter(row=>row.route===route).map(row=>({interaction_id:row.interaction_id,source_screen:`${route}:${row.line||start}`,trigger:row.interaction_id.includes('change')?'input':'click / Enter',preconditions:'Authenticated owner; current match_id and effective state; write revalidates eligibility/privacy/balance/consent.',visible_feedback:'Source control and Sheet; pure navigation is read-only; writes use custom 500ms Loading and duplicate lock.',success_result:'Canonical match_id/state and route; peer acceptance alone can establish Connection/Conversation.',failure_result:'Inline readable error; original state, deadline, quota and balance preserved; stale/cancelled operation cannot commit.',persistence:'Store match_sessions/preferences/quota/ledger only; deadline-derived clocks are read-only.',sync_scope:'Home, Discover primary, Auto Match status/history, authorized incoming invitation and conversation.',acceptance:`scripts/auto-match-browser.test.mjs --page=${page}; native HostTests; screenshots in this directory.`}))
    fs.writeFileSync(path.join(folder,'source-contract.json'),JSON.stringify({page,component:`src/pages/auto-match/${page}.vue`,source:{file:source.filename,file_sha256:source.source_hash,query:`route=${route}`,condition,lines:[start,end],fragment_sha256:sha256(fragment),fragment,styles,copy,svg},source_lock:'locked',reference_viewport:{width:393,height:852,top:54,bottom:0},animation:{name:'cRise',duration_ms:240,phase:'end',pulse_phase_ms:0},approved_deltas:['Cimoa brand and canonical current/candidate identities','Actual safe areas and fixed header/footer; one scrolling content region','Local-account matching engine; no timer grants peer consent; no fabricated online count','UTC daily quota and atomic costs; restarting a terminal session reviews the entry cost','User-authorized persisted campus-area distances, not GPS or real-time location; unknown distance fails; 100+ km is unrestricted','Source options screen does not falsify an active session as no_match'],interaction_ids:interactions.map(r=>r.interaction_id)},null,2)+'\n')
    fs.writeFileSync(path.join(folder,'interactions.json'),JSON.stringify(interactions,null,2)+'\n')
    console.log(`${page}: source locked, ${interactions.length} interactions`)
  }
}
