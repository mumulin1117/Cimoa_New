import { createRequire } from 'node:module'

const { parse } = createRequire(import.meta.resolve('@dcloudio/vite-plugin-uni'))('@vue/compiler-sfc')

const attributes = new Set(['aria-label', 'placeholder', 'title', 'alt'])
const editable = new Set(['input', 'textarea', 'script', 'style'])
const encode = value => JSON.stringify(value).replace(/</g, '\\u003c')
const escape_attribute = value => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;')

// Translate display values in Vue's render effect. Values used by v-model,
// events, IDs, routes and data attributes remain the original business values.
export function localize_template(source, filename = 'Component.vue') {
  const { descriptor, errors } = parse(source, { filename })
  if (errors.length || !descriptor.template?.ast || !descriptor.scriptSetup) return null
  const changes = []
  const replace = (location, value) => changes.push({ start: location.start.offset, end: location.end.offset, value })
  const visit = (node, inherited = false) => {
    if (node.type !== 1 && node.type !== 0) return
    const verbatim = inherited || node.props?.some(prop => prop.type === 6 && prop.name === 'data-i18n' && prop.value?.content === 'verbatim')
    if (verbatim) return
    for (const prop of node.props || []) {
      if (prop.type === 6 && attributes.has(prop.name) && prop.value?.content) {
        replace(prop.loc, `:${prop.name}="${escape_attribute(`cimoa_translate(${encode(prop.value.content)})`)}"`)
      } else if (prop.type === 7 && prop.name === 'bind' && attributes.has(prop.arg?.content) && prop.exp) {
        replace(prop.exp.loc, escape_attribute(`cimoa_translate(${prop.exp.content})`))
      }
    }
    if (editable.has(node.tag)) return
    const children = node.children || []
    for (let index = 0; index < children.length; index += 1) {
      const child = children[index]
      if (child.type !== 2 && child.type !== 5) { visit(child, verbatim); continue }
      const run = [child]
      while ([2, 5].includes(children[index + 1]?.type)) run.push(children[++index])
      if (!run.some(row => row.type === 5 || /[A-Za-zÀ-ÿ]/.test(row.content))) continue
      if (run.every(row => row.type !== 2 || !/[A-Za-zÀ-ÿ]/.test(row.content)) && run.some(row => row.type === 5 && /^(?:(?:[\w$]+\??\.)*user_name(?:\.(?:trim|toUpperCase)\(\))?|name|userName)$/.test(row.content.content.trim()))) continue
      const expression = run.length === 1 && child.type === 5 ? child.content.content : run.map(row => row.type === 5 ? `String(${row.content.content})` : encode(row.content)).join(' + ')
      replace({ start: run[0].loc.start, end: run.at(-1).loc.end }, `{{ cimoa_translate(${expression}) }}`)
    }
  }
  visit(descriptor.template.ast)
  if (!changes.length) return null
  changes.push({ start: descriptor.scriptSetup.loc.start.offset, end: descriptor.scriptSetup.loc.start.offset, value: "\nimport { t as cimoa_translate } from '@/i18n/index.js'\n" })
  let code = source
  for (const change of changes.sort((a, b) => b.start - a.start)) code = code.slice(0, change.start) + change.value + code.slice(change.end)
  return { code, map: null }
}

export function cimoa_localization() {
  return {
    name: 'cimoa-localized-display',
    enforce: 'pre',
    transform(source, id) {
      if (!id.endsWith('.vue') || !id.replace(/\\/g, '/').includes('/src/')) return null
      return localize_template(source, id)
    },
  }
}
