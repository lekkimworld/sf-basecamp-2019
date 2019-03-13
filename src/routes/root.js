const express = require("express");
const router = express.Router();
const redisClient = require("../configure-redis.js").promisifiedClient;

router.use((req, res, next) => {
    // ensure we have a session
    if (!req.session) {
        return next(Error('Unable to get session - probably unable to connect to Redis'));
    } else {
        return next();
    }
})

router.get("/q", (req, res) => {
    // get questionnaire
    redisClient.get("questionnaire:/").then(data => {
        return JSON.parse(data);
    }).then(questionnaire => {
        // render template using questions in sub-key as it otherwised rendered double...
        res.render("questions", questionnaire);
    })
    
    
})

router.get("/?*?", (req, res) => {
    // figure out where we are in the flow
    let step = !req.session || !req.session.step ? 0 : req.session.step;

    // get action and decide on context and action
    const parts = req.params[0].split("/");
    const ctx = parts.length >= 2 ? `/${parts[0]}` : "/";
    const action = parts.length >= 2 ? parts[1] : parts[0];

    // inspect action
    if (!action || action === "start") {
        step = 1;
    } else if (action === "next") {
        step++;
    } else if (action === "prev") {
        step--;
        if (step < 0) step = 1;
    } else if (action === "restart") {
        step = 1;
    } else {
        throw Error(`Unknown action (${action}) received...`)
    }

    // handle welcome step
    if (step === 1) {
        req.session.step = 1;
        return res.render("root");
    }

    // handle the personal info step
    if (step === 2) {
        req.session.step = 2;
        return res.render("personal-info");
    }

    // handle go to questions step
    if (step === 3) {
        req.session.step = 3;
        // get questionnaire
        return redisClient.get(`questionnaire:${ctx}`).then(data => {
            return JSON.parse(data);
        }).then(questionnaire => {
            // render template using questions in sub-key as it otherwised rendered double...
            res.render("questions", questionnaire);
        })
    }
    
    // coming here is an error
    res.render("error", {"error": "You went past the end of the trail - did you forget to turn? In all seriousness this shouldn't happen!"});
})

module.exports = router;
