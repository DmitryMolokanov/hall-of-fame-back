import express from 'express'
import { createBoxer, deleteBoxer, getAllBoxers, getBoxer, getBoxerBySlug, getCategories, searchBoxer, updateBoxer } from '../controllers/boxersController'

const boxerRouter = express.Router()

boxerRouter.get('/boxers', getAllBoxers)
boxerRouter.get('/boxers/categories', getCategories) // before /boxers/:id
boxerRouter.get('/boxers/by-slug/:slug', getBoxerBySlug)

boxerRouter.post('/boxers/search', searchBoxer)
boxerRouter.get('/boxers/:id', getBoxer)
boxerRouter.post('/boxers', createBoxer)
boxerRouter.put('/boxers', updateBoxer)
boxerRouter.delete('/boxers', deleteBoxer)


export default boxerRouter