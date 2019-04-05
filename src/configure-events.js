const url = process.env.CLOUDAMQP_URL;
if (!url) {
    console.log("Missing CLOUDAMQP_URL environtment variable - cannot start");
    return;
}
const connPromise = require('amqplib').connect(url);
const QUEUE_WRITESF = "QUEUE.WRITE-SF";
const QUEUE_ADMIN = "QUEUE.ADMIN";
const EXCHANGE_EVENTS = "EXCHANGE.EVENTS";

const queuePublish = queueName => (data) => {
    return connPromise.then(conn => {
        return conn.createChannel();
    }).then(ch => {
        return ch.assertQueue(queueName).then(() => {
            ch.sendToQueue(queueName, Buffer.from(typeof data === "object" ? JSON.stringify(data): data));
            return ch.close();
        })
    })
}
const queueSubscribe = queueName => callback => {
    connPromise.then(conn => {
        return conn.createChannel();
    }).then(ch => {
        return ch.assertQueue(queueName).then(q => {
            console.log(`queueSubscribe - binding channel to queue <${q.queue}>`)
            ch.consume(queueName, msg => {
                if (msg === null) return;
                let payload = msg.content;
                try {
                    payload = JSON.parse(payload);
                } catch (err) {}
                setImmediate(() => {
                    try {
                        callback(payload, () => {
                            ch.ack(msg);
                        });
                    } catch (err) {
                        console.log(`queueSubscribe - ERROR caught when calling back with message for queue <${queueName}>: ${err.message}`)
                    }
                })
            })
        })
    })
}
const topicPublish = exchangeName => (key, data) => {
    return connPromise.then(conn => {
        return conn.createChannel();
    }).then(ch => {
        return ch.assertExchange(exchangeName, "topic", {"durable": false}).then(() => {
            ch.publish(exchangeName, key, Buffer.from(typeof data === "object" ? JSON.stringify(data): data));
            return ch.close();
        })
    })
}
const topicSubscribe = exchangeName => (routingKey, callback) => {
    connPromise.then(conn => {
        return conn.createChannel();
    }).then(ch => {
        return ch.assertExchange(exchangeName, "topic", {"durable": false}).then(() => {
            return ch.assertQueue("", {"exclusive": true})
        }).then(q => {
            console.log(`topicSubscribe - binding channel to queue <${q.queue}>, exchange <${exchangeName}>, key <${routingKey}>`)
            ch.bindQueue(q.queue, exchangeName, routingKey);
            ch.consume(q.queue, msg => {
                if (msg === null) return;
                try {
                    callback(msg.fields.routingKey, msg.content, msg);
                } catch (err) {
                    console.log(`topicSubscribe - ERROR caught when calling back with message for exchange <${exchangeName}> and routing key <${routingKey}>: ${err.message}`)
                }
            }, {"noAck": true});
        })
    })
}

module.exports = {
    "connectionPromise": connPromise,
    "queues": {
        "writesf": {
            "publish": queuePublish(QUEUE_WRITESF),
            "subscribe": queueSubscribe(QUEUE_WRITESF)
        },
        "admin": {
            "publish": queuePublish(QUEUE_ADMIN),
            "subscribe": queueSubscribe(QUEUE_ADMIN)
        }
    },
    "topics": {
        "events": {
            "publish": topicPublish(EXCHANGE_EVENTS),
            "subscribe": topicSubscribe(EXCHANGE_EVENTS)
        }
    },
    "close": () => {
        connPromise.then(conn => {
            conn.close();
        })
    }
}
