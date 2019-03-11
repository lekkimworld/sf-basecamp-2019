const path = require("path");
const express = require("express");
const session = require("express-session");
const RedisStore = require("connect-redis")(session);
const uuid = require("uuid/v4");

// create promisified redis client
const redisClient = require("./configure-redis.js");

// create expres app
const app = express();
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use(session({
    "saveUninitialized": false,
    "resave": false,
    "secret": process.env.SESSION_SECRET || uuid(),
    "store": new RedisStore({
        "client": redisClient, 
        "prefix": "session:"
    })
}));


// listen
app.listen(process.env.PORT || 8080);
