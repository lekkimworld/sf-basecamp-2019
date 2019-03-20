const express = require("express");
const router = express.Router();
const bodyParser = require("body-parser");
const passport = require("passport");

// use JSON for POST bodies
router.use(bodyParser.json());

const isLoggedIn = (req, res, next) => {
    if (req.session.user !== undefined) {
        next();
    } else {
        res.redirect("/login");
    }
} 

router.get("/events", isLoggedIn, (req, res) => {
    return res.render("admin/events", {"layout": "admin", "user": req.session.user});
})

module.exports = router;