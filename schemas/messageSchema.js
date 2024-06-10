const mongoose = require('mongoose')

const schema = new mongoose.Schema({
    recipient: {
        type: mongoose.Types.ObjectId,
        required: true
    },
    sender: {
        type: mongoose.Types.ObjectId,
        required: true
    },
    text: {
        type: String,
        required: true
    },
    date_created: {
        type: Date,
        default: Date.now()
    }
})

module.exports = mongoose.model('messages', schema)