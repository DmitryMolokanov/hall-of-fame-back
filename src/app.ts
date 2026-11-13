import express from 'express'
import BoxerModel from './models/boxerModel'
import boxersRouter from './routes/boxersRouter'
import peopleRouter from './routes/peopleRouter'
import cors from 'cors'
import { errorHandler } from './middleware/errorHandler'

const app = express()
app.use(cors())
app.use(express.json())
app.use(express.static('public'))


app.use(boxersRouter)
app.use(peopleRouter)

app.use(errorHandler)


app.listen(3000, () => {
    console.log('server started')
})