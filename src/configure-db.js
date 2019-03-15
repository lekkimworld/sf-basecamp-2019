const {Pool} = require("pg");

// create db pool
const pool = new Pool({
    'connectionString': process.env.DATABASE_URL,
    'ssl': process.env.NODE_ENV === 'production' ? true : false
});

module.exports = pool;
