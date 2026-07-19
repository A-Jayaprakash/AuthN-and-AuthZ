const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name:{
        type: String,
        required: true
    },

    email:{
        type: String,
        required: true,
        unique: true
    },

    password:{
        type: String,
        required: true
    },

    role:{
        type: String,
        enum: ['user', 'admin'],
        default: 'user'
    },
    address:{
        street: String,
        city: String,
        state: String,
        zip: String,
        country: String
    },
    createdAt:{
        type: Date,
        default: Date.now
    },
    isActive: {
        type: Boolean, 
        default: true,
    },
    failedLoginAttempts: {
        type: Number,
        default: 0
    },
    lockUntil: {
        type: Date,
        default: null
    }
});

const User = mongoose.model('User', userSchema);

module.exports = User;