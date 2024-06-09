const express = require('express')
const app = express()
const path = require('path')
const compression = require('compression')
const routers = require('./controllers/userControllers.js')

app.set('view engine', 'ejs')

app.use(express.static(path.join(__dirname, 'views')))
app.use(express.urlencoded({extended: true}))
app.use(express.json())
app.use(compression())

app.use(routers)


app.listen(5000)