require('dotenv').config()
const express = require('express')
const router = express.Router()
const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const Users = require('../schemas/userSchema')
const Messages = require('../schemas/messageSchema')
const verifyToken = require('../utils/verify')


mongoose.connect('mongodb://localhost/socketdb')


router.get('/registration', async (req, res) => {

    res.render('registration')
})

router.post('/registration', async (req, res) => {
    const { username, password, uniqueUsername } = req.body

    try {
        const isUniqueNameExists = await Users.findOne({
            uniqueUsername: uniqueUsername
        })
    
        if(isUniqueNameExists){
            return res.json({message: "A unique username exists", color: '#ff6054'})
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

                const token = jwt.sign({id}, process.env.SECRET_KEY_JWT)

                return res.json({ token});
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
    const recipient = await Users.findOne({ _id: userId }, { username: 1, uniqueUsername: 1 })

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


router.post('/confirm-unique-username', async (req, res) => {
    try{
        const {uniqueUsername} = req.body
        const isUniqueNameExists = await Users.findOne({
            uniqueUsername: uniqueUsername
        })
    
        if(isUniqueNameExists){
            return res.json({message: "A unique username exists"})
        }

        if(!uniqueUsername){
            return res.json({message: "A unique username is required!"})
        }
    
        res.json({ok: true})
    }catch(e){
        return res.json({message: e.message})
    }
})

module.exports = router