import { Request, Response } from 'express'
import { Op, fn, col } from 'sequelize'
import PersonModel, { PERSON_ROLES } from '../models/personModel'

const roleFilter = (role: unknown) =>
    typeof role === 'string' && PERSON_ROLES.includes(role) ? { role } : {}

// number of people per role: [{ role, count }]
export const getRoles = async (_req: Request, res: Response) => {
    const rows = await PersonModel.findAll({
        attributes: ['role', [fn('COUNT', col('id')), 'count']],
        group: ['role'],
        raw: true,
    }) as unknown as { role: string, count: string }[]
    const counts = Object.fromEntries(rows.map((r) => [r.role, Number(r.count)]))
    res.send(PERSON_ROLES.map((role) => ({ role, count: counts[role] ?? 0 })))
}

export const getPeople = async (req: Request, res: Response) => {
    const { limit, offset, sortOrder, sortBy, role } = req.query
    // whitelist: these values go into ORDER BY
    const column = ['name', 'born', 'induction'].includes(sortBy as string) ? (sortBy as string) : 'name'
    const direction = String(sortOrder).toUpperCase() === 'DESC' ? 'DESC' : 'ASC'
    const response = await PersonModel.findAll({
        where: roleFilter(role),
        limit: Math.min(parseInt(limit as string) || 20, 100),
        offset: parseInt(offset as string) || 0,
        order: [[column, `${direction} NULLS LAST`], ['name', 'ASC']],
    })
    res.send(response)
}

export const searchPeople = async (req: Request, res: Response) => {
    const response = await PersonModel.findAll({
        where: {
            name: { [Op.iLike]: `%${req.body.search ?? ''}%` },
            ...roleFilter(req.body.role),
        },
        order: ['name'],
    })
    res.send(response)
}

// profile page: the person plus alphabetical neighbours with the same role
export const getPersonBySlug = async (req: Request, res: Response) => {
    const person = await PersonModel.findOne({ where: { slug: req.params.slug } })
    if (!person) {
        res.status(404).send({ message: 'Person not found' })
        return
    }
    const name = person.get('name') as string
    const sameRole = { role: person.get('role') as string }
    const attributes = ['name', 'slug', 'role']
    const [prev, next] = await Promise.all([
        PersonModel.findOne({ where: { ...sameRole, name: { [Op.lt]: name } }, order: [['name', 'DESC']], attributes }),
        PersonModel.findOne({ where: { ...sameRole, name: { [Op.gt]: name } }, order: [['name', 'ASC']], attributes }),
    ])
    res.send({ person, prev, next })
}
