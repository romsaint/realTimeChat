require('dotenv').config()
const express = require('express')
const router = express.Router()
const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const NodeCache = require('node-cache')

const Users = require('../schemas/userSchema')
const Messages = require('../schemas/messageSchema')

const verifyToken = require('../utils/verify')
const { ObjectId } = require('mongoose').Types


mongoose.connect('mongodb://localhost/socketdb')

const cache = new NodeCache()


router.get('/registration', async (req, res) => {

    res.render('registration')
})

router.post('/registration', async (req, res) => {
    const { username, password, uniqueUsername } = req.body

    try {
        const isUniqueNameExists = await Users.findOne({
            uniqueUsername: uniqueUsername
        })

        if (isUniqueNameExists) {
            return res.json({ message: "A unique username exists", color: '#ff6054' })
        }

        const hashedPassword = await bcrypt.hash(password, 10)

        const user = await Users.create({
            username,
            password: hashedPassword,
            uniqueUsername
        })
        let id = user._id
        const token = await jwt.sign({ id }, process.env.SECRET_KEY_JWT)

        return res.json({ ok: true, token })

    } catch (e) {
        console.log(e)
        return res.json({ message: 'Something error...', color: '#ff6054' })
    }
})
router.get('/login', async (req, res) => {
    res.render('login')
})
router.post('/login', async (req, res) => {
    try {
        const { password, uniqueUsername } = req.body

        const findUser = await Users.findOne({ uniqueUsername }).lean().exec()

        if (findUser) {
            const hashPassword = findUser.password

            const isPasswordMatch = await bcrypt.compare(password, hashPassword)
            if (isPasswordMatch) {
                const id = findUser._id

                const token = jwt.sign({ id }, process.env.SECRET_KEY_JWT)

                return res.json({ token });
            }

            return res.json({ color: '#ff6054', message: "Password didn't match!" });
        }

        return res.json({ color: '#ff6054', message: "User does not exists!" });

    } catch (e) {
        return res.json({ color: '#ff6054', message: e.message });
    }
})



router.get('/', async (req, res) => {
    res.render('home')
})

router.get('/acquaintances', verifyToken, async (req, res) => {
    const messagesDirty = await Messages.find({}, {recipient: 1, sender: 1}).lean().exec();

    let messagesDirtySet = new Set(messagesDirty)

    let messagesArr = Array.from(messagesDirtySet)

    const messagesSet = new Set();

    for (let message of messagesArr) {
        const senderId = new mongoose.Types.ObjectId(message.sender);
        const recipientId = new mongoose.Types.ObjectId(message.recipient);

        if (senderId.equals(new mongoose.Types.ObjectId(req.user))) {
            messagesSet.add(recipientId);
        }
        if (recipientId.equals(new mongoose.Types.ObjectId(req.user))) {
            messagesSet.add(senderId);
        }
    }

    const messages = Array.from(messagesSet);

    const users = await Users.find({
        $and: [
            { _id: { $ne: req.user } },
            { _id: { $in: messages } }
        ]
    }).lean().exec();

    return res.json({ users });
});


/* 
router.get('/acquaintances', verifyToken, async (req, res) => {
    const messagesDirty = await Messages.find().lean().exec();

    const messagesSet = new Set();

    for (let message of messagesDirty) {
        const senderId = new mongoose.Types.ObjectId(message.sender);
        const recipientId = new mongoose.Types.ObjectId(message.recipient);

        if (senderId.equals(new mongoose.Types.ObjectId(req.user))) {
            messagesSet.add(recipientId);
        }
        if (recipientId.equals(new mongoose.Types.ObjectId(req.user))) {
            messagesSet.add(senderId);
        }
    }

    const messages = Array.from(messagesSet);

    const users = await Users.find({
        $and: [
            { _id: { $ne: req.user } },
            { _id: { $in: messages } }
        ]
    }).lean().exec();
    
    return res.json({ users });
});*/

router.get('/chat/:userId', async (req, res) => {
    res.render('chat')
})

router.get('/chat-data/:userId', verifyToken, async (req, res) => {
    const userId = req.params.userId
    const cacheKey = `messeges_${userId}-${req.user}`
    try{
        if(cache.get(cacheKey)){
            const {recipient, messages, userNow} = cache.get(cacheKey)
    
            return res.json({
                recipient,
                messages,
                userNow
            })
        }
    
        const recipient = await Users.findOne({ _id: userId }, { username: 1, uniqueUsername: 1 })
    
        const messages = await Messages.find({
            $or: [
                { recipient: userId, sender: req.user },
                { recipient: req.user, sender: userId },
            ]
        }).sort({ date_create: 1 }).lean().exec()
    
        cache.set(cacheKey, {
            recipient,
            messages,
            userNow: req.user
        })
    
        return res.json({
            recipient,
            messages,
            userNow: req.user
        })
    }catch(e){
        console.log(e.message)
    }
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
            
            const cacheKey = `messeges_${userId}-${req.user}`
            
            if(cache.get(cacheKey)){
                const recipient = await Users.findOne({ _id: userId }, { username: 1, uniqueUsername: 1 })

                const cacheData = cache.get(cacheKey).messages.concat([createdMessage])
  
                cache.set(cacheKey, {messages: cacheData, recipient, userNow: req.user })
            }

            return res.json({
                createdAt: createdMessage.date_created,
                message,
                ok: true
            })
        }

        res.json({ ok: false })
    } catch (e) {
        console.log(e.message)
    }
})


router.post('/confirm-unique-username', async (req, res) => {
    try {
        const { uniqueUsername } = req.body
        const isUniqueNameExists = await Users.findOne({
            uniqueUsername: uniqueUsername
        }).lean()

        if (isUniqueNameExists) {
            return res.json({ message: "A unique username exists" })
        }

        if (!uniqueUsername) {
            return res.json({ message: "A unique username is required!" })
        }

        res.json({ ok: true })
    } catch (e) {
        return res.json({ message: e.message })
    }
})

router.post('/search-users', verifyToken, async (req, res) => {
    const { query } = req.body

    if (!query.trim()) {
        const messagesDirty = await Messages.find().lean().exec();

        const messagesSet = new Set();

        for (let message of messagesDirty) {
            const senderId = new mongoose.Types.ObjectId(message.sender);
            const recipientId = new mongoose.Types.ObjectId(message.recipient);

            if (senderId.equals(new mongoose.Types.ObjectId(req.user))) {
                messagesSet.add(recipientId);
            }
            if (recipientId.equals(new mongoose.Types.ObjectId(req.user))) {
                messagesSet.add(senderId);
            }
        }

        const messages = Array.from(messagesSet);

        const users = await Users.find({
            $and: [
                { _id: { $ne: req.user } },
                { _id: { $in: messages } }
            ]
        }).lean().exec();

        return res.json({ users });
    }

    const users = await Users.find({
        $and: [
            { uniqueUsername: new RegExp(`^${query}`) },
            {
                _id: {
                    $ne: req.user
                }
            }
        ]
    }, { username: 1 }).lean().exec()

    return res.json({ users })
})



module.exports = router