import fs from 'node:fs'
import path from 'node:path'
import { read_circa_source, read_catalog, walk_html, walk_js, attribute, binding } from './lib/circa-source.mjs'

const source = read_circa_source()
const definitions = []
const route_conditions = {}
const transitions = []
walk_js(source.ast, (node, ancestors) => {
  if (node.type === 'ObjectProperty' && node.key.type === 'Identifier') {
    const body = source.logic.slice(node.value.start, node.value.end)
    const owner = ancestors.findLast((parent) => parent.type === 'ClassMethod')?.key.name || 'state'
    definitions.push({ binding: node.key.name, owner, line: source.logic_line + node.loc.start.line - 1, body })
    const route = /^s\.route === "([^"]+)"$/.exec(body)
    if (route) route_conditions[node.key.name] = route[1]
  }
  if (node.type === 'CallExpression' && node.callee.type === 'MemberExpression'
      && node.callee.object.type === 'ThisExpression'
      && ['nav', 'root', 'open'].includes(node.callee.property.name)) {
    transitions.push({ kind: node.callee.property.name, target: source.logic.slice(node.arguments[0].start, node.arguments[0].end),
      source_line: source.logic_line + node.loc.start.line - 1,
      handler: ancestors.findLast((parent) => parent.type === 'ObjectProperty')?.key.name
        || ancestors.findLast((parent) => parent.type === 'ClassMethod')?.key.name })
  }
})
const interactions = []
const sections = []
const svg_resources = []
const counts = new Map()
walk_html(source.html, (node, ancestors) => {
  if (node.type !== 1) return
  const parents = [...ancestors, node]
  const conditions = parents.filter((parent) => parent.tag === 'sc-if').map((parent) => binding(attribute(parent, 'value')))
  const owner_condition = conditions.find((condition) => route_conditions[condition]) || conditions[0] || 'global'
  const route = route_conditions[owner_condition] || owner_condition
  if (node.tag === 'sc-if' && route_conditions[binding(attribute(node, 'value'))]) {
    const texts = []
    walk_html(node, (child) => { if (child.type === 2 && child.content.trim()) texts.push(child.content.trim()) })
    sections.push({ route: route_conditions[binding(attribute(node, 'value'))], source_line: node.loc.start.line,
      condition: binding(attribute(node, 'value')), text: texts.join(' ').replace(/\s+/g, ' ') })
  }
  if (node.tag === 'svg') svg_resources.push({ route, line: node.loc.start.line, source: node.loc.source })
  for (const prop of node.props || []) {
    if (!/^(sc-camel-on-|on(?:Click|Change|Input|Pointer|Wheel))/.test(prop.name)) continue
    const handler = binding(prop.value?.content || '')
    const repeaters = parents.filter((parent) => parent.tag === 'sc-for')
      .map((parent) => Object.fromEntries(parent.props.filter((p) => p.value).map((p) => [p.name, p.value.content])))
    const key = `${route}.${handler.replace(/[^a-zA-Z0-9.]+/g, '_')}.${prop.name.replace('sc-camel-on-', '')}`
    const ordinal = (counts.get(key) || 0) + 1
    counts.set(key, ordinal)
    const list = repeaters.findLast((repeater) => handler.startsWith(`${repeater.as}.`))
    let definition_key = list ? binding(list.list).split('.')[0] : handler
    // Resolve nested list scopes (o.pick -> g.options -> prefGroups) without eval.
    for (let depth = 0; depth < repeaters.length; depth += 1) {
      const parent = repeaters.find((repeater) => repeater.as === definition_key)
      if (!parent) break
      definition_key = binding(parent.list).split('.')[0]
    }
    const matches = definitions.filter((def) => def.binding === definition_key)
    interactions.push({ interaction_id: `${key}.${ordinal}`, route, conditions, repeaters,
      trigger: prop.name, handler, source_line: node.loc.start.line,
      definitions: matches.map(({ owner, line, body }) => ({ owner, line, body })),
      source_status: matches.length ? (list ? 'located_list_factory' : 'located') : 'needs_scope_resolution' })
  }
})
const asset_manifest = JSON.parse(fs.readFileSync('static/assets/manifest.json', 'utf8'))
const extracted_by_bundle = new Map(asset_manifest.assets.map((asset) => [asset.bundle_id || source.external.find((entry) => entry.id === asset.id)?.uuid, asset]))
const resources = Object.entries(source.manifest).map(([uuid, resource]) => {
  const entry = source.external.find((candidate) => candidate.uuid === uuid)
  const local = extracted_by_bundle.get(uuid)
  return { source_id: entry?.id || uuid, bundle_id: uuid, mime: resource?.mime,
    extracted: !!local && fs.existsSync(local.target), local_path: local?.target || null,
    bytes: resource?.data ? Buffer.byteLength(resource.data, 'base64') : 0 }
})
const data = { source: source.filename, source_sha256: source.source_hash,
  note: 'Static analysis only. No source scripts are executed. Located does not mean implemented or verified.',
  catalog: read_catalog(source.catalog), route_conditions, sections, transitions, interactions, resources,
  svg_resources: svg_resources.map(({ route, line }) => ({ route, line })) }
const out = path.resolve('docs/circa-source-audit.json')
fs.writeFileSync(out, JSON.stringify(data, null, 2) + '\n')
console.log(JSON.stringify({ catalog_screens: data.catalog.flatMap((g) => g.screens).length,
  route_sections: sections.length, interactions: interactions.length, resources: resources.length,
  svg_resources: svg_resources.length, output: out }, null, 2))
