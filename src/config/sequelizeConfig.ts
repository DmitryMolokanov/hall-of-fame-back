import { Sequelize } from 'sequelize'
import dotenv from 'dotenv'

// .env.local (local machine, not committed) takes precedence over .env
dotenv.config({ path: ['.env.local', '.env'], quiet: true })

const dbName = process.env.DATABASE_NAME;
const dbUser = process.env.DATABASE_USER;
const dbPassword = process.env.DATABASE_PASSWORD;
const dbHost = process.env.DATABASE_URL;
const dbPort = parseInt(process.env.DATABASE_PORT ?? '5432', 10);


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
        port: dbPort,
        logging: false,
        define: {
            timestamps: false
        }
    });


sequelize.authenticate()
    .then(() => { console.log('Success connection to DB') })
    .catch(e => console.log(e))


export default sequelize