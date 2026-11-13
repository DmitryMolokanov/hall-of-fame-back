import express from 'express'
import { getPeople, getPersonBySlug, getRoles, searchPeople } from '../controllers/peopleController'

// "Beyond the Ring": read-only API for non-boxer inductees
const peopleRouter = express.Router()

peopleRouter.get('/people', getPeople)
peopleRouter.get('/people/roles', getRoles)
peopleRouter.get('/people/by-slug/:slug', getPersonBySlug)
peopleRouter.post('/people/search', searchPeople)

export default peopleRouter
