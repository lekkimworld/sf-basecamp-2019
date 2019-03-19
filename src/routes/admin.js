const express = require("express");
const router = express.Router();
const bodyParser = require("body-parser");

// use JSON for POST bodies
router.use(bodyParser.json());

router.get("/events", (req, res) => {
    return res.render("admin/events", {"layout": "admin"});
})

module.exports = router;