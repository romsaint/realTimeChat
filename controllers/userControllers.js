require('dotenv').config()
const express = require('express')
const router = express.Router()
const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const Users = require('../schemas/userSchema')

const verifyToken = require('../utils/verify')

mongoose.connect('mongodb://localhost/socketdb')


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


module.exports = router