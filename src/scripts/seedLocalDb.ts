/**
 * Fills a local database with boxers (src/data/boxersSeed.json) and Beyond the Ring people (peopleSeed.json)
 * (built from Wikidata/Wikipedia by back/tools/registry-scripts/build-seed.mjs, photos from Wikimedia Commons).
 *
 * Connection settings come from .env.local (falls back to .env). The database itself must exist:
 *   psql -h localhost -U postgres -c "CREATE DATABASE boxers"
 * Then:
 *   npx ts-node src/scripts/seedLocalDb.ts           # create table if missing, insert boxers if table is empty
 *   npx ts-node src/scripts/seedLocalDb.ts --reset   # delete all boxers and insert again
 */
import fs from 'fs'
import path from 'path'
import sequelize from '../config/sequelizeConfig'
import BoxerModel from '../models/boxerModel'
import PersonModel from '../models/personModel'
import { Model, ModelStatic } from 'sequelize'

const reset = process.argv.includes('--reset')

const main = async () => {
    const host = sequelize.config.host
    if (!['localhost', '127.0.0.1', '::1'].includes(host ?? '')) {
        throw new Error(`Refusing to seed a non-local database (${host}). Check .env.local.`)
    }

    // drop helper fields (_source, _wikidata, ...)
    const load = (file: string) => JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', file), 'utf8'))
        .map((row: Record<string, unknown>) => Object.fromEntries(Object.entries(row).filter(([k]) => !k.startsWith('_'))))

    const tables: [ModelStatic<Model>, string, string][] = [
        [BoxerModel, 'boxersSeed.json', 'boxers'],
        [PersonModel, 'peopleSeed.json', 'people'],
    ]
    for (const [model, file, label] of tables) {
        if (!fs.existsSync(path.join(__dirname, '..', 'data', file))) continue
        const rows = load(file)
        await model.sync()
        if (reset) await model.destroy({ where: {} })

        const count = await model.count()
        if (count > 0) {
            console.log(`Table already has ${count} ${label}, nothing inserted (use --reset to reload).`)
        } else {
            await model.bulkCreate(rows, { validate: true })
            console.log(`Inserted ${rows.length} ${label} into ${sequelize.config.database}@${host}.`)
        }
    }
    await sequelize.close()
}

main().catch(async (e) => {
    console.error(e)
    await sequelize.close()
    process.exit(1)
})
