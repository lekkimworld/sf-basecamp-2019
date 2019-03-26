// load environment variables for localhost
require('dotenv').config();

const terminateListener = require("../terminate-listener.js");
const path = require("path");
const express = require("express");
const exphbs = require("express-handlebars");
const redis = require("../configure-redis.js");
const pool = require("../configure-db.js");
const events = require("../configure-events.js");

// create promisified redis client
const redisClient = redis.promisifiedClient;

// create expres app, add static content and configure sessions
const app = express();
app.use(express.static(path.join(__dirname, '..', '..', 'public')));
app.use(require("../configure-session.js")(redis.client));

// configure authentication
require("../configure-authentication.js").initialize(app);

// configure handlebars for templating
app.engine("handlebars", exphbs({
    "defaultLayout": "questionnaire",
    "helpers": {
        "json": function (context) {
            return JSON.stringify(context);
        }
    }
}))
app.set('view engine', 'handlebars')

// send to tls is production
if(process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'qa') {
  app.use((req, res, next) => {
    if (req.header('x-forwarded-proto') !== 'https')
      res.redirect(`https://${req.header('host')}${req.url}`);
    else
      next();
  })
}

// configure routes
require("../configure-routes.js")(app);

// add error handler
app.use((err, req, res, next) => {
    return res.render("error", {"error": err.message});
})

// listen
const port = process.env.PORT || 8080;
const httpServer = require('http').createServer(app);
require("../websocket.js").createInstance(httpServer);
httpServer.listen(port);
console.log(`Listening on port ${port}`);

// setup termination listener
terminateListener(() => {
	console.log("Terminating services");
    pool.end();
    redisClient.end();
    events.close();
	console.log("Terminated services");
});
