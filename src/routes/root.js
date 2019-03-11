const express = require("express");
const router = express.Router();

router.get("/?*?", (req, res) => {
    // figure out where we are in the flow
    let step = !req.session || !req.session.step ? 0 : req.session.step;

    // get action
    const action = req.params[0];
    if (!action || action === "next") {
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
        return res.render("questions");
    }
    
    // coming here is an error
    res.render("error", {"error": "You went past the end of the trail - did you forget to turn? In all seriousness this shouldn't happen!"});
})

router.get("/q", (req, res) => {
    res.render("questions")
})

module.exports = router;
