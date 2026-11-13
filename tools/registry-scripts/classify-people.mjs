// IBHOF Non-Participants -> roles for the "Beyond the Ring" section.
// Input:  ibhof-site-2026.json (nonparticipant list from the archived ibhof.com page) + ibhof-inductees.json (Wikidata)
// Output: back/tools/registry-scripts/people-roles.json  [{ name, qid, title, roles[], occupations[], description }]
// Usage (from repo root): node back/tools/registry-scripts/classify-people.mjs
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
  return null
}

const site = JSON.parse(fs.readFileSync(P('back/tools/registry-scripts/ibhof-site-2026.json'), 'utf8'))
const inductees = JSON.parse(fs.readFileSync(P('back/tools/registry-scripts/ibhof-inductees.json'), 'utf8'))
const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/&#39;|'/g, '').replace(/\b(dr|jr|sr|lord)\b\.?/g, '').replace(/[().,"]/g, ' ').replace(/\s+/g, ' ').trim()

const names = site.nonparticipant
const result = []
for (const name of names) {
  const n = norm(name)
  const last = n.split(' ').pop()
  let hit = inductees.find((x) => norm(x.name) === n)
    || inductees.filter((x) => norm(x.name).split(' ').pop() === last && norm(x.name)[0] === n[0])[0]
  if (!hit) {
    // not in the Wikidata award list: search by name
    const s = await get(`https://www.wikidata.org/w/api.php?action=wbsearchentities&language=en&type=item&limit=5&format=json&search=${encodeURIComponent(name.replace(/[()]/g, ''))}`)
    const c = (s?.search || []).find((x) => /box|promot|train|manag|referee|matchmak|announc/i.test(x.description || ''))
    if (c) hit = { q: c.id, name: c.label, viaSearch: true }
    await sleep(300)
  }
  result.push({ name, qid: hit?.q || null, wdName: hit?.name || null, viaSearch: !!hit?.viaSearch })
}

// occupations (P106) and English Wikipedia titles
const ids = result.map((r) => r.qid).filter(Boolean)
const ent = {}
for (let i = 0; i < ids.length; i += 50) {
  const j = await get('https://www.wikidata.org/w/api.php?action=wbgetentities&props=claims|sitelinks|descriptions&languages=en&sitefilter=enwiki&format=json&ids=' + ids.slice(i, i + 50).join('|'))
  Object.assign(ent, j?.entities || {})
  await sleep(500)
}
const occIds = [...new Set(Object.values(ent).flatMap((e) => (e.claims?.P106 || []).map((c) => c.mainsnak?.datavalue?.value?.id)).filter(Boolean))]
const occLabel = {}
for (let i = 0; i < occIds.length; i += 50) {
  const j = await get('https://www.wikidata.org/w/api.php?action=wbgetentities&props=labels&languages=en&format=json&ids=' + occIds.slice(i, i + 50).join('|'))
  for (const [q, e] of Object.entries(j?.entities || {})) occLabel[q] = e.labels?.en?.value || q
  await sleep(500)
}

const TRAINER = /trainer|coach|cutman|cornerman|second\b/i
const PROMOTER = /promot|manager|matchmak|impresario|agent|executive|businessman|businessperson|entrepreneur/i
for (const r of result) {
  const e = ent[r.qid]
  r.title = e?.sitelinks?.enwiki?.title || null
  r.description = e?.descriptions?.en?.value || ''
  r.occupations = (e?.claims?.P106 || []).map((c) => occLabel[c.mainsnak?.datavalue?.value?.id]).filter(Boolean)
  const text = [r.description, ...r.occupations].join(' | ')
  r.roles = [TRAINER.test(text) && 'trainer', PROMOTER.test(text) && 'promoter'].filter(Boolean)
}
fs.writeFileSync(P('back/tools/registry-scripts/people-roles.json'), JSON.stringify(result, null, 2))
const by = (f) => result.filter(f).length
console.log('total', result.length, '| no qid', by((r) => !r.qid), '| trainer', by((r) => r.roles.includes('trainer')), '| promoter', by((r) => r.roles.includes('promoter')), '| both', by((r) => r.roles.length === 2), '| neither', by((r) => !r.roles.length))
