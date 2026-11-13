import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (extname(p) === '.jsx') out.push(p)
  }
  return out
}

const css = readFileSync('src/index.css', 'utf8')
const defined = new Set(
  [...css.matchAll(/\.([a-zA-Z][a-zA-Z0-9_-]*)/g)].map((m) => m[1])
)

const used = new Map()
for (const f of walk('src')) {
  const text = readFileSync(f, 'utf8')
  for (const m of text.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\}|\{'([^']*)'\})/g)) {
    const raw = m[1] || m[2] || m[3] || ''
    for (const token of raw.split(/[\s${}`?!&|:]+/)) {
      const cls = token.trim()
      if (!cls || !/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(cls)) continue
      if (!used.has(cls)) used.set(cls, new Set())
      used.get(cls).add(f)
    }
  }
}

const missing = [...used.entries()]
  .filter(([cls]) => !defined.has(cls))
  .sort((a, b) => a[0].localeCompare(b[0]))

if (missing.length === 0) {
  console.log('all classes defined')
} else {
  console.log('MISSING CLASSES:')
  for (const [cls, files] of missing) {
    console.log(`  .${cls}   (${[...files].map((f) => f.split('/').pop()).join(', ')})`)
  }
}
