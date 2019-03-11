module.exports = (app) => {
    app.use("/", require("./routes/root.js"));
}
