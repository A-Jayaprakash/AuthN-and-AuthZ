const express = require('express');
const {getAllCategories, getCategory, createCategory, updateCategory, deleteCategory} = require('../controllers/categoryController');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const asyncHandler = require('../utils/asyncHandler');
const router = express.Router();

router.get('/:id', asyncHandler(getCategory));
router.get('/', asyncHandler(getAllCategories));


router.post('/', auth, admin, asyncHandler(createCategory));

router.put('/:id', auth, admin, asyncHandler(updateCategory));

router.delete('/:id', auth, admin, asyncHandler(deleteCategory));

module.exports = router;