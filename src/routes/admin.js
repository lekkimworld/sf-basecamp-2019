const express = require("express");
const router = express.Router();
const bodyParser = require("body-parser");
const passport = require("passport");
const auth = require("../configure-authentication.js");

// use JSON for POST bodies
router.use(bodyParser.json());

router.get("/events", auth.isLoggedIn, (req, res) => {
    return res.render("admin/events", {"layout": "admin", "user": req.session.user});
})

module.exports = router;