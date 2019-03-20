// load environment variables for localhost
require('dotenv').config();

const terminateListener = require("../terminate-listener.js");
const path = require("path");
const express = require("express");
const exphbs = require("express-handlebars");
const redis = require("../configure-redis.js");
const pool = require("../configure-db.js");
const events = require("../configure-events.js");
const passport = require("passport");
const OAuth2Strategy = require("passport-oauth2");

// create promisified redis client
const redisClient = redis.promisifiedClient;

// create expres app, add static content and configure sessions
const app = express();
app.use(express.static(path.join(__dirname, '..', '..', 'public')));
app.use(require("../configure-session.js")(redis.client));

// configure authentication using oauth2
app.use(passport.initialize());
passport.serializeUser(function(user, done) {
    done(null, user.username);
});
passport.deserializeUser(function(login, done) {
    done(undefined, {
        "username": login
    });
});

OAuth2Strategy.prototype.userProfile = function(accessToken, done) {
    this._oauth2.get(`https://${process.env.SF_LOGIN_URL || "login.salesforce.com"}/services/oauth2/userinfo`, accessToken, function (err, body, res) {
        if (err) { return done(new InternalOAuthError('Failed to fetch user profile', err)); }
        try {
            let json = JSON.parse(body);
            let profile = {
                "provider": "Salesforce.com",
                "username": json.preferred_username,
                "name": json.name,
                "email": json.email,
                "firstname": json.given_name,
                "lastname": json.family_name,
                "payload": json
            };
            
            done(null, profile);
        } catch(e) {
            done(e);
        }
    });
}

passport.use(new OAuth2Strategy({
        authorizationURL: `https://${process.env.SF_LOGIN_URL || "login.salesforce.com"}/services/oauth2/authorize`,
        tokenURL: `https://${process.env.SF_LOGIN_URL || "login.salesforce.com"}/services/oauth2/token`,
        clientID: process.env.SF_CLIENT_ID,
        clientSecret: process.env.SF_CLIENT_SECRET,
        callbackURL: process.env.SF_CALLBACK_URL
    },
    function(accessToken, refreshToken, profile, cb) {
        cb(undefined, profile);
    }
));

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