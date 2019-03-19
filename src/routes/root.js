const express = require("express");
const router = express.Router();
const redisClient = require("../configure-redis.js").promisifiedClient;
const bodyParser = require("body-parser");
const queue = require("../configure-queue.js");
const events = require("../configure-events.js");

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

const getStep0 = (state, ctx, questionnaire, templateCtx, req, res) => {
    templateCtx.title = questionnaire.greetingTitle || "Greetings Trailblazer!";
    templateCtx.text = questionnaire.greetingText || `<p>
            We are so happy you decided to join us on the trail and blaze your way 
            through the treasure hunt. Before we can get 
            going you need to provide a few simple pieces of information on the next 
            screen.
        </p>`;
    return res.render("root", templateCtx);
}

const getStep1 = (state, ctx, questionnaire, templateCtx, req, res) => {
    if (req.session.nameData) templateCtx.nameData = req.session.nameData;
    return res.render("personal-info", templateCtx);
}

const getStep2 = (state, ctx, questionnaire, templateCtx, req, res) => {
    // render template using questions in sub-key as it otherwised rendered double...
    templateCtx.questions = questionnaire.questions;
    return res.render("questions", templateCtx);
}

const getStep3 = (state, ctx, questionnaire, templateCtx, req, res) => {
    // get data from session / state and create payload
    const nameData = req.session.nameData;
    const answers = state.answers;
    const payload = {
        ctx,
        nameData,
        answers
    }

    // send into queue
    queue.publish(payload);

    // delete state data for context from session
    delete req.session[ctx];

    // add text data if any
    templateCtx.title = questionnaire.confirmationTitle || "Thank You!";
    templateCtx.text = questionnaire.confirmationText || `<p>
        We received your information and we are so excited to figure out if you will 
        win the grand prize. 
    </p>
    <p>
        Thank you for playing and see you on the trail!
    </p>`;

    // return thank you page
    return res.render("final", templateCtx);
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
    } else if (payload.action === "restart") {
        step = 0;
    }
    state.step = step;

    // write to event stream
    events.publish("navigation-post", `User at session ${req.session.id} went to step ${step}`);
    
    // see if there is personal info data in the payload
    if (payload.firstname || payload.lastname || payload.email) {
        req.session.nameData = payload;
        if (req.session.nameData.email) req.session.nameData.email = req.session.nameData.email.toLowerCase(); 
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

    // get questionnaire
    return redisClient.get(`questionnaire:${ctx}`).then(data => {
        return JSON.parse(data);

    }).then(questionnaire => {
        if (step === 0) {
            // handle welcome step
            getStep0(state, ctx, questionnaire, templateCtx, req, res);
        } else if (step === 1) {
            // handle the personal info step
            getStep1(state, ctx, questionnaire, templateCtx, req, res);
        } else if (step === 2) {
            // handle go to questions step
            getStep2(state, ctx, questionnaire, templateCtx, req, res);
        } else if (step === 3) {
            // handle final step
            getStep3(state, ctx, questionnaire, templateCtx, req, res);
        } else {
            // coming here is an error
            throw Error("You went past the end of the trail - did you forget to turn? In all seriousness this shouldn't happen!");
        }

        // write to event stream
        events.publish("navigation-get", `User at session ${req.session.id} went to step ${step}`);

    }).catch(err => {
        return res.render("error", {"error": err.message});
    })
})

module.exports = router;
