require('dotenv').config()
const express = require('express')
const router = express.Router()
const mongoose = require('mongoose')

const bcrypt = require('bcryptjs')
const http = require('http')
const app = express()
const server = http.createServer(app)
const jwt = require('jsonwebtoken')

const Users = require('../schemas/userSchema')

const {Server} = require('socket.io')
const io = new Server(server)

mongoose.connect('mongodb://localhost/socketdb')


io.use((socket, next) => {
    const token = socket.handshake.auth.token
    console.log(token)
    next()
})

io.on('connection', socket => {
    socket.emit('p')
})

router.get('/registration', async (req, res) => {

    res.render('registration')
})

router.post('/registration', async (req, res) => {
    const { username, password } = req.body
    console.log(password)
    try{
        const hashedPassword = await bcrypt.hash(password, 10)

        const user = await Users.create({
            username,
            password: hashedPassword
        })
    
        const token = await jwt.sign({ user: user._id }, process.env.SECRET_KEY_JWT)
    
        return res.json({ ok: true, token })
    
    }catch(e){
        console.log(e)
        return res.json({ message: 'Something error...', color: '#ff6054' })
    }
})


router.get('/', async (req, res) => {
    res.render('home')
})

function verifyToken(req, res, next){
    const token = req.headers.authorization
    if (!token) {
        return res.json({ message: "Please, register!1",  color: '#f0e27c;' });
    }
    if(!token.startsWith('Bearer')){
        return res.json({ message: "Please, register!2",  color: '#f0e27c;' });
    }
    jwt.verify(token, process.env.SECRET_KEY_JWT, (err, decoded) => {
        if(err) return res.json({ message: "Please, register!3",  color: '#f0e27c;' });
        req.user = decoded.user
        next()
    })
}

module.exports = router