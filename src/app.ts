import express from 'express'
import BoxerModel from './models/boxerModel'
import { readBoxersImgNameFromPublic } from './utils/readBoxersImgNameFromPublic'
import boxersRouter from './routes/boxersRouter'
import cors from 'cors'

const app = express()
app.use(cors())
app.use(express.json())
app.use(express.static('public'))


app.use(boxersRouter)


// readBoxersImgNameFromPublic()

app.listen(3000, () => {
    console.log('server started')
})