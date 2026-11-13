// Downloads free Commons replacements listed in audit.json and writes the credits manifest.
// Usage (from repo root): node back/tools/registry-scripts/download.mjs
import fs from 'fs'
import path from 'path'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '../../..')
const AUDIT = path.join(ROOT, 'back/tools/registry-scripts/audit.json')
const OUT_IMG = path.join(ROOT, 'back/public/images/commons')
const MANIFEST = path.join(ROOT, 'back/src/data/imageCredits.json')
const UA = 'HoF-image-audit/1.0 (local script)'
const AVATAR_W = 500, IMG_W = 1280

// Replacements that are not usable as a portrait: skipped by the DB util until a better file is found.
const SKIP = {
  buchanan: 'Commons P18 is a photo of a statue, not a portrait',
  curry: 'Commons P18 is a magazine cover',
}
const REVIEW = {
  gonzalez: 'Group photo, needs cropping', graham: 'Fight photo (postcard), needs cropping',
  chacon: 'Fight photo, needs cropping', elorde: 'Fight photo, needs cropping', hamed: 'Photo from a WWE show',
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const get = async (url, asBuffer) => {
  for (let i = 0; i < 5; i++) {
    const r = await fetch(url, { headers: { 'User-Agent': UA } })
    if (r.ok) return asBuffer ? Buffer.from(await r.arrayBuffer()) : r.json()
    console.log('  HTTP', r.status, 'retry', i + 1)
    await sleep(r.status === 429 ? 30000 * (i + 1) : 2000 * (i + 1))
  }
  throw new Error('Failed: ' + url)
}
// Wikimedia only serves (and caches) these thumbnail widths without throttling: https://w.wiki/GHai
const STD_W = [120, 250, 330, 500, 960, 1280]
const thumbs = async (file, width) => {
  const info = await get(`https://commons.wikimedia.org/w/api.php?action=query&prop=imageinfo&iiprop=size&format=json&titles=${encodeURIComponent('File:' + file)}`)
  const orig = Object.values(info.query.pages)[0].imageinfo[0].width
  const w = STD_W.filter((s) => s <= width && s < orig).pop() || STD_W[0]
  const j = await get(`https://commons.wikimedia.org/w/api.php?action=query&prop=imageinfo&iiprop=url&iiurlwidth=${w}&format=json&titles=${encodeURIComponent('File:' + file)}`)
  const ii = Object.values(j.query.pages)[0].imageinfo[0]
  return ii.thumburl
}
const unknown = (a) => !a || /unknown|see below|none indicated|public domain in/i.test(a)
const plain = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')

const { boxers } = JSON.parse(fs.readFileSync(AUDIT, 'utf8'))
fs.mkdirSync(path.join(OUT_IMG, 'avatar'), { recursive: true })
fs.mkdirSync(path.join(OUT_IMG, 'img'), { recursive: true })
fs.mkdirSync(path.dirname(MANIFEST), { recursive: true })

const manifest = []
for (const b of Object.values(boxers).sort((x, y) => x.key.localeCompare(y.key))) {
  if (!b.commonsFile) continue
  const slug = b.key.replace(/\s+/g, '-')
  const entry = {
    key: b.key,
    name: b.title.replace(/ \((American )?boxer\)$/, ''),
    wikidata: b.qid,
    avatarImg: null, img: null,
    imageAuthor: unknown(b.artist) ? null : b.artist,
    imageLicense: b.license,
    imageLicenseUrl: b.licenseUrl || null,
    imageSourceUrl: b.page,
    ...(SKIP[b.key] ? { skip: SKIP[b.key] } : {}),
    ...(REVIEW[b.key] ? { review: REVIEW[b.key] } : {}),
  }
  for (const [kind, width] of [['avatar', AVATAR_W], ['img', IMG_W]]) {
    const url = await thumbs(b.commonsFile, width)
    const ext = path.extname(new URL(url).pathname).toLowerCase().replace('.jpeg', '.jpg') || '.jpg'
    const rel = `${kind}/${slug}${ext}`
    const dest = path.join(OUT_IMG, rel)
    if (!fs.existsSync(dest)) { fs.writeFileSync(dest, await get(url, true)); await sleep(1500) }
    entry[kind === 'avatar' ? 'avatarImg' : 'img'] = `/images/commons/${rel}`
  }
  if (plain(entry.name) !== entry.name) entry.nameAscii = plain(entry.name)
  manifest.push(entry)
  console.log('ok', b.key)
}
fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n')
console.log('done', manifest.length)
