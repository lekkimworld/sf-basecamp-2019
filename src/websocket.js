const {Writable} = require('stream')
const StreamCache = require('stream-cache');
const WebSocket = require('ws')
const uuid = require('uuid/v1')

const WebSocketController = function(http) {
    // create server
    this.wss = new WebSocket.Server({
        'server': http
    })
    this.wss.on('connection', (ws, req) => {
        // set up keep alive
        console.log("Created websocket connection");
        ws.isAlive = true
        ws.isClosed = false
        ws.on('pong', () => {
            ws.isAlive = true
        })
        ws.on('message', (message) => {
            // received message - see if it contains channelId
            try {
                console.log(`Received websocket message ${message}`)
                
            } catch (e) {
                console.log(e)
            }
        })
        ws.on('close', () => {
            ws.isClosed = true
        })

        // create a writable stream and pipe build messages into stream
        let output = new Writable({
            'objectMode': true, 
            'write': (msg, encoding, done) => {
                if (ws.isClosed || !ws.isAlive) return done()
                if (!msg) {
                    // no message - we are done - close websocket
                    done(undefined, undefined)
                    ws.close()
                } else {
                    // send message to websocket
                    ws.send(JSON.stringify(msg))
                    done()
                }
            }
        })
        this.wrapper.stream.pipe(output);
    })

    // check whether connections are alive for cleanup
    global.setInterval(() => {
        this.wss.clients.forEach((ws) => {
            if (!ws.isAlive) return ws.terminate()
            ws.isAlive = false
            ws.ping(null, false, true)
        });
    }, 10000);
}
WebSocketController.prototype.initializeStream = function(buildId) {
    // prepare a message stream
    let stream = new StreamCache();
    this.wrapper = {
        'stream': stream
    }

    // listen for messages and write to stream
    return stream
}

// shared instance
let instance

/**
 * Create a websocket instance for the application in general. This 
 * method takes a HttpServer instance from node that we can attach 
 * the websocket to.
 * 
 * @param {*} http 
 */
module.exports.createInstance = (http) => {
    instance = new WebSocketController(http);
}

/**
 * Return the instance. This is used when we are building to get the websocket 
 * instance to configure it.
 */
module.exports.getInstance = () => {
    return instance;
}
