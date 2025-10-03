import { Sequelize } from 'sequelize'
import dotenv from 'dotenv'

dotenv.config()

const dbName = process.env.DATABASE_NAME;
const dbUser = process.env.DATABASE_USER;
const dbPassword = process.env.DATABASE_PASSWORD;
const dbHost = process.env.DATABASE_URL;


if (!dbName || !dbUser || !dbPassword || !dbHost) {
    throw new Error('One or more database environment variables are missing');
}

const sequelize = new Sequelize(
    dbName,
    dbUser,
    dbPassword,
    {
        dialect: "postgres",
        host: dbHost,
        port: 5432,
        define: {
            timestamps: false
        }
    });


sequelize.authenticate()
    .then(() => { console.log('Success connection to DB') })
    .catch(e => console.log(e))


export default sequelize