// Short "Beyond the Ring" profiles for inductees without an English Wikipedia article.
// The biography is a short sentence composed from Wikidata (CC0): role, nationality, life dates, induction year.
// Usage (from repo root): node back/tools/registry-scripts/add-short-people.mjs
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

const report = JSON.parse(fs.readFileSync(P('back/tools/registry-scripts/build-people-report.json'), 'utf8'))
const roles = JSON.parse(fs.readFileSync(P('back/tools/registry-scripts/people-roles.json'), 'utf8'))
const seedPath = P('back/src/data/peopleSeed.json')
const seed = JSON.parse(fs.readFileSync(seedPath, 'utf8'))
const have = new Set(seed.map((s) => s._wikidata))

// role from the curated lists in build-people.mjs
const buildSrc = fs.readFileSync(P('back/tools/registry-scripts/build-people.mjs'), 'utf8')
const listOf = (name) => JSON.parse(buildSrc.match(new RegExp(`const ${name} = (\\[[\\s\\S]*?\\])`))[1].replace(/'/g, '"').replace(/,\s*\]/, ']').replace(/"Cus D"Amato"/, '"Cus D\'Amato"').replace(/"Tom O"Rourke"/, '"Tom O\'Rourke"'))
const TRAINERS = new Set(listOf('TRAINERS'))
const REFEREES = new Set(listOf('REFEREES'))
const roleOf = (name) => (TRAINERS.has(name) ? 'trainer' : REFEREES.has(name) ? 'referee' : 'promoter')

const todo = report.noWiki.map((name) => ({ name, qid: roles.find((r) => r.name === name)?.qid, role: roleOf(name) }))
  .filter((p) => p.qid && !have.has(p.qid))

const j = await get('https://www.wikidata.org/w/api.php?action=wbgetentities&props=labels|descriptions|claims&languages=en&format=json&ids=' + todo.map((p) => p.qid).join('|'))
const wdDate = (c) => {
  const t = c?.[0]?.mainsnak?.datavalue?.value?.time
  if (!t) return null
  const [y, m, d] = t.slice(1, 11).split('-')
  return m === '00' ? y : d === '00' ? `${y}-${m}` : `${y}-${m}-${d}`
}
const NATIONALITY = /\b(American|Greek-American|Cuban|Mexican|Argentin(?:e|ian)|German|French|Japanese|Italian|Filipino|British|English|Canadian|Puerto Rican)\b/i
const slugOf = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const slugs = new Set(seed.map((s) => s.slug))

const added = []
for (const p of todo) {
  const e = j.entities[p.qid]
  const name = (e.labels?.en?.value || p.name).replace(/"/g, '')
  const desc = e.descriptions?.en?.value || ''
  const female = e.claims?.P21?.[0]?.mainsnak?.datavalue?.value?.id === 'Q6581072'
  const born = wdDate(e.claims?.P569), died = wdDate(e.claims?.P570)
  const hof = (e.claims?.P166 || []).filter((c) => c.mainsnak?.datavalue?.value?.id === IBHOF)
  const induction = parseInt(hof.map((h) => h.qualifiers?.P585?.[0]?.datavalue?.value?.time).find(Boolean)?.slice(1, 5), 10) || null

  const nat = desc.match(NATIONALITY)?.[1]?.replace(/^Argentinian$/i, 'Argentine')
  const what = p.role === 'trainer'
    ? (/cutman/i.test(desc) ? 'cutman' : 'boxing trainer')
    : p.role === 'referee'
      ? (/referee/i.test(desc) && /judge/i.test(desc) ? 'boxing referee and judge' : /judge/i.test(desc) ? 'boxing judge' : 'boxing referee')
      : (/matchmaker/i.test(desc) ? 'boxing matchmaker' : /manager/i.test(desc) ? 'boxing manager' : 'boxing promoter')
  // no pronouns and no is/was: Wikidata often lacks sex and death dates, so neither can be inferred safely
  void female
  const label = `${nat ? nat + ' ' : ''}${what}`
  const biography = [
    `${label.charAt(0).toUpperCase()}${label.slice(1)}.`,
    induction ? `Inducted into the International Boxing Hall of Fame in ${induction} (Non-Participant category).`
      : 'Inductee of the International Boxing Hall of Fame (Non-Participant category).',
  ].join(' ')

  let slug = slugOf(name); while (slugs.has(slug)) slug += '-2'
  slugs.add(slug)
  const row = {
    id: crypto.randomUUID(), slug, name, role: p.role, biography,
    bioSourceUrl: `https://www.wikidata.org/wiki/${p.qid}`,
    born, died, induction,
    avatarImg: null, img: null, imageAuthor: null, imageLicense: null, imageLicenseUrl: null, imageSourceUrl: null,
    _wikidata: p.qid, _ibhofName: p.name, _shortProfile: true,
  }

  const file = e.claims?.P18?.[0]?.mainsnak?.datavalue?.value
  if (file) {
    const info = Object.values((await get(`https://commons.wikimedia.org/w/api.php?action=query&prop=imageinfo&iiprop=size|extmetadata|url&format=json&titles=${encodeURIComponent('File:' + file)}`)).query.pages)[0].imageinfo?.[0]
    const m = info?.extmetadata || {}
    const license = strip(m.LicenseShortName?.value)
    if (info && /^(public domain|pd|cc0|cc by(-sa)? \d)/i.test(license)) {
      for (const [kind, target] of [['avatar', 500], ['img', 1280]]) {
        const w = STD_W.filter((s) => s <= target && s < info.width).pop() || STD_W[0]
        const t = Object.values((await get(`https://commons.wikimedia.org/w/api.php?action=query&prop=imageinfo&iiprop=url&iiurlwidth=${w}&format=json&titles=${encodeURIComponent('File:' + file)}`)).query.pages)[0].imageinfo[0].thumburl
        const ext = path.extname(new URL(t).pathname).toLowerCase().replace('.jpeg', '.jpg')
        const rel = `/images/commons/people/${kind}/${slug}${ext}`
        fs.writeFileSync(P('back/public' + rel), await get(t, true))
        row[kind === 'avatar' ? 'avatarImg' : 'img'] = rel
        await sleep(800)
      }
      const artist = strip(m.Artist?.value)
      Object.assign(row, {
        imageAuthor: !artist || /unknown/i.test(artist) ? null : artist.replace(/\.\s*Agence photographique \(commanditaire\)$/, '').slice(0, 120),
        imageLicense: license, imageLicenseUrl: m.LicenseUrl?.value || null, imageSourceUrl: info.descriptionurl,
      })
    }
  }
  seed.push(row)
  added.push(`${p.role.padEnd(8)} ${row.name} | ${row.biography}`)
}
fs.writeFileSync(seedPath, JSON.stringify(seed, null, 2) + '\n')
console.log(added.join('\n'))
console.log('added', added.length, '| total', seed.length)
