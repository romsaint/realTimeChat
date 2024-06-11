const mongoose = require('mongoose')

const schema = new mongoose.Schema({
    username: {
        type: String,
        required: true
    },
    password: {
        type: String,
        required: true
    },
    uniqueUsername: {
        type: String,
        required: true,
        unique: true
    }
}) 

module.exports = mongoose.model('user', schema)