// Builds back/src/data/boxersSeed.json for a local DB from open data:
//  - dates and IBHOF induction year: Wikidata (CC0)
//  - fight record: English Wikipedia infobox; biography: lead section of the article (CC BY-SA 4.0)
//  - photos: back/src/data/imageCredits.json (Wikimedia Commons)
// Usage (from repo root): node back/tools/registry-scripts/build-seed.mjs
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '../../..')
const { boxers } = JSON.parse(fs.readFileSync(path.join(ROOT, 'back/tools/registry-scripts/audit.json'), 'utf8'))
const credits = JSON.parse(fs.readFileSync(path.join(ROOT, 'back/src/data/imageCredits.json'), 'utf8'))
const OUT = path.join(ROOT, 'back/src/data/boxersSeed.json')
const H = { headers: { 'User-Agent': 'HoF-image-audit/1.0 (local script)' } }
const IBHOF = 'Q572227' // International Boxing Hall of Fame

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const get = async (url) => {
  for (let i = 0; i < 8; i++) {
    const r = await fetch(url, H)
    if (r.ok) return r.json()
    console.log('  HTTP', r.status, 'retry'); await sleep(r.status === 429 ? 20000 * (i + 1) : 3000 * (i + 1))
  }
  throw new Error('Failed: ' + url)
}
const wdDate = (c) => {
  const t = c?.[0]?.mainsnak?.datavalue?.value?.time // +1954-05-23T00:00:00Z
  if (!t) return null
  const [y, m, d] = t.slice(1, 11).split('-')
  return m === '00' ? y : d === '00' ? `${y}-${m}` : `${y}-${m}-${d}`
}
const num = (wikitext, field) => {
  const m = wikitext.match(new RegExp(`^\\s*\\|\\s*${field}\\s*=\\s*([^\\n|]*)`, 'im'))
  const n = m && parseInt(m[1].replace(/<[^>]*>|\{\{[^}]*\}\}|,/g, '').trim(), 10)
  return Number.isFinite(n) ? n : null
}

const seed = [], warnings = []
for (const b of Object.values(boxers).sort((x, y) => x.title.localeCompare(y.title))) {
  const name = b.title.replace(/ \((American )?boxer\)$/, '')
  const e = (await get(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${b.qid}&props=claims&format=json`)).entities[b.qid]
  const hof = (e.claims.P166 || []).filter((c) => c.mainsnak?.datavalue?.value?.id === IBHOF)
  const induction = parseInt(hof[0]?.qualifiers?.P585?.[0]?.datavalue?.value?.time?.slice(1, 5), 10) || null

  const wt = (await get(`https://en.wikipedia.org/w/api.php?action=parse&redirects=1&page=${encodeURIComponent(b.title)}&prop=wikitext&section=0&format=json&formatversion=2`)).parse.wikitext
  const ex = await get(`https://en.wikipedia.org/w/api.php?action=query&redirects=1&prop=extracts&exintro=1&explaintext=1&format=json&formatversion=2&titles=${encodeURIComponent(b.title)}`)
  const extract = ex.query.pages[0].extract || ''

  const won = num(wt, 'wins'), lost = num(wt, 'losses'), drew = num(wt, 'draws') ?? 0, nc = num(wt, 'no_?contests') ?? 0
  const bouts = num(wt, 'total') ?? (won != null && lost != null ? won + lost + drew + nc : null)
  const credit = credits.find((c) => c.key === b.key && !c.skip)

  const row = {
    id: crypto.randomUUID(),
    name,
    biography: extract.split(/\n+/).map((p) => p.trim()).filter(Boolean).join('<br>'),
    born: wdDate(e.claims.P569),
    died: wdDate(e.claims.P570),
    bouts, won, lost, drew, nc,
    kos: num(wt, 'KO'),
    induction,
    avatarImg: credit?.avatarImg ?? null,
    img: credit?.img ?? null,
    imageAuthor: credit?.imageAuthor ?? null,
    imageLicense: credit?.imageLicense ?? null,
    imageLicenseUrl: credit?.imageLicenseUrl ?? null,
    imageSourceUrl: credit?.imageSourceUrl ?? null,
    _source: `https://en.wikipedia.org/wiki/${encodeURIComponent(b.title.replace(/ /g, '_'))}`,
  }
  const missing = ['biography', 'born', 'bouts', 'won', 'lost', 'kos', 'induction'].filter((k) => row[k] == null || row[k] === '')
  if (missing.length) warnings.push(`${name}: missing ${missing.join(', ')}`)
  if (b.note) warnings.push(`${name}: ${b.note}`)
  seed.push(row)
  console.log('ok', name)
  await sleep(800)
}
fs.writeFileSync(OUT, JSON.stringify(seed, null, 2) + '\n')
console.log('\n' + warnings.join('\n'))
console.log('done', seed.length)
