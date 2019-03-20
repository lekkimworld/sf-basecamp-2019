const express = require("express");
const router = express.Router();
const bodyParser = require("body-parser");
const websocket = require("../websocket.js");
const events = require("../configure-events.js");

// use JSON for POST bodies
router.use(bodyParser.json());

const isLoggedIn = (req, res, next) => {
    if (req.session.user !== undefined) {
        next();
    } else {
        res.redirect("/login");
    }
} 

router.get("/reload-questionnaires", isLoggedIn, (req, res) => {
    res.type("json");

    // simply post message to queue to get reload
    events.queues.admin.publish({
        "type": "cache.questionnaire",
        "action": "invalidate"
    }).then(() => {
        res.send({"status": "success"});
    }).catch(err => {
        res.status(500).send({"status": "error", "error": err.message});
    })
})

router.get("/events", isLoggedIn, (req, res) => {
    // get websockt and initialize stream
    const wsController = websocket.getInstance();
    const stream = wsController.initializeStream();

    // listen to topic and stream data to websocket
    events.topics.events.subscribe("#", (routingKey, content) => {
        stream.write({"msg": `${routingKey.toUpperCase()}: ${content}`})
    });

    // return to caller
    res.type("json");
    return res.send({"status": "success"});
})

module.exports = router;