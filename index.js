const express = require('express')
const app = express()

const assert = require('assert')
const { ObjectID, MongoClient } = require('mongodb')

const WebSocket = require('ws')

/***
 * Utils
 */
function timeToMinObjectId(sometypeoftime) {
    const d = new Date(sometypeoftime)
    const n = Math.floor(d.getTime() / 1000)
    const s = n.toString(16)
    return ObjectID(s.padEnd(24, '0'))
}

/***
 * MongoDB
 */
const url = `${process.env.MONGO_HOST || 'mongodb://mongodb:27017'}`
// console.log(url)
const dbname = 'mmq'
let db = null, client = null
// Interactive Message Collection
const collections = []

function getCollection(collname) {
    if (collections[collname]) {
        return collections[collname]
    }
    return collections[collname] = db.collection(collname)
}

MongoClient.connect(url, function(err, _client) {
  assert.equal(null, err)
  console.log("Connected successfully to server")
  client = _client
  db = _client.db(dbname)
})

/***
 * Http (Express) Server
 */
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.get('/*', (req, res) => {
    let {
        path,
        query
    } = req

    path = path.replace(/\//g, '')

    if ('' === path) {
        return res.sendStatus(403)
    }
    if (null === db) {
        return res.sendStatus(503)
    }

    const mongoquery = {}
    const mongolimit = parseInt(query.limit || 100, 10)
    if (query.from) {
        mongoquery._id = {
            $gt: timeToMinObjectId(query.from)
        }
    }

    getCollection(path).find(mongoquery).limit(mongolimit).toArray((err, docs) => {
        assert.equal(err, null);
        // console.log("Found the following records");
        // console.log(docs);
        res.json(docs)
    })
})

// For Stack Interactive Message
const temp = []
app.post('/*', (req, res) => {
    let {
        path,
        body
    } = req

    path = path.replace(/\//g, '')

    if (process.env.DEBUG === 'TRUE' || process.env.DEBUG === 'true') {
        console.info(req)
    }

    if ('' === path) {
        return res.sendStatus(403)
    }

    if (undefined === body || null === body) {
        return res.sendStatus(503)
    }

    wss.clients.forEach((ws) => {
        // TODO : websocket alive check
        // if (ws.isAlive === false) return ws.terminate()
        // ws.ping(() => {})
        ws.send(JSON.stringify(body))
    })

    if (body.payload && typeof body.payload === 'string') {
        try {
            body.payload = JSON.parse(body.payload)
        } catch (err) {
            console.log('Parsing body.payload failed')
        }
    }

    temp.push(body)
    if (null === db) {
        // return res.sendStatus(200)
    }

    getCollection(path).insertMany(temp, function(err, result) {
        assert.equal(err, null);
        // assert.equal(3, result.result.n);
        // assert.equal(3, result.ops.length);
        console.log(`Inserted ${result.ops.length} / ${temp.length} documents into the collection`)
        temp.splice(0, temp.length)
    })

    // return res.sendStatus(200)
})

const httpserver = app.listen(process.env.PORT || 9000)

const wss = new WebSocket.Server({
    server: httpserver,
    perMessageDeflate: {
        zlibDeflateOptions: {
          // See zlib defaults.
          chunkSize: 1024,
          memLevel: 7,
          level: 3
        },
        zlibInflateOptions: {
          chunkSize: 10 * 1024
        },
        // Other options settable:
        clientNoContextTakeover: true, // Defaults to negotiated value.
        serverNoContextTakeover: true, // Defaults to negotiated value.
        serverMaxWindowBits: 10, // Defaults to negotiated value.
        // Below options specified as default values.
        concurrencyLimit: 10, // Limits zlib concurrency for perf.
        threshold: 1024 // Size (in bytes) below which messages
        // should not be compressed.
      }
})
 
wss.on('connection', function connection(ws) {
    ws.isAlive = true
    ws.on('message', function incoming(message) {
        console.log('received: ', message)
    })
    // ws.send({ url, dbname })
})

/***
 * Process Exit Handler
 */
process.stdin.resume()//so the program will not close instantly

function exitHandler(options, exitCode) {
    if (options.cleanup) console.log('clean')
    if (exitCode || exitCode === 0) console.log(exitCode)
    if (options.exit) {
        if (temp.length > 0) {
            console.log('Must Implement Save Text Files')
        }
        if (client) {
            client.close()
        }
        process.exit()
    }
}

//do something when app is closing
process.on('exit', exitHandler.bind(null,{cleanup:true}))

//catches ctrl+c event
process.on('SIGINT', exitHandler.bind(null, {exit:true}))

// catches "kill pid" (for example: nodemon restart)
process.on('SIGUSR1', exitHandler.bind(null, {exit:true}))
process.on('SIGUSR2', exitHandler.bind(null, {exit:true}))

//catches uncaught exceptions
process.on('uncaughtException', exitHandler.bind(null, {exit:true}))