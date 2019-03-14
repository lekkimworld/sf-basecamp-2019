const express = require("express");
const router = express.Router();
const redisClient = require("../configure-redis.js").promisifiedClient;
const bodyParser = require("body-parser");

/**
 * Return the context in use.
 * @param {String} req 
 */
const getContextForRequest = req => req.params[0] ? `/${req.params[0].split("/")[0]}` : "/";

const getStateForContext = (req) => {
    const ctx = getContextForRequest(req);
    if (!req.session[ctx]) req.session[ctx] = {};
    return req.session[ctx];
}

// use JSON for POST bodies
router.use(bodyParser.json());

router.use((req, res, next) => {
    // ensure we have a session
    if (!req.session) {
        return next(Error('Unable to get session - probably unable to connect to Redis'));
    } else {
        return next();
    }
})

/**
 * We use the POST route to receive data from the UI and modify 
 * the state.
 */
router.post("/?*?", (req, res) => {
    // decide on context
    const ctx = getContextForRequest(req);
    const state = getStateForContext(req);

    // get payload
    const payload = req.body;

    // figure out which step we're at and store back in session
    let step = state.step || 0;
    if (payload.action === "next") {
        step++;
    } else if (payload.action === "prev") {
        step--;
        if (step < 0) step = 1;
    }
    state.step = step;
    
    // see if there is personal info data in the payload
    if (payload.firstname || payload.lastname || payload.email) {
        req.session.nameData = payload;
    }

    // see if there are answers in the payload
    if (payload.answers) {
        state.answers = payload.answers;
    }

    // return
    res.type("json");
    res.send({
        "status": "ok"
    })
})

/**
 * We use the GET route to return the rendered UI for the user 
 * based on the state we have for the user.
 */
router.get("/?*?", (req, res) => {
    // get context and state
    const ctx = getContextForRequest(req);
    const state = getStateForContext(req);

    // figure out where we are in the flow
    let step = state.step || 0;

    const templateCtx = {
        "ctx": {
            "ctx": ctx,
            "state": state
        }
    }
    templateCtx.ctx.stringify = JSON.stringify(templateCtx.ctx);

    // handle welcome step
    if (step === 0) {
        return res.render("root", templateCtx);
    }

    // handle the personal info step
    if (step === 1) {
        if (req.session.nameData) templateCtx.nameData = req.session.nameData;
        return res.render("personal-info", templateCtx);
    }

    // handle go to questions step
    if (step === 2) {
        // get questionnaire
        return redisClient.get(`questionnaire:${ctx}`).then(data => {
            return JSON.parse(data);
        }).then(questionnaire => {
            // render template using questions in sub-key as it otherwised rendered double...
            templateCtx.questions = questionnaire.questions;
            res.render("questions", templateCtx);
        })
    }

    // handle final step
    if (step === 3) {
        // get data from session / state
        const nameData = req.session.nameData;
        const answers = state.answers;

        // send into queue
        

        // delete data from session
        delete req.session[ctx];

        // return thank you page
        return res.render("final", templateCtx);
    }
    
    // coming here is an error
    res.render("error", {"error": "You went past the end of the trail - did you forget to turn? In all seriousness this shouldn't happen!"});
})

module.exports = router;
