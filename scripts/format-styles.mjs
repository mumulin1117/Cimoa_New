import fs from 'node:fs'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const postcss = createRequire(require.resolve('vite'))('postcss')
for (const filename of process.argv.slice(2)) {
  const original = fs.readFileSync(filename, 'utf8')
  const formatted = original.replace(/(<style[^>]*>)([\s\S]*?)(<\/style>)/g, (_, open, css, close) => {
    const ast = postcss.parse(css)
    const print = (node, level = 0) => {
      const pad = '  '.repeat(level)
      if (!node.nodes) return `${pad}${node.toString().replace(/;$/, '')};`
      const head = node.type === 'atrule' ? `@${node.name} ${node.params}` : node.selector
      const compact = node.nodes.every((item) => item.type === 'decl') && node.nodes.length <= 5
      return compact ? `${pad}${head} { ${node.nodes.map((item) => `${item.prop}: ${item.value}${item.important ? ' !important' : ''};`).join(' ')} }` : `${pad}${head} {\n${node.nodes.map((item) => print(item, level + 1)).join('\n')}\n${pad}}`
    }
    return `${open}\n${ast.nodes.map((node) => print(node)).join('\n')}\n${close}`
  })
  if (original !== formatted) fs.writeFileSync(filename, formatted)
}
