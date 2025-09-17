import { Sequelize, DataTypes } from 'sequelize'
import sequelize from '../config/sequelizeConfig'

const Boxer = sequelize.define('boxers', {
    id: {
        type: DataTypes.STRING,
        primaryKey: true,
        allowNull: false
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    biography: {
        type: DataTypes.TEXT,
        allowNull: false

    },
    born: {
        type: DataTypes.STRING,
    },
    died: {
        type: DataTypes.STRING,
    },
    bouts: {
        type: DataTypes.STRING,

    },
    won: {
        type: DataTypes.STRING,
    },
    lost: {
        type: DataTypes.STRING,
    },
    drew: {
        type: DataTypes.STRING,
    },
    nc: {
        type: DataTypes.STRING,
    },
    kos: {
        type: DataTypes.STRING,
    },
    induction: {
        type: DataTypes.STRING,
    },
    avatarImg: {
        type: DataTypes.STRING,
    },
    img: {
        type: DataTypes.STRING,
    }
});


export default Boxer