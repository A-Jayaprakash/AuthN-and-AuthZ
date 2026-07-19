const express = require('express');
const {getAllUsers, getUser, updateUser, deleteUser} = require('../controllers/userController')
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const router = express.Router();
const asyncHandler = require('../utils/asyncHandler');

router.get('/:id', auth, asyncHandler(getUser));
router.get('/', auth, admin, asyncHandler(getAllUsers));

router.put('/:id', auth, asyncHandler(updateUser));

router.delete('/:id', auth, asyncHandler(deleteUser));

module.exports = router;