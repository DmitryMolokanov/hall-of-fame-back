// Replaces chosen boxers' photos with other Commons files and updates credits + seed.
// Usage (from repo root): node back/tools/registry-scripts/replace-photos.mjs
import fs from 'fs'
import path from 'path'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '../../..')
const H = { headers: { 'User-Agent': 'HoF-image-audit/1.0 (local script)' } }
const STD_W = [120, 250, 330, 500, 960, 1280]
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// key -> [Commons file, cleaned author]
const PICK = {
  camacho: ['Héctor Camacho on the cover of International Boxing August 1983.jpg', 'Bill Apter'],
  conn: ['Billy Conn 1945.jpg', null],
  froch: ['Carl Froch (GBR) 2010.jpg', 'Pasi'],
  gomez: ['Wilfredo Gómez in KO Magazine April 1983 issue.jpg', 'Bill Apter'],
  graziano: ['Rocky Graziano 1946.jpg', null],
  hagler: ['Marvelous Marvin Hagler c1981.jpg', 'Killer Kowalski (KO Magazine)'],
  hearns: ['Thomas Hearns by Bill Apter 1981.jpg', 'Bill Apter'],
  johansson: ['IngemarJohansson 2.jpg', 'Jowil'],
  johnson: ['Harold Johnson by Stanley Weston.png', 'Stanley Weston'],
}

const get = async (url, asBuffer) => {
  for (let i = 0; i < 8; i++) {
    const r = await fetch(url, H)
    if (r.ok) return asBuffer ? Buffer.from(await r.arrayBuffer()) : r.json()
    await sleep(r.status === 429 ? 20000 * (i + 1) : 3000 * (i + 1))
  }
  throw new Error('Failed: ' + url)
}
const imageinfo = async (file, width) => {
  const q = `https://commons.wikimedia.org/w/api.php?action=query&prop=imageinfo&iiprop=url|size|extmetadata&format=json${width ? '&iiurlwidth=' + width : ''}&titles=${encodeURIComponent('File:' + file)}`
  return Object.values((await get(q)).query.pages)[0].imageinfo[0]
}

const credPath = path.join(ROOT, 'back/src/data/imageCredits.json')
const seedPath = path.join(ROOT, 'back/src/data/boxersSeed.json')
const credits = JSON.parse(fs.readFileSync(credPath, 'utf8'))
const seed = JSON.parse(fs.readFileSync(seedPath, 'utf8'))
const pub = path.join(ROOT, 'back/public')

for (const [key, [file, author]] of Object.entries(PICK)) {
  const c = credits.find((x) => x.key === key)
  const base = await imageinfo(file)
  const m = base.extmetadata
  const slug = key.replace(/\s+/g, '-')
  const oldPaths = [c.avatarImg, c.img]
  for (const [kind, target] of [['avatar', 500], ['img', 1280]]) {
    const w = STD_W.filter((s) => s <= target && s < base.width).pop() || STD_W[0]
    const url = (await imageinfo(file, w)).thumburl
    const ext = path.extname(new URL(url).pathname).toLowerCase().replace('.jpeg', '.jpg')
    const rel = `/images/commons/${kind}/${slug}${ext}`
    fs.writeFileSync(path.join(pub, rel), await get(url, true))
    c[kind === 'avatar' ? 'avatarImg' : 'img'] = rel
    await sleep(1500)
  }
  for (const p of oldPaths) if (p && ![c.avatarImg, c.img].includes(p)) fs.rmSync(path.join(pub, p), { force: true })

  const oldSource = c.imageSourceUrl
  Object.assign(c, {
    imageAuthor: author,
    imageLicense: (m.LicenseShortName?.value || '').replace(/<[^>]+>/g, '').trim(),
    imageLicenseUrl: m.LicenseUrl?.value || null,
    imageSourceUrl: base.descriptionurl,
  })
  delete c.review
  delete c.skip
  for (const b of seed) {
    if (b.imageSourceUrl === oldSource) {
      Object.assign(b, { avatarImg: c.avatarImg, img: c.img, imageAuthor: c.imageAuthor, imageLicense: c.imageLicense, imageLicenseUrl: c.imageLicenseUrl, imageSourceUrl: c.imageSourceUrl })
    }
  }
  console.log('ok', key, base.width + 'x' + base.height, c.imageLicense, c.img)
}
fs.writeFileSync(credPath, JSON.stringify(credits, null, 2) + '\n')
fs.writeFileSync(seedPath, JSON.stringify(seed, null, 2) + '\n')
