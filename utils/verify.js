const jwt = require('jsonwebtoken')


module.exports = function (req, res, next) {

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

