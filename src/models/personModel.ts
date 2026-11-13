import { DataTypes } from 'sequelize'
import sequelize from '../config/sequelizeConfig'

// "Beyond the Ring": Hall of Fame inductees who are not boxers.
// role is our grouping of the IBHOF Non-Participant / Observer categories.
export const PERSON_ROLES = ['trainer', 'promoter', 'referee']

const PersonModel = sequelize.define('people', {
    id: {
        type: DataTypes.STRING,
        primaryKey: true,
        allowNull: false,
        unique: true,
    },
    slug: {
        type: DataTypes.STRING,
        unique: true,
        allowNull: false,
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: { notEmpty: { msg: 'Name must not be empty' } }
    },
    role: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            isIn: { args: [PERSON_ROLES], msg: `Role must be one of: ${PERSON_ROLES.join(', ')}` }
        }
    },
    biography: {
        type: DataTypes.TEXT,
        allowNull: false,
    },
    bioSourceUrl: { type: DataTypes.STRING },
    born: { type: DataTypes.STRING },
    died: { type: DataTypes.STRING },
    induction: { type: DataTypes.INTEGER },
    avatarImg: { type: DataTypes.STRING },
    img: { type: DataTypes.STRING },
    imageAuthor: { type: DataTypes.STRING },
    imageLicense: { type: DataTypes.STRING },
    imageLicenseUrl: { type: DataTypes.STRING },
    imageSourceUrl: { type: DataTypes.STRING },
});

export default PersonModel
