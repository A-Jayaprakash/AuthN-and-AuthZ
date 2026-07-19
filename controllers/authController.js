const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AppError = require('../utils/AppError');

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

    const token = jwt.sign({id: user._id, role: user.role}, process.env.JWT_SECRET, {expiresIn: process.env.JWT_EXPIRE});

    res.status(201).json({
        success: true,
        token,
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

    const token = jwt.sign({id: user.id, role: user.role}, process.env.JWT_SECRET, {expiresIn: process.env.JWT_EXPIRE});

    return res.status(200).json({
        success: true,
        token, 
        user: {id: user._id, name: user.name, email: user.email, role: user.role}});

}

const profile = async(req, res) => {
        const id = req.user.id;
        const user = await User.findById(id).select('-password');
        
        if(!user) throw new AppError('User not found', 404);

        return res.status(200).json({success: true, user});
}

module.exports = {register, login, profile};