const express = require("express");
const router = express.Router();

router.get("/", (req, res) => {
    res.render("root")
})

router.get("/q", (req, res) => {
    res.render("questions")
})

module.exports = router;
