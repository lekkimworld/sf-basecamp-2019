// load environment variables for localhost
require('dotenv').config();

const terminateListener = require("../terminate-listener.js");
const path = require("path");
const express = require("express");
const exphbs = require("express-handlebars");
const redis = require("../configure-redis.js");
const queue = require("../configure-queue.js");
const pool = require("../configure-db.js");

// read data from Salesforce
require("../configure-questionnaire-cache.js")(pool);

// create promisified redis client
const redisClient = redis.promisifiedClient;

// create expres app, add static content and configure sessions
const app = express();
app.use(express.static(path.join(__dirname, '..', '..', 'public')));
app.use(require("../configure-session.js")(redis.client));

// configure handlebars for templating
app.engine("handlebars", exphbs({
    "defaultLayout": "main",
    "helpers": {
        "json": function (context) {
            return JSON.stringify(context);
        }
    }
}))
app.set('view engine', 'handlebars')

// configure routes
require("../configure-routes.js")(app);

// add error handler
app.use((err, req, res, next) => {
    return res.render("error", {"error": err.message});
})

// listen
app.listen(process.env.PORT || 8080);
console.log(`Listening on port ${process.env.PORT || 8080}`)

// setup termination listener
terminateListener(() => {
	console.log("Terminating services");
    pool.end();
    redisClient.end();
    queue.close();
	console.log("Terminated services");
});