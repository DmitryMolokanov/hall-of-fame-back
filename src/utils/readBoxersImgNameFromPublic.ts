import Boxer from '../models/boxerModel'
import fs from 'fs'
import path from 'path'
import { Op, where } from 'sequelize'

export const readBoxersImgNameFromPublic = async () => {
    const avatarDir = path.join('public', 'images', 'avatarImg')
    const imgDir = path.join('public', 'images', 'img')
    fs.readdir(avatarDir, (error, files) => {
        if (error) {
            console.log(error)
        }

        for (const el of files) {
            const boxerName = el.split('.')[0]
            Boxer.findOne({
                where: {
                    name: {
                        [Op.iLike]: `%${boxerName}%`
                    }
                }
            }).then((boxer) => {
                const boxerId = boxer?.dataValues.id
                boxerId &&
                    Boxer.update(
                        { avatarImg: `/images/avatarImg/${el}` },
                        { where: { id: boxerId } }
                    )
            })

        }
    })

    fs.readdir(imgDir, (error, files) => {
        if (error) {
            console.log(error)
        }

        for (const el of files) {
            const boxerName = el.split('.')[0]
            Boxer.findOne({
                where: {
                    name: {
                        [Op.iLike]: `%${boxerName}%`
                    }
                }
            }).then((boxer) => {
                const boxerId = boxer?.dataValues.id
                boxerId &&
                    Boxer.update(
                        { img: `/images/img/${el}` },
                        { where: { id: boxerId } }
                    )
            }).catch((err) => console.log(err))
        }
    })
}