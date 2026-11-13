// Searches Europeana (aggregates Gallica, Nationaal Archief and other European archives) for
// freely reusable photos of boxers and Beyond the Ring people that have no photo yet.
// Uses Europeana's public demo key; set EUROPEANA_KEY to use your own.
// Usage (from repo root): node back/tools/registry-scripts/find-europeana.mjs
// Output: back/tools/registry-scripts/europeana-candidates.json (resumable)
import fs from 'fs'
import path from 'path'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '../../..')
const P = (p) => path.join(ROOT, p)
const KEY = process.env.EUROPEANA_KEY || 'api2demo'
const H = { headers: { 'User-Agent': 'HoF-image-audit/1.0 (local script)' } }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const get = async (url) => {
  for (let i = 0; i < 6; i++) {
    let r
    try { r = await fetch(url, H) } catch { await sleep(5000 * (i + 1)); continue }
    if (r.ok) { const t = await r.text(); try { return JSON.parse(t) } catch { } }
    await sleep(r.status === 429 ? 20000 * (i + 1) : 4000 * (i + 1))
  }
  return null
}

const boxers = JSON.parse(fs.readFileSync(P('back/src/data/boxersSeed.json'), 'utf8')).filter((r) => !r.img)
  .map((r) => ({ kind: 'boxer', name: r.name, born: r.born, died: r.died }))
const people = JSON.parse(fs.readFileSync(P('back/src/data/peopleSeed.json'), 'utf8')).filter((r) => !r.img)
  .map((r) => ({ kind: 'person', name: r.name, born: r.born, died: r.died, role: r.role }))
const targets = [...boxers, ...people]

const OUT = P('back/tools/registry-scripts/europeana-candidates.json')
const result = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : []
const done = new Set(result.map((r) => r.name))
const plain = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')

for (const t of targets) {
  if (done.has(t.name)) continue
  const surname = plain(t.name).replace(/"/g, '').split(' ').pop()
  const words = t.kind === 'boxer' ? '(boxer OR boxeur OR bokser OR Boxer OR pugilist)' : '(boxing OR boxe OR boksen OR Boxen)'
  const queries = [`"${plain(t.name).replace(/"/g, '')}"`, `"${surname}" AND ${words}`]
  const items = new Map()
  for (const q of queries) {
    const u = `https://api.europeana.eu/record/v2/search.json?wskey=${KEY}&rows=15&reusability=open&media=true&qf=TYPE:IMAGE&profile=rich&query=${encodeURIComponent(q)}`
    const j = await get(u)
    for (const it of j?.items || []) {
      items.set(it.id, {
        id: it.id,
        title: (it.title || [''])[0],
        description: ((it.dcDescription || [''])[0] || '').slice(0, 200),
        year: (it.year || [''])[0],
        provider: (it.dataProvider || [''])[0],
        rights: (it.rights || [''])[0],
        creator: (it.dcCreator || [''])[0] || null,
        preview: (it.edmPreview || [''])[0],
        image: (it.edmIsShownBy || [''])[0],
        page: it.guid,
      })
    }
    await sleep(400)
  }
  // keep items whose title or description mentions the surname
  const sn = surname.toLowerCase()
  const cands = [...items.values()].filter((c) => plain(`${c.title} ${c.description}`).toLowerCase().includes(sn)).slice(0, 8)
  result.push({ ...t, candidates: cands })
  fs.writeFileSync(OUT, JSON.stringify(result, null, 2))
  console.log(t.name, '->', cands.length)
}
console.log('with candidates:', result.filter((r) => r.candidates.length).length, 'of', result.length)
