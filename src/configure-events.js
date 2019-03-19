const PubNub = require('pubnub')

const cfg = {
    "ssl": true,
    "subscribeKey": process.env.PUBNUB_SUBSCRIBE_KEY,
    "publishKey": process.env.PUBNUB_PUBLISH_KEY
}
if (!cfg.subscribeKey || !cfg.publishKey) throw Error("Missing PUBNUB_SUBSCRIBE_KEY and/or PUBNUB_PUBLISH_KEY variables in environment");
const pubnub = new PubNub(cfg);

module.exports = {
    "terminate": () => {
        pubnub.unsubscribeAll();
    },
    "subscribe": (channel, callback) => {
        const channels = Array.isArray(channel) ? channel : [channel];

        // subcribe to channel
        pubnub.addListener({
            'message': (msg) => {
                if (channels.includes(msg.channel)) callback(msg.channel, msg.message)
            }
        })
        pubnub.subscribe({
            "channels": channels
        })
    },
    "publish": (channel, msg) => {
        pubnub.publish({
            "channel": channel,
            "message": msg
        })
    }
}