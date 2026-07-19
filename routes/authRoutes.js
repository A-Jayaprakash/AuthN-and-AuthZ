const express = require('express');
const {registerSchema, loginSchema} = require('../validators/authValidator');
const validate = require('../middleware/validate');
const router = express.Router();
const auth = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const {register, login, profile} = require('../controllers/authController');

router.post('/register', validate(registerSchema), asyncHandler(register));

router.post('/login', validate(loginSchema), asyncHandler(login));

router.get('/me', auth, asyncHandler(profile));


module.exports = router