const mongoose = require('mongoose')

const schema = new mongoose.Schema({
    chatName: {
        type: String,
        required: true
    },
    uniqueChatName: {
        type: String,
        required: true,
        unique: true
    },
    maxUsers: {
        type: Number
    },
    date_created: {
        type: Date,
        default: () => Date.now()
    },
    creator: {
        type: mongoose.Types.ObjectId,
        required: true
    },
    avatar: {
        type: String
    },
    members: {
        type: [mongoose.Types.ObjectId]
    }
})

module.exports = mongoose.model('chats', schema)