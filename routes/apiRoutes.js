var db = require("../models");
// const { request } = require("express");
var crypto = require('crypto');
const { Sequelize, sequelize } = require("../models");
const Op = Sequelize.Op;
const nodemailer = require('nodemailer');

module.exports = function (app) {
    // login in auth
    app.post("/api/login", function (req, res) {
        var username = req.body.username;
        var password = req.body.password;

        if (username && password) {
            var hashed_password = crypto.createHash("sha256").update(req.body.password).digest("hex");
            db.User.findAll({
                where: {
                    username: username,
                    password: hashed_password
                }
            }).then(function (results) {
                console.log(results)
                if (results.length > 0) {
                    console.log("YOU ARE LOGGED IN");
                    req.session.loggedin = true;
                    req.session.userID = results[0].id;
                    req.session.username = results[0].username;
                    req.session.useremail = results[0].email;
                    // res.redirect("/loggedin");
                    res.send({
                        statusString: "loggedin"
                    });
                } else {
                    console.log("WRONG PASS OR USER")
                    res.send({
                        statusString: "wrongPassOrUser"
                    });
                }
            });

        } else {
            res.send({
                statusString: "noPassOrUser"
            });
        }
    });

    //authenticate user logged in w react router
    app.get("/api/checklogin", function (req, res) {
        if (req.session.loggedin) {
            res.sendStatus(200)
        } else {
            res.sendStatus(404)
        }
    })

    // Create account
    app.post("/api", function (req, res) {
        var username = req.body.username;
        var password = req.body.password;
        var email = req.body.email;

        if (username && password && email) {
            var accountGetObj = {
                username: username
            };

            db.User.findAll({ where: accountGetObj }).then(function (results) {
                // console.log("this works: " + results.length);
                if (results.length === 0) {
                    var hashed_password = crypto.createHash("sha256").update(req.body.password).digest("hex");
                    var postObj = {
                        username: username,
                        password: hashed_password,
                        email: email
                    }
                    db.User.create(postObj).then(function (results2) {
                        res.send({
                            statusString: "userCreateSuccess"
                        });
                    });

                } else {
                    res.send({
                        statusString: "userAlreadyExists"
                    });
                }
            });

        } else {
            res.send({
                statusString: "formNotComplete"
            });
        }
    });

    // get profile info
    app.get("/api/profile", function (req, res) {
        if (req.session.loggedin) {
            db.User.findOne({
                where: {
                    id: req.session.userID
                }
            })
                .then(function (results) {
                    res.json(results);
                })
                .catch(err => console.log(err));
        } else {
            res.sendStatus(404)
        }

    });


    // update user info
    app.put("/api/profileupdate", function (req, res) {
        if (req.session.loggedin) {
            console.log(req.body)
            db.User.update(
                req.body,
                {
                    where: {
                        id: req.session.userID
                    }
                }
            ).then(function (result) {
                res.sendStatus(200)
            }).catch(err => res.send(err))
        } else {
            res.status(400).end();
        }
    });

    // search for usernames
    app.get("/api/username", function (req, res) {
        if (req.session.loggedin) {
            if (req.query.username === "") {

            } else {
                if ((req.query.username).split(" ").length > 1) {
                    let userArr = (req.query.username).split(" ");

                    db.User.findAll({
                        attributes: ["username", "firstname", "lastname", "id", "pushToken", "pushEnabled", "profilePic"],
                        where: {
                            [Op.and]: [
                                { firstname: { [Op.substring]: userArr[0] } },
                                { lastname: { [Op.substring]: userArr[1] } },
                                { id: { [Op.not]: req.session.userID } }
                            ]
                        }
                    }).then(function (results) {
                        res.json(results);
                    });
                } else {
                    db.User.findAll({
                        attributes: ["username", "firstname", "lastname", "id", "pushToken", "pushEnabled", "profilePic"],
                        where: {
                            id: { [Op.not]: req.session.userID },
                            [Op.or]: [
                                { username: { [Op.substring]: req.query.username } },
                                { firstname: { [Op.substring]: req.query.username } },
                                { lastname: { [Op.substring]: req.query.username } }
                            ]
                        }
                    }).then(function (results) {
                        res.json(results);
                    });
                }
            }
        } else {
            res.status(400).end();
        }
    });

    // create event
    app.post("/api/calendar", function (req, res) {
        if (req.session.loggedin) {
            let requestData = req.body;
            requestData.UserId = req.session.userID;
            db.Event.create(requestData)
                .then(function (results) {
                    res.send({
                        statusString: "eventCreated"
                    });
                }).catch(err => res.send(err));
        } else {
            res.status(400).end();
        }

    });

    // get events for calendar
    app.get("/api/calendar", function (req, res) {
        if (req.session.loggedin) {
            db.Event.findAll({
                where: {
                    [Op.or]: [
                        { UserId: req.session.userID },
                        {
                            eventStatus: "confirmed",
                            confirmedByUser: req.session.userID
                        }
                    ]

                },
                order: [["start"]],
                include: [
                    {
                        model: db.User,
                        attributes: ["username", "firstname", "lastname", "id", "profilePic"]
                    },
                    {
                        model: db.User,
                        as: 'secondUser',
                        attributes: ["username", "firstname", "lastname", "id", "profilePic"]
                    }]
            }).then(function (results) {
                res.json({ results: results, myUserId: req.session.userID });
            });
        } else {
            res.status(400).end();
        }

    });

    // confirmed events for feed
    app.get("/api/confirmed/:limit/:userId?", function (req, res) {
        if (req.session.loggedin) {
            // checks if the query should include a where condition for a specific user id
            const whereStatement = req.params.userId ? { eventStatus: "confirmed", [Op.or]: [{ UserId: req.params.userId }, { confirmedByUser: req.params.userId }] } : { eventStatus: "confirmed" };

            db.Event.findAll({
                where: whereStatement,
                include: [
                    { model: db.User },
                    {
                        model: db.User,
                        as: 'secondUser'
                    }],
                order: [["start", "DESC"]],
                limit: parseInt(req.params.limit)
            }).then(function (results) {
                res.json({ events: results, myUserId: req.session.userID });
            })
        } else {
            res.status(400).end();
        }
    });

    // user's proposed match updates
    app.get("/api/updates", function (req, res) {
        if (req.session.loggedin) {
            db.Event.findAll({
                attributes: ["id", "title", "start"],
                where: {
                    eventStatus: "denied",
                    UserId: req.session.userID
                },
                order: [["createdAt", "DESC"]]
            }).then(function (results) {
                res.json(results)
            })
        } else {
            res.status(400).end();
        }
    });

    // searching for players with availibility on chosen day
    app.get("/api/calendar/propose", function (req, res) {
        let dateSearch;
        if (req.query.date) {
            dateSearch = { start: { [Op.like]: req.query.date + "%" } };
        }

        let locationSearch;
        if (req.query.locationlat && req.query.locationlng) {
            locationSearch = {
                [Op.and]: [
                    { latitude: req.query.locationlat },
                    { longitude: req.query.locationlng }
                ]
            }
        }

        let skillUserSearch = {};
        if (req.query.skill) {
            // skillSearch = {
            //     skilllevel: req.query.skill
            // }
            skillUserSearch.skilllevel = req.query.skill;
        }
        if (req.query.user) {
            // userSearch = {
            //     id: req.query.user
            // }
            skillUserSearch.id = req.query.user;
        }
        if (req.session.loggedin) {
            db.Event.findAll({
                where: {
                    [Op.and]: [

                        // { start: { [Op.like]: req.query.date + "%" } },
                        dateSearch,
                        locationSearch,


                        { UserId: { [Op.not]: req.session.userID } },
                        { eventStatus: "available" }]
                },
                include: [
                    {
                        model: db.User,
                        attributes: ["username", "firstname", "lastname", "id", "skilllevel", "pushToken", "pushEnabled", "profilePic"],
                        where: skillUserSearch
                    }]
            }).then(function (results) {
                res.json(results);
            });
        } else {
            res.status(400).end();
        }

    });

    // Get logged in user's requests
    app.get("/api/calendar/requests", function (req, res) {
        if (req.session.loggedin) {
            db.Event.findAll({
                where: {
                    [Op.and]: [
                        { confirmedByUser: req.session.userID },
                        { eventStatus: "propose" }]
                },
                include: [
                    {
                        model: db.User,
                        attributes: ["username", "firstname", "lastname", "id", "skilllevel", "pushToken", "pushEnabled", "profilePic"],
                    }]
            }).then(function (results) {
                results = { results: results, userid: req.session.userID }
                res.json(results);
            });
        } else {
            res.status(400).end();
        }

    });

    app.put("/api/calendar/requests", function (req, res) {
        if (req.session.loggedin) {
            db.Event.update(
                {
                    title: req.body.title,
                    eventStatus: "confirmed"
                },
                {
                    where: {
                        id: req.body.id
                    }
                }
            ).then(function (result) {
                res.send(result);
            })
        } else {
            res.status(400).end();
        }
    });

    app.put("/api/calendar/requests/location", function (req, res) {
        if (req.session.loggedin) {
            db.Event.update(
                {
                    location: req.body.location,
                    vicinity: req.body.vicinity,
                    latitude: req.body.latitude,
                    longitude: req.body.longitude
                },
                {
                    where: {
                        id: req.body.id
                    }
                }
            ).then(function (result) {
                res.send(result);
            })
                .catch(function (err) {
                    console.log(err)
                })
        }
        else {
            res.status(400).end();
        }
    });

    app.delete("/api/overlap/destroy", function (req, res) {
        if (req.session.loggedin) {
            db.Event.destroy({
                where: {
                    UserId: req.session.userID,
                    eventStatus: "available",
                    [Op.or]: [
                        {
                            start: {
                                [Op.gte]: req.body.start,
                                [Op.lte]: req.body.end
                            }
                        },
                        {
                            start: {
                                [Op.lte]: req.body.start
                            },
                            end: {
                                [Op.gte]: req.body.start
                            }
                        }
                    ]
                }
            }).then(function (result) {
                res.json(result);
            })
        } else {
            res.status(400).end();
        }
    });

    // overlap of schedule between users
    app.get("/api/overlap", function (req, res) {
        // This uses User 1 as the input into the query. All returns are in reference to User 1's events. Change this by changing the createdByUser = values in the query
        // let userNum=req.body.userNum;
        let userNum = 1;
        sequelize.query("SELECT t2.*, t1.id overlapWithEventID, t1.UserID chosenUser, t3.username eventUserName FROM events t1 JOIN events t2 JOIN users t3 WHERE t1.UserID = " + userNum + " AND t3.id = t2.UserID AND t2.UserID != " + userNum + " AND date(t1.end) >= CURDATE() AND TIMESTAMPDIFF(MINUTE, GREATEST(t1.start, t2.start), LEAST(t1.`end`, t2.`end`)) >= 30;", { type: Sequelize.QueryTypes.SELECT }).then(function (result) {
            res.json(result);
        });
    });

    //   part of overlap test , getting a users events
    app.get("/api/events/:user", function (req, res) {
        db.Event.findAll({
            where: {
                UserId: req.params.user
            }
        }).then(function (userEvents) {
            res.json(userEvents);
        }).catch(function (error) {
            console.log(error);
        })
    });

    //   path to log a user out of sessions
    app.get("/logout", function (req, res) {
        req.session.destroy();
        res.sendStatus(200);
    });
    // saves new message to messages table
    app.post("/api/message", function (req, res) {
        if (req.session.loggedin) {
            let requestData = req.body;
            requestData.UserId = req.session.userID;
            db.Messages.create(requestData)
                .then(function (results) {
                    res.json(results);
                }).catch(err => res.send(err));
        }
        else {
            res.status(400).end();
        }
    });
    // returns list of users that match search parameters
    app.get("/api/users/:user", function (req, res) {
        if (req.session.loggedin) {
            db.User.findAll({
                where: {
                    username: { [Op.like]: req.params.user + "%" } //would like to make this to include searching by first name and exclude current user
                }
            })
                .then(function (results) {
                    res.json(results);
                })
                .catch(err => console.log(err));
        } else {
            res.sendStatus(404)
        }
    });

    app.get("/api/messages", function (req, res) {
        if (req.session.loggedin) {
            db.Messages.findAll({
                attributes: ["id", "message", "read", "createdAt", ["UserId", "senderId"], ["secondUser", "recipientId"]],
                where: {
                    [Op.or]: [
                        { UserId: req.session.userID },
                        { secondUser: req.session.userID }
                    ],
                },
                order: [["createdAt", "DESC"]],
                include: [
                    { model: db.User, attributes: ["username", "firstname", "lastname", "pushToken", "pushEnabled", "profilePic"] },
                    { model: db.User, as: "recipient", attributes: ["username", "firstname", "lastname", "pushToken", "pushEnabled", "profilePic"] }
                ]
            })
                .then(function (results) {
                    const resArr = { results: results, myUserId: req.session.userID };
                    res.json(resArr);
                })
                .catch(err => console.log(err));
        } else {
            res.sendStatus(404)
        }
    });

    app.get("/api/conversation/:recipient", function (req, res) {
        if (req.session.loggedin) {
            db.Messages.findAll({
                attributes: ["id", "message", "read", "createdAt", ["UserId", "senderId"], ["secondUser", "recipientId"]],
                where: {
                    [Op.or]: [
                        { userId: req.session.userID, secondUser: req.params.recipient },
                        { secondUser: req.session.userID, userId: req.params.recipient }
                    ],
                },
                limit: 100,
                order: [["createdAt", "DESC"]],
                include: [
                    { model: db.User, attributes: ["username", "firstname", "lastname", "pushToken", "pushEnabled"] },
                    { model: db.User, as: "recipient", attributes: ["username", "firstname", "lastname", "pushToken", "pushEnabled"] }
                ]
            })
                .then(function (results) {
                    res.json(results);
                })
                .catch(err => console.log(err));
        } else {
            res.sendStatus(404)
        }
    });

    // updates unread messages to read
    app.put("/api/messages/read/:id", function (req, res) {
        if (req.session.loggedin) {
            db.Messages.update(
                {
                    read: true
                },
                {
                    where: {
                        UserId: req.params.id,
                        secondUser: req.session.userID,
                        read: false
                    }
                }
            ).then(function (result) {
                console.log("messages updated")
            })
                .catch(err => console.log(err))
        } else {
            res.status(400).end();
        }
    });

    app.get("/api/notifications", function (req, res) {
        if (req.session.loggedin) {
            const messageNotifications = db.Messages.count({
                where: {
                    [Op.and]: [
                        { secondUser: req.session.userID },
                        { read: false }
                    ]
                }
            })
                .catch(err => console.log(err));;

            const matchNotifications = db.Event.count({
                where: {
                    [Op.and]: [
                        { confirmedByUser: req.session.userID },
                        { read: false },
                        { eventStatus: "propose" }
                    ]
                }
            })
                .catch(err => console.log(err));;

            Promise
                .all([messageNotifications, matchNotifications])
                .then(responses => {
                    res.json({ messages: responses[0], matches: responses[1], userid: req.session.userID });
                })
                .catch(err => console.log(err));
        }
    });

    // user can deny request from other user
    app.put("/api/event/deny", function (req, res) {
        if (req.session.loggedin) {
            db.Event.update(
                {
                    eventStatus: "denied",
                    title: "Denied by " + req.session.username
                },
                {
                    where: {
                        id: req.body.id
                    }
                }
            ).then(function (result) {
                res.send(result);
            })
        } else {
            res.status(400).end();
        }
    });

    // PASSWORD RESET ROUTES

    // CREATES TOKEN IN DB AND SENDS EMAIL
    app.post("/api/forgot-password"), async (req, res, next) => {
        const transport = nodemailer.createTransport({
            host: process.env.EMAIL_HOST,
            port: process.env.EMAIL_PORT,
            secure: false,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

        const email = await db.User.findOne({ where: { email: req.body.email } });

        if (email == null) {
            return res.json({ status: 'ok' });
        }

        await db.ResetTokens.update(
            { used: 1 },
            { where: { email: req.body.email } }
        );

        const token = crypto.randomBytes(64).toString('base64');

        const expireDate = new Date();
        expireDate.setTime(expireDate.getTime() + (1 * 60 * 60 * 1000));

        await db.ResetTokens.create({
            email: req.body.email,
            expiration: expireDate,
            token: token,
            used: 0
        });

        const message = {
            from: process.env.SENDER_ADDRESS,
            to: req.body.email,
            subject: process.env.FORGOT_PASS_SUBJECT_LINE,
            text: 'To reset your password, please click the link below.\n\nhttps://' + process.env.DOMAIN + '/reset-password/' + encodeURIComponent(token) + '/' + req.body.email
        };

        transport.sendMail(message, (err, info) => {
            if (err) { console.log(err); }
            else { console.log(info); }
        });

        return res.json({ status: 'ok' });
    };

    // CLEANS UP OLD TOKENS IN DB AND CHECKS CURRENT TOKEN FOR VALID
    app.get("/api/reset-password", async (req, res, next) => {
        await db.ResetTokens.destroy({
            where: {
                expiration: {
                    [Op.lt]: Date.now()
                }
            }
        });

        const record = await db.ResetTokens.findOne({
            where: {
                [Op.and]: [
                    { email: req.query.email },
                    {
                        expiration: {
                            [Op.gt]: Date.now()
                        }
                    },
                    { token: decodeURIComponent(req.query.token) },
                    { used: 0 }
                ]
            }
        });

        if (record == null) {
            res.status(400).send('tokenExpired');
        } else {
            res.status(200).send('showForm');
        }
    });

    // VALIDATES NEW PASSWORD, CHECKS TOKEN, AND RESETS USER PASSWORD
    app.post('/api/reset-password', (req, res) => {
        const token = decodeURIComponent(req.body.token);
        const email = req.body.email;
        const password = req.body.password;
        const passwordConfirm = req.body.passwordConfirm;

        // Add password test validations 

        if (token && email && password && passwordConfirm) {
            db.ResetTokens.findOne({
                where: {
                    [Op.and]: [
                        { email: req.query.email },
                        {
                            expiration: {
                                [Op.gt]: Date.now()
                            }
                        },
                        { token: decodeURIComponent(req.query.token) },
                        { used: 0 }
                    ]
                }
            })
                .then(results => {
                    if (results) {
                        db.ResetTokens.update(
                            { used: 1 },
                            { where: { email: req.body.email } }
                        )
                        .then(()=>{
                            var hashed_password = crypto.createHash("sha256").update(password).digest("hex");

                            db.User.update(
                                {password: hashed_password},
                                { where: { email: req.body.email }}
                            )
                            .then(result => res.json(result))
                            .catch(err => res.json(err));
                        })
                    } else {
                        res.status(400).send('tokenNotFound');
                    }
                })
        } else {
            res.status(400).send('formNotComplete');
        }
    });

    app.delete("/api/event/delete/:id", function (req, res) {
        if (req.session.loggedin) {
            db.Event.destroy({ where: { id: req.params.id } }).then(function (event) {
                res.json(event)
            })
        }
    })
    // Delete an example by id
    //   app.delete("/api/examples/:id", function(req, res) {
    //     db.Example.destroy({ where: { id: req.params.id } }).then(function(dbExample) {
    //       res.json(dbExample);
    //     });
    //   });
};