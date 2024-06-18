const mongoose = require('mongoose')


const schema = new mongoose.Schema({
    darkMode: {
        type: Boolean,
        default: false
    },
    user: {
        type: mongoose.Types.ObjectId,
        unique: true
    }
})


module.exports = mongoose.model('siteSettings', schema)