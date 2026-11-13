import { writeFileSync, mkdirSync } from 'node:fs'

const res = await fetch(
  'https://www.eff.org/files/2016/07/18/eff_large_wordlist.txt'
)
const text = await res.text()

const words = text
  .split('\n')
  .map((l) => l.trim())
  .filter((l) => l !== '')
  .map((l) => l.split(/\s+/)[1])
  .filter((w) => w && /^[a-z]+$/.test(w))

const unique = [...new Set(words)].sort()

mkdirSync('src/data', { recursive: true })
writeFileSync(
  'src/data/wordlist.js',
  `// EFF large wordlist (diceware) - 7776 five-dice words, minus 4 hyphenated\n` +
    `// entries. 3 words from this list = ~39 bits of entropy.\n` +
    `export default ${JSON.stringify(unique)}\n`,
  'utf8'
)

console.log(`wrote src/data/wordlist.js with ${unique.length} words`)
console.log(`sample: ${unique.slice(0, 5).join(', ')} ... ${unique.slice(-3).join(', ')}`)
console.log(
  `entropy: 3 words = ${(Math.log2(unique.length) * 3).toFixed(1)} bits`
)
