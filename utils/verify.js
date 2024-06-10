function verifyToken(req, res, next){
    const token = req.headers.authorization
    console.log(req.headers)
    if (!token) {
        return res.json({ message: "Please, register!1",  color: '#f0e27c;' });
    }
    if(!token.startsWith('Bearer')){
        return res.json({ message: "Please, register!2",  color: '#f0e27c;' });
    }
    jwt.verify(token, process.env.SECRET_KEY_JWT, (err, decoded) => {
        if(err) return res.json({ message: "Please, register!3",  color: '#f0e27c;' });
        req.user = decoded.user
        next()
    })
}

module.exports = verifyToken