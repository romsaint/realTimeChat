const express = require('express')
const app = express()
const path = require('path')
const compression = require('compression')
const jwt = require('jsonwebtoken')

const routers = require('./controllers/userControllers.js')

const http = require('http')
const server = http.createServer(app)
const { Server } = require('socket.io')
const io = new Server(server)

app.set('view engine', 'ejs')

app.use(express.static(path.join(__dirname, 'views')))
app.use(express.urlencoded({extended: true}))
app.use(express.json())
app.use(compression())

io.use((socket, next) => {
    const token = socket.handshake.auth.token
    if(!token){
        next(new Error('Auth error'))
    }
    jwt.verify(token, process.env.SECRET_KEY_JWT, (err, decoded) => {
        if(err) new Error(err.message)

        socket.user = decoded
        next()
    })
})

app.use(routers)

server.listen(5000)  // NO APP ONLY SERVER