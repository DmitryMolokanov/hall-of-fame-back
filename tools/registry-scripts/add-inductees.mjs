// Adds IBHOF boxers that are missing from the site (men only for now) to the local seed.
// Sources: Wikidata (dates, induction year, photo P18 - CC0), English Wikipedia (record from infobox,
// biography from the lead section - CC BY-SA 4.0), Wikimedia Commons (photos, free licenses).
// Usage (from repo root): node back/tools/registry-scripts/add-inductees.mjs
// Input:  back/tools/registry-scripts/ibhof-inductees.json (Wikidata list of inductees)
// Output: appends to back/src/data/boxersSeed.json and imageCredits.json, downloads photos,
//         writes back/tools/registry-scripts/add-inductees-report.json
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '../../..')
const P = (p) => path.join(ROOT, p)
const H = { headers: { 'User-Agent': 'HoF-image-audit/1.0 (local script)' } }
const IBHOF = 'Q572227'
const STD_W = [120, 250, 330, 500, 960, 1280]
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const chunks = (a, n) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n))
const strip = (s) => (s || '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim()
const get = async (url, asBuffer) => {
  for (let i = 0; i < 8; i++) {
    const r = await fetch(url, H)
    if (r.ok) {
      if (asBuffer) return Buffer.from(await r.arrayBuffer())
      const t = await r.text()
      try { return JSON.parse(t) } catch { /* rate-limit page served with 200 */ }
    }
    await sleep(r.status === 429 ? 20000 * (i + 1) : 4000 * (i + 1))
  }
  throw new Error('Failed: ' + url)
}

const inductees = JSON.parse(fs.readFileSync(P('back/tools/registry-scripts/ibhof-inductees.json'), 'utf8'))
const seed = JSON.parse(fs.readFileSync(P('back/src/data/boxersSeed.json'), 'utf8'))
const credits = JSON.parse(fs.readFileSync(P('back/src/data/imageCredits.json'), 'utf8'))
const { boxers: existing } = JSON.parse(fs.readFileSync(P('back/tools/registry-scripts/audit.json'), 'utf8'))
const haveQ = new Set([...Object.values(existing).map((b) => b.qid), ...seed.map((s) => s._wikidata).filter(Boolean)])
const haveNames = new Set(seed.map((s) => s.name.toLowerCase()))

// --women: the IBHOF women's categories (category by Wikidata id, names differ between sources)
const WOMEN = process.argv.includes('--women')
const TRAILBLAZERS = new Set(['Q4858794', 'Q5053412', 'Q136416975', 'Q124256334', 'Q24649833', 'Q24851641'])
const categoryOf = (q) => (!WOMEN ? undefined : TRAILBLAZERS.has(q) ? 'women-trailblazer' : 'women-modern')
const slugOf = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const haveSlugs = new Set(seed.map((s) => s.slug).filter(Boolean))

const todo = inductees.filter((x) => x.boxer && (WOMEN ? x.female : !x.female) && !haveQ.has(x.q))
console.log('to add:', todo.length)

// 1. Wikidata entities: dates, induction year, P18, enwiki title
const wd = {}
for (const c of chunks(todo.map((x) => x.q), 50)) {
  const j = await get('https://www.wikidata.org/w/api.php?action=wbgetentities&props=claims|sitelinks|labels&languages=en&sitefilter=enwiki&format=json&ids=' + c.join('|'))
  Object.assign(wd, j.entities)
  await sleep(500)
}
const wdDate = (c) => {
  const t = c?.[0]?.mainsnak?.datavalue?.value?.time
  if (!t) return null
  const [y, m, d] = t.slice(1, 11).split('-')
  return m === '00' ? y : d === '00' ? `${y}-${m}` : `${y}-${m}-${d}`
}

const rows = [], report = { added: [], skipped: [], incomplete: [], noPhoto: [], smallPhoto: [] }
const base = todo.map((x) => {
  const e = wd[x.q]
  const title = e?.sitelinks?.enwiki?.title
  const hof = (e?.claims?.P166 || []).filter((c) => c.mainsnak?.datavalue?.value?.id === IBHOF)
  const year = parseInt(hof.map((h) => h.qualifiers?.P585?.[0]?.datavalue?.value?.time).find(Boolean)?.slice(1, 5), 10) || (x.year ? +x.year : null)
  return { q: x.q, label: e?.labels?.en?.value || x.name, title, induction: year, born: wdDate(e?.claims?.P569), died: wdDate(e?.claims?.P570), p18: e?.claims?.P18?.[0]?.mainsnak?.datavalue?.value || null }
})
for (const b of base.filter((b) => !b.title)) report.skipped.push(`${b.label} (${b.q}): no English Wikipedia article`)
const withWiki = base.filter((b) => b.title)

// 2. Wikipedia: lead wikitext (record) and plain-text intro (biography)
const wikitext = {}, extract = {}
for (const c of chunks(withWiki.map((b) => b.title), 20)) {
  const t = encodeURIComponent(c.join('|'))
  const r = await get(`https://en.wikipedia.org/w/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&format=json&formatversion=2&titles=${t}`)
  for (const p of r.query.pages) wikitext[p.title] = p.revisions?.[0]?.slots?.main?.content || ''
  const x = await get(`https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=1&explaintext=1&exlimit=20&format=json&formatversion=2&titles=${t}`)
  for (const p of x.query.pages) extract[p.title] = p.extract || ''
  await sleep(800)
}
const num = (wt, field) => {
  const m = wt.match(new RegExp(`^\\s*\\|\\s*${field}\\s*=\\s*([^\\n|]*)`, 'im'))
  const n = m && parseInt(m[1].replace(/<[^>]*>|\{\{[^}]*\}\}|,/g, '').trim(), 10)
  return Number.isFinite(n) ? n : null
}

// 3. Commons metadata for P18 photos
const meta = {}
for (const c of chunks(withWiki.map((b) => b.p18).filter(Boolean), 40)) {
  const j = await get('https://commons.wikimedia.org/w/api.php?action=query&prop=imageinfo&iiprop=size|extmetadata|url&format=json&titles=' + encodeURIComponent(c.map((f) => 'File:' + f).join('|')))
  const norm = Object.fromEntries((j.query.normalized || []).map((n) => [n.to, n.from]))
  for (const p of Object.values(j.query.pages)) {
    const ii = p.imageinfo?.[0]; if (!ii) continue
    const m = ii.extmetadata || {}
    meta[(norm[p.title] || p.title).replace(/^File:/, '').replace(/_/g, ' ')] = {
      w: ii.width, h: ii.height, page: ii.descriptionurl,
      license: strip(m.LicenseShortName?.value), licenseUrl: m.LicenseUrl?.value || null, artist: strip(m.Artist?.value),
    }
  }
  await sleep(500)
}
const cleanArtist = (a) => (!a || /unknown|see below|none indicated|public domain in/i.test(a) ? null : a.length > 120 ? a.slice(0, 117) + '…' : a)
const FREE = /^(public domain|pd|cc0|cc by(-sa)? \d|cc-by(-sa)?-\d|attribution|no restrictions)/i

// 4. Assemble rows and download photos
const keys = new Set(credits.map((c) => c.key))
for (const b of withWiki) {
  const name = b.title.replace(/\s*\([^)]*\)$/, '')
  if (haveNames.has(name.toLowerCase())) { report.skipped.push(`${name} (${b.q}): name already in seed`); continue }
  const wt = wikitext[b.title] || ''
  // boxer infobox (wins/losses/KO) or martial-artist infobox (box_win/box_loss/box_ko_win)
  const pick = (...fields) => { for (const f of fields) { const v = num(wt, f); if (v != null) return v } return null }
  const won = pick('wins', 'box_win'), lost = pick('losses', 'box_loss'), drew = pick('draws', 'box_draw') ?? 0, nc = pick('no_?contests', 'box_nc') ?? 0
  const total = pick('total', 'box_total')
  let slug = slugOf(name); while (haveSlugs.has(slug)) slug += '-2'
  haveSlugs.add(slug)
  const row = {
    id: crypto.randomUUID(), slug, name,
    biography: (extract[b.title] || '').split(/\n+/).map((p) => p.trim()).filter(Boolean).join('<br>'),
    bioSourceUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(b.title.replace(/ /g, '_'))}`,
    born: b.born, died: b.died,
    bouts: total ?? (won != null && lost != null ? won + lost + drew + nc : null),
    won, lost: lost ?? (won != null && total === won + drew + nc ? 0 : null), drew, nc,
    kos: pick('KO', 'box_ko_win'), induction: b.induction,
    ...(WOMEN ? { category: categoryOf(b.q) } : {}),
    avatarImg: null, img: null, imageAuthor: null, imageLicense: null, imageLicenseUrl: null, imageSourceUrl: null,
    _source: `https://en.wikipedia.org/wiki/${encodeURIComponent(b.title.replace(/ /g, '_'))}`,
    _wikidata: b.q,
  }
  const missing = ['biography', 'born', 'bouts', 'won', 'lost', 'kos', 'induction'].filter((k) => row[k] == null || row[k] === '')
  if (missing.length) report.incomplete.push({ name, q: b.q, missing, source: row._source })

  const m = b.p18 && meta[b.p18.replace(/_/g, ' ')]
  if (m && FREE.test(m.license)) {
    let key = slugOf(name); while (keys.has(key)) key += '-2'
    keys.add(key)
    for (const [kind, target] of [['avatar', 500], ['img', 1280]]) {
      const w = STD_W.filter((s) => s <= target && s < m.w).pop() || STD_W[0]
      const info = await get(`https://commons.wikimedia.org/w/api.php?action=query&prop=imageinfo&iiprop=url&iiurlwidth=${w}&format=json&titles=${encodeURIComponent('File:' + b.p18)}`)
      const url = Object.values(info.query.pages)[0].imageinfo[0].thumburl
      const ext = path.extname(new URL(url).pathname).toLowerCase().replace('.jpeg', '.jpg')
      const rel = `/images/commons/${kind}/${key}${ext}`
      const dest = P('back/public' + rel)
      if (!fs.existsSync(dest)) { fs.writeFileSync(dest, await get(url, true)); await sleep(700) }
      row[kind === 'avatar' ? 'avatarImg' : 'img'] = rel
    }
    Object.assign(row, { imageAuthor: cleanArtist(m.artist), imageLicense: m.license, imageLicenseUrl: m.licenseUrl, imageSourceUrl: m.page })
    credits.push({ key, name, wikidata: b.q, avatarImg: row.avatarImg, img: row.img, imageAuthor: row.imageAuthor, imageLicense: row.imageLicense, imageLicenseUrl: row.imageLicenseUrl, imageSourceUrl: row.imageSourceUrl })
    if (m.w < 500 || m.h < 600) report.smallPhoto.push(`${name}: ${m.w}x${m.h}`)
  } else {
    report.noPhoto.push(name + (m ? ` (license: ${m.license})` : ''))
  }
  rows.push(row)
  report.added.push(name)
  if (rows.length % 25 === 0) console.log('...', rows.length)
}

fs.writeFileSync(P('back/src/data/boxersSeed.json'), JSON.stringify([...seed, ...rows], null, 2) + '\n')
fs.writeFileSync(P('back/src/data/imageCredits.json'), JSON.stringify(credits, null, 2) + '\n')
fs.writeFileSync(P(WOMEN ? 'back/tools/registry-scripts/add-women-report.json' : 'back/tools/registry-scripts/add-inductees-report.json'), JSON.stringify(report, null, 2))
console.log({ added: report.added.length, skipped: report.skipped.length, incomplete: report.incomplete.length, noPhoto: report.noPhoto.length, smallPhoto: report.smallPhoto.length })
