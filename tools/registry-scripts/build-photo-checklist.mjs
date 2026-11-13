// Generates back/tools/manual-photo-search.html: everyone without a photo, with ready search links
// for sources that block scripts (Gallica, Library of Congress) or need a manual look.
// Usage (from repo root): node back/tools/registry-scripts/build-photo-checklist.mjs
import fs from 'fs'
import path from 'path'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '../../..')
const P = (p) => path.join(ROOT, p)
const h = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const enc = encodeURIComponent

const CATEGORY = {
  modern: 'Modern', 'late-era': 'Late Era', 'early-era': 'Early Era', pioneer: 'Pioneer',
  'women-modern': "Women's Modern", 'women-trailblazer': "Women's Trailblazer",
  trainer: 'Trainer', promoter: 'Promoter / Manager', referee: 'Referee / Judge',
}
const boxers = JSON.parse(fs.readFileSync(P('back/src/data/boxersSeed.json'), 'utf8')).filter((r) => !r.img)
  .map((r) => ({ type: 'boxer', slug: r.slug, name: r.name, group: CATEGORY[r.category], born: r.born, died: r.died }))
const people = JSON.parse(fs.readFileSync(P('back/src/data/peopleSeed.json'), 'utf8')).filter((r) => !r.img)
  .map((r) => ({ type: 'person', slug: r.slug, name: r.name, group: CATEGORY[r.role], born: r.born, died: r.died }))
const rows = [...boxers, ...people].sort((a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name))

const links = (r) => {
  const n = r.name.replace(/"/g, '')
  const extra = r.type === 'boxer' ? 'boxer' : 'boxing'
  return [
    ['Gallica', `https://gallica.bnf.fr/services/engine/search/sru?operation=searchRetrieve&version=1.2&query=${enc(`(gallica all "${n}") and dc.type all "image"`)}`],
    ['Library of Congress', `https://www.loc.gov/photos/?q=${enc(n)}&fa=online-format:image`],
    ['Flickr (free licenses)', `https://www.flickr.com/search/?text=${enc(`${n} ${extra}`)}&license=4%2C5%2C9%2C10`],
    ['Commons', `https://commons.wikimedia.org/w/index.php?title=Special:MediaSearch&type=image&search=${enc(n)}`],
    ['Openverse', `https://openverse.org/search/image?q=${enc(`${n} ${extra}`)}&license_type=commercial`],
    ['Internet Archive', `https://archive.org/search?query=${enc(`"${n}"`)}&and%5B%5D=mediatype%3A%22image%22`],
  ]
}
const years = (r) => [r.born?.slice(0, 4), r.died?.slice(0, 4)].filter(Boolean).join('–')

const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ручной поиск фото</title><style>
:root{--bg:#fafaf9;--fg:#1c1917;--muted:#78716c;--line:#e7e5e4;--card:#fff;--acc:#dc2626;--ok:#15803d;--okbg:#dcfce7}
@media (prefers-color-scheme:dark){:root{--bg:#161412;--fg:#e7e5e4;--muted:#a8a29e;--line:#2e2a27;--card:#1f1c1a;--acc:#f87171;--ok:#86efac;--okbg:#14532d}}
*{box-sizing:border-box}body{margin:0;padding:24px 16px;background:var(--bg);color:var(--fg);font:14px/1.5 system-ui,Segoe UI,sans-serif}
main{max-width:1200px;margin:auto}h1{font-size:22px;margin:0 0 6px}.muted{color:var(--muted)}a{color:var(--acc)}
.box{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px 16px;margin:14px 0}
.box h2{font-size:15px;margin:0 0 6px}.box ul{margin:6px 0;padding-left:20px}code{font-size:12px;background:var(--line);padding:1px 5px;border-radius:4px}
.filters{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}input[type=search]{flex:1;min-width:200px;padding:7px 12px;border:1px solid var(--line);border-radius:99px;background:var(--card);color:var(--fg)}
select{padding:6px 10px;border-radius:99px;border:1px solid var(--line);background:var(--card);color:var(--fg)}
.wrap{overflow-x:auto}table{width:100%;border-collapse:collapse;background:var(--card);min-width:760px}
th,td{padding:8px 10px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}th{font-size:12px;color:var(--muted);text-transform:uppercase}
td.links a{display:inline-block;margin:0 10px 4px 0;white-space:nowrap}tr.done{opacity:.45}tr.done td:first-child{text-decoration:line-through}
.slug{font-family:ui-monospace,monospace;font-size:12px;color:var(--muted)}
</style></head><body><main>
<h1>Ручной поиск фото</h1>
<p class="muted">${rows.length} человек без фото: ${boxers.length} боксёров и ${people.length} из Beyond the Ring. Список сформирован ${new Date().toISOString().slice(0, 10)}.</p>

<div class="box"><h2>Какие фото подходят</h2><ul>
<li><b>Gallica, Library of Congress, Internet Archive:</b> снимки с пометкой «domaine public», «Public domain» или «No known restrictions on publication». Обычно это фото до 1930-х и газетные архивы (Agence Rol, Meurisse, Bain, Harris &amp; Ewing, New York World-Telegram &amp; Sun).</li>
<li><b>Flickr, Openverse, Commons:</b> только CC BY, CC BY-SA, CC0 или Public Domain Mark. <b>Не подходят</b> CC BY-NC и «All rights reserved».</li>
<li>Снимок должен изображать именно этого человека: проверяйте подпись и годы, однофамильцев много.</li>
</ul></div>

<div class="box"><h2>Куда класть найденное</h2><ul>
<li>Файл: <code>back/tools/manual-photos/&lt;slug&gt;.jpg</code> (slug указан в таблице под именем), например <code>back/tools/manual-photos/eddie-futch.jpg</code>.</li>
<li>Строка в <code>back/tools/manual-photos/credits.csv</code>: <code>slug;source_url;author;license</code>, например<br>
<code>eddie-futch;https://www.loc.gov/item/...;New York World-Telegram &amp; Sun;Public domain</code></li>
<li>Затем: <code>node back/tools/registry-scripts/import-manual-photos.mjs</code>. Скрипт подключит фото к карточкам и пропишет подписи.</li>
</ul></div>

<div class="filters"><input type="search" id="q" placeholder="Фильтр по имени">
<select id="g"><option value="">Все группы</option>${[...new Set(rows.map((r) => r.group))].map((g) => `<option>${h(g)}</option>`).join('')}</select>
<label class="muted"><input type="checkbox" id="hideDone"> скрыть отмеченные</label></div>

<div class="wrap"><table><thead><tr><th>Имя</th><th>Группа</th><th>Годы</th><th>Где искать</th><th>Готово</th></tr></thead><tbody>
${rows.map((r) => `<tr data-name="${h(r.name.toLowerCase())}" data-group="${h(r.group)}" data-slug="${h(r.slug)}">
<td><b>${h(r.name)}</b><br><span class="slug">${h(r.slug)}</span></td><td>${h(r.group)}</td><td>${h(years(r))}</td>
<td class="links">${links(r).map(([t, u]) => `<a href="${h(u)}" target="_blank" rel="noopener">${t}</a>`).join('')}</td>
<td><input type="checkbox" aria-label="Готово: ${h(r.name)}"></td></tr>`).join('\n')}
</tbody></table></div></main>
<script>
const KEY='hof-manual-photos-done';let done={};try{done=JSON.parse(localStorage.getItem(KEY)||'{}')}catch(e){}
const rows=[...document.querySelectorAll('tbody tr')];
function apply(){const q=document.getElementById('q').value.toLowerCase(),g=document.getElementById('g').value,hd=document.getElementById('hideDone').checked;
rows.forEach(r=>{const d=!!done[r.dataset.slug];r.classList.toggle('done',d);r.hidden=(q&&!r.dataset.name.includes(q))||(g&&r.dataset.group!==g)||(hd&&d)})}
rows.forEach(r=>{const cb=r.querySelector('input');cb.checked=!!done[r.dataset.slug];cb.onchange=()=>{done[r.dataset.slug]=cb.checked;try{localStorage.setItem(KEY,JSON.stringify(done))}catch(e){};apply()}});
['q','g','hideDone'].forEach(id=>document.getElementById(id).addEventListener('input',apply));apply();
</script></body></html>`
fs.writeFileSync(P('back/tools/manual-photo-search.html'), html)
console.log('rows', rows.length)
