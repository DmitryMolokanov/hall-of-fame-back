// Applies hand-picked photos from photo-candidates.json (picked on contact sheets):
// downloads Commons thumbnails, updates imageCredits.json and boxersSeed.json.
// Usage (from repo root): node back/tools/registry-scripts/apply-photo-picks.mjs [candidates.json] [picks.json]
import fs from 'fs'
import path from 'path'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '../../..')
const P = (p) => path.join(ROOT, p)
const H = { headers: { 'User-Agent': 'HoF-image-audit/1.0 (local script)' } }
const STD_W = [120, 250, 330, 500, 960, 1280]
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const get = async (url, asBuffer) => {
  for (let i = 0; i < 8; i++) {
    let r
    try { r = await fetch(url, H) } catch { await sleep(5000 * (i + 1)); continue }
    if (r.ok) {
      if (asBuffer) return Buffer.from(await r.arrayBuffer())
      const t = await r.text(); try { return JSON.parse(t) } catch { }
    }
    await sleep(r.status === 429 ? 20000 * (i + 1) : 4000 * (i + 1))
  }
  throw new Error('Failed: ' + url)
}

// boxer name -> candidate number on the contact sheet (1-based)
// usage: node apply-photo-picks.mjs [candidates.json] [picks.json]
const PICKS = JSON.parse(fs.readFileSync(path.resolve(process.argv[3] ?? path.join(ROOT, 'back/tools/registry-scripts/photo-picks.json')), 'utf8'))
const cleanArtist = (a) => (!a || /unknown|see below|none indicated|public domain in/i.test(a) ? null : a.length > 120 ? a.slice(0, 117) + '…' : a)
const slugOf = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

const cands = JSON.parse(fs.readFileSync(path.resolve(process.argv[2] ?? P('back/tools/registry-scripts/photo-candidates.json')), 'utf8'))
const seedPath = P('back/src/data/boxersSeed.json'), credPath = P('back/src/data/imageCredits.json')
const seed = JSON.parse(fs.readFileSync(seedPath, 'utf8'))
const credits = JSON.parse(fs.readFileSync(credPath, 'utf8'))
const pub = P('back/public')

let done = 0
for (const [name, n] of Object.entries(PICKS)) {
  const entry = cands.find((c) => c.name === name)
  const pick = entry?.candidates[n - 1]
  const row = seed.find((r) => r.name === name)
  if (!pick || !row) { console.log('MISSING', name); continue }
  const file = pick.title.replace(/^File:/, '')
  let cred = credits.find((c) => c.imageSourceUrl && c.imageSourceUrl === row.imageSourceUrl) || credits.find((c) => c.name === name)
  if (!cred) {
    let key = slugOf(name); while (credits.some((c) => c.key === key)) key += '-2'
    cred = { key, name, wikidata: entry.qid }
    credits.push(cred)
  }
  const old = [row.avatarImg, row.img]
  for (const [kind, target] of [['avatar', 500], ['img', 1280]]) {
    const w = STD_W.filter((s) => s <= target && s < pick.w).pop() || STD_W[0]
    const info = await get(`https://commons.wikimedia.org/w/api.php?action=query&prop=imageinfo&iiprop=url&iiurlwidth=${w}&format=json&titles=${encodeURIComponent('File:' + file)}`)
    const url = Object.values(info.query.pages)[0].imageinfo[0].thumburl
    const ext = path.extname(new URL(url).pathname).toLowerCase().replace('.jpeg', '.jpg')
    const rel = `/images/commons/${kind}/${cred.key}${ext}`
    fs.writeFileSync(path.join(pub, rel), await get(url, true))
    row[kind === 'avatar' ? 'avatarImg' : 'img'] = rel
    await sleep(800)
  }
  for (const p of old) if (p && ![row.avatarImg, row.img].includes(p)) fs.rmSync(path.join(pub, p), { force: true })
  Object.assign(row, { imageAuthor: cleanArtist(pick.artist), imageLicense: pick.license, imageLicenseUrl: pick.licenseUrl, imageSourceUrl: pick.page })
  Object.assign(cred, { avatarImg: row.avatarImg, img: row.img, imageAuthor: row.imageAuthor, imageLicense: row.imageLicense, imageLicenseUrl: row.imageLicenseUrl, imageSourceUrl: row.imageSourceUrl })
  delete cred.skip; delete cred.review
  done++
  console.log('ok', name, `${pick.w}x${pick.h}`, pick.license)
}
fs.writeFileSync(seedPath, JSON.stringify(seed, null, 2) + '\n')
fs.writeFileSync(credPath, JSON.stringify(credits, null, 2) + '\n')
console.log('applied', done, 'of', Object.keys(PICKS).length)
