import fs from 'node:fs'
import {page_parts,elements,adjusted_text,source_image,snake,design_source,source_root} from './auto-match-design.mjs'
import {attribute,binding} from './circa-source.mjs'
import {match_presentation} from '../../src/stores/matchPresentation.js'
const escape=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;')
export function auto_match_reference(page,data,origin,sheet='',at=Date.now()){
  const {header,body,footer}=page_parts(page),id=data.match_sessions.find(m=>m.match_id==='match_pixel')?.match_id||'',c=match_presentation(data,id,at,'ready'),theme=JSON.parse(fs.readFileSync('src/config/theme.json')),variables=[]
  const flatten=(o,p='')=>{for(const[k,v]of Object.entries(o)){const key=p+k.replaceAll('_','-');if(typeof v==='string')variables.push(`--cimoa-${key}:${v.replace(/(-?\d*\.?\d+)rpx\b/g,(_,n)=>Number(n)*393/750+'px')}`);else flatten(v,key+'-')}};flatten(theme.colors);flatten(theme.gradients,'gradient-');flatten(theme.shadows,'shadow-')
  if(sheet==='cancel')c.leave_copy='Your invitation will be withdrawn. No connection will be made.'
  const resolve=(scope,key)=>key.split('.').reduce((r,k)=>r?.[snake(k)],scope)
  const fill=(v,scope)=>v.replace(/{{\s*([\w.]+)\s*}}/g,(_,key)=>escape(resolve(scope,key)))
  const render=(node,scope=c)=>{
    if(node.type===2||node.type===5)return fill(sheet==='cancel' ? adjusted_text(node).replace('Leave this match?','Cancel this request?').replace(/^Leave match$/,'Cancel Request') : adjusted_text(node),scope)
    if(node.type!==1)return ''
    if(node.tag==='sc-if')return resolve(scope,binding(attribute(node,'value')))?node.children.map(n=>render(n,scope)).join(''):''
    if(node.tag==='sc-for')return(resolve(scope,binding(attribute(node,'list')))||[]).map(row=>node.children.map(n=>render(n,{...scope,[attribute(node,'as')]:row})).join('')).join('')
    const line=node.loc.start.line
    if(page==='found'&&line===1748)return `<div data-source-line="${line}" style="display:flex;flex-wrap:wrap;gap:10px;margin-top:14px">${c.shared_chips.map(i=>`<div style="display:flex;align-items:center;gap:8px;height:44px;padding:0 16px;border-radius:22px;background:${i.bg};color:${i.ink};font-size:16px;font-weight:700"><div style="font-size:19px;line-height:1;flex:none">${i.emoji}</div><div>${i.label}</div></div>`).join('')}</div>`
    if(page==='found'&&node.tag==='svg'&&node.children.some(n=>n.tag==='circle'&&attribute(n,'fill')==='#1d9bf0')&&!c.candidate_verified)return ''
    let style=attribute(node,'style');if(page==='found'&&style.includes('flex-wrap:nowrap'))style=style.replace('flex-wrap:nowrap','flex-wrap:wrap')
    if(node===header)style=style.replace(/position:absolute;|top:58px;|left:20px;|right:20px;/g,'')+`;position:relative;margin:4px 20px ${attribute(body,'style').includes('top:120px')?14:12}px;flex:none`
    if(node===body){if(style.includes('overflow-y:auto'))style='padding:0 20px 24px;box-sizing:border-box';else{const top=Number(style.match(/top:(\d+)px/)?.[1]||118);style=style.replace(/position:absolute;|top:\d+px;|left:20px;|right:20px;/g,'')+`;margin-top:${top-118}px;padding:0 20px 24px`}}
    if(node===footer)style=style.replace(/position:absolute;|left:20px;|right:20px;|bottom:\d+px;/g,'')+`;padding:0 20px ${attribute(node,'style').match(/bottom:(\d+)px/)?.[1]||30}px;flex:none;position:relative`
    let attrs=` data-source-line="${line}" style="${fill(style,scope)}"`
    for(const prop of node.props.filter(p=>p.type===6&&!['style','class'].includes(p.name)&&!p.name.startsWith('sc-camel-on-')&&!p.name.startsWith('hint-'))){let name=prop.name.replace('sc-camel-view-box','viewBox'),value=prop.value?.content||'';if(node.tag==='img'&&name==='src'){const [key]=source_image(node);value=origin+(key.startsWith('h.')?resolve(scope,key):c[key]||'')}else if(node.tag==='img'&&name==='alt'){const[,key]=source_image(node);value=key.startsWith("'")?key.slice(1,-1):key.startsWith('h.')?resolve(scope,key):resolve(c,key)}attrs+=` ${name}="${fill(String(value||''),scope)}"`}
    return `<${node.tag}${attrs}>${node.children.map(n=>render(n,scope)).join('')}${['img','input'].includes(node.tag)?'':`</${node.tag}>`}`
  }
  const header_html=render(header).replace(page==='index'?/<\/div>$/:/__no_replace__/,'<div style="display:flex;align-items:center;justify-content:center;height:38px;padding:0 14px;border-radius:19px;background:#fff;color:#0b1b3a;box-shadow:0 6px 18px rgba(16,36,74,.10);font-size:15px;font-weight:600;cursor:pointer">History</div></div>')
  return `<!doctype html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box}:root{${variables.join(';')}}html,body{width:100%;height:100%;margin:0;overflow:hidden}body{font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text',sans-serif;color:#0b1b3a;background:linear-gradient(168deg,#e4f4fb 0%,#eaf0fd 44%,#f2ecfb 100%);-webkit-font-smoothing:antialiased;display:flex;flex-direction:column;padding-top:54px}::-webkit-scrollbar{display:none}@keyframes cPulse{0%,100%{transform:scale(.94);opacity:.16}50%{transform:scale(1.04);opacity:.3}}</style></head><body>${header_html}<div data-reference-scroll style="flex:1;min-height:0;overflow:auto">${render(body)}</div>${footer?render(footer):''}${sheet?render(source_root(sheet==='cancel'?'sheetAmFoundLeave':sheet)):''}</body></html>`
}
