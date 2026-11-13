// Builds an image-rights registry for D:\Projects\HoF\back\public\images
// Usage: node audit.mjs <imagesDir> <outDir>
import fs from 'fs'
import path from 'path'

const [imagesDir, outDir] = process.argv.slice(2)
const UA = 'HoF-image-audit/1.0 (local script)'

// file key -> [enwiki title, note]
const MAP = {
  'ali': ['Muhammad Ali'], 'angott': ['Sammy Angott'], 'apostoli': ['Fred Apostoli'],
  'arguello': ['Alexis Argüello'], 'armstrong': ['Henry Armstrong'], 'barrera': ['Marco Antonio Barrera'],
  'basilio': ['Carmen Basilio'], 'beau jack': ['Beau Jack'], 'benitez': ['Wilfred Benítez'],
  'benvenuti': ['Nino Benvenuti'], 'berg': ['Jack Kid Berg'], 'bivins': ['Jimmy Bivins'],
  'bowe': ['Riddick Bowe'], 'bradley': ['Timothy Bradley'],
  'brown': ['Joe Brown (boxer)', 'Неоднозначно: Joe Brown или Panama Al Brown — уточнить по БД'],
  'buchanan': ['Ken Buchanan'], 'burley': ['Charley Burley'], 'calderon': ['Iván Calderón (boxer)'],
  'calzaghe': ['Joe Calzaghe'], 'camacho': ['Héctor Camacho'], 'canizales': ['Orlando Canizales'],
  'canto': ['Miguel Canto'], 'carbajal': ['Michael Carbajal'],
  'carter': ['Jimmy Carter (boxer)', 'Предположительно Jimmy Carter (лёгкий вес) — уточнить по БД'],
  'cerdan': ['Marcel Cerdan'], 'cervantes': ['Antonio Cervantes'], 'chacon': ['Bobby Chacon'],
  'chandler': ['Jeff Chandler (boxer)'], 'chang': ['Chang Jung-koo'], 'charles': ['Ezzard Charles'],
  'chavez': ['Julio César Chávez'], 'cokes': ['Curtis Cokes'], 'conn': ['Billy Conn'],
  'corrales': ['Diego Corrales'], 'cotto': ['Miguel Cotto'], 'cuevas': ['Pipino Cuevas'],
  'curry': ['Donald Curry'], 'duran': ['Roberto Durán'], 'elorde': ['Flash Elorde'],
  'fenech': ['Jeff Fenech'], 'foreman': ['George Foreman'], 'foster': ['Bob Foster (boxer)'],
  'froch': ['Carl Froch'], 'fullmer': ['Gene Fullmer'], 'galaxy': ['Khaosai Galaxy'],
  'galindez': ['Víctor Galíndez'], 'gatti': ['Arturo Gatti'], 'gavilan': ['Kid Gavilán'],
  'giardello': ['Joey Giardello'], 'gomez': ['Wilfredo Gómez'],
  'gonzalez': ['Humberto González', 'Предположительно Humberto González — уточнить по БД'],
  'graham': ['Billy Graham (American boxer)'], 'graziano': ['Rocky Graziano'], 'griffith': ['Emile Griffith'],
  'hagler': ['Marvin Hagler'], 'hamed': ['Naseem Hamed'], 'harada': ['Fighting Harada'],
  'hatton': ['Ricky Hatton'], 'hearns': ['Thomas Hearns'], 'hill': ['Virgil Hill'],
  'holmes': ['Larry Holmes'], 'holyfield': ['Evander Holyfield'], 'hopkins': ['Bernard Hopkins'],
  'hoya': ['Oscar De La Hoya'], 'jackson': ['Julian Jackson (boxer)'], 'jenkins': ['Lew Jenkins'],
  'jofre': ['Éder Jofre'], 'johansson': ['Ingemar Johansson'],
  'johnson': ['Harold Johnson (boxer)', 'Неоднозначно: Harold Johnson или Jack Johnson — уточнить по БД'],
  'kid': ['Kid Chocolate', 'Неоднозначно: «kid» — уточнить по БД'],
  'klitschko': ['Vitali Klitschko'], 'laguna': ['Ismael Laguna'], 'lamotta': ['Jake LaMotta'],
  'mark johnson': ['Mark Johnson (boxer)'], 'roy jones': ['Roy Jones Jr.'],
  'wladimir klitschko': ['Wladimir Klitschko'],
}

const getJSON = async (url) => {
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA } })
      if (r.ok) return r.json()
    } catch (e) { if (i === 3) throw e }
    await new Promise((res) => setTimeout(res, 1500 * (i + 1)))
  }
  throw new Error('fetch failed ' + url)
}
const chunks = (a, n) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n))
const strip = (s) => (s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()

// 1. files
const files = []
for (const dir of ['avatarImg', 'img']) {
  for (const f of fs.readdirSync(path.join(imagesDir, dir))) {
    const base = f.replace(/\.[^.]+$/, '')
    const hasCyr = /[а-яё]/i.test(base)
    const key = base.replace(/с/g, 'c').replace(/С/g, 'C').toLowerCase()
    const st = fs.statSync(path.join(imagesDir, dir, f))
    files.push({ dir, file: f, key, hasCyr, kb: Math.round(st.size / 1024) })
  }
}

// 2. wikidata by enwiki title
const titles = [...new Set(Object.values(MAP).map((v) => v[0]))]
// requested title -> final enwiki title -> QID
const norm = {}, qidByTitle = {}
for (const c of chunks(titles, 50)) {
  const j = await getJSON('https://en.wikipedia.org/w/api.php?action=query&redirects=1&prop=pageprops&ppprop=wikibase_item&format=json&titles=' + encodeURIComponent(c.join('|')))
  for (const n of j.query?.normalized || []) norm[n.from] = n.to
  for (const r of j.query?.redirects || []) norm[r.from] = r.to
  for (const p of Object.values(j.query?.pages || {})) if (p.pageprops?.wikibase_item) qidByTitle[p.title] = p.pageprops.wikibase_item
}
const finalTitle = (t) => { let x = t; for (let i = 0; i < 3 && norm[x]; i++) x = norm[x]; return x }
const wdByQid = {}
for (const c of chunks([...new Set(Object.values(qidByTitle))], 50)) {
  const j = await getJSON('https://www.wikidata.org/w/api.php?action=wbgetentities&props=claims|labels|sitelinks&languages=ru|en&sitefilter=ruwiki&format=json&ids=' + c.join('|'))
  for (const [qid, e] of Object.entries(j.entities || {})) {
    const p18 = e.claims?.P18?.map((x) => x.mainsnak?.datavalue?.value).filter(Boolean) || []
    const p373 = e.claims?.P373?.[0]?.mainsnak?.datavalue?.value
    wdByQid[qid] = { qid, p18, p373, ru: e.sitelinks?.ruwiki?.title || e.labels?.ru?.value || '' }
  }
}
const wd = wdByQid
const resolve = (t) => wdByQid[qidByTitle[finalTitle(t)]] || null

// 3. commons file metadata
const commonsFiles = [...new Set(Object.values(wd).flatMap((w) => w.p18))]
const meta = {}
for (const c of chunks(commonsFiles, 40)) {
  const u = 'https://commons.wikimedia.org/w/api.php?action=query&prop=imageinfo&iiprop=extmetadata|url|size&iiurlwidth=600&format=json&titles=' + encodeURIComponent(c.map((f) => 'File:' + f).join('|'))
  const j = await getJSON(u)
  for (const p of Object.values(j.query?.pages || {})) {
    const ii = p.imageinfo?.[0]; if (!ii) continue
    const m = ii.extmetadata || {}
    meta[p.title.replace(/^File:/, '').replace(/_/g, ' ')] = {
      license: strip(m.LicenseShortName?.value), licenseUrl: m.LicenseUrl?.value || '',
      artist: strip(m.Artist?.value), credit: strip(m.Credit?.value), date: strip(m.DateTimeOriginal?.value),
      attrReq: m.AttributionRequired?.value || '', page: ii.descriptionurl, thumb: ii.thumburl || ii.url,
      w: ii.width, h: ii.height,
    }
  }
}
// 4. category sizes
const cats = [...new Set(Object.values(wd).map((w) => w.p373).filter(Boolean))]
const catSize = {}
for (const c of chunks(cats, 40)) {
  const j = await getJSON('https://commons.wikimedia.org/w/api.php?action=query&prop=categoryinfo&format=json&titles=' + encodeURIComponent(c.map((x) => 'Category:' + x).join('|')))
  for (const p of Object.values(j.query?.pages || {})) catSize[p.title.replace(/^Category:/, '')] = p.categoryinfo?.files ?? 0
}

// 5. assemble
const boxers = {}
for (const [key, [title, note]] of Object.entries(MAP)) {
  const w = resolve(title)
  const file = w?.p18?.[0]
  const m = file ? meta[file.replace(/_/g, ' ')] : null
  boxers[key] = {
    key, title, note: note || '', qid: w?.qid || '', ru: w?.ru || '',
    commonsFile: file || '', ...(m || {}),
    category: w?.p373 || '', catFiles: w?.p373 ? catSize[w.p373] ?? '' : '',
  }
}
const unknownKeys = [...new Set(files.map((f) => f.key))].filter((k) => !MAP[k])

fs.mkdirSync(outDir, { recursive: true })
fs.writeFileSync(path.join(outDir, 'audit.json'), JSON.stringify({ files, boxers, unknownKeys }, null, 2))
console.log('files', files.length, 'boxers', Object.keys(boxers).length, 'withP18', Object.values(boxers).filter((b) => b.commonsFile).length, 'unknown', unknownKeys)
for (const b of Object.values(boxers)) console.log([b.key, b.qid, b.commonsFile, b.license, b.artist?.slice(0, 40), b.catFiles].join(' | '))
