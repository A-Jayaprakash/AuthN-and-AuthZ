const express = require('express');
const {getAllUsers, getUser, updateUser, deleteUser} = require('../controllers/userController')
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const updateUserSchema = require('../validators/userValidator');
const validate = require('../middleware/validate');
const router = express.Router();
const asyncHandler = require('../utils/asyncHandler');

router.get('/:id', auth, asyncHandler(getUser));
router.get('/', auth, admin, asyncHandler(getAllUsers));

router.put('/:id', auth, validate(updateUserSchema), asyncHandler(updateUser));

router.delete('/:id', auth, asyncHandler(deleteUser));

module.exports = router;