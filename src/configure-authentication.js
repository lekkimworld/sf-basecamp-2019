const passport = require("passport");
const OAuth2Strategy = require("passport-oauth2");

module.exports = {
    "initialize": app => {
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
    },
    "isLoggedIn": (req, res, next) => {
        if (!process.env.SF_CALLBACK_URL) {
            console.log("THERE IS NO SF_CALLBACK_URL configured in the environment - will not use authentication");
            next();
        } else if (req.session.user !== undefined) {
            next();
        } else {
            res.redirect("/login");
        }
    }
}