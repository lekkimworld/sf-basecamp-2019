const express = require("express");
const router = express.Router();
const bodyParser = require("body-parser");
const websocket = require("../websocket.js");
const events = require("../configure-events.js");

// use JSON for POST bodies
router.use(bodyParser.json());

router.get("/events", (req, res) => {
    // get websockt and initialize stream
    const wsController = websocket.getInstance();
    const stream = wsController.initializeStream();

    // listen to topic and stream data to websocket
    events.subscribe(["write-salesforce", "navigation-get"], (channel, msg) => {
        stream.write({"msg": `${channel.toUpperCase()}: ${msg}`})
    });

    // return to caller
    res.type("json");
    return res.send({"status": "success"});
})

module.exports = router;