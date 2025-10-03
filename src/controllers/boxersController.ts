import BoxerModel from "../models/boxerModel"
import { Request, Response } from "express"
import crypto from 'crypto'
import { Op } from "sequelize"


export const getAllBoxers = async (req: Request, res: Response) => {
    const { limit, offset } = req.body
    try {
        const response = await BoxerModel.findAll({ limit, offset })
        res.send(response)
    } catch (err) {
        console.log(err)
    }
}

export const getBoxer = async (req: Request, res: Response) => {
    const { id } = req.body
    try {
        const response = await BoxerModel.findOne({ where: { id } })
        res.send(response)
    } catch (err) {
        console.log(err)
    }
}

export const createBoxer = async (req: Request, res: Response) => {
    const newBoxer = req.body
    const id = crypto.randomUUID()
    newBoxer.id = id
    console.log(newBoxer)
    try {
        await BoxerModel.create(newBoxer)
        res.sendStatus(201)
    } catch (err) {
        console.log(err)
        res.send(err)
    }
}

export const updateBoxer = async (req: Request, res: Response) => {
    const newBoxer = req.body
    const id = req.body.id
    try {
        await BoxerModel.update(newBoxer, { where: { id } })
        res.sendStatus(200)
    } catch (err) {
        console.log(err)
        res.send(err)
    }
}

export const deleteBoxer = async (req: Request, res: Response) => {
    const id = req.body.id
    try {
        await BoxerModel.destroy({ where: { id } })
        res.sendStatus(200)
    } catch (err) {
        console.log(err)
        res.send(err)
    }
}

export const searchBoxer = async (req: Request, res: Response) => {
    const search = req.body.search
    try {
        const response = await BoxerModel.findAll({
            where: {
                name:
                    { [Op.iLike]: `%${search}%` }
            }
        })
        res.send(response)
    } catch (err) {
        console.log(err)
    }
}