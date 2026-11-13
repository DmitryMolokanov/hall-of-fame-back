// Second pass over boxers added by add-inductees.mjs:
//  - removes inductees that are not boxers (trainers, referees, promoters, writers) mis-tagged in Wikidata
//  - re-parses fight records with more infobox variants (inline record templates, martial-artist infobox)
// Usage (from repo root): node back/tools/registry-scripts/fix-inductees.mjs
import fs from 'fs'
import path from 'path'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '../../..')
const P = (p) => path.join(ROOT, p)
const H = { headers: { 'User-Agent': 'HoF-image-audit/1.0 (local script)' } }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Inducted as non-participants/observers; Wikidata lists "boxer" among their occupations
const NOT_BOXERS = [
  'John Douglas, 9th Marquess of Queensberry', 'Emanuel Steward', 'Lou Duva', 'Richard Steele', 'Nat Fleischer',
  'Teddy Atlas', 'Charley Goldman', 'Eddie Futch', 'Jack Kearns', 'Ralph Citro', 'José Sulaimán', 'Arthur Mercante Sr.',
  'Harry Gibbs', 'Nigel Collins', 'Ray Arcel', 'Kenny Bayless', 'Whitey Bimstein', 'Frank Cappuccino', 'George Benton',
  'Jarvis Astaire', 'Angelo Dundee', 'John Graham Chambers', 'Gil Clancy', "Cus D'Amato", 'Bill Cayton', 'Harry Mullan',
  'Stanley Christodoulou',
]

const seedPath = P('back/src/data/boxersSeed.json'), credPath = P('back/src/data/imageCredits.json')
let seed = JSON.parse(fs.readFileSync(seedPath, 'utf8'))
let credits = JSON.parse(fs.readFileSync(credPath, 'utf8'))

// 1. drop non-boxers (and their downloaded photos)
const drop = new Set(NOT_BOXERS)
for (const r of seed.filter((r) => drop.has(r.name))) {
  for (const p of [r.avatarImg, r.img]) if (p) fs.rmSync(P('back/public' + p), { force: true })
}
const removed = seed.filter((r) => drop.has(r.name)).map((r) => r.name)
seed = seed.filter((r) => !drop.has(r.name))
credits = credits.filter((c) => !drop.has(c.name))

// 2. re-parse records for rows still missing data
const field = (wt, names) => {
  for (const n of names) {
    const m = wt.match(new RegExp(`(?:^|\\|)\\s*${n}\\s*=\\s*([^\\n|}]*)`, 'im'))
    const v = m && parseInt(m[1].replace(/<[^>]*>|\{\{[^}]*\}\}|,/g, '').trim(), 10)
    if (Number.isFinite(v)) return v
  }
  return null
}
const todo = seed.filter((r) => r._wikidata && ['bouts', 'won', 'lost', 'kos'].some((k) => r[k] == null))
const titles = todo.map((r) => decodeURIComponent(r._source.split('/wiki/')[1]).replace(/_/g, ' '))
const wikitext = {}
for (let i = 0; i < titles.length; i += 20) {
  const j = await (await fetch('https://en.wikipedia.org/w/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&format=json&formatversion=2&titles=' + encodeURIComponent(titles.slice(i, i + 20).join('|')), H)).json()
  for (const p of j.query.pages) wikitext[p.title] = p.revisions?.[0]?.slots?.main?.content || ''
  await sleep(800)
}
const still = []
todo.forEach((r, i) => {
  const wt = wikitext[titles[i]] || ''
  const won = r.won ?? field(wt, ['wins', 'box_win'])
  const lost = r.lost ?? field(wt, ['losses', 'box_loss'])
  const drew = field(wt, ['draws', 'box_draw']) ?? r.drew ?? 0
  const nc = field(wt, ['no_contests', 'box_nc']) ?? r.nc ?? 0
  Object.assign(r, {
    won, lost, drew, nc,
    bouts: r.bouts ?? field(wt, ['total', 'box_total']) ?? (won != null && lost != null ? won + lost + drew + nc : null),
    kos: r.kos ?? field(wt, ['KO', 'box_ko_win']),
  })
  const missing = ['bouts', 'won', 'lost', 'kos'].filter((k) => r[k] == null)
  if (missing.length) still.push({ name: r.name, missing, source: r._source })
})

fs.writeFileSync(seedPath, JSON.stringify(seed, null, 2) + '\n')
fs.writeFileSync(credPath, JSON.stringify(credits, null, 2) + '\n')
console.log('removed', removed.length, removed.filter((n) => !NOT_BOXERS.includes(n)))
console.log('still missing', still.length)
for (const s of still) console.log(' ', s.name, '-', s.missing.join(','))
fs.writeFileSync(P('back/tools/registry-scripts/fix-inductees-report.json'), JSON.stringify({ removed, still }, null, 2))
