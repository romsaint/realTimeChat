require('dotenv').config()
const express = require('express')
const router = express.Router()
const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const Users = require('../schemas/userSchema')
const Messages = require('../schemas/messageSchema')


mongoose.connect('mongodb://localhost/socketdb')


router.get('/registration', async (req, res) => {

    res.render('registration')
})

router.post('/registration', async (req, res) => {
    const { username, password } = req.body

    try {
        const hashedPassword = await bcrypt.hash(password, 10)

        const user = await Users.create({
            username,
            password: hashedPassword
        })
        let id = user._id
        const token = await jwt.sign({ id }, process.env.SECRET_KEY_JWT)

        return res.json({ ok: true, token })

    } catch (e) {
        console.log(e)
        return res.json({ message: 'Something error...', color: '#ff6054' })
    }
})


router.get('/', async (req, res) => {
    res.render('home')
})

router.get('/users', verifyToken, async (req, res) => {
    const users = await Users.find({
        _id: {
            $ne: req.user
        }
    }).lean().exec()

    return res.json({ users })
})
router.get('/chat/:userId', async (req, res) => {
    res.render('chat')
})
router.get('/chat-data/:userId', verifyToken, async (req, res) => {
    const userId = req.params.userId
    const recipient = await Users.findOne({ _id: userId }, { username: 1 })

    const messages = await Messages.find({
        $or: [
            { recipient: userId, sender: req.user },
            { recipient: req.user, sender: userId },
        ]
    }).sort({ date_create: 1 }).lean().exec()

    return res.json({
        recipient,
        messages,
        userNow: req.user
    })
})

router.post('/send-message/:userId', verifyToken, async (req, res) => {
    const { message } = req.body
    const userId = req.params.userId

    try {
        if (message.trim()) {
            const createdMessage = await Messages.create({
                recipient: userId,
                sender: req.user,
                text: message
            })

            return res.json({
                createdAt: createdMessage.date_created,
                message,
                ok: true
            })
        }

        res.json({ok: false})
    } catch (e) {
        console.log('EEEEEEEEE')
    }


})



//     OTHER          //                //               /             //             / /   
function verifyToken(req, res, next) {

    if (!req.headers.authorization) {
        return res.json({ message: "Please, register!2", color: '#f0e27c;' });
    }
    if (!req.headers.authorization.startsWith('Bearer')) {
        return res.json({ message: "Please, register!2", color: '#f0e27c;' });
    }
    const token = req.headers.authorization.split(' ')[1];

    if (!token) {
        return res.json({ message: "Please, register!1", color: '#f0e27c;' });
    }

    jwt.verify(token, process.env.SECRET_KEY_JWT, (err, decoded) => {
        if (err) console.log(err)
        req.user = decoded.id

        next()
    })
}

module.exports = router