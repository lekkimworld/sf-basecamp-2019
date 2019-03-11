const session = require("express-session");
const RedisStore = require("connect-redis")(session);
const uuid = require("uuid/v4");

module.exports = (redisClient) => {
    return session({
        "saveUninitialized": false,
        "resave": false,
        "secret": process.env.SESSION_SECRET || uuid(),
        "store": new RedisStore({
            "client": redisClient,
            "prefix": "session:"
        })
    })
}
