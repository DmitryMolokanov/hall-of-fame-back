// Second search for boxers without a photo, beyond P18 / Commons category / "depicts":
//  1) lead images of the boxer's articles in every Wikipedia language (free images only)
//  2) Commons full-text search on file names
// Usage (from repo root): node back/tools/registry-scripts/find-missing-photos.mjs
// Output: back/tools/registry-scripts/missing-photo-candidates.json
import fs from 'fs'
import path from 'path'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '../../..')
const P = (p) => path.join(ROOT, p)
const H = { headers: { 'User-Agent': 'HoF-image-audit/1.0 (local script)' } }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const strip = (s) => (s || '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim()
const FREE = /^(public domain|pd|cc0|cc by(-sa)? \d|cc-by(-sa)?-\d|attribution|no restrictions)/i
const get = async (url) => {
  for (let i = 0; i < 8; i++) {
    let r
    try { r = await fetch(url, H) } catch { await sleep(5000 * (i + 1)); continue }
    if (r.ok) { const t = await r.text(); try { return JSON.parse(t) } catch { } }
    if (r.status === 404) return null
    await sleep(r.status === 429 ? 20000 * (i + 1) : 4000 * (i + 1))
  }
  return null
}

const seed = JSON.parse(fs.readFileSync(P('back/src/data/boxersSeed.json'), 'utf8'))
const { boxers: audit } = JSON.parse(fs.readFileSync(P('back/tools/registry-scripts/audit.json'), 'utf8'))
const qidByName = Object.fromEntries(Object.values(audit).map((b) => [b.title.replace(/\s*\([^)]*\)$/, ''), b.qid]))
const missing = seed.filter((r) => !r.img).map((r) => ({ name: r.name, qid: r._wikidata || qidByName[r.name] }))
console.log('without photo:', missing.length)

// all Wikipedia sitelinks per boxer
const links = {}
for (let i = 0; i < missing.length; i += 50) {
  const ids = missing.slice(i, i + 50).map((m) => m.qid).filter(Boolean)
  const j = await get('https://www.wikidata.org/w/api.php?action=wbgetentities&props=sitelinks&format=json&ids=' + ids.join('|'))
  for (const [q, e] of Object.entries(j?.entities || {})) {
    links[q] = Object.values(e.sitelinks || {}).filter((s) => /^[a-z_]+wiki$/.test(s.site) && s.site !== 'commonswiki' && s.site !== 'specieswiki')
  }
  await sleep(500)
}

// resumable: results are saved after every boxer, a rerun skips the ones already done
const OUT = P('back/tools/registry-scripts/missing-photo-candidates.json')
const result = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : []
const done = new Set(result.map((r) => r.name))
for (const m of missing) {
  if (done.has(m.name)) continue
  const files = new Set()
  // 1) lead image of each language article; pilicense=free keeps only Commons files
  for (const s of links[m.qid] || []) {
    const lang = s.site.replace(/wiki$/, '').replace(/_/g, '-')
    const j = await get(`https://${lang}.wikipedia.org/w/api.php?action=query&prop=pageimages&piprop=name&pilicense=free&format=json&formatversion=2&titles=${encodeURIComponent(s.title)}`)
    const img = j?.query?.pages?.[0]?.pageimage
    if (img) files.add('File:' + img.replace(/_/g, ' '))
    await sleep(150)
  }
  // 2) Commons file-name search: full name, then quoted surname + "boxer"
  const surname = m.name.split(' ').pop()
  for (const q of [`intitle:"${m.name}"`, `intitle:"${surname}" boxer`]) {
    const j = await get('https://commons.wikimedia.org/w/api.php?action=query&list=search&srnamespace=6&srlimit=15&format=json&srsearch=' + encodeURIComponent(q + ' filetype:bitmap'))
    ;(j?.query?.search || []).forEach((x) => files.add(x.title))
    await sleep(300)
  }

  const info = []
  const titles = [...files]
  for (let i = 0; i < titles.length; i += 40) {
    const j = await get('https://commons.wikimedia.org/w/api.php?action=query&prop=imageinfo&iiprop=size|extmetadata|url|mime&iiurlwidth=250&format=json&titles=' + encodeURIComponent(titles.slice(i, i + 40).join('|')))
    for (const p of Object.values(j?.query?.pages || {})) {
      const ii = p.imageinfo?.[0]; if (!ii) continue
      const md = ii.extmetadata || {}
      const license = strip(md.LicenseShortName?.value)
      if (!/^image\/(jpeg|png|tiff|webp)/.test(ii.mime) || !FREE.test(license) || ii.height < 300) continue
      info.push({ title: p.title, w: ii.width, h: ii.height, thumb: ii.thumburl, page: ii.descriptionurl, license,
        licenseUrl: md.LicenseUrl?.value || null, artist: strip(md.Artist?.value), credit: strip(md.Credit?.value) })
    }
    await sleep(400)
  }
  // rank: file name mentions the surname, larger first
  const sn = surname.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  info.sort((a, b) => (b.title.toLowerCase().includes(sn) - a.title.toLowerCase().includes(sn)) || b.w * b.h - a.w * a.h)
  result.push({ ...m, candidates: info.slice(0, 6) })
  fs.writeFileSync(OUT, JSON.stringify(result, null, 2))
  console.log(m.name, '->', info.length)
}
console.log('with candidates:', result.filter((r) => r.candidates.length).length, 'of', result.length)
