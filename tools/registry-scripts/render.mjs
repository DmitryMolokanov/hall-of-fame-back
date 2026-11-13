// Renders registry CSV + HTML from out/audit.json
// Usage: node render.mjs <audit.json> <outDir>
import fs from 'fs'
import path from 'path'

const [src, outDir] = process.argv.slice(2)
const { files, boxers } = JSON.parse(fs.readFileSync(src, 'utf8'))

// Author names were cleaned up by hand in the credits manifest: prefer them over raw Commons metadata
const manifestPath = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '../../src/data/imageCredits.json')
for (const c of JSON.parse(fs.readFileSync(manifestPath, 'utf8'))) {
  if (boxers[c.key]) boxers[c.key].artistClean = c.imageAuthor ?? 'автор неизвестен'
}

const CAVEAT = {
  buchanan: 'Фото статуи, не портрет: как аватар не подходит',
  curry: 'Обложка журнала KO: лучше поискать другое фото',
  gonzalez: 'Совместное фото: нужна обрезка',
  graham: 'Кадр боя с Basilio (открытка): нужна обрезка',
  chacon: 'Кадр боя, формат TIFF: обрезать и конвертировать в WebP/JPG',
  jofre: 'Формат TIFF: конвертировать в WebP/JPG',
  hamed: 'Снимок с шоу WWE (1999): проверить, подходит ли',
  elorde: 'Кадр боя: нужна обрезка',
}

const cleanArtist = (a) => {
  if (!a || /unknown|see below|none indicated|public domain in/i.test(a)) return 'автор неизвестен'
  return a.length > 90 ? a.slice(0, 87) + '…' : a
}
const isPD = (l) => /public domain|^pd|cc0/i.test(l || '')
const attribution = (b) => {
  if (!b.commonsFile) return ''
  const who = (b.artistClean ?? cleanArtist(b.artist))
  return isPD(b.license)
    ? `Фото: ${who} / ${b.license === 'CC0' ? 'CC0' : 'общественное достояние'} / Wikimedia Commons`
    : `Фото: ${who} / ${b.license} / Wikimedia Commons`
}
const statusOf = (b) => {
  if (!b.commonsFile) return 'Свободной замены в Wikidata нет'
  if (CAVEAT[b.key]) return 'Есть замена, нужна доработка'
  return isPD(b.license) ? 'Есть замена (общественное достояние)' : 'Есть замена (CC, нужна атрибуция)'
}
const actionOf = (b) => {
  if (!b.commonsFile) {
    const cat = b.catFiles ? `Проверить категорию Commons «${b.category}» (${b.catFiles} файлов), ` : 'Проверить '
    return cat + 'Library of Congress, Openverse; иначе редакционная лицензия (Getty/AP/Alamy) или плейсхолдер'
  }
  return CAVEAT[b.key] ? CAVEAT[b.key] : 'Заменить файл и добавить подпись'
}

const fileNotes = (f) => {
  const n = []
  if (f.hasCyr) n.push('В имени файла кириллическая «с» вместо латинской c: iLike-поиск по имени не находит боксёра')
  if (f.key === 'cerdan' && f.dir === 'avatarImg') n.push('Дубликат: два аватара Cerdan (.jpg и .webp)')
  if (['johnson', 'klitschko', 'kid'].includes(f.key)) n.push('Поиск iLike %' + f.key + '% совпадает с несколькими боксёрами: возможна неверная привязка')
  return n
}

// ---- CSV (one row per file) ----
const cols = ['Папка', 'Файл', 'Размер, КБ', 'Боксёр', 'Боксёр (рус.)', 'Wikidata', 'Текущий источник', 'Статус прав',
  'Статус замены', 'Действие', 'Файл-замена (Commons)', 'Страница файла', 'Лицензия', 'URL лицензии', 'Автор',
  'Текст подписи', 'Категория Commons', 'Файлов в категории', 'Замечания']
const esc = (v) => { const s = String(v ?? ''); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s }
const rows = files
  .sort((a, b) => a.key.localeCompare(b.key) || a.dir.localeCompare(b.dir))
  .map((f) => {
    const b = boxers[f.key]
    return [f.dir, f.file, f.kb, b.title.replace(/ \((American )?boxer\)$/, ''), b.ru, b.qid ? 'https://www.wikidata.org/wiki/' + b.qid : '',
      'Не установлен (взято из интернета)', 'Права не подтверждены', statusOf(b), actionOf(b), b.commonsFile || '', b.page || '',
      b.license || '', b.licenseUrl || '', b.commonsFile ? (b.artistClean ?? cleanArtist(b.artist)) : '', attribution(b),
      b.category ? 'https://commons.wikimedia.org/wiki/Category:' + encodeURIComponent(b.category.replace(/ /g, '_')) : '',
      b.catFiles ?? '', [b.note, ...fileNotes(f)].filter(Boolean).join('; ')]
  })
fs.mkdirSync(outDir, { recursive: true })
fs.writeFileSync(path.join(outDir, 'image-registry.csv'), '﻿' + [cols, ...rows].map((r) => r.map(esc).join(';')).join('\r\n'))

// ---- HTML (one row per boxer) ----
const h = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const byKey = {}
for (const f of files) (byKey[f.key] ??= []).push(f)
const list = Object.values(boxers).sort((a, b) => a.title.localeCompare(b.title))
const counts = {}
for (const b of list) counts[statusOf(b)] = (counts[statusOf(b)] || 0) + 1
const badge = (s) => s.startsWith('Свободной') ? 'bad' : s.includes('доработка') ? 'warn' : 'ok'
const cyrCount = files.filter((f) => f.hasCyr).length

const trs = list.map((b) => {
  const fs_ = byKey[b.key] || []
  const cur = fs_.map((f) => `<figure><img loading="lazy" src="../public/images/${f.dir}/${encodeURIComponent(f.file)}" alt=""><figcaption>${h(f.dir)}/${h(f.file)}${f.hasCyr ? ' <span class="tag">кириллица</span>' : ''}</figcaption></figure>`).join('')
  const rep = b.commonsFile
    ? `<figure><a href="${h(b.page)}" target="_blank" rel="noopener"><img loading="lazy" src="${h(b.thumb)}" alt=""></a><figcaption><a href="${h(b.page)}" target="_blank" rel="noopener">${h(b.commonsFile)}</a></figcaption></figure>`
    : '<span class="muted">не найдено</span>'
  const st = statusOf(b)
  const notes = [b.note, ...new Set(fs_.flatMap(fileNotes))].filter(Boolean)
  return `<tr data-s="${badge(st)}">
<td><strong>${h(b.title.replace(/ \((American )?boxer\)$/, ''))}</strong><br><span class="muted">${h(b.ru)}</span>${b.qid ? `<br><a href="https://www.wikidata.org/wiki/${b.qid}" target="_blank" rel="noopener">${b.qid}</a>` : ''}</td>
<td><div class="imgs">${cur}</div></td><td><div class="imgs">${rep}</div></td>
<td><span class="badge ${badge(st)}">${h(st)}</span><br>${h(b.license || '')}${b.licenseUrl ? ` · <a href="${h(b.licenseUrl)}" target="_blank" rel="noopener">текст</a>` : ''}
${b.commonsFile ? `<div class="attr">${h(attribution(b))}</div>` : ''}</td>
<td>${h(actionOf(b))}${notes.length ? '<ul>' + notes.map((n) => `<li>${h(n)}</li>`).join('') + '</ul>' : ''}${b.category ? `<div class="muted">Категория: <a href="https://commons.wikimedia.org/wiki/Category:${encodeURIComponent(b.category.replace(/ /g, '_'))}" target="_blank" rel="noopener">${h(b.category)}</a> (${h(b.catFiles)})</div>` : ''}</td></tr>`
}).join('\n')

const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Реестр изображений HoF</title><style>
:root{--bg:#fafaf9;--fg:#1c1917;--muted:#78716c;--line:#e7e5e4;--card:#fff;--ok:#15803d;--okbg:#dcfce7;--warn:#a16207;--warnbg:#fef9c3;--bad:#b91c1c;--badbg:#fee2e2;--link:#1d4ed8}
@media (prefers-color-scheme:dark){:root{--bg:#161412;--fg:#e7e5e4;--muted:#a8a29e;--line:#2e2a27;--card:#1f1c1a;--ok:#86efac;--okbg:#14532d;--warn:#fde68a;--warnbg:#713f12;--bad:#fca5a5;--badbg:#7f1d1d;--link:#93c5fd}}
*{box-sizing:border-box}body{margin:0;padding:24px 16px;background:var(--bg);color:var(--fg);font:14px/1.45 system-ui,Segoe UI,sans-serif}
main{max-width:1280px;margin:auto}h1{font-size:22px;margin:0 0 4px}a{color:var(--link)}.muted{color:var(--muted)}
.summary{display:flex;flex-wrap:wrap;gap:12px;margin:16px 0}.card{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:10px 14px}
.card b{font-size:20px;display:block}button{font:inherit;padding:4px 10px;border:1px solid var(--line);background:var(--card);color:var(--fg);border-radius:6px;cursor:pointer}button.on{outline:2px solid var(--link)}
.wrap{overflow-x:auto}table{border-collapse:collapse;width:100%;background:var(--card);min-width:900px}th,td{border-bottom:1px solid var(--line);padding:8px;vertical-align:top;text-align:left}
th{position:sticky;top:0;background:var(--card);font-size:12px;text-transform:uppercase;color:var(--muted)}
.imgs{display:flex;gap:8px;flex-wrap:wrap}figure{margin:0;width:110px}figure img{width:110px;height:110px;object-fit:cover;border-radius:6px;background:var(--line);display:block}
figcaption{font-size:11px;color:var(--muted);word-break:break-all}.badge{display:inline-block;padding:1px 8px;border-radius:99px;font-size:12px;margin-bottom:4px}
.ok{color:var(--ok);background:var(--okbg)}.warn{color:var(--warn);background:var(--warnbg)}.bad{color:var(--bad);background:var(--badbg)}
.attr{margin-top:6px;font-size:12px;padding:4px 6px;border-left:3px solid var(--line)}.tag{color:var(--bad)}ul{margin:6px 0 0;padding-left:18px}
.notes{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:12px 16px;margin-bottom:16px}
</style></head><body><main>
<h1>Реестр изображений: Зал славы бокса</h1>
<div class="muted">${files.length} файлов в back/public/images, ${list.length} боксёров. Сформирован ${new Date().toISOString().slice(0, 10)} по данным Wikidata и Wikimedia Commons.</div>
<div class="summary">
<div class="card"><b>${files.length}</b>файлов без подтверждённых прав</div>
${Object.entries(counts).map(([k, v]) => `<div class="card"><b>${v}</b>${h(k)}</div>`).join('')}
<div class="card"><b>${cyrCount}</b>файлов с кириллицей в имени</div></div>
<div class="notes"><strong>Как читать.</strong> «Замена» — фото из свойства P18 записи Wikidata, оно всегда лежит на Wikimedia Commons под свободной лицензией или в общественном достоянии.
Для CC BY / CC BY-SA обязательна подпись (готовый текст в колонке «Права»). Для общественного достояния подпись не обязательна, но рекомендуется.
«Общественное достояние» на Commons для американских фото 1930–60-х обычно означает «опубликовано без уведомления или права не продлены» (PD в США). Риск низкий, но в спорных случаях проверяйте страницу файла.
Сопоставление файлов с боксёрами сделано по фамилиям, без доступа к БД: строки с пометкой «уточнить» проверьте.</div>
<p><button data-f="all" class="on">Все</button> <button data-f="ok">Замена найдена</button> <button data-f="warn">Нужна доработка</button> <button data-f="bad">Нет замены</button></p>
<div class="wrap"><table><thead><tr><th>Боксёр</th><th>Текущие файлы</th><th>Свободная замена</th><th>Права</th><th>Действие / замечания</th></tr></thead><tbody>
${trs}
</tbody></table></div></main>
<script>document.querySelectorAll('button[data-f]').forEach(b=>b.onclick=()=>{document.querySelectorAll('button[data-f]').forEach(x=>x.classList.toggle('on',x===b));document.querySelectorAll('tbody tr').forEach(r=>r.hidden=b.dataset.f!=='all'&&r.dataset.s!==b.dataset.f)})</script>
</body></html>`
fs.writeFileSync(path.join(outDir, 'image-registry.html'), html)
console.log(counts, 'cyr', cyrCount, 'rows', rows.length)
