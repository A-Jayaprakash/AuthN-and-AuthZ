const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth')
const admin = require('../middleware/admin')
const asyncHandler = require('../utils/asyncHandler');
const {getAllItems, addItem, updateItem, deleteItem, clearCart} = require('../controllers/cartController');

router.get('/', auth, asyncHandler(getAllItems));
router.post('/add', auth, asyncHandler(addItem));
router.put('/update', auth, asyncHandler(updateItem));
router.delete('/remove/:id', auth, asyncHandler(deleteItem));
router.delete('/clear', auth, asyncHandler(clearCart));

module.exports = router;