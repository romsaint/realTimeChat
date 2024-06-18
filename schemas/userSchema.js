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
    },
    avatar: {
        type: String,
        required: false
    },
    date_created: {
        type: Date,
        default: () => Date.now()
    }
}) 


module.exports = mongoose.model('user', schema)