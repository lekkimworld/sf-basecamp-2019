const session = require("express-session");
const RedisStore = require("connect-redis")(session);
const uuid = require("uuid/v4");

const DEFAULT_SESSION_TTL = 2;
const ttl = (function() {
    let hours;
    if (process.env.SESSION_TTL) {
        try {
            hours = process.env.SESSION_TTL - 0;
            console.log(`Session TTL is set to ${hours} hours`);
        } catch (err) {}
    }
    if (!hours) {
        console.log(`ERROR reading SESSION_TTL from environment (${process.env.SESSION_TTL}) - session TTL is set to default (${DEFAULT_SESSION_TTL}) hours`);
        hours = DEFAULT_SESSION_TTL;
    }
    return hours * 60 * 60;
})();
const secret = (function() {
    if (process.env.SESSION_SECRET) {
        console.log(`Using SESSION_SECRET provided by environment`);
        return process.env.SESSION_SECRET;
    } else {
        console.log(`No SESSION_SECRET found in envionment - will cause problems if more than 1 web process`);
        return uuid();
    }
})();

module.exports = (redisClient) => {
    return session({
        "saveUninitialized": false,
        "resave": false,
        "secret": secret,
        "store": new RedisStore({
            "client": redisClient,
            "prefix": "session:",
            "ttl": ttl
        })
    })
}
