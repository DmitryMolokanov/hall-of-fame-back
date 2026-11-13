import BoxerModel, { BOXER_CATEGORIES } from "../models/boxerModel"
import { Request, Response } from "express"
import crypto from 'crypto'
import { Op, fn, col } from "sequelize"

// optional ?category=... / body.category filter; unknown values are ignored
const categoryFilter = (category: unknown) =>
    typeof category === 'string' && BOXER_CATEGORIES.includes(category) ? { category } : {}

export const getCategories = async (_req: Request, res: Response) => {
    const rows = await BoxerModel.findAll({
        attributes: ['category', [fn('COUNT', col('id')), 'count']],
        group: ['category'],
        raw: true,
    }) as unknown as { category: string | null, count: string }[]
    const counts = Object.fromEntries(rows.map((r) => [r.category, Number(r.count)]))
    res.send(BOXER_CATEGORIES.map((category) => ({ category, count: counts[category] ?? 0 })))
}

export const getAllBoxers = async (req: Request, res: Response) => {
    const { limit, offset, sortOrder, sortBy, category } = req.query
    const parseLimit = parseInt(limit as string)
    const parseOffset = parseInt(offset as string)
    const where = categoryFilter(category)

    // whitelist: these values go into ORDER BY
    const sortColumns = ['name', 'born', 'induction', 'bouts', 'won']
    const column = sortColumns.includes(sortBy as string) ? (sortBy as string) : 'name'
    const direction = String(sortOrder).toUpperCase() === 'DESC' ? 'DESC' : 'ASC'

    let response
    if (limit && offset && sortBy && sortOrder) {
        response = await BoxerModel.findAll({
            where,
            limit: parseLimit,
            offset: parseOffset,
            // boxers with an unknown record go last in both directions; name keeps paging stable
            order: [[column, `${direction} NULLS LAST`], ['name', 'ASC']],
        })
    } else {
        response = await BoxerModel.findAll({ where, order: ['name'] })
    }
    res.send(response)
}


// Profile page: the boxer plus alphabetical neighbours within the same category
export const getBoxerBySlug = async (req: Request, res: Response) => {
    const boxer = await BoxerModel.findOne({ where: { slug: req.params.slug } })
    if (!boxer) {
        res.status(404).send({ message: 'Boxer not found' })
        return
    }
    const name = boxer.get('name') as string
    const sameCategory = { category: boxer.get('category') as string | null }
    const attributes = ['name', 'slug', 'category']
    const [prev, next] = await Promise.all([
        BoxerModel.findOne({ where: { ...sameCategory, name: { [Op.lt]: name } }, order: [['name', 'DESC']], attributes }),
        BoxerModel.findOne({ where: { ...sameCategory, name: { [Op.gt]: name } }, order: [['name', 'ASC']], attributes }),
    ])
    res.send({ boxer, prev, next })
}

export const getBoxer = async (req: Request, res: Response) => {
    const { id } = req.params
    const response = await BoxerModel.findOne({ where: { id } })
    if (!response) {
        res.status(404).send({ message: 'Boxer not found' })
        return
    }
    res.send(response)
}

export const createBoxer = async (req: Request, res: Response) => {
    const newBoxer = req.body
    newBoxer.id = crypto.randomUUID()
    await BoxerModel.create(newBoxer)
    res.sendStatus(201)
}

export const updateBoxer = async (req: Request, res: Response) => {
    const newBoxer = req.body
    const id = req.body.id
    await BoxerModel.update(newBoxer, { where: { id } })
    res.sendStatus(200)
}

export const deleteBoxer = async (req: Request, res: Response) => {
    const id = req.body.id
    await BoxerModel.destroy({ where: { id } })
    res.sendStatus(200)
}

export const searchBoxer = async (req: Request, res: Response) => {
    const search = req.body.search
    const response = await BoxerModel.findAll({
        where: {
            name: { [Op.iLike]: `%${search}%` },
            ...categoryFilter(req.body.category),
        },
        order: ['name'],
    })
    res.send(response)
}
