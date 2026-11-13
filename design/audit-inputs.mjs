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

let total = 0
for (const f of walk('src')) {
  const text = readFileSync(f, 'utf8')
  let idx = 0
  while (idx < text.length) {
    const open = text.indexOf('<', idx)
    if (open === -1) break
    const nameMatch = /^<(input|textarea|select)\b/.exec(text.slice(open))
    if (!nameMatch) {
      idx = open + 1
      continue
    }
    const close = text.indexOf('>', open)
    if (close === -1) break
    const tag = text.slice(open, close + 1)
    const type = /type=["']([^"']+)["']/.exec(tag)?.[1]
    const hasClass = /className=/.test(tag)
    const isCheckbox = type === 'checkbox' || type === 'radio'
    if (!hasClass && !isCheckbox) {
      const line = text.slice(0, open).split('\n').length
      total++
      console.log(
        `  ${f}:${line}  <${nameMatch[1]}>  ${tag.replace(/\s+/g, ' ').trim().slice(0, 90)}`
      )
    }
    idx = close + 1
  }
}
console.log(
  total === 0
    ? '  every text field has a className'
    : `  ${total} unstyled field(s) found`
)
