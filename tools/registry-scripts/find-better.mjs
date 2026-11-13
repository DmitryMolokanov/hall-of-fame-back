// Finds higher-resolution, freely licensed Commons photos for boxers whose current photo is small.
// Usage (from repo root): node back/tools/registry-scripts/find-better.mjs [minWidth] [minHeight]
// Writes back/tools/registry-scripts/better-candidates.json and back/tools/photo-candidates.html
import fs from 'fs'
import path from 'path'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '../../..')
const MIN_W = +(process.argv[2] ?? 500), MIN_H = +(process.argv[3] ?? 600)
const H = { headers: { 'User-Agent': 'HoF-image-audit/1.0 (local script)' } }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const get = async (url) => {
  for (let i = 0; i < 8; i++) {
    const r = await fetch(url, H)
    if (r.ok) { const t = await r.text(); try { return JSON.parse(t) } catch { } }
    await sleep(r.status === 429 ? 15000 * (i + 1) : 3000 * (i + 1))
  }
  throw new Error('Failed: ' + url)
}
const API = 'https://commons.wikimedia.org/w/api.php?format=json&'
const strip = (s) => (s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
const FREE = /^(public domain|pd|cc0|cc by(-sa)? \d|cc-by(-sa)?-\d|attribution|no restrictions)/i

const credits = JSON.parse(fs.readFileSync(path.join(ROOT, 'back/src/data/imageCredits.json'), 'utf8'))
const { boxers } = JSON.parse(fs.readFileSync(path.join(ROOT, 'back/tools/registry-scripts/audit.json'), 'utf8'))

const info = async (titles) => {
  const out = {}
  for (let i = 0; i < titles.length; i += 40) {
    const j = await get(API + 'action=query&prop=imageinfo&iiprop=size|extmetadata|url|mime&iiurlwidth=330&titles=' + encodeURIComponent(titles.slice(i, i + 40).join('|')))
    for (const p of Object.values(j.query?.pages || {})) {
      const ii = p.imageinfo?.[0]; if (!ii) continue
      const m = ii.extmetadata || {}
      out[p.title] = {
        title: p.title, w: ii.width, h: ii.height, mime: ii.mime, thumb: ii.thumburl, page: ii.descriptionurl,
        license: strip(m.LicenseShortName?.value), licenseUrl: m.LicenseUrl?.value || null,
        artist: strip(m.Artist?.value), date: strip(m.DateTimeOriginal?.value).slice(0, 40),
        desc: strip(m.ImageDescription?.value).slice(0, 160),
      }
    }
    await sleep(500)
  }
  return out
}

const current = await info(credits.map((c) => 'File:' + decodeURIComponent(c.imageSourceUrl.split('/wiki/File:')[1]).replace(/_/g, ' ')))
const result = []
for (const c of credits) {
  const curTitle = 'File:' + decodeURIComponent(c.imageSourceUrl.split('/wiki/File:')[1]).replace(/_/g, ' ')
  const cur = current[curTitle]
  if (!cur || (cur.w >= MIN_W && cur.h >= MIN_H && !c.skip && !c.review)) continue
  const b = boxers[c.key]
  const titles = new Set()
  // 1) files in the boxer's Commons category (and one level of subcategories)
  if (b.category) {
    const j = await get(API + 'action=query&list=categorymembers&cmtype=file|subcat&cmlimit=200&cmtitle=' + encodeURIComponent('Category:' + b.category))
    const members = j.query?.categorymembers || []
    members.filter((m) => m.ns === 6).forEach((m) => titles.add(m.title))
    for (const sub of members.filter((m) => m.ns === 14).slice(0, 5)) {
      const s = await get(API + 'action=query&list=categorymembers&cmtype=file&cmlimit=100&cmtitle=' + encodeURIComponent(sub.title))
      ;(s.query?.categorymembers || []).forEach((m) => titles.add(m.title))
      await sleep(300)
    }
  }
  // 2) files tagged "depicts" (P180) = this boxer
  const d = await get(API + 'action=query&list=search&srnamespace=6&srlimit=50&srsearch=' + encodeURIComponent('haswbstatement:P180=' + b.qid))
  ;(d.query?.search || []).forEach((s) => titles.add(s.title))
  titles.delete(curTitle)

  const cand = Object.values(await info([...titles]))
    .filter((x) => /^image\/(jpeg|png|tiff|webp)/.test(x.mime) && FREE.test(x.license))
    .filter((x) => x.w * x.h > cur.w * cur.h * 1.5 && x.h >= 400)
    .sort((x, y) => y.w * y.h - x.w * x.h)
    .slice(0, 8)
  result.push({ key: c.key, name: c.name, current: cur, reason: c.skip || c.review || 'low resolution', candidates: cand })
  console.log(c.key, cur.w + 'x' + cur.h, '->', cand.length, 'candidates')
  await sleep(500)
}
fs.writeFileSync(path.join(ROOT, 'back/tools/registry-scripts/better-candidates.json'), JSON.stringify(result, null, 2))

const h = (s) => String(s ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]))
const card = (x, tag) => `<figure class="${tag}"><a href="${h(x.page)}" target="_blank" rel="noopener"><img src="${h(x.thumb)}" alt=""></a>
<figcaption><b>${x.w}×${x.h}</b> · ${h(x.license)}<br>${h(x.artist.slice(0, 60))}<br><span>${h(x.title.slice(5, 70))}</span></figcaption></figure>`
const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Кандидаты на замену фото</title>
<style>:root{--bg:#fafaf9;--fg:#1c1917;--muted:#78716c;--line:#e7e5e4;--card:#fff;--acc:#dc2626}@media (prefers-color-scheme:dark){:root{--bg:#161412;--fg:#e7e5e4;--muted:#a8a29e;--line:#2e2a27;--card:#1f1c1a;--acc:#f87171}}
body{margin:0;padding:24px 16px;background:var(--bg);color:var(--fg);font:14px/1.4 system-ui,sans-serif}main{max-width:1300px;margin:auto}section{border-bottom:1px solid var(--line);padding:16px 0}
.row{display:flex;gap:10px;flex-wrap:wrap}figure{margin:0;width:170px;background:var(--card);border:1px solid var(--line);border-radius:8px;overflow:hidden}figure.cur{outline:2px solid var(--acc)}
img{width:170px;height:200px;object-fit:cover;display:block;background:var(--line)}figcaption{padding:6px;font-size:11px;color:var(--muted)}figcaption b{color:var(--fg)}span{word-break:break-all}a{color:inherit}</style></head><body><main>
<h1>Кандидаты на замену фото</h1><p>Красная рамка — текущее фото. Порог: меньше ${MIN_W}×${MIN_H} px, плюс фото с пометками «доработать»/«пропущено».</p>
${result.map((r) => `<section><h2>${h(r.name)} <small>(${h(r.reason)})</small></h2><div class="row">${card(r.current, 'cur')}${r.candidates.map((x) => card(x, '')).join('') || '<p>Крупнее ничего нет.</p>'}</div></section>`).join('\n')}
</main></body></html>`
fs.writeFileSync(path.join(ROOT, 'back/tools/photo-candidates.html'), html)
console.log('done', result.length)
