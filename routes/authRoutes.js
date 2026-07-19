const express = require('express');

const router = express.Router();
const auth = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const {register, login, profile} = require('../controllers/authController');

router.post('/register', asyncHandler(register));

router.post('/login', asyncHandler(login));

router.get('/me', auth, asyncHandler(profile));


module.exports = router