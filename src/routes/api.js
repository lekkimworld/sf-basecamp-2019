const express = require("express");
const router = express.Router();
const bodyParser = require("body-parser");
const websocket = require("../websocket.js");
const events = require("../configure-events.js");
const auth = require("../configure-authentication.js");

// use JSON for POST bodies
router.use(bodyParser.json());

router.get("/reload-questionnaires", auth.isLoggedIn, (req, res) => {
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

router.get("/events", auth.isLoggedIn, (req, res) => {
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