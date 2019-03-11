const path = require("path");
const express = require("express");
const exphbs = require("express-handlebars");
const redis = require("./configure-redis.js")

// create promisified redis client
const redisClient = redis.promisifiedClient;

// create expres app, add static content and configure sessions
const app = express();
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use(require("./configure-session.js")(redis.client));

// configure handlebars for templating
app.engine('handlebars', exphbs({defaultLayout: 'main'}))
app.set('view engine', 'handlebars')

// configure routes
require("./configure-routes.js")(app);

// listen
app.listen(process.env.PORT || 8080);
console.log(`Listening on port ${process.env.PORT || 8080}`)