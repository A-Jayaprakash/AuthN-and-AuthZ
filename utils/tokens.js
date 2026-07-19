const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const generateAccessToken = (user) => {
    return jwt.sign(
        {id: user._id, role: user.role}, 
        process.env.JWT_SECRET, 
        {expiresIn: process.env.JWT_EXPIRE}
    );
}

const generateRefreshToken = (user) => {
    return jwt.sign(
        {id: user._id},
        process.env.JWT_REFRESH_SECRET,
        {expiresIn: process.env.JWT_REFRESH_EXPIRE}
    );
}

const hashToken = (token) => {
    return crypto.createHash('sha256').update(token).digest('hex');
}

const generateVerificationToken = () => {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    return {rawToken, hashedToken};
}

module.exports = {generateAccessToken, generateRefreshToken, hashToken, generateVerificationToken};
