const express = require('express');
const {registerSchema, loginSchema} = require('../validators/authValidator');
const validate = require('../middleware/validate');
const router = express.Router();
const auth = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const {register, login, profile, refresh, logout, verifyEmail, resendVerification} = require('../controllers/authController');
const {registerLimiter, loginLimiter} = require('../middleware/rateLimiter');

router.post('/register', registerLimiter, validate(registerSchema), asyncHandler(register));
router.post('/login', loginLimiter, validate(loginSchema), asyncHandler(login));

router.get('/me', auth, asyncHandler(profile));
router.get('/verify-email/:token', asyncHandler(verifyEmail));


router.post('/refresh', asyncHandler(refresh));
router.post('/logout', asyncHandler(logout));
router.post('/resend-verification', registerLimiter, asyncHandler(resendVerification));

module.exports = router