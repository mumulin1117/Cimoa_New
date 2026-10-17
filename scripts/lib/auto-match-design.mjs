// Offline AST translation/audit helpers. The application never imports the prototype.
import fs from 'node:fs'
import {read_circa_source,walk_html,attribute,binding} from './circa-source.mjs'
import {match_pages} from '../auto-match-contracts.mjs'
export const snake=value=>value.replace(/([a-z0-9])([A-Z])/g,'$1_$2').toLowerCase()
export const design_source=read_circa_source()
export const source_root=condition=>{let root;walk_html(design_source.html,n=>{if(n.tag==='sc-if'&&binding(attribute(n,'value'))===condition)root=n});if(!root)throw Error(condition);return root.children.find(n=>n.type===1)}
export const elements=node=>node.children.filter(n=>n.type===1)
export const page_parts=page=>{const root=source_root(match_pages[page][1]),nodes=elements(root);return {root,header:nodes[0],body:nodes[1],footer:nodes[2]}}
export const approved_text=(line)=>({1471:'{{ joinPoolLabel }}',1488:'{{ entryWait }}',1492:'{{ availableNow }}',1642:'{{ goalLabel }}',1643:'{{ universityLabel }}',1644:'{{ interestLabel }}',1749:'{{ sharedTitle }}',1750:'{{ sharedCopy }}',1780:'{{ waitingTitle }}',1781:'{{ waitingCopy }}',1808:'{{ connectedCopy }}',4377:'{{ connectTitle }}',4379:'{{ connectCopy }}',4434:'{{ leaveCopy }}'})[line]
export function adjusted_text(node){
  const text=node.type===2?node.content:node.loc.source,line=node.loc.start.line
  if(line===1504&&text==='Join the Pool')return '{{ joinPoolLabel }}'
  if(node.type===2&&text.trim()==='About 2 minutes')return '{{ entryWait }}'
  if(node.type===2&&text.trim()==='48 students')return '{{ availableNow }}'
  if(node.type===2&&line===1642&&text.trim()==='Friends')return '{{ goalLabel }}'
  if(node.type===2&&line===1643&&text.trim()==='My campus')return '{{ universityLabel }}'
  if(node.type===2&&line===1644&&text.trim()==='Shared interests')return '{{ interestLabel }}'
  if(node.type===2&&text==='You have a lot in common')return '{{ sharedTitle }}'
  if(node.type===2&&text==='You both enjoy photography, coffee, and live music.')return '{{ sharedCopy }}'
  if(node.type===2&&text==='Waiting for Chloe')return '{{ waitingTitle }}'
  if(node.type===2&&text.startsWith('We’ll let you know when Chloe'))return '{{ waitingCopy }}'
  if(node.type===2&&text==='You and Chloe can now start a conversation.')return '{{ connectedCopy }}'
  if(node.type===2&&text==='Connect with Chloe?')return '{{ connectTitle }}'
  if(node.type===2&&text.startsWith('If Chloe also accepts'))return '{{ connectCopy }}'
  if(node.type===2&&text.startsWith('You won’t connect with Chloe'))return '{{ leaveCopy }}'
  if(node.type===2&&text.startsWith('You’re placed in a queue'))return 'Your saved preferences help us find a compatible student. You can pause or leave the pool anytime. Chat unlocks only when you both accept.'
  return text
}
export function source_image(node){
  const line=node.loc.start.line
  if(attribute(node,'alt')==='You'||[1777,1804].includes(line))return ['me_img','me.user_name']
  if(line===1625)return ['search_avatar',"'Potential match'"]
  if(binding(attribute(node,'src'))==='amImg')return ['am_img','person_name']
  if(line>=1890)return ['h.img','h.name']
  return ['candidate_avatar','person_name']
}
const norm=value=>value.toLowerCase().replace(/(-?\d*\.?\d+)rpx\b/g,(_,n)=>Math.round(Number(n)*393/750*100)/100+'px').replaceAll(/\s/g,'').replaceAll('#fff,','#ffffff,').replace(/^#fff$/,'#ffffff').replaceAll(',0.',',.').replaceAll('(0.','(.')
export function theme_converter(theme){
  const values=new Map(),add=(obj,prefix)=>{for(const[k,v]of Object.entries(obj)){const key=`${prefix}${k.replaceAll('_','-')}`;if(typeof v==='string'){if(!values.has(norm(v)))values.set(norm(v),`var(--cimoa-${key})`)}else add(v,key+'-')}}
  add(theme.colors,'');add(theme.gradients,'gradient-');add(theme.shadows,'shadow-')
  const customColors={'#3b6bd8':'step','#e5f3ff':'wait-pill','#2e7dd6':'wait-ink','#3760c9':'goal-ink','#7238c9':'campus-ink','#f6ecfd':'priority-pill','#6b21a8':'priority-ink','#fdecd2':'crown-bg','#e08a1e':'crown','#fbe3f8':'deadline-pill','#9d1d8f':'deadline-ink','rgba(255,255,255,0.7)':'note','rgba(255,255,255,0.22)':'cost-tag'}
  const px=value=>value.replace(/(-?\d*\.?\d+)px\b/g,(_,n)=>`${Math.floor(Number(n)*750/393*1000)/1000}rpx`)
  const get=(value,kind)=>{
    const raw=value.trim(),key=norm(raw)
    if(values.has(key))return values.get(key)
    if(['currentColor','none','inherit'].includes(raw))return raw
    const bucket=kind==='shadow'?theme.shadows:kind==='gradient'?theme.gradients:(theme.colors['auto-match']??={})
    const id=kind==='color'?'match_'+(customColors[raw]||`tone_${Object.keys(bucket).length}`):`auto_match_${Object.keys(bucket).length}`
    bucket[id]=kind==='shadow'?px(raw):raw;const token=`var(--cimoa-${kind==='color'?'auto-match-':kind==='gradient'?'gradient-':'shadow-'}${id.replaceAll('_','-')})`;values.set(key,token);return token
  }
  return {px,color:value=>get(value,'color'),style:style=>style.split(';').filter(Boolean).map(decl=>{
    const at=decl.indexOf(':'),key=decl.slice(0,at).trim();let value=decl.slice(at+1).trim()
    if(value.includes('{{'))return {key,value,dynamic:true}
    if(key==='box-shadow')value=get(value,'shadow')
    else if(/(?:linear|radial)-gradient/.test(value))value=get(value,'gradient')
    else value=value.replace(/rgba?\([^)]+\)|#[0-9a-fA-F]{3,8}\b|\btransparent\b/g,m=>get(m,'color'))
    // Border widths retain the existing one-pixel hairline exception.
    if(!key.startsWith('border')||key==='border-radius')value=px(value)
    return {key,value}
  })}
}
export function vue_design(page,theme){
  const {header,body,footer}=page_parts(page),convert=theme_converter(theme),rules=[],audit=JSON.parse(fs.readFileSync('docs/circa-source-audit.json')),route=match_pages[page][0];let node_index=0
  const expr=value=>value.split('.').map((x,i)=>i===0&&['o','h'].includes(x)?x:snake(x)).join('.')
  const interpolate=value=>value.replace(/{{\s*([\w.]+)\s*}}/g,(_,v)=>`{{ ${/^[oh]\./.test(v)?expr(v):'c.'+expr(v)} }}`)
  const render=(node,context={})=>{
    if(node.type===2||node.type===5)return interpolate(adjusted_text(node))
    if(node.type!==1)return ''
    const line=node.loc.start.line,index=++node_index,children=()=>node.children.map(n=>render(n,context)).join('')
    if(page==='found'&&line===1751){const item=elements(node)[0];return `<view class="am-shared"><view v-for="i in c.shared_chips" :key="i.item_id" class="am-interest" :style="{background:i.bg,color:i.ink}"><view class="am-emoji">{{ i.emoji }}</view><view>{{ i.label }}</view></view></view>`}
    if(node.tag==='sc-if')return `<template v-if="${/^[oh]\./.test(binding(attribute(node,'value')))?expr(binding(attribute(node,'value'))):'c.'+expr(binding(attribute(node,'value')))}">${children()}</template>`
    if(node.tag==='sc-for'){const list=expr(binding(attribute(node,'list'))),as=attribute(node,'as');return `<template v-for="${as} in c.${list}" :key="${as}.value || ${as}.match_id || ${as}.item_id">${node.children.map(n=>render(n,{...context,list})).join('')}</template>`}
    let tag=node.tag==='div'?'view':node.tag,attrs=` data-source-line="${line}"`,style=attribute(node,'style'),classes=[]
    if(node===header){style=style.replace(/position:absolute;|top:58px;|left:20px;|right:20px;/g,'');style+=`;position:relative;margin:4px 20px ${attribute(body,'style').includes('top:120px')?14:12}px`}
    if(node===body){if(style.includes('overflow-y:auto'))style='padding:0 20px 24px;box-sizing:border-box';else{const top=Number(style.match(/top:(\d+)px/)?.[1]||118);style=style.replace(/position:absolute;|top:\d+px;|left:20px;|right:20px;/g,'')+`;margin-top:${top-118}px;padding:0 20px 24px`}}
    if(node===footer){style=style.replace(/position:absolute;|left:20px;|right:20px;|bottom:\d+px;/g,'');style+=`;padding:0 20px ${attribute(node,'style').match(/bottom:(\d+)px/)?.[1]||30}px;flex:none`;classes.push('am-footer')}
    if(node.tag==='svg'){
      for(const dimension of ['width','height']){const size=attribute(node,dimension);if(size)style+=`;${dimension}:${size}px;flex:none`}
    }
    if(node.tag==='img'){
      const [src,name]=source_image(node);tag=src==='am_img'?'ProfilePhoto':'UserAvatar';attrs+=` :src="${src.startsWith('h.')?src:'c.'+src}" :name="${name.startsWith("'")||name.startsWith('h.')?name:'c.'+name}"`;if(tag==='ProfilePhoto')attrs+=' position="50% 26%"'
    }
    if(node.tag==='input'){attrs+=' :value="query"';style+=';height:100%;min-width:0';}
    const declarations=convert.style(style),dynamic=[]
    for(const d of declarations.filter(d=>d.dynamic)){dynamic.push(`'${d.key}':\`${d.value.replace(/{{\s*([\w.]+)\s*}}/g,(_,v)=>'${'+(/^[oh]\./.test(v)?expr(v):'c.'+expr(v))+'}')}\``)}
    const staticStyle=declarations.filter(d=>!d.dynamic).map(d=>`${d.key}: ${d.value}`).join('; ')
    if(staticStyle){const className=`am-${line}-${index}`;classes.push(className);rules.push(`.${className} { ${staticStyle}; }`)}
    if(classes.length)attrs+=` class="${classes.join(' ')}"`
    if(dynamic.length)attrs+=` :style="{${dynamic.join(',')}}"`
    for(const prop of node.props.filter(p=>p.type===6&&!['style','class','src','alt','width','height','value'].includes(p.name)&&!p.name.startsWith('hint-')&&!p.name.startsWith('sc-camel-on-'))){
      const name=prop.name.replace('sc-camel-view-box','viewBox'),value=prop.value?.content||''
      if(['fill','stroke'].includes(name)&&value!=='none'&&value!=='currentColor')attrs+=` ${name}="${convert.color(value)}"`
      else if(value.includes('{{'))attrs+=` :${name}="${/^[oh]\./.test(binding(value))?expr(binding(value)):'c.'+expr(binding(value))}"`
      else attrs+=` ${name}="${value.replaceAll('"','&quot;')}"`
    }
    const handler=attribute(node,'sc-camel-on-click')||attribute(node,'sc-camel-on-change')
    if(handler){const original=binding(handler),method=original==='o.pick'?'pick':original==='h.go'?'history':original,event=node.tag==='input'?'input':'click',interaction=audit.interactions.find(i=>i.route===route&&i.line===line&&i.handler===original)||audit.interactions.find(i=>i.route===route&&i.line===line);attrs+=` data-interaction="${interaction?.interaction_id||route+'.'+original+'.click.1'}"`
      attrs+=` @${event}="action('${method}',$event${original.startsWith('o.')?',o':original.startsWith('h.')?',h':''})"`
      if(event==='click'){attrs+=' role="button" tabindex="0" :aria-disabled="busy"';attrs+=` @keydown.enter="action('${method}',$event${original.startsWith('o.')?',o':original.startsWith('h.')?',h':''})"`;if(['goBack','askLeaveMatch','passMatch'].includes(method))attrs+=` aria-label="${method==='passMatch'?'Skip match':'Back'}"`}
      if(method.endsWith('Track'))attrs+=` data-range="${method==='onAgeTrack'?'age':method==='onHeightTrack'?'height':'distance'}"`
    }
    if(node.tag==='img'||node.tag==='input')return `<${tag}${attrs} />`
    return `<${tag}${attrs}>${children()}</${tag}>`
  }
  const headerCode=render(header),bodyCode=render(body),footerCode=footer?render(footer):''
  const script=`<script setup>\nimport {use_auto_match_page} from '@/composables/useAutoMatchPage.js'\nimport SecondaryPageFrame from '@/components/SecondaryPageFrame.vue'\nimport EventActionLoading from '@/components/EventActionLoading.vue'\nimport AutoMatchConfirmDialog from '@/components/AutoMatchConfirmDialog.vue'\nimport UserAvatar from '@/components/UserAvatar.vue'\nimport ProfilePhoto from '@/components/ProfilePhoto.vue'\nconst {frame,c,error,modal,query,busy,is_loading,guard,action}=use_auto_match_page('${page}')\n</script>`
  return `${script}\n<template>\n<SecondaryPageFrame ref="frame" class="auto-match-page auto-match-${page}" :scroll-locked="!!modal">\n<template #header>${headerCode}<text v-if="error" class="am-error" role="alert">{{ error }}</text></template>\n<view v-if="guard" class="am-error" role="alert">{{ guard }}<view role="button" @click="action('returnHome')">Return Home</view></view>\n<template v-else>${bodyCode}</template>\n${footerCode?`<template #footer><template v-if="!guard">${footerCode}</template></template>`:''}\n<template #overlays><AutoMatchConfirmDialog :modal="modal" :context="c" :busy="busy" @action="action" /><EventActionLoading :visible="is_loading" label="Updating your match…" /></template>\n</SecondaryPageFrame>\n</template>\n<style scoped>\n.auto-match-page { -webkit-font-smoothing: antialiased; line-height: normal; }\n.am-error { display: block; padding: 15.267rpx 38.167rpx; font-size: 28.625rpx; line-height: 1.4; color: var(--cimoa-status-danger); overflow-wrap: anywhere; }\n.am-footer { position: relative; }\n.am-shared { display: flex; flex-wrap: wrap; gap: 19.083rpx; margin-top: 26.717rpx; }\n.am-interest { display: flex; align-items: center; gap: 15.267rpx; height: 83.969rpx; padding: 0 30.534rpx; border-radius: 41.984rpx; font-size: 30.534rpx; font-weight: 700; }\n.am-emoji { font-size: 36.259rpx; line-height: 1; flex: none; }\n${[...new Set(rules)].join('\n')}\n@keyframes cPulse { 0%,100% { transform:scale(0.94); opacity:0.16; } 50% { transform:scale(1.04); opacity:0.3; } }\n</style>\n`
}
