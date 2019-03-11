const {promisify} = require("util");
const redis = require("redis");

module.exports = (function() {
    const client = redis.createClient({
        'url': process.env.REDIS_URL || "redis://localhost:6379"
    });
    return {
        'get': promisify(client.get).bind(client),
        'set': promisify(client.set).bind(client),
        'setex': promisify(client.setex).bind(client),
        'keys': promisify(client.keys).bind(client),
        'mget': promisify(client.mget).bind(client),
        'expire': promisify(client.expire).bind(client),
        'on': client.on.bind(client)
    }
})();
