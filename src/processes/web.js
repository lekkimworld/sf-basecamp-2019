// load environment variables for localhost
require('dotenv').config();

const terminateListener = require("../terminate-listener.js");
const path = require("path");
const express = require("express");
const Handlebars = require("handlebars");
const exphbs = require("express-handlebars");
const pool = require("../configure-db.js");
const events = require("../configure-events.js");
const redis = process.env.REDIS_URL ? require("../configure-redis.js") : undefined;

// create expres app, add static content and configure sessions
const app = express();
app.use(express.static(path.join(__dirname, '..', '..', 'public')));

// configure sessions
if (!redis) {
  console.log("No REDIS_URL found in environment - cannot configure sessions...");
} else {
  app.use(require("../configure-session.js")(redis.client));
}

// configure authentication
if (!process.env.SF_CLIENT_ID || !process.env.SF_CLIENT_SECRET) {
  console.log("No SF_CLIENT_ID or SF_CLIENT_SECRET found in environment - cannot configure auth...");
} else {
  require("../configure-authentication.js").initialize(app);
}

// configure handlebars for templating
app.engine("handlebars", exphbs({
    "defaultLayout": "questionnaire"
}))
Handlebars.registerHelper("inputText", (id, value, placeholder) => {
  let disabled = process.env.NODE_ENV === "demo" ? true : false;
  return `<input type="text" ${disabled ? "disabled=\"disabled\" readonly=\"readonly\"": ""} value="${value ? value : ""}" id="${id}" placeholder="${placeholder}" autocomplete="new-password" autocorrect="off" autocapitalize="on" spellcheck="false" class="m-top--small"></input>`;
})
Handlebars.registerHelper("inputCheckbox", (id, value) => {
  let disabled = process.env.NODE_ENV === "demo" ? true : false;
  return `<input type="checkbox" id="${id}" name="${id}" ${disabled ? "disabled=\"disabled\" readonly=\"readonly\"": ""} ${value ? "checked" : ""}>`
})
app.set('view engine', 'handlebars')

// send to tls is production
if(process.env.ENFORCE_TLS) {
  app.use((req, res, next) => {
    if (req.header('x-forwarded-proto') !== 'https')
      res.redirect(`https://${req.header('host')}${req.url}`);
    else
      next();
  })
}

// if not configuration yet show simple page
app.use((req, res, next) => {
  if (!process.env.CLOUDAMQP_URL || !process.env.REDIS_URL) {
    // no real configuration
    res.type("text");
    res.send("Unable to find any of the required settings in the environment - will not start...");
  } else {
    next();
  }
})

// configure routes
if (redis) require("../configure-routes.js")(app);

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
  if (redis) redis.promisifiedClient.end();
  if (events && events.close) events.close();
	console.log("Terminated services");
});