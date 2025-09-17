import { Sequelize } from 'sequelize'

const sequelize = new Sequelize("boxers", "postgres", "D321063!", {
    dialect: "postgres",
    host: "localhost",
    port: 5432,
    define: {
        timestamps: false
    }
});

export default sequelize