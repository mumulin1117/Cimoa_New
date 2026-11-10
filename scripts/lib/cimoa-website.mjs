// The supplied website is a standalone, bundled artifact, not the uni-app runtime.
// Read its literal content through an AST; never evaluate the supplied JavaScript.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

export const root = path.resolve(import.meta.dirname, '../..')
const require = createRequire(import.meta.url)
const packageDir = fs.readdirSync(path.join(root, 'node_modules/.pnpm'))
  .filter(name => /^@babel\+parser@/.test(name)).sort().at(-1)
if (!packageDir) throw Error('The existing Babel parser dependency is required.')
const { parse } = require(path.join(root, 'node_modules/.pnpm', packageDir, 'node_modules/@babel/parser'))

export const sha256 = value => crypto.createHash('sha256').update(value).digest('hex')
export const parseScript = code => parse(code, { sourceType: 'script' })
export const content = JSON.parse(fs.readFileSync(path.join(root, 'website/cimoa-content.json'), 'utf8'))

export function visit(node, callback) {
  if (!node || typeof node !== 'object') return
  callback(node)
  for (const [key, value] of Object.entries(node)) {
    if (['start', 'end', 'loc', 'extra'].includes(key)) continue
    if (Array.isArray(value)) value.forEach(item => visit(item, callback))
    else visit(value, callback)
  }
}

function literal(node) {
  switch (node.type) {
    case 'StringLiteral': case 'NumericLiteral': case 'BooleanLiteral': return node.value
    case 'NullLiteral': return null
    case 'ArrayExpression': return node.elements.map(literal)
    case 'ObjectExpression': return Object.fromEntries(node.properties.map(property => {
      assert.equal(property.type, 'ObjectProperty')
      assert.equal(property.computed, false)
      return [property.key.name ?? property.key.value, literal(property.value)]
    }))
    case 'TemplateLiteral':
      if (node.expressions.length === 0) return node.quasis[0].value.cooked
  }
  throw Error(`Refusing to evaluate non-literal source: ${node.type}`)
}

export function inspect(html) {
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
  assert.equal(scripts.length, 3, 'Unexpected source script structure')
  const code = scripts[1][2]
  const ast = parseScript(code)
  const nodes = {}
  visit(ast, node => {
    if (node.type === 'VariableDeclarator' && ['Hm', 'Xy', 'gn'].includes(node.id?.name)) {
      assert.ok(!nodes[node.id.name], `Duplicate content binding ${node.id.name}`)
      nodes[node.id.name] = node.init
    }
    if (node.type === 'FunctionDeclaration' && node.id?.name === 'Qf') nodes.stores = node
  })
  for (const key of ['Hm', 'Xy', 'gn', 'stores']) assert.ok(nodes[key], `Missing ${key}`)
  return { scripts, code, ast, nodes, data: Object.fromEntries(['Hm', 'Xy', 'gn'].map(key => [key, literal(nodes[key])])) }
}

export function preservedContent(html) {
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
  return {
    styles: [...html.matchAll(/<style\b[^>]*>[\s\S]*?<\/style>/gi)].map(match => sha256(match[0])),
    assetScript: sha256(scripts[0][0]),
    licenseScript: sha256(scripts[2][0]),
    embeddedResources: [...html.matchAll(/data:[^"'\s)<>]+/g)].map(match => sha256(match[0])),
    scriptAttributes: scripts.map(match => match[1]),
    bundledLicenses: sha256(scripts[1][2].slice(scripts[1][2].indexOf('/*! Bundled license information:')))
  }
}

function merge(original, replacement) {
  const merged = structuredClone(original)
  for (const lang of ['en', 'fr']) merged[lang] = { ...merged[lang], ...replacement[lang] }
  return merged
}

export function buildWebsite(original) {
  const source = inspect(original)
  const marketing = merge(source.data.Hm, content.marketing)
  const legal = merge(source.data.Xy, content.legal)
  marketing.en.features[1].points[2] = 'Private conversations begin with a mutual connection'
  marketing.fr.features[1].points[2] = 'Les conversations privées commencent par une connexion réciproque'
  const replacements = ['Hm', 'Xy', 'gn'].map(key => ({
    start: source.nodes[key].start,
    end: source.nodes[key].end,
    text: JSON.stringify({ Hm: marketing, Xy: legal, gn: content.contact }[key])
  }))
  let storeArrays = 0
  let availabilityBranches = 0
  visit(source.ast, node => {
    if (node.type === 'ArrayExpression' && node.start > source.nodes.stores.start && node.end < source.nodes.stores.end) {
      assert.deepEqual(literal(node), ['App Store', 'Google Play'])
      replacements.push({ start: node.start, end: node.end, text: '["App Store"]' })
      storeArrays++
    }
    // The brand's availability button has a second hard-coded bilingual message.
    if (node.type === 'ConditionalExpression' && node.test.type === 'BinaryExpression'
      && node.test.left?.name === 'f' && node.test.right?.value === 'Cimoa') {
      replacements.push({ start: node.start, end: node.end, text: 'g.modalText.replace("{store}",f)' })
      availabilityBranches++
    }
  })
  assert.equal(storeArrays, 1)
  assert.equal(availabilityBranches, 1)
  let code = source.code
  for (const replacement of replacements.sort((a, b) => b.start - a.start)) {
    code = code.slice(0, replacement.start) + replacement.text + code.slice(replacement.end)
  }
  const oldLanguage = 'localStorage.getItem("cimoa-language")==="fr"?"fr":"en"}catch{return"en"}'
  assert.equal(code.split(oldLanguage).length, 2, 'Unexpected language preference initializer')
  code = code.replace(oldLanguage, 'localStorage.getItem("cimoa-language")==="en"?"en":"fr"}catch{return"fr"}')
  parseScript(code)
  let result = original.replace(source.code, () => code)
    .replace('<html lang="en">', '<html lang="fr">')
    .replace(/<title>[^<]*<\/title>/, `<title>${marketing.fr.pageTitle}</title>`)
    .replace(/<meta name="description" content="[^"]*"\/>/, `<meta name="description" content="${marketing.fr.description}"/>`)
  assert.ok(!result.includes('rel="canonical"'), 'Review existing canonical link before changing it')
  result = result.replace('</title>', '</title><link rel="canonical" href="https://cimoabeam.online/"/>')
  assert.deepEqual(preservedContent(result), preservedContent(original), 'Styles or embedded resources changed')
  return result
}
