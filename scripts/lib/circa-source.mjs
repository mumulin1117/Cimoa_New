import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import crypto from 'node:crypto'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const vue_require = createRequire(require.resolve('vue'))
const compiler_require = createRequire(vue_require.resolve('@vue/compiler-sfc'))
const { parse: parse_js } = compiler_require('@babel/parser')
const { parse: parse_html } = vue_require('@vue/compiler-dom')

export const read_bundle_script = (html, type) => {
  const escaped = type.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = html.match(new RegExp(`<script type="${escaped}">([\\s\\S]*?)</script>`))
  if (!match) throw new Error(`Missing source block: ${type}`)
  return JSON.parse(match[1])
}

export function read_circa_source(root = process.cwd()) {
  const filename = 'CIRCA All Screens (interactive).html'
  const source = fs.readFileSync(path.join(root, filename), 'utf8')
  const outer_manifest = read_bundle_script(source, '__bundler/manifest')
  const html_entry = Object.values(outer_manifest).find((entry) => entry.mime?.includes('html'))
  if (!html_entry) throw new Error('Missing embedded HTML resource')
  const standalone = zlib.gunzipSync(Buffer.from(html_entry.data, 'base64')).toString('utf8')
  const template = read_bundle_script(standalone, '__bundler/template')
  const catalog = read_bundle_script(source, '__bundler/template')
  const manifest = read_bundle_script(standalone, '__bundler/manifest')
  const external = read_bundle_script(standalone, '__bundler/ext_resources')
  const logic_match = /<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/.exec(template)
  if (!logic_match) throw new Error('Missing DCLogic source')
  const logic = logic_match[1]
  const logic_offset = template.indexOf(logic, logic_match.index)
  const logic_line = template.slice(0, logic_offset).split('\n').length
  const ast = parse_js(logic, { sourceType: 'script', plugins: ['classProperties'] })
  const html = parse_html(template.slice(0, logic_match.index), {
    // The design export includes duplicate HTML attributes. Preserve their evidence;
    // do not execute or repair the prototype as a runtime application.
    onError: (error) => { if (![2, 24].includes(error.code)) throw error },
  })
  return { filename, source_hash: crypto.createHash('sha256').update(source).digest('hex'),
    template, catalog, manifest, external, logic, logic_line, ast, html }
}

export function walk_js(node, visit, ancestors = []) {
  if (!node || typeof node !== 'object') return
  if (node.type) visit(node, ancestors)
  for (const [key, value] of Object.entries(node)) {
    if (['loc', 'start', 'end', 'extra', 'comments'].includes(key)) continue
    if (Array.isArray(value)) value.forEach((child) => walk_js(child, visit, [...ancestors, node]))
    else if (value && typeof value === 'object') walk_js(value, visit, [...ancestors, node])
  }
}

export const attribute = (node, name) => node.props?.find((prop) => prop.name === name)?.value?.content || ''
export const binding = (value) => value.replace(/^\s*\{\{\s*|\s*\}\}\s*$/g, '').trim()

export function walk_html(node, visit, ancestors = []) {
  visit(node, ancestors)
  for (const child of node.children || []) walk_html(child, visit, [...ancestors, node])
}

export function read_catalog(catalog) {
  const start = catalog.indexOf('groups: [')
  const fragment = catalog.slice(start, catalog.indexOf('];', start))
  const groups = []
  let group
  for (const line of fragment.split('\n')) {
    const title = line.match(/title:\s*"([^"]+)"/)
    if (title) { group = { title: title[1], screens: [] }; groups.push(group) }
    const screen = line.match(/s\("([^"]+)",\s*"([^"]+)"\)/)
    if (screen && group) {
      const params = Object.fromEntries(new URLSearchParams(screen[2]))
      group.screens.push({ source_screen: screen[1], source_query: screen[2], params })
    }
  }
  return groups
}
