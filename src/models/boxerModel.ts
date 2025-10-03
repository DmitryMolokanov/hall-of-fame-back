import { Sequelize, DataTypes } from 'sequelize'
import sequelize from '../config/sequelizeConfig'

const BoxerModel = sequelize.define('boxers', {
    id: {
        type: DataTypes.STRING,
        primaryKey: true,
        allowNull: false,
        unique: true,
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
    bouts: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            notEmpty: {
                msg: 'Bouts must not be empty'
            },
            is: {
                args: /^\d+$/,
                msg: 'Bouts can only contain a number'
            }
        }
    },
    won: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            notEmpty: {
                msg: 'Won must not be empty'
            },
            is: {
                args: /^\d+$/,
                msg: 'Won can only contain a number'
            }
        }

    },
    lost: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            notEmpty: {
                msg: 'Lost must not be empty'
            },
            is: {
                args: /^\d+$/,
                msg: 'Lost can only contain a number'
            }
        }
    },
    drew: {
        type: DataTypes.STRING,
    },
    nc: {
        type: DataTypes.STRING,
    },
    kos: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            notEmpty: {
                msg: 'Knockout must not be empty'
            },
            is: {
                args: /^\d+$/,
                msg: 'Knockout can only contain a number'
            }
        }
    },
    induction: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            notEmpty: {
                msg: 'Induction must not be empty'
            }
        }
    },
    avatarImg: {
        type: DataTypes.STRING,
    },
    img: {
        type: DataTypes.STRING,
    }
});


export default BoxerModel