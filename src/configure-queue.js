const url = process.env.CLOUDAMQP_URL;
if (!url) throw Error('Missing CLOUDAMQP_URL environtment variable');
const connPromise = require('amqplib').connect(url);
const QUEUE_NAME = "myQueue";

module.exports = {
    "connectionPromise": connPromise,
    "publish": data => {
        connPromise.then(conn => {
            return conn.createChannel();
        }).then(ch => {
            return ch.assertQueue(QUEUE_NAME).then(() => {
                ch.sendToQueue(QUEUE_NAME, Buffer.from(typeof data === "object" ? JSON.stringify(data): data));
                return ch.close();
            })
        })
    },
    "subscribe": callback => {
        connPromise.then(conn => {
            return conn.createChannel();
        }).then(ch => {
            return ch.assertQueue(QUEUE_NAME).then(() => {
                ch.consume(QUEUE_NAME, msg => {
                    if (msg === null) return;
                    setImmediate(() => {
                        callback(msg.content, () => {
                            ch.ack(msg);
                        });
                    })
                })
            })
        })
    },
    "close": () => {
        connPromise.then(conn => {
            conn.close();
        })
    }
}
