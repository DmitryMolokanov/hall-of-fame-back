import BoxerModel from "../models/boxerModel"
import { Request, Response } from "express"
import crypto from 'crypto'
import { Op } from "sequelize"


export const getAllBoxers = async (req: Request, res: Response) => {
    const { limit, offset, sortOrder, sortBy } = req.query
    const parseLimit = parseInt(limit as string)
    const parseOffset = parseInt(offset as string)

    let response
    if (limit && offset && sortBy && sortOrder) {
        response = await BoxerModel.findAll({
            limit: parseLimit,
            offset: parseOffset,
            order: [[sortBy as string, sortOrder as string]],
        })
    } else {
        response = await BoxerModel.findAll({ order: ['name'] })
    }
    res.send(response)
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
            name: { [Op.iLike]: `%${search}%` }
        }
    })
    res.send(response)
}
