import { DataTypes } from 'sequelize'
import sequelize from '../config/sequelizeConfig'

// IBHOF boxer categories. Men by the date of the last bout:
// modern >= 1989, late-era 1943-1988, early-era 1893-1942, pioneer <= 1892.
// Women (inducted since the class of 2020): women-modern and women-trailblazer (pioneers of women's boxing)
export const BOXER_CATEGORIES = ['modern', 'late-era', 'early-era', 'pioneer', 'women-modern', 'women-trailblazer']

const BoxerModel = sequelize.define('boxers', {
    id: {
        type: DataTypes.STRING,
        primaryKey: true,
        allowNull: false,
        unique: true,
    },
    // URL part of the profile page: /boxers/:category/:slug
    slug: {
        type: DataTypes.STRING,
        unique: true,
    },
    // article the biography is taken from (CC BY-SA requires a link to it)
    bioSourceUrl: {
        type: DataTypes.STRING,
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
            notEmpty: {
                msg: 'Name must not be empty'
            }
        }
    },
    biography: {
        type: DataTypes.TEXT,
        allowNull: false,
        validate: {
            notEmpty: {
                msg: 'Biography must not be empty'
            }
        }
    },
    born: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            notEmpty: {
                msg: 'Born must not be empty'
            }
        }
    },
    died: {
        type: DataTypes.STRING,
    },
    // Record fields may be null: for many bare-knuckle era fighters the record is unknown
    bouts: {
        type: DataTypes.INTEGER,
        allowNull: true,
        validate: {
            is: {
                args: /^\d+$/,
                msg: 'Bouts can only contain a number'
            }
        }
    },
    won: {
        type: DataTypes.INTEGER,
        allowNull: true,
        validate: {
            is: {
                args: /^\d+$/,
                msg: 'Won can only contain a number'
            }
        }

    },
    lost: {
        type: DataTypes.INTEGER,
        allowNull: true,
        validate: {
            is: {
                args: /^\d+$/,
                msg: 'Lost can only contain a number'
            }
        }
    },
    drew: {
        type: DataTypes.INTEGER,
    },
    nc: {
        type: DataTypes.INTEGER,
    },
    kos: {
        type: DataTypes.INTEGER,
        allowNull: true,
        validate: {
            is: {
                args: /^\d+$/,
                msg: 'Knockout can only contain a number'
            }
        }
    },
    induction: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
            notEmpty: {
                msg: 'Induction must not be empty'
            }
        }
    },
    // IBHOF category (current scheme), see BOXER_CATEGORIES
    category: {
        type: DataTypes.STRING,
        validate: {
            isIn: {
                args: [BOXER_CATEGORIES],
                msg: `Category must be one of: ${BOXER_CATEGORIES.join(', ')}`
            }
        }
    },
    avatarImg: {
        type: DataTypes.STRING,
    },
    img: {
        type: DataTypes.STRING,
    },
    // Photo credit (required by CC BY / CC BY-SA licenses), see back/migrations/
    imageAuthor: {
        type: DataTypes.STRING,
    },
    imageLicense: {
        type: DataTypes.STRING,
    },
    imageLicenseUrl: {
        type: DataTypes.STRING,
    },
    imageSourceUrl: {
        type: DataTypes.STRING,
    }
});


export default BoxerModel