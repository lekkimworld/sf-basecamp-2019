module.exports = (app) => {
    app.use("/api", require("./routes/api.js"));
    app.use("/admin", require("./routes/admin.js"));
    app.use("/", require("./routes/root.js"));
}
