module.exports = function(sequelize, DataTypes) {
    var ResetTokens = sequelize.define("ResetTokens", {
        email: {
            type: DataTypes.STRING
        },
        token: {
            type: DataTypes.STRING
        },
        expiration: {
            type: DataTypes.DATE
        },
        used: {
            type: DataTypes.INTEGER
        }
    });

    // User.associate = function (models) {
    //     User.hasMany(models.Event, {
    //         onDelete: "cascade"
    //     });

    //     User.hasMany(models.Messages, {
    //         onDelete: "cascade"
    //     })
    // };

    return ResetTokens;
};