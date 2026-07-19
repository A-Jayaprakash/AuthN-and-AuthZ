const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const cookieOptions = require('../utils/cookieOptions');
const sendEmail = require('../utils/email');
const {generateAccessToken, generateRefreshToken, generateVerificationToken, hashToken} = require('../utils/tokens');

const register = async(req, res) => {
    
    const {name, email, password, address} = req.body;

    const exists = await User.findOne({email});
    if(exists) throw new AppError('User already exists', 400);

    const hashPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
        name,
        email,
        password: hashPassword,
        address
    });

    

    const {rawToken, hashedToken} = generateVerificationToken();
    user.emailVerificationTokenHash = hashedToken;
    user.emailVerificationExpires = Date.now() + 24*60*60*1000;
    await user.save();

    const verificationLink = `${process.env.CLIENT_URL}/verify-email/${rawToken}`;

    let accessToken;

    try{
        await sendEmail({
            to: user.email,
            subject: 'Verify your email',
            html: `<p> Hi ${user.name}, </p>
                    <p>Please verify your email by clicking the link below:<p>
                    <a href="${verificationLink}">${verificationLink}</a>
                    <p>This link expires in 24 hours.</p>`
        });

        accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user);
        user.refreshTokenHash = hashToken(refreshToken);
        await user.save();

        res.cookie('refreshToken', refreshToken, cookieOptions);
    } catch(err){
        await User.findByIdAndDelete(user._id);
        throw new AppError('Registration failed: Could not send verification email. Please try again', 500);
    }    

    res.status(201).json({
        success: true,
        accessToken,
        user: {id: user._id, name: user.name, email: user.email, role: user.role}
    })
}

const login = async (req, res) => {
    const {email, password} = req.body;

    const user = await User.findOne({email});

    const dummyHash = '$2b$10$CwTycUXWue0Thq9StjUM0uJ8Wf6/4uYSuS8oPlAtVs5rZ3pKF9M8y';
    const match = await bcrypt.compare(password, user? user.password : dummyHash);

    if(!user) throw new AppError('Invalid email or password' , 401);

    if(!user.isActive) throw new AppError('User account deactivated', 403);

    if(!user.emailVerified) throw new AppError('Please verify your email before logging in', 403);

    if(user.lockUntil && user.lockUntil > Date.now()){
        throw new AppError('Account temporarily locked due to multiple failed login attempts. Try again later.', 403);
    }

    if(!match) {
        user.failedLoginAttempts += 1;
        if(user.failedLoginAttempts >= 5){
            user.lockUntil = Date.now() + 15*60*1000;
            user.failedLoginAttempts = 0;
        }
        await user.save();
        throw new AppError('Invalid email or password', 401);
    }

    if(user.failedLoginAttempts > 0 || user.lockUntil){
        user.failedLoginAttempts = 0;
        user.lockUntil = null;
        await user.save();
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    user.refreshTokenHash = hashToken(refreshToken);
    await user.save();

    res.cookie('refreshToken', refreshToken, cookieOptions);

    return res.status(200).json({
        success: true,
        accessToken, 
        user: {id: user._id, name: user.name, email: user.email, role: user.role}});

}

const profile = async(req, res) => {
        const id = req.user.id;
        const user = await User.findById(id).select('-password');
        
        if(!user) throw new AppError('User not found', 404);

        return res.status(200).json({success: true, user});
}

const refresh = async(req, res) => {
    const incomingToken = req.cookies.refreshToken;
    if(!incomingToken) throw new AppError('No refresh token provided', 401);

    let decoded;
    try{
        decoded = jwt.verify(incomingToken, process.env.JWT_REFRESH_SECRET);
    } 
    catch(err){
        throw new AppError('Invalid or expired refresh token', 401);
    }

    const user = await User.findById(decoded.id);
    if(!user || !user.refreshTokenHash) throw new AppError('Invalid refresh token', 401);

    const incomingHash = hashToken(incomingToken);
    if(incomingHash !== user.refreshTokenHash) {
        throw new AppError('Invalid refresh token', 401);
    }

    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);

    user.refreshTokenHash = hashToken(newRefreshToken);
    await user.save();

    res.cookie('refreshToken', newRefreshToken, cookieOptions);

    res.status(200).json({success: true, accessToken: newAccessToken});
}

const logout = async(req, res) => {
    const incomingToken = req.cookies.refreshToken;

    if(incomingToken) {
        try{
            const decoded = jwt.verify(incomingToken, process.env.JWT_REFRESH_SECRET);
            await User.findByIdAndUpdate(decoded.id, {refreshTokenHash: null});
        }   
        catch(err){

        }
    }

    res.clearCookie('refreshToken', {path: '/api/auth'});
    res.status(200).json({success: true, message: 'Logged out successfully'});
}


const verifyEmail = async(req, res) => {
    const {token} = req.params;
    const hashedToken = hashToken(token);

    const user = await User.findOne({
        emailVerificationTokenHash: hashedToken,
        emailVerificationExpires: {$gt: Date.now()}
    });

    if(!user){
        throw new AppError('Invalid or expired verification link', 400);
    }

    user.emailVerified = true;
    user.emailVerificationTokenHash = null;
    user.emailVerificationExpires = null;
    await user.save();

    res.status(200).json({success: true, message: 'Email verified successfully. You can login'});
}


const resendVerification = async (req, res) => {
    const { email } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
        return res.status(200).json({ success: true, message: 'If that email is registered, a verification link has been sent.' });
    }

    if (user.emailVerified) {
        throw new AppError('This email is already verified', 400);
    }

    const { rawToken, hashedToken } = generateVerificationToken();
    user.emailVerificationTokenHash = hashedToken;
    user.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000;
    await user.save();

    const verificationLink = `${process.env.CLIENT_URL}/verify-email/${rawToken}`;

    await sendEmail({
        to: user.email,
        subject: 'Verify your email',
        html: `<p>Hi ${user.name},</p>
               <p>Here's your new verification link:</p>
               <a href="${verificationLink}">${verificationLink}</a>
               <p>This link expires in 24 hours.</p>`
    });

    res.status(200).json({ success: true, message: 'Verification email sent.' });
};

module.exports = {register, login, profile, refresh, logout, verifyEmail, resendVerification};