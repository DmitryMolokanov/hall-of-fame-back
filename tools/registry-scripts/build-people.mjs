// Builds back/src/data/peopleSeed.json for the "Beyond the Ring" section (non-boxer inductees).
// Roles are curated by hand below (Wikidata occupations are too coarse); data come from
// Wikidata (dates, induction year, photo), English Wikipedia (lead section) and Wikimedia Commons (photos).
// Usage (from repo root): node back/tools/registry-scripts/build-people.mjs
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '../../..')
const P = (p) => path.join(ROOT, p)
const H = { headers: { 'User-Agent': 'HoF-image-audit/1.0 (local script)' } }
const IBHOF = 'Q572227'
const STD_W = [120, 250, 330, 500, 960, 1280]
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const strip = (s) => (s || '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim()
const FREE = /^(public domain|pd|cc0|cc by(-sa)? \d|cc-by(-sa)?-\d|attribution|no restrictions)/i
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

// ---------- curated roles (names as on ibhof.com) ----------
const TRAINERS = [
  "Cus D'Amato", 'Angelo Dundee', 'Lou Duva', 'Whitey Esneault', 'Eddie Futch', 'Al Gavin', 'Jimmy Glenn', 'Charley Goldman',
  'Joe Goossen', 'Bill Gore', 'Russ Anber', 'Ray Arcel', 'George Benton', 'Nacho Beristain', 'Whitey Bimstein', 'Jack Blackburn',
  'Freddie Brown', 'Amilcar Brusa', 'Gil Clancy', 'Arturo (Cuyo) Hernandez', 'Johnny Lewis', 'Jackie McCoy', 'William Muldoon',
  'Freddie Roach', 'Emanuel Steward',
]
const PROMOTERS = [
  'Lou DiBella', 'Jeff Dickson', 'Mickey Duff', 'Chris Dundee', 'Dan Duva', 'Kathy Duva', 'Aileen Eaton', 'Don Elbaum', 'Shelly Finkel',
  'Dewey Fragetta', 'Don Fraser', 'Billy Gibson', 'Bobby Goodman', 'Brad Goodman', 'Dan Goossen', 'Bob Arum', 'Jarvis Astaire',
  'A.F. Bettinson', 'William A. Brady', 'Umberto Branchini', 'Teddy Brenner', 'William D. Cayton', 'Don Chargin', 'Lorraine Chargin',
  'James W. Coffroth', 'Irving Cohen', 'Cuco Conde', 'Barry Hearn', 'Akihiko Honda', 'Sam Ichinose', 'Jimmy Jacobs', 'Mike Jacobs',
  'James J. Johnston', 'Jackie Kallen', 'Jack Kearns', 'Don King', 'Klaus-Peter Kohl', 'Tito Lectoure', 'Hugh D. McIntosh',
  'Harry Markson', 'Rafael Mendoza', 'Dan Morgan', "Tom O'Rourke", 'Mogens Palle', 'George Parnassus', 'J Russell Peltz',
  'Tex Rickard', 'Rodolfo Sabbatini', 'Lope Sarreal', 'Wilfried Sauerland', 'Sam Silverman', 'Jack Solomons', 'Herman Taylor',
  'Bruce Trampler', 'Rip Valenti', 'Lou Viscusi', 'Frank Warren', 'Al Weill',
]
const REFEREES = [
  'Arthur Donovan', 'Harry Gibbs', 'Kenny Bayless', 'Frank Cappuccino', 'Stanley Christodoulou', 'Eugene Corri', 'Joe Cortez',
  'Larry Hazzard', 'Guy Jutras', 'Mills Lane', 'Harold Lederman', 'Arthur Mercante', 'Jerry Roth', 'Steve Smoger', 'Richard Steele',
  'Ruby Goldstein',
]
// QIDs that the name search could not resolve
const QID_OVERRIDE = { 'William D. Cayton': null }

const roles = JSON.parse(fs.readFileSync(P('back/tools/registry-scripts/people-roles.json'), 'utf8'))
const qidOf = Object.fromEntries(roles.map((r) => [r.name, r.qid]))
const people = [
  ...TRAINERS.map((name) => ({ name, role: 'trainer' })),
  ...PROMOTERS.map((name) => ({ name, role: 'promoter' })),
  ...REFEREES.map((name) => ({ name, role: 'referee' })),
]
for (const p of people) p.qid = QID_OVERRIDE[p.name] ?? qidOf[p.name] ?? null

// resolve missing QIDs through English Wikipedia search
for (const p of people.filter((x) => !x.qid)) {
  const s = await get(`https://en.wikipedia.org/w/api.php?action=query&list=search&srlimit=3&format=json&srsearch=${encodeURIComponent(p.name.replace(/^William D\. /, 'Bill ') + ' boxing')}`)
  const title = s.query.search[0]?.title
  if (title) {
    const j = await get(`https://en.wikipedia.org/w/api.php?action=query&prop=pageprops&ppprop=wikibase_item&format=json&formatversion=2&titles=${encodeURIComponent(title)}`)
    p.qid = j.query.pages[0].pageprops?.wikibase_item ?? null
  }
  console.log('resolved', p.name, '->', title, p.qid)
}

// Wikidata: dates, induction, P18, enwiki title
const ent = {}
const ids = people.map((p) => p.qid).filter(Boolean)
for (let i = 0; i < ids.length; i += 50) {
  const j = await get('https://www.wikidata.org/w/api.php?action=wbgetentities&props=claims|sitelinks&sitefilter=enwiki&format=json&ids=' + ids.slice(i, i + 50).join('|'))
  Object.assign(ent, j.entities)
  await sleep(500)
}
const wdDate = (c) => {
  const t = c?.[0]?.mainsnak?.datavalue?.value?.time
  if (!t) return null
  const [y, m, d] = t.slice(1, 11).split('-')
  return m === '00' ? y : d === '00' ? `${y}-${m}` : `${y}-${m}-${d}`
}

// Wikipedia lead sections
const titles = people.map((p) => ent[p.qid]?.sitelinks?.enwiki?.title).filter(Boolean)
const extract = {}
for (let i = 0; i < titles.length; i += 20) {
  const j = await get(`https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=1&explaintext=1&exlimit=20&format=json&formatversion=2&titles=${encodeURIComponent(titles.slice(i, i + 20).join('|'))}`)
  for (const pg of j.query.pages) extract[pg.title] = pg.extract || ''
  await sleep(800)
}

const slugOf = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const cleanArtist = (a) => (!a || /unknown|see below|none indicated|public domain in/i.test(a) ? null
  : a.replace(/\.\s*Agence photographique \(commanditaire\)$/, '').replace(/^(Bain News Service|Harris & Ewing), (publisher|photographer)$/, '$1').slice(0, 120))
const out = [], report = { noWiki: [], noInduction: [], noPhoto: [], smallPhoto: [] }
const imgDir = P('back/public/images/commons/people')
fs.mkdirSync(path.join(imgDir, 'avatar'), { recursive: true })
fs.mkdirSync(path.join(imgDir, 'img'), { recursive: true })

// append mode: people already in the seed (incl. short profiles) are kept as they are
const existing = fs.existsSync(P('back/src/data/peopleSeed.json')) ? JSON.parse(fs.readFileSync(P('back/src/data/peopleSeed.json'), 'utf8')) : []
const haveQ = new Set(existing.map((r) => r._wikidata))

for (const p of people) {
  if (haveQ.has(p.qid)) continue
  const e = ent[p.qid]
  const title = e?.sitelinks?.enwiki?.title
  if (!title) { report.noWiki.push(p.name); continue }
  const hof = (e.claims?.P166 || []).filter((c) => c.mainsnak?.datavalue?.value?.id === IBHOF)
  const induction = parseInt(hof.map((h) => h.qualifiers?.P585?.[0]?.datavalue?.value?.time).find(Boolean)?.slice(1, 5), 10) || null
  if (!induction) report.noInduction.push(p.name)
  const name = title.replace(/\s*\([^)]*\)$/, '')
  const row = {
    id: crypto.randomUUID(), slug: slugOf(name), name, role: p.role,
    biography: (extract[title] || '').split(/\n+/).map((s) => s.trim()).filter(Boolean).join('<br>'),
    bioSourceUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`,
    born: wdDate(e.claims?.P569), died: wdDate(e.claims?.P570), induction,
    avatarImg: null, img: null, imageAuthor: null, imageLicense: null, imageLicenseUrl: null, imageSourceUrl: null,
    _wikidata: p.qid, _ibhofName: p.name,
  }
  const file = e.claims?.P18?.[0]?.mainsnak?.datavalue?.value
  if (file) {
    const info = Object.values((await get(`https://commons.wikimedia.org/w/api.php?action=query&prop=imageinfo&iiprop=size|extmetadata|url&format=json&titles=${encodeURIComponent('File:' + file)}`)).query.pages)[0].imageinfo?.[0]
    const m = info?.extmetadata || {}
    const license = strip(m.LicenseShortName?.value)
    if (info && FREE.test(license)) {
      for (const [kind, target] of [['avatar', 500], ['img', 1280]]) {
        const w = STD_W.filter((s) => s <= target && s < info.width).pop() || STD_W[0]
        const t = Object.values((await get(`https://commons.wikimedia.org/w/api.php?action=query&prop=imageinfo&iiprop=url&iiurlwidth=${w}&format=json&titles=${encodeURIComponent('File:' + file)}`)).query.pages)[0].imageinfo[0].thumburl
        const ext = path.extname(new URL(t).pathname).toLowerCase().replace('.jpeg', '.jpg')
        const rel = `/images/commons/people/${kind}/${row.slug}${ext}`
        if (!fs.existsSync(P('back/public' + rel))) { fs.writeFileSync(P('back/public' + rel), await get(t, true)); await sleep(800) }
        row[kind === 'avatar' ? 'avatarImg' : 'img'] = rel
      }
      Object.assign(row, { imageAuthor: cleanArtist(strip(m.Artist?.value)), imageLicense: license, imageLicenseUrl: m.LicenseUrl?.value || null, imageSourceUrl: info.descriptionurl })
      if (info.width < 500 || info.height < 600) report.smallPhoto.push(`${row.name}: ${info.width}x${info.height}`)
    } else report.noPhoto.push(row.name + (info ? ` (license: ${license})` : ''))
  } else report.noPhoto.push(row.name)
  out.push(row)
  console.log('ok', p.role, row.name)
}
fs.writeFileSync(P('back/src/data/peopleSeed.json'), JSON.stringify([...existing, ...out], null, 2) + '\n')
fs.writeFileSync(P('back/tools/registry-scripts/build-people-report.json'), JSON.stringify(report, null, 2))
console.log({ total: out.length, trainers: out.filter((r) => r.role === 'trainer').length, promoters: out.filter((r) => r.role === 'promoter').length,
  noWiki: report.noWiki, noInduction: report.noInduction.length, noPhoto: report.noPhoto.length, smallPhoto: report.smallPhoto.length })
