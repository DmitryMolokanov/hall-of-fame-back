// Moves the seed to the current IBHOF category scheme:
//   modern     - last bout 1989 or later
//   late-era   - last bout 1943-1988
//   early-era  - old "Old-Timer" list (1893-1942)
//   pioneer    - last bout 1892 or earlier
// The old "Modern" list from ibhof.com is split by the year of the last bout, taken as the latest year
// in the "Professional boxing record" section of the boxer's English Wikipedia article.
// Usage (from repo root): node back/tools/registry-scripts/split-eras.mjs
import fs from 'fs'
import path from 'path'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '../../..')
const P = (p) => path.join(ROOT, p)
const H = { headers: { 'User-Agent': 'HoF-image-audit/1.0 (local script)' } }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const get = async (url) => {
  for (let i = 0; i < 8; i++) {
    let r
    try { r = await fetch(url, H) } catch { await sleep(5000 * (i + 1)); continue }
    if (r.ok) { const t = await r.text(); try { return JSON.parse(t) } catch { } }
    await sleep(r.status === 429 ? 20000 * (i + 1) : 4000 * (i + 1))
  }
  throw new Error('Failed: ' + url)
}

const seedPath = P('back/src/data/boxersSeed.json')
const seed = JSON.parse(fs.readFileSync(seedPath, 'utf8'))
const titleOf = (r) => decodeURIComponent(r._source.split('/wiki/')[1]).replace(/_/g, ' ')

// re-runnable: every gloved-era row is recomputed. The ibhof.com "Old-Timer" list also holds
// Late Era fighters elected on the old-timer ballot since 2014, so it is checked by last bout too.
const GLOVED = ['modern', 'late-era', 'early-era', 'old-timer']
const modern = seed.filter((r) => GLOVED.includes(r.category))
const wikitext = {}
for (let i = 0; i < modern.length; i += 20) {
  const titles = modern.slice(i, i + 20).map(titleOf)
  const j = await get('https://en.wikipedia.org/w/api.php?action=query&redirects=1&prop=revisions&rvprop=content&rvslots=main&format=json&formatversion=2&titles=' + encodeURIComponent(titles.join('|')))
  const back = Object.fromEntries([...(j.query.normalized || []), ...(j.query.redirects || [])].map((x) => [x.to, x.from]))
  for (const p of j.query.pages) {
    let t = p.title
    while (back[t] && !titles.includes(t)) t = back[t]
    wikitext[t] = p.revisions?.[0]?.slots?.main?.content || ''
  }
  await sleep(800)
}

const lastBoutYear = (wt) => {
  const start = wt.search(/==\s*Professional (boxing )?record\s*==/i)
  if (start < 0) return null
  const rest = wt.slice(start)
  const next = rest.slice(5).search(/\n==[^=]/)
  const section = (next < 0 ? rest : rest.slice(0, next + 5))
    .replace(/<ref[^>]*\/>/g, '').replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, '') // footnotes carry access dates
    .replace(/\{\{\s*cite[\s\S]*?\}\}/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '') // editor comments, e.g. "did not exist until 1994"
  // only table rows carry fight dates; prose and notes around the table mention other years
  const rows = section.split('\n').filter((l) => /^\s*\|/.test(l) && !/^\s*\|[}+-]/.test(l)).join('\n')
  // only years written as a fight date; cells also hold titles like "IBU (1913–1946)"
  const M = '(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\\.?'
  const DATE = new RegExp(
    `${M}\\s+\\d{1,2},?\\s+(\\d{4})` +            // Mar 24, 1930
    `|\\b\\d{1,2}\\s+${M}\\s+(\\d{4})` +          // 24 March 1930
    `|\\{\\{\\s*(?:dts|dtsort|sort)\\s*\\|\\s*(\\d{4})` + // {{dts|1930|...}}
    `|\\b(\\d{4})-\\d{2}-\\d{2}\\b` +              // 1930-03-24
    `|^\\s*\\|\\s*(?:${M}\\s+)?(\\d{4})\\s*$`,      // a cell holding just "1930" or "March 1930"
    'gim')
  const years = [...rows.matchAll(DATE)].map((m) => +(m[1] || m[2] || m[3] || m[4] || m[5]))
    .filter((y) => y >= 1700 && y <= 2030 && (!diedYear || y <= diedYear)) // nobody boxes after death
  return years.length ? Math.max(...years) : null
}
let diedYear = null

const unknown = []
for (const r of seed) {
  if (r.category === 'old-timer') r.category = 'early-era'
  if (!GLOVED.includes(r.category)) continue
  diedYear = r.died ? +String(r.died).slice(0, 4) : null
  const y = lastBoutYear(wikitext[titleOf(r)] || '')
  r._lastBout = y
  if (y == null) { unknown.push(`${r.name} (${r.category})`); continue } // no record table: keep the list category
  r.category = y >= 1989 ? 'modern' : y >= 1943 ? 'late-era' : 'early-era'
}
fs.writeFileSync(seedPath, JSON.stringify(seed, null, 2) + '\n')
const cnt = {}
for (const r of seed) cnt[r.category] = (cnt[r.category] || 0) + 1
console.log(cnt)
console.log('no record table (left as modern):', unknown)
console.log('late-era sample:', seed.filter((r) => r.category === 'late-era').slice(0, 8).map((r) => `${r.name} ${r._lastBout}`).join(', '))
console.log('modern sample:', seed.filter((r) => r.category === 'modern').slice(0, 8).map((r) => `${r.name} ${r._lastBout}`).join(', '))
