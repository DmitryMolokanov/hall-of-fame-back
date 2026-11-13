// Imports photos found by hand (back/tools/manual-photo-search.html) into the site data.
//   back/tools/manual-photos/<slug>.jpg|jpeg|png|webp   the image
//   back/tools/manual-photos/credits.csv                slug;source_url;author;license
// For each row: checks the license, makes a 500px avatar and a 1280px image (Windows: System.Drawing,
// elsewhere the original is copied), and writes photo + credit into boxersSeed.json or peopleSeed.json.
// Then reload the local DB: cd back && npx ts-node src/scripts/seedLocalDb.ts --reset
// Usage (from repo root): node back/tools/registry-scripts/import-manual-photos.mjs
import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '../../..')
const P = (p) => path.join(ROOT, p)
const DIR = P('back/tools/manual-photos')

// license text -> [short name, URL]; anything else (NC, ND, all rights reserved) is rejected
const LICENSES = [
  [/^(public domain|pd|domaine public|no known restrictions)/i, 'Public domain', null],
  [/^(cc0|cc-0)/i, 'CC0', 'https://creativecommons.org/publicdomain/zero/1.0/'],
  [/public domain mark|pdm/i, 'Public domain', 'https://creativecommons.org/publicdomain/mark/1.0/'],
  [/^cc[ -]by[ -]sa[ -]?(\d\.\d)/i, (v) => `CC BY-SA ${v}`, (v) => `https://creativecommons.org/licenses/by-sa/${v}/`],
  [/^cc[ -]by[ -]?(\d\.\d)/i, (v) => `CC BY ${v}`, (v) => `https://creativecommons.org/licenses/by/${v}/`],
]
const parseLicense = (text) => {
  if (/\bnc\b|\bnd\b|non-?commercial|no ?deriv|all rights reserved/i.test(text)) return null
  for (const [re, name, url] of LICENSES) {
    const m = text.trim().match(re)
    if (m) return { name: typeof name === 'function' ? name(m[1]) : name, url: typeof url === 'function' ? url(m[1]) : url }
  }
  return null
}

const resize = (src, dest, width) => {
  if (process.platform !== 'win32') { fs.copyFileSync(src, dest); return }
  const ps = `Add-Type -AssemblyName System.Drawing
$im = [System.Drawing.Image]::FromFile('${src.replace(/'/g, "''")}')
$w = [Math]::Min(${width}, $im.Width); $h = [int]($im.Height * $w / $im.Width)
$bmp = New-Object System.Drawing.Bitmap $w, $h
$g = [System.Drawing.Graphics]::FromImage($bmp); $g.InterpolationMode = 'HighQualityBicubic'; $g.DrawImage($im, 0, 0, $w, $h)
$codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$p = New-Object System.Drawing.Imaging.EncoderParameters 1
$p.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality), 88L
$bmp.Save('${dest.replace(/'/g, "''")}', $codec, $p); $g.Dispose(); $bmp.Dispose(); $im.Dispose()`
  execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], { stdio: 'pipe' })
}

const csv = fs.readFileSync(path.join(DIR, 'credits.csv'), 'utf8').split(/\r?\n/).slice(1).filter((l) => l.trim())
const seeds = {
  boxer: { file: P('back/src/data/boxersSeed.json') },
  person: { file: P('back/src/data/peopleSeed.json') },
}
for (const s of Object.values(seeds)) s.rows = JSON.parse(fs.readFileSync(s.file, 'utf8'))
const credits = JSON.parse(fs.readFileSync(P('back/src/data/imageCredits.json'), 'utf8'))

const ok = [], skipped = []
for (const line of csv) {
  const [slug, sourceUrl, author, licenseText] = line.split(';').map((s) => (s ?? '').trim())
  const image = ['jpg', 'jpeg', 'png', 'webp'].map((e) => path.join(DIR, `${slug}.${e}`)).find((f) => fs.existsSync(f))
  const kind = seeds.boxer.rows.some((r) => r.slug === slug) ? 'boxer' : seeds.person.rows.some((r) => r.slug === slug) ? 'person' : null
  const license = parseLicense(licenseText || '')
  if (!kind) { skipped.push(`${slug}: unknown slug`); continue }
  if (!image) { skipped.push(`${slug}: no image file in back/tools/manual-photos`); continue }
  if (!license) { skipped.push(`${slug}: license "${licenseText}" is not free (need PD, CC0, CC BY or CC BY-SA)`); continue }
  if (!/^https?:\/\//.test(sourceUrl)) { skipped.push(`${slug}: source_url must be a link`); continue }

  const base = kind === 'boxer' ? '/images/manual' : '/images/manual/people'
  const urls = {}
  for (const [k, width] of [['avatar', 500], ['img', 1280]]) {
    const rel = `${base}/${k}/${slug}.jpg`
    fs.mkdirSync(P('back/public' + path.dirname(rel)), { recursive: true })
    resize(image, P('back/public' + rel), width)
    urls[k] = rel
  }
  const row = seeds[kind].rows.find((r) => r.slug === slug)
  Object.assign(row, {
    avatarImg: urls.avatar, img: urls.img,
    imageAuthor: author || null, imageLicense: license.name, imageLicenseUrl: license.url, imageSourceUrl: sourceUrl,
    _photoSource: 'manual',
  })
  if (kind === 'boxer') {
    const c = credits.find((x) => x.key === slug || x.name === row.name)
    const entry = { key: slug, name: row.name, avatarImg: row.avatarImg, img: row.img, imageAuthor: row.imageAuthor, imageLicense: row.imageLicense, imageLicenseUrl: row.imageLicenseUrl, imageSourceUrl: row.imageSourceUrl }
    if (c) Object.assign(c, entry); else credits.push(entry)
  }
  ok.push(`${kind} ${row.name} (${license.name})`)
}
for (const s of Object.values(seeds)) fs.writeFileSync(s.file, JSON.stringify(s.rows, null, 2) + '\n')
fs.writeFileSync(P('back/src/data/imageCredits.json'), JSON.stringify(credits, null, 2) + '\n')
console.log('imported:', ok.length ? '\n  ' + ok.join('\n  ') : 0)
if (skipped.length) console.log('skipped:\n  ' + skipped.join('\n  '))
if (ok.length) console.log('\nNow reload the local DB: cd back && npx ts-node src/scripts/seedLocalDb.ts --reset')
