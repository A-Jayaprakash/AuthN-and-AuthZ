const jwt = require('jsonwebtoken');

const auth = (req, res, next) => {
    const authHeader = req.headers.authorization;

    //If authHeader is completely missing, or the token is malformed
    if(!authHeader || !authHeader.startsWith('Bearer ')){
        return res.status(401).json({success: false, message: 'No token provided'});
    }

    //Getting the token alone
    const token = authHeader.split(' ')[1];

    //Try-Catch exception
    try{
        const decoded_token = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded_token;
        next();
    }
    catch(err){
        return res.status(401).json({success: false, message: 'Invalid or expired token'});
    }
};

module.exports = auth;