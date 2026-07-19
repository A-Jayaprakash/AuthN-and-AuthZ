const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const {createProductSchema, updateProductSchema} = require('../validators/productValidator');
const validate = require('../middleware/validate');
const {getAllProducts, getProduct, createProduct, updateProduct, deleteProduct} = require('../controllers/productController');
const asyncHandler = require('../utils/asyncHandler');


router.get('/', asyncHandler(getAllProducts));
router.get('/:id', asyncHandler(getProduct));

router.post('/', auth, admin, validate(createProductSchema), asyncHandler(createProduct));

router.put('/:id', auth, admin, validate(updateProductSchema), asyncHandler(updateProduct));

router.delete('/:id', auth, admin, asyncHandler(deleteProduct));

module.exports = router;