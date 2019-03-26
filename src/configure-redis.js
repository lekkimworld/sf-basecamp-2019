const {promisify} = require("util");
const redis = require("redis");

// create basic client
const client = redis.createClient({
    'url': process.env.REDIS_URL || "redis://localhost:6379"
});

// create promisified client
const promisifiedClient = (function() {
    return {
        'get': promisify(client.get).bind(client),
        'set': promisify(client.set).bind(client),
        'setex': promisify(client.setex).bind(client),
        'keys': promisify(client.keys).bind(client),
        'del': promisify(client.del).bind(client),
        'mget': promisify(client.mget).bind(client),
        'expire': promisify(client.expire).bind(client),
        'end': promisify(client.end).bind(client)
    }
})();

module.exports = {
    client, 
    promisifiedClient
}
