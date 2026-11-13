// Finds freely licensed Commons photo candidates for boxers in the seed that have no photo or a small one.
// Usage (from repo root): node back/tools/registry-scripts/find-photos.mjs
// Output: back/tools/registry-scripts/photo-candidates.json
import fs from 'fs'
import path from 'path'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '../../..')
const P = (p) => path.join(ROOT, p)
const H = { headers: { 'User-Agent': 'HoF-image-audit/1.0 (local script)' } }
const MIN_W = 500, MIN_H = 600
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const strip = (s) => (s || '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim()
const FREE = /^(public domain|pd|cc0|cc by(-sa)? \d|cc-by(-sa)?-\d|attribution|no restrictions)/i
const get = async (url) => {
  for (let i = 0; i < 8; i++) {
    let r
    try { r = await fetch(url, H) } catch { await sleep(5000 * (i + 1)); continue } // connection reset
    if (r.ok) { const t = await r.text(); try { return JSON.parse(t) } catch { } }
    await sleep(r.status === 429 ? 20000 * (i + 1) : 4000 * (i + 1))
  }
  throw new Error('Failed: ' + url)
}
const API = 'https://commons.wikimedia.org/w/api.php?format=json&'
const info = async (titles) => {
  const out = {}
  for (let i = 0; i < titles.length; i += 40) {
    const j = await get(API + 'action=query&prop=imageinfo&iiprop=size|extmetadata|url|mime&iiurlwidth=250&titles=' + encodeURIComponent(titles.slice(i, i + 40).join('|')))
    for (const p of Object.values(j.query?.pages || {})) {
      const ii = p.imageinfo?.[0]; if (!ii) continue
      const m = ii.extmetadata || {}
      out[p.title] = { title: p.title, w: ii.width, h: ii.height, mime: ii.mime, thumb: ii.thumburl, page: ii.descriptionurl,
        license: strip(m.LicenseShortName?.value), licenseUrl: m.LicenseUrl?.value || null, artist: strip(m.Artist?.value) }
    }
    await sleep(400)
  }
  return out
}

const seed = JSON.parse(fs.readFileSync(P('back/src/data/boxersSeed.json'), 'utf8'))
const credits = JSON.parse(fs.readFileSync(P('back/src/data/imageCredits.json'), 'utf8'))
const { boxers: audit } = JSON.parse(fs.readFileSync(P('back/tools/registry-scripts/audit.json'), 'utf8'))
const qidByName = Object.fromEntries(Object.values(audit).map((b) => [b.title.replace(/\s*\([^)]*\)$/, ''), b.qid]))

// current photo sizes
const curTitles = seed.filter((r) => r.imageSourceUrl).map((r) => 'File:' + decodeURIComponent(r.imageSourceUrl.split('/wiki/File:')[1]).replace(/_/g, ' '))
const cur = await info(curTitles)
const targets = seed.map((r) => {
  const t = r.imageSourceUrl && 'File:' + decodeURIComponent(r.imageSourceUrl.split('/wiki/File:')[1]).replace(/_/g, ' ')
  return { name: r.name, qid: r._wikidata || qidByName[r.name], current: t ? cur[t] : null }
}).filter((t) => t.qid && (!t.current || t.current.w < MIN_W || t.current.h < MIN_H))
// already reviewed by hand earlier: no better free photo exists
const REVIEWED = new Set(['Bobby Chacon', 'Miguel Canto', 'Nino Benvenuti', 'Marcel Cerdan', 'Gene Fullmer', 'Arturo Gatti', 'Emile Griffith', 'Ismael Laguna', 'Antonio Cervantes'])
const list = targets.filter((t) => !REVIEWED.has(t.name))
console.log('targets', list.length, '(no photo:', list.filter((t) => !t.current).length + ')')

// Wikidata: Commons category per boxer
const cats = {}
for (let i = 0; i < list.length; i += 50) {
  const j = await get('https://www.wikidata.org/w/api.php?action=wbgetentities&props=claims&format=json&ids=' + list.slice(i, i + 50).map((t) => t.qid).join('|'))
  for (const [q, e] of Object.entries(j.entities)) cats[q] = e.claims?.P373?.[0]?.mainsnak?.datavalue?.value
  await sleep(500)
}

const BAD = /\b(grave|tomb|statue|monument|plaque|signature|autograph|map|poster|program|ticket|street|house|birthplace|memorial|stamp|coin|logo|book|gravestone|headstone|sign)\b/i
const result = []
for (const t of list) {
  const titles = new Set()
  if (cats[t.qid]) {
    const j = await get(API + 'action=query&list=categorymembers&cmtype=file&cmlimit=100&cmtitle=' + encodeURIComponent('Category:' + cats[t.qid]))
    ;(j.query?.categorymembers || []).forEach((m) => titles.add(m.title))
  }
  const d = await get(API + 'action=query&list=search&srnamespace=6&srlimit=30&srsearch=' + encodeURIComponent('haswbstatement:P180=' + t.qid))
  ;(d.query?.search || []).forEach((s) => titles.add(s.title))
  if (t.current) titles.delete(t.current.title)
  const surname = t.name.split(' ').pop().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const cands = Object.values(await info([...titles]))
    .filter((x) => /^image\/(jpeg|png|tiff|webp)/.test(x.mime) && FREE.test(x.license) && x.h >= 350)
    .filter((x) => !t.current || x.w * x.h > t.current.w * t.current.h * 1.5)
    .map((x) => {
      const title = x.title.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
      let score = Math.log(x.w * x.h)
      if (title.includes(surname)) score += 3
      if (/\b(vs\.?|versus|and|&|with|fight|bout)\b/.test(title)) score -= 3
      if (BAD.test(title)) score -= 6
      if (x.h >= x.w) score += 1 // portrait orientation suits the profile page
      return { ...x, score }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
  result.push({ name: t.name, qid: t.qid, current: t.current || null, candidates: cands })
  await sleep(300)
}
fs.writeFileSync(P('back/tools/registry-scripts/photo-candidates.json'), JSON.stringify(result, null, 2))
console.log('with candidates', result.filter((r) => r.candidates.length).length, 'of', result.length)
