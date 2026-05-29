import { ErrorRequestHandler } from 'express'
import { ValidationError, UniqueConstraintError, DatabaseError } from 'sequelize'

export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
    console.error(err)

    if (err instanceof UniqueConstraintError) {
        res.status(409).send({
            message: 'Resource already exists',
            fields: err.errors.map(e => ({ field: e.path, message: e.message })),
        })
        return
    }

    if (err instanceof ValidationError) {
        res.status(400).send({
            message: 'Validation failed',
            fields: err.errors.map(e => ({ field: e.path, message: e.message })),
        })
        return
    }

    if (err instanceof DatabaseError) {
        res.status(500).send({ message: 'Database error' })
        return
    }

    res.status(500).send({ message: 'Internal server error' })
}
