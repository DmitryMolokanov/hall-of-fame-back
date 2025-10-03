import express from 'express'
import { createBoxer, deleteBoxer, getAllBoxers, getBoxer, searchBoxer, updateBoxer } from '../controllers/boxersController'

const boxerRouter = express.Router()

boxerRouter.get('/boxers', getAllBoxers)
boxerRouter.get('/boxers/id', getBoxer)
boxerRouter.post('/boxers', createBoxer)
boxerRouter.post('/boxers/search', searchBoxer)
boxerRouter.put('/boxers', updateBoxer)
boxerRouter.delete('/boxers', deleteBoxer)


export default boxerRouter